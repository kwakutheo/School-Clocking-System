import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'TK Dashboard',
  description: 'Workforce Time & Attendance Management Dashboard',
  // PWA / installability meta
  applicationName: 'TK Dashboard',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TK Dashboard',
  },
  formatDetection: { telephone: false },
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

import { headers } from 'next/headers';

// Viewport must be exported separately in Next.js 14+ App Router
export async function generateViewport(): Promise<Viewport> {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? '';
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');
  const slug = parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost' ? parts[0] : null;

  let themeColor = '#3b82f6';

  if (slug) {
    try {
      let BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://school-clocking-system.onrender.com/api/v1';
      if (
        BASE_URL.includes('10.') ||
        BASE_URL.includes('192.168.') ||
        BASE_URL.includes('localhost') ||
        BASE_URL.includes('127.0.0.1')
      ) {
        BASE_URL = 'https://school-clocking-system.onrender.com/api/v1';
      }

      const res = await fetch(`${BASE_URL}/tenants/brand/${slug}`, {
        headers: { 'x-tenant-slug': slug },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.primaryColor) {
          themeColor = data.primaryColor;
        }
      }
    } catch (err) {
      console.warn(`[layout] Error fetching brand for ${slug}:`, err);
    }
  }

  return {
    themeColor,
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <body suppressHydrationWarning>
        {children}
        {/* PWA: registers service worker after page load */}
        <PwaRegister />
        {/* PWA: shows install-to-home-screen prompt on supported browsers */}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
