import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Rewrites index.html for the `bundled` flavor: strips marketing-only meta
// tags (canonical, OG, Twitter card) and replaces the public-facing title +
// description with admin-tool wording. The cloud build is left untouched.
function flavorHtml(flavor: string): Plugin {
  return {
    name: 'leverie:flavor-html',
    enforce: 'pre',
    transformIndexHtml(html) {
      if (flavor !== 'bundled') return html;
      return html
        .replace(/<title>[^<]*<\/title>/, '<title>LEVERIE Admin</title>')
        .replace(
          /<meta\s+name="description"[^>]*>/,
          '<meta name="description" content="LEVERIE administration console." />',
        )
        .replace(/<link\s+rel="canonical"[^>]*>\s*/g, '')
        .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/g, '')
        .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/g, '');
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    flavorHtml(mode),
    // Only emit the Cloudflare Worker bundle for the public cloud build.
    // The bundled flavor is meant to be served by @leverie/server, so the
    // wrangler/worker artifacts are noise there.
    command === 'build' && mode !== 'bundled' && cloudflare(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Proxy the docs site (its own Vite dev server on :5174, served under
      // the /docs/ base) so the header's Docs link resolves in development,
      // mirroring production where @leverie/server serves /docs/* itself.
      '/docs': {
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}));
