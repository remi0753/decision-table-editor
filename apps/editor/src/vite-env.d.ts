/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // 'cloud' (default) ships the marketing top page + leverie.dev metadata.
  // 'bundled' is the @leverie/server admin-only build: no top page, redirects
  // `/` to `/edit`, strips marketing meta tags from index.html.
  readonly VITE_FLAVOR?: 'cloud' | 'bundled';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
