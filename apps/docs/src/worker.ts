// Worker entry for the LEVERIE docs site.
//
// Static assets live under ./dist/docs/ (see vite.config.ts), and the Worker
// is bound to leverie.dev/docs and leverie.dev/docs/* in wrangler.jsonc.
// This script handles two concerns Workers Assets cannot do alone:
//
// 1. /docs and /docs/ → /docs/introduction (so the bare entry URL lands on a
//    real page instead of a 404 or a flash of the SPA boot).
// 2. SPA fallback within /docs/*: if the requested file is not in assets,
//    serve dist/docs/index.html so the React router can take over.
//    `not_found_handling: "single-page-application"` would serve dist/index.html
//    (which does not exist here), so we wire up the fallback ourselves.

interface Env {
  ASSETS: Fetcher;
}

const SPA_FALLBACK_URL = '/docs/index.html';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/docs' || url.pathname === '/docs/') {
      const target = new URL('/docs/introduction', url.origin);
      target.search = url.search;
      target.hash = url.hash;
      return Response.redirect(target.toString(), 302);
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status === 404 && url.pathname.startsWith('/docs/')) {
      const routeIndex = new URL(`${url.pathname}/index.html`, url.origin);
      const routeResponse = await env.ASSETS.fetch(
        new Request(routeIndex.toString(), request),
      );
      if (routeResponse.ok) {
        return new Response(routeResponse.body, {
          status: 200,
          headers: routeResponse.headers,
        });
      }

      const fallbackUrl = new URL(SPA_FALLBACK_URL, url.origin);
      const fallback = await env.ASSETS.fetch(
        new Request(fallbackUrl.toString(), request),
      );
      if (fallback.ok) {
        return new Response(fallback.body, {
          status: 200,
          headers: fallback.headers,
        });
      }
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
