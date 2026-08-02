/// <reference lib="webworker" />
// sw.ts is intentionally excluded from tsconfig.json to avoid dom/webworker lib conflicts.
// The triple-slash reference above gives IDEs (VS Code) correct types for this file.
// Serwist bundles this file independently — Next.js type-checks are not needed here.

import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'serwist';
import { Serwist } from 'serwist';

// ── Serwist self.__SW_MANIFEST type declaration ─────────────────────────────
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// self must be declared at module level (not inside declare global) so
// TypeScript resolves it as ServiceWorkerGlobalScope throughout the file.
declare const self: ServiceWorkerGlobalScope;

// ── Cache name constants ────────────────────────────────────────────────────
const STATIC_CACHE = 'static-assets-v2';
const PAGES_CACHE  = 'pages-v2';
const API_READ_CACHE = 'api-read-v2';
const IMAGES_CACHE = 'images-v2';

// ── Serwist instance ────────────────────────────────────────────────────────
// @serwist/next scans the source for the token `self.__SW_MANIFEST` at build
// time — the build fails if the string is absent. We reference it here to
// satisfy that requirement, but intentionally do NOT pass it to
// precacheEntries. Precaching all 36 pages + JS bundles on install caused a
// massive background download that competed with live network traffic and made
// the dashboard feel slow. All caching is done lazily at runtime instead.
void self.__SW_MANIFEST; // required reference — do not remove

const serwist = new Serwist({
  precacheEntries: [],    // runtime-only caching — no install-time downloads

  skipWaiting: true,           // immediately activate new SW version
  clientsClaim: true,          // take control of all existing clients
  navigationPreload: false,    // disable — not needed without NetworkFirst navigation
  offlineAnalyticsConfig: false,

  runtimeCaching: [

    // ── 1. Static Next.js assets (JS, CSS, fonts) — Cache First ────────────
    // These are content-hashed by the Next.js build so they never go stale.
    // Serving from cache saves a full round-trip on every page load — this is
    // the biggest real-world speed win for repeat visitors.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/')         ||
        url.pathname.endsWith('.svg')              ||
        url.pathname.endsWith('.woff')             ||
        url.pathname.endsWith('.woff2'),
      handler: new CacheFirst({
        cacheName: STATIC_CACHE,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
        ],
      }),
    },

    // ── 2. Tenant logo / brand images (CDN URLs) — Cache First ─────────────
    // Logos are rarely changed; caching them avoids repeated CDN round-trips.
    {
      matcher: ({ request }) =>
        request.destination === 'image' &&
        request.url.includes('http'),
      handler: new CacheFirst({
        cacheName: IMAGES_CACHE,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
        ],
      }),
    },

    // ── 3. Read-safe API endpoints — Stale While Revalidate ─────────────────
    // Serve the cached response immediately (zero network wait), then update
    // the cache in the background. This makes the dashboard feel instant on
    // repeat visits and keeps data available offline.
    {
      matcher: ({ url, request }) => {
        // Only intercept GET requests
        if (request.method !== 'GET') return false;
        const path = url.pathname;
        const isApiPath =
          path.includes('/api/v1/') || path.includes('/api/');
        if (!isApiPath) return false;

        return (
          path.includes('/shifts')           ||
          path.includes('/branches')         ||
          path.includes('/employees')        ||
          path.includes('/attendance')       ||
          path.includes('/departments')      ||
          path.includes('/holidays')         ||
          path.includes('/leaves')           ||
          path.includes('/rankings')         ||
          path.includes('/academic-calendar')||
          path.includes('/bulletins')        ||
          path.includes('/audit')            ||
          path.includes('/tenants/brand')    ||
          // SaaS admin read routes
          path.includes('/saas-admin/stats')       ||
          path.includes('/saas-admin/tenants')     ||
          path.includes('/saas-admin/bulletins')   ||
          path.includes('/saas-admin/rankings')    ||
          path.includes('/saas-admin/employees')   ||
          path.includes('/saas-admin/admin-users')
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: API_READ_CACHE,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
        ],
      }),
    },

    // ── 4. Auth & permissions — Network First ────────────────────────────────
    // Must be fresh when online; use a short timeout so it doesn't block the
    // app for long if the backend is slow. Falls back to cache if offline.
    {
      matcher: ({ url, request }) => {
        if (request.method !== 'GET') return false;
        const path = url.pathname;
        return (
          path.includes('/auth/me')              ||
          path.includes('/settings/permissions') ||
          path.includes('/time')
        );
      },
      handler: new NetworkFirst({
        cacheName: API_READ_CACHE,
        networkTimeoutSeconds: 4,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
        ],
      }),
    },

    // ── 5. Mutating API calls — Network Only (never cache) ───────────────────
    // POST / PUT / PATCH / DELETE must always reach the server.
    {
      matcher: ({ request, url }) => {
        const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
          request.method.toUpperCase()
        );
        const isSensitive =
          url.pathname.includes('/saas-admin/audit')          ||
          url.pathname.includes('/qr-code')                   ||
          url.pathname.includes('/auth/login')                ||
          url.pathname.includes('/auth/request-password-reset') ||
          url.pathname.includes('/auth/complete-password-reset');
        return isMutating || isSensitive;
      },
      handler: new NetworkOnly(),
    },

    // ── 6. App pages (HTML navigation) — Stale While Revalidate ─────────────
    // PERFORMANCE FIX #2: Changed from NetworkFirst to StaleWhileRevalidate.
    //
    // NetworkFirst (old): Every navigation waited for a full network round-trip
    // through the SW before the browser got ANY response — always slower than
    // no SW at all.
    //
    // StaleWhileRevalidate (new):
    //   • First visit  → served from network (same as before PWA, no overhead)
    //   • Repeat visits → served from cache INSTANTLY, updated in background
    //                     (actually FASTER than before PWA)
    //   • Offline       → served from cache (still works offline)
    //
    // The offline fallback is handled by the fetch event listener below to
    // show /offline when nothing is cached for a given URL.
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new StaleWhileRevalidate({
        cacheName: PAGES_CACHE,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

// ── Offline fallback for uncached navigation requests ────────────────────────
// When the user navigates to a page that isn't cached yet and is offline,
// serve the /offline page instead of a browser error.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(PAGES_CACHE);
      const cachedPage = await cache.match(event.request);
      if (cachedPage) return cachedPage;
      const offlinePage = await cache.match('/offline');
      return offlinePage ?? Response.error();
    })
  );
});

// ── Cache-bust on logout ─────────────────────────────────────────────────────
// The app posts a 'LOGOUT' message to the SW when the user signs out.
// We delete the API read cache and pages cache to prevent stale data leaks
// when a different tenant user logs in on the same browser.
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'LOGOUT') {
    await caches.delete(API_READ_CACHE);
    await caches.delete(PAGES_CACHE);
    event.ports[0]?.postMessage({ success: true });
  }
});
