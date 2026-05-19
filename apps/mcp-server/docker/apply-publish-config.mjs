#!/usr/bin/env node
// Apply each workspace package's `publishConfig` overrides in place — i.e. do
// what `npm publish` / `pnpm pack` would have done, but inside a `pnpm deploy`
// output tree.
//
// Why this exists: `pnpm deploy` deliberately does not apply `publishConfig`,
// so deployed `node_modules/.../package.json` files still expose the
// source-time `exports` (typically `./src/index.ts`). Node then refuses to
// type-strip TypeScript files under `node_modules` and the runtime fails.
// Tracking issue: https://github.com/pnpm/pnpm/issues/6693 (PR #7647 still
// draft as of 2026-05). Delete this script when that ships.
//
// Usage:
//   node apply-publish-config.mjs <node_modules-dir>

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const target = process.argv[2];
if (!target) {
  process.stderr.write('usage: apply-publish-config.mjs <node_modules-dir>\n');
  process.exit(2);
}

let rewritten = 0;

function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      visit(full);
      continue;
    }
    if (entry.name !== 'package.json') continue;
    const pkg = JSON.parse(readFileSync(full, 'utf8'));
    if (!pkg.publishConfig) continue;
    Object.assign(pkg, pkg.publishConfig);
    delete pkg.publishConfig;
    writeFileSync(full, JSON.stringify(pkg, null, 2));
    rewritten += 1;
  }
}

visit(target);
process.stdout.write(
  `apply-publish-config: rewrote ${rewritten} package.json file(s)\n`,
);
