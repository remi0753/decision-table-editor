#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { checkDatabaseHealth } from './db/client.js';
import { createLeverieServer, type Env } from './index.js';
import { runMigrations } from './migrate.js';

type CliOptions = {
  host: string;
  port: number;
  basePath: string;
  editorDir: string;
};

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

async function runMigrateCommand(argv: string[]) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      `Usage: leverie-server migrate\n\n` +
        `Applies every pending Drizzle migration against DATABASE_URL.\n` +
        `Required env: DATABASE_URL (postgres:// connection string).`,
    );
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'leverie-server migrate: DATABASE_URL environment variable is required.',
    );
    process.exit(1);
  }
  console.log('Applying migrations…');
  await runMigrations({ databaseUrl });
  console.log('Migrations complete.');
}

function parseArgs(argv: string[]): CliOptions {
  const distDir = resolve(
    fileURLToPath(new URL('..', import.meta.url)),
    '..',
    'editor-dist',
  );
  const options: CliOptions = {
    host: '127.0.0.1',
    port: 8787,
    basePath: '/',
    editorDir: distDir,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--host' && next) {
      options.host = next;
      index += 1;
    } else if (arg === '--port' && next) {
      options.port = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === '--base-path' && next) {
      options.basePath = next;
      index += 1;
    } else if (arg === '--editor-dir' && next) {
      options.editorDir = resolve(next);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        `Usage:\n` +
          `  leverie-server [--host 127.0.0.1] [--port 8787] [--base-path /] [--editor-dir ./dist]\n` +
          `  leverie-server migrate           Apply pending DB migrations (uses $DATABASE_URL)`,
      );
      process.exit(0);
    }
  }

  if (!Number.isFinite(options.port) || options.port <= 0) {
    throw new Error('Expected --port to be a positive integer.');
  }

  return options;
}

function buildEnv(options: CliOptions): Env {
  const origin = `http://${options.host}:${options.port}`;
  const basePath = options.basePath === '/' ? '' : options.basePath;
  return {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://localhost/leverie',
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me',
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? `${origin}${basePath}`,
    HMAC_KEY_RING_JSON: process.env.HMAC_KEY_RING_JSON,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
}

function safeAssetPath(root: string, path: string) {
  const relative = normalize(path.replace(/^\/+/, ''));
  const resolved = resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    return null;
  }
  return resolved;
}

async function serveAsset(root: string, assetPath: string) {
  const filePath = safeAssetPath(root, assetPath);
  if (!filePath) return null;

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) return null;

  const headers = new Headers({
    'Content-Type':
      contentTypes[extname(filePath)] ?? 'application/octet-stream',
    'Content-Length': String(fileStat.size),
  });

  if (assetPath === '/index.html') {
    headers.set('Cache-Control', 'no-cache');
    return new Response(await readFile(filePath), { headers });
  }

  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(createReadStream(filePath) as unknown as BodyInit, {
    headers,
  });
}

async function toFetchRequest(
  request: import('node:http').IncomingMessage,
  host: string,
  port: number,
) {
  const headers = new Headers();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index];
    const value = request.rawHeaders[index + 1];
    if (name && value) headers.append(name, value);
  }

  const url = `http://${request.headers.host ?? `${host}:${port}`}${
    request.url ?? '/'
  }`;
  const method = request.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(url, {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(request) as BodyInit) : undefined,
    duplex: hasBody ? 'half' : undefined,
  } as RequestInit);
}

const [subcommand, ...subcommandArgs] = process.argv.slice(2);

if (subcommand === 'migrate') {
  await runMigrateCommand(subcommandArgs).catch((error) => {
    console.error(error);
    process.exit(1);
  });
  process.exit(0);
}

const options = parseArgs(process.argv.slice(2));
const app = createLeverieServer({
  basePath: options.basePath,
  editor: {
    enabled: true,
    assets: (path) => serveAsset(options.editorDir, path),
  },
});
const env = buildEnv(options);

console.log('Checking database connectivity...');
await checkDatabaseHealth(env.DATABASE_URL).catch((error) => {
  console.error('Database health check failed. Server startup aborted.');
  console.error(error);
  process.exit(1);
});

createServer(async (request, response) => {
  try {
    const fetchRequest = await toFetchRequest(
      request,
      options.host,
      options.port,
    );
    const fetchResponse = await app.fetch(fetchRequest, env);
    response.statusCode = fetchResponse.status;
    fetchResponse.headers.forEach((value, key) => {
      response.setHeader(key, value);
    });
    response.end(Buffer.from(await fetchResponse.arrayBuffer()));
  } catch (error) {
    console.error(error);
    response.statusCode = 500;
    response.end('Internal Server Error');
  }
}).listen(options.port, options.host, () => {
  console.log(
    `LEVERIE server listening on http://${options.host}:${options.port}${options.basePath === '/' ? '' : options.basePath}`,
  );
});
