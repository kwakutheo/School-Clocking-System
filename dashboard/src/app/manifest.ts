import { type MetadataRoute } from 'next';
import { headers } from 'next/headers';


async function getTenantBranding(slug: string | null): Promise<{
  name: string;
  primaryColor: string;
} | null> {
  if (!slug) return null;

  try {
    let BASE_URL =
      process.env.NEXT_PUBLIC_API_URL ?? 'https://school-clocking-system.onrender.com/api/v1';

    if (
      BASE_URL.includes('10.') ||
      BASE_URL.includes('192.168.') ||
      BASE_URL.includes('localhost') ||
      BASE_URL.includes('127.0.0.1')
    ) {
      BASE_URL = 'https://school-clocking-system.onrender.com/api/v1';
    }

    const res = await fetch(`${BASE_URL}/tenants/brand/${slug}`, {
      headers: {
        'x-tenant-slug': slug,
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[manifest] Failed to fetch brand for ${slug}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return {
      name: data.name ?? null,
      primaryColor: data.primaryColor ?? '#3b82f6',
    };
  } catch (err) {
    console.error(`[manifest] Error fetching brand for ${slug}:`, err);
    return null;
  }
}

// Build the /api/icon URL with the tenant's brand color.
// The color is stripped of the # sign and URL-encoded safely.
function iconUrl(hexColor: string, size: 192 | 512, purpose: 'maskable' | 'any'): string {
  const clean = hexColor.replace('#', '').replace(/[^a-fA-F0-9]/g, '') || '3b82f6';
  // Added v=2 to bust the browser cache for the new rounded icons
  return `/api/icon?color=${clean}&size=${size}&purpose=${purpose}&v=2`;
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // ── Extract tenant slug from the host header ─────────────────────────────
  const headersList = await headers();
  // Vercel / proxies usually pass the original host in x-forwarded-host
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? '';
  // Strip port for local dev (e.g. "testing.localhost:3001")
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');

  // A valid subdomain slug exists when there are >1 parts and it's not "www"
  const slug =
    parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost'
      ? parts[0]
      : null;

  const branding = await getTenantBranding(slug);

  // ── Naming ────────────────────────────────────────────────────────────────
  // The dashboard PWA is explicitly named "Dashboard" to distinguish it from
  // the Flutter mobile clocking app which is just "TK Clocking".
  const appName = branding?.name
    ? `${branding.name}`
    : 'TK Clocking Dashboard';

  const shortName = branding?.name
    ? `${branding.name.split(' ')[0]} Dashboard`   // e.g. "Lincoln Dashboard"
    : 'TK Clocking Dashboard';

  const themeColor = branding?.primaryColor ?? '#3b82f6';

  // ── Icon color ────────────────────────────────────────────────────────────
  const color = (branding?.primaryColor ?? '#3b82f6').replace('#', '');

  return {
    name: appName,
    short_name: shortName,
    description: branding?.name
      ? `Management dashboard for ${branding.name}`
      : 'TK Clocking — HR & Attendance Management Dashboard',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0f1117',
    theme_color: themeColor,
    categories: ['business', 'productivity', 'education'],
    lang: 'en',

    icons: [
      // ── Maskable icons (solid background — required by Android adaptive icons)
      {
        src: iconUrl(`#${color}`, 192, 'maskable'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: iconUrl(`#${color}`, 512, 'maskable'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      // ── Any-purpose icons (used for splash screens, bookmarks)
      {
        src: iconUrl(`#${color}`, 192, 'any'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: iconUrl(`#${color}`, 512, 'any'),
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
