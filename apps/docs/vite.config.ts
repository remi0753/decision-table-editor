import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/docs/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Emit to dist/docs/ so the on-disk layout matches the /docs/* URL space.
    // The Cloudflare Worker serves assets from ./dist; with this outDir,
    // a request for /docs/foo maps to ./dist/docs/foo without prefix rewriting.
    outDir: 'dist/docs',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
