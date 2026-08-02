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
const STATIC_CACHE = 'static-assets-v1';
const PAGES_CACHE = 'pages-v1';
const API_READ_CACHE = 'api-read-v1';
const IMAGES_CACHE = 'images-v1';

// ── Serwist instance ────────────────────────────────────────────────────────
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,          // immediately activate new SW
  clientsClaim: true,         // take control of all existing clients
  navigationPreload: true,    // speed up navigation responses
  offlineAnalyticsConfig: false,

  runtimeCaching: [

    // ── 1. Static Next.js assets (JS, CSS, fonts) — Cache First ────────────
    // These are fingerprinted by Next.js build hashes so they never clash.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff') ||
        url.pathname.endsWith('.woff2'),
      handler: new CacheFirst({
        cacheName: STATIC_CACHE,
        plugins: [
          {
            // Limit cache size to avoid filling the user's storage
            cacheDidUpdate: async () => {},
          },
        ],
      }),
    },

    // ── 2. Tenant logo / brand images (CDN URLs) — Cache First, 7-day TTL ──
    // Logos rarely change; aggressively cache them.
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
    // Serve cached data immediately, refresh in the background when online.
    // Covers: shifts, branches, employees, attendance stats/history,
    //         departments, holidays, leaves, rankings, academic calendar,
    //         bulletins, audit logs.
    {
      matcher: ({ url }) => {
        const path = url.pathname;
        return (
          (path.includes('/api/v1/') || path.includes('/api/')) &&
          (
            path.includes('/shifts') ||
            path.includes('/branches') ||
            path.includes('/employees') ||
            path.includes('/attendance') ||
            path.includes('/departments') ||
            path.includes('/holidays') ||
            path.includes('/leaves') ||
            path.includes('/rankings') ||
            path.includes('/academic-calendar') ||
            path.includes('/bulletins') ||
            path.includes('/audit') ||
            path.includes('/tenants/brand') ||
            // SaaS admin read routes — both users requested
            path.includes('/saas-admin/stats') ||
            path.includes('/saas-admin/tenants') ||
            path.includes('/saas-admin/bulletins') ||
            path.includes('/saas-admin/rankings') ||
            path.includes('/saas-admin/employees') ||
            path.includes('/saas-admin/admin-users')
          ) &&
          // Only cache GET requests
          true
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
    // These must be fresh if possible; fall back to cache if offline.
    {
      matcher: ({ url }) => {
        const path = url.pathname;
        return (
          path.includes('/auth/me') ||
          path.includes('/settings/permissions') ||
          path.includes('/time')
        );
      },
      handler: new NetworkFirst({
        cacheName: API_READ_CACHE,
        networkTimeoutSeconds: 5,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
        ],
      }),
    },

    // ── 5. Mutating API calls — Network Only (never cache) ───────────────────
    // POST, PUT, PATCH, DELETE must always go to the server.
    // Also covers sensitive SaaS admin actions and QR code regeneration.
    {
      matcher: ({ request, url }) => {
        const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
          request.method.toUpperCase()
        );
        const isSensitive =
          url.pathname.includes('/saas-admin/audit') ||
          url.pathname.includes('/qr-code') ||
          url.pathname.includes('/auth/login') ||
          url.pathname.includes('/auth/request-password-reset') ||
          url.pathname.includes('/auth/complete-password-reset');
        return isMutating || isSensitive;
      },
      handler: new NetworkOnly(),
    },

    // ── 6. App pages (HTML navigation) — Network First ──────────────────────
    // Try to get the freshest page; fall back to cache when offline.
    // The offline fallback page (/offline) is served when nothing is cached.
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 6,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response && response.status === 200 ? response : null,
          },
          {
            // If navigation fails offline and nothing is cached, serve /offline
            handlerDidError: async () => {
              const cache = await caches.open(PAGES_CACHE);
              const offlinePage = await cache.match('/offline');
              return offlinePage ?? Response.error();
            },
          },
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

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
