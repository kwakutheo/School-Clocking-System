import { type MetadataRoute } from 'next';
import { headers } from 'next/headers';

// ── Dynamic multi-tenant manifest ───────────────────────────────────────────
// Each subdomain (school) gets its own manifest via the browser's per-origin
// manifest cache. This means "testing.tkclocking.online" installs as
// "Testing School" and "lincoln.tkclocking.online" installs as "Lincoln High".
//
// Tenant branding (name, primaryColor) is fetched from the backend.
// Icons must be static files served from the same origin — they cannot be
// dynamic per tenant due to PWA spec constraints. All tenants share the
// TK Clocking system icon, but the name and theme color are per-tenant.

async function getTenantBranding(slug: string | null): Promise<{
  name: string;
  primaryColor: string;
} | null> {
  if (!slug) return null;

  try {
    const BASE_URL =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

    const res = await fetch(`${BASE_URL}/tenants/brand/${slug}`, {
      // Keep manifest fetches short — they block the browser install prompt
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 300 }, // Cache server-side for 5 minutes
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name ?? null,
      primaryColor: data.primaryColor ?? '#3b82f6',
    };
  } catch {
    return null;
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // ── Extract tenant slug from the host header ─────────────────────────────
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  // Strip port for local dev (e.g. "testing.localhost:3001")
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // A valid subdomain slug exists when there are >1 parts and it's not "www"
  const slug =
    parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost'
      ? parts[0]
      : null;

  const branding = await getTenantBranding(slug);

  const appName = branding?.name
    ? `${branding.name} — Clocking`
    : 'TK Clocking System';

  const shortName = branding?.name
    ? branding.name.split(' ').slice(0, 2).join(' ')
    : 'TK Clocking';

  const themeColor = branding?.primaryColor ?? '#3b82f6';

  return {
    name: appName,
    short_name: shortName,
    description: branding?.name
      ? `Attendance tracking dashboard for ${branding.name}`
      : 'Multi-tenant attendance and workforce time-tracking dashboard',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: themeColor,
    categories: ['business', 'productivity', 'education'],
    lang: 'en',
    icons: [
      {
        src: '/icons/icon-192x192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: 'Dashboard',
        url: '/dashboard',
        description: 'Go to overview dashboard',
      },
      {
        name: 'Attendance',
        url: '/attendance',
        description: 'View attendance report',
      },
    ],
  };
}
