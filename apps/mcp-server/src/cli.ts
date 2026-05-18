#!/usr/bin/env node
import { HELP_TEXT, parseArgs } from './args.js';
import { serve } from './serve.js';
import { PACKAGE_VERSION } from './version.js';

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  switch (parsed.kind) {
    case 'help':
      process.stdout.write(HELP_TEXT);
      return;
    case 'version':
      process.stdout.write(`${PACKAGE_VERSION}\n`);
      return;
    case 'error':
      process.stderr.write(`${parsed.message}\n\n${HELP_TEXT}`);
      process.exit(2);
      return;
    case 'serve':
      await serve({
        filePath: parsed.filePath as string,
        strict: parsed.strict,
      });
      return;
  }
}

main().catch((err) => {
  process.stderr.write(
    `[leverie-mcp] error: ${(err as Error).message ?? String(err)}\n`,
  );
  process.exit(1);
});
