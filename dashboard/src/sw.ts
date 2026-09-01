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
const STATIC_CACHE  = 'static-assets-v3';
const PAGES_CACHE   = 'pages-v3';
const API_READ_CACHE = 'api-read-v3';
const IMAGES_CACHE  = 'images-v3';

// ── The one page we MUST precache ────────────────────────────────────────────
// /offline must be available before the user visits it online, because by
// definition they're offline when they need it. We precache ONLY this one URL
// to avoid the performance regression of downloading all 36 pages on SW install.
const OFFLINE_URL = '/offline';

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

// ── Precache the /offline fallback page on SW install ───────────────────────
// We don't use serwist's precacheEntries for this because we need to keep
// self.__SW_MANIFEST referenced (build requirement) but empty. Instead we
// manually cache /offline during the install event.
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
});

// ── Background Sync: replay the offline queue ────────────────────────────────
// When the browser detects connectivity, it fires the 'sync' event (even if
// the tab is closed). We read pending items from IndexedDB and replay them.
// The actual replay logic lives in src/lib/offline-queue.ts (replayQueue).
// We duplicate a minimal version here so the SW bundle stays self-contained.
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'offline-queue-sync') {
    event.waitUntil(swReplayQueue());
  }
});

const SW_DB_NAME  = 'tk-offline-queue';
const SW_DB_VER   = 1;
const SW_STORE    = 'requests';
const MAX_RETRIES = 3;

function openSwDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(SW_DB_NAME, SW_DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SW_STORE)) {
        db.createObjectStore(SW_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function swGetAll(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(SW_STORE, 'readonly').objectStore(SW_STORE).getAll();
    req.onsuccess = () => resolve(req.result as any[]);
    req.onerror   = () => reject(req.error);
  });
}

function swPut(db: IDBDatabase, item: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(SW_STORE, 'readwrite').objectStore(SW_STORE).put(item);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function swReplayQueue(): Promise<void> {
  const db  = await openSwDb();
  const all = await swGetAll(db);
  const pending = all
    .filter((r: any) => r.status === 'pending')
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const item of pending) {
    await swPut(db, { ...item, status: 'syncing' });
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...item.headers },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        await swPut(db, { ...item, status: 'synced', retryCount: item.retryCount });
        // Notify all open clients so the Sync Center badge updates
        const clients = await (self as any).clients.matchAll({ includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'SYNC_CENTER_UPDATED' });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const msg: string = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message ?? `Server returned ${res.status}`;
        const nextRetry = item.retryCount + 1;
        const isPermanent = nextRetry >= MAX_RETRIES || res.status === 401 || res.status === 403 || res.status === 400;
        const failReason  = res.status === 401
          ? 'Session expired — please retry after logging in again'
          : msg;
        await swPut(db, {
          ...item,
          status: isPermanent ? 'failed' : 'pending',
          failureReason: isPermanent ? failReason : msg,
          retryCount: nextRetry,
        });
        const clients = await (self as any).clients.matchAll({ includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'SYNC_CENTER_UPDATED' });
        }
      }
    } catch {
      // Network still down — reset to pending for next attempt
      await swPut(db, { ...item, status: 'pending' });
    }
  }
}
