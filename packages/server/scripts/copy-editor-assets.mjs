import { cp, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(packageRoot, '..', '..');
// `dist-bundled/` is produced by `apps/editor build:bundled` — admin-only
// SPA, no marketing top page, with admin-flavored index.html.
const source = resolve(repoRoot, 'apps', 'editor', 'dist-bundled');
const target = resolve(packageRoot, 'editor-dist');

// Skip files that have no purpose inside the admin SPA bundled with the
// server package:
//   - wrangler.json: defense in depth; the bundled flavor disables the
//     Cloudflare Vite plugin so it shouldn't appear, but a future build
//     tool dropping artifacts here shouldn't silently leak into the package.
//   - og-image.*: only referenced by the leverie.dev marketing meta tags,
//     which the bundled flavor strips from index.html.
const EXCLUDE = new Set(['wrangler.json', 'og-image.png', 'og-image.svg']);

await rm(target, { recursive: true, force: true });
await cp(source, target, {
  recursive: true,
  filter: (src) => !EXCLUDE.has(basename(src)),
});
