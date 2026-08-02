'use client';
import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

// ── OfflinePage ──────────────────────────────────────────────────────────────
// Shown by the service worker when a navigation request fails and nothing
// is available in the pages cache. Industry-standard approach: give the user
// clear offline feedback, show a reload button, and auto-retry when the
// connection is restored.

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-navigate back when connection is restored
      window.location.reload();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base, #0f1117)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', sans-serif",
        color: 'var(--text-primary, #f1f5f9)',
        gap: '0',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'rgba(100, 116, 139, 0.12)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          color: 'rgba(100, 116, 139, 0.8)',
        }}
      >
        <WifiOff size={36} strokeWidth={1.5} />
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          marginBottom: '12px',
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}
      >
        You&rsquo;re Offline
      </h1>

      {/* Body */}
      <p
        style={{
          fontSize: '15px',
          color: 'var(--text-secondary, #94a3b8)',
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: '360px',
          marginBottom: '32px',
        }}
      >
        No internet connection detected. Pages and data you&rsquo;ve recently
        visited may still be available — try navigating to them from here.
      </p>

      {/* Quick links to cached pages */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          width: '100%',
          maxWidth: '300px',
          marginBottom: '32px',
        }}
      >
        {[
          { href: '/dashboard', label: 'Overview Dashboard' },
          { href: '/attendance', label: 'Attendance Report' },
          { href: '/employees', label: 'Staff Registry' },
          { href: '/shifts', label: 'Shifts' },
          { href: '/branches', label: 'Branches' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--bg-surface, #1a1d27)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              color: 'var(--text-primary, #f1f5f9)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'var(--primary, #3b82f6)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor =
                'var(--border, rgba(255,255,255,0.08))')
            }
          >
            {link.label}
            <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '18px' }}>›</span>
          </a>
        ))}
      </div>

      {/* Reload button */}
      <button
        onClick={() => window.location.reload()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          borderRadius: '12px',
          background: 'var(--primary, #3b82f6)',
          color: '#fff',
          border: 'none',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <RefreshCw size={16} />
        Try Again
      </button>

      {/* Auto-retry indicator */}
      {isOnline && (
        <p
          style={{
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--success, #10b981)',
            textAlign: 'center',
          }}
        >
          Connection restored — reloading…
        </p>
      )}
    </div>
  );
}
