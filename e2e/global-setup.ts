import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(e2eDir, '..');

function run(command: string, args: string[]) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

export default async function globalSetup() {
  const envFile = path.resolve(repoRoot, 'apps/api/.dev.vars');
  if (!existsSync(envFile)) {
    writeFileSync(
      envFile,
      [
        'DATABASE_URL="postgres://dev:dev@localhost:5432/leverie_dev"',
        'BETTER_AUTH_SECRET="leverie-local-e2e-secret-at-least-32-bytes"',
        'BETTER_AUTH_URL="http://localhost:8787"',
        'CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"',
        'GOOGLE_CLIENT_ID=""',
        'GOOGLE_CLIENT_SECRET=""',
        'RESEND_API_KEY=""',
        'EMAIL_FROM="LEVERIE <auth@leverie.dev>"',
        '',
      ].join('\n'),
    );
  }

  run('pnpm', ['--dir', 'apps/api', 'db:up']);
  run('pnpm', ['--dir', 'apps/api', 'db:migrate']);
}
