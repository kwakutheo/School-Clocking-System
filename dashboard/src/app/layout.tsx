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

// Viewport must be exported separately in Next.js 14+ App Router
export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
};

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
