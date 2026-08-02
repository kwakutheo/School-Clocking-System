'use client';
import { useEffect } from 'react';

// ── PwaRegister ──────────────────────────────────────────────────────────────
// Registers the service worker on the client side.
// Placed in the root layout so it runs once globally for the entire app.
// Only runs in production — @serwist/next disables SW generation in dev mode.

export function PwaRegister() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // Always check for SW updates from network
        });

        // Check for updates on page visibility change (e.g. tab switch back)
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Register Background Sync if supported (Chrome/Edge)
        if ('sync' in registration) {
          const swReg = registration as any;
          // Register immediately and also when coming back online
          swReg.sync.register('offline-queue-sync').catch(() => {});
          window.addEventListener('online', () => {
            swReg.sync.register('offline-queue-sync').catch(() => {});
          });
        } else {
          // Fallback for Safari/Firefox: trigger manually on 'online' event
          window.addEventListener('online', () => {
            import('@/lib/offline-queue').then(({ replayQueue }) => {
              replayQueue().catch(() => {});
            });
          });
        }

        return () => {
          document.removeEventListener(
            'visibilitychange',
            handleVisibilityChange
          );
        };
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err);
      }
    };

    // Defer registration until after page load to not compete with resources
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }
  }, []);

  // This component renders nothing — it only side-effects
  return null;
}
