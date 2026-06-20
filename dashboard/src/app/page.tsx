'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { tenantsApi } from '@/lib/api';

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schoolData, setSchoolData] = useState<{
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  }>({
    name: 'TK Clocking System',
  });

  useEffect(() => {
    async function fetchBranding() {
      try {
        const hostname = window.location.hostname;
        const parts = hostname.split(".");
        let slug = null;

        if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "localhost") {
          slug = parts[0];
        }

        if (slug) {
          const res = await tenantsApi.getBrandingBySlug(slug);
          if (res.data) {
            setSchoolData({
              name: res.data.name || 'TK Clocking System',
              logoUrl: res.data.logoUrl,
              primaryColor: res.data.primaryColor,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load branding:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBranding();
  }, []);

  const logoSrc = schoolData.logoUrl || '/logo.png';
  const primaryColor = schoolData.primaryColor || 'var(--primary)';

  return (
    <div 
      className="welcome-container" 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: `radial-gradient(circle at top, ${primaryColor}15 0%, var(--bg-base) 60%)`,
        padding: '24px',
        color: 'var(--text-primary)'
      }}
    >
      <div 
        className="welcome-card"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '48px',
          width: '100%',
          maxWidth: '480px',
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '32px',
          animation: 'fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {loading ? (
          <>
            <div style={{ width: 120, height: 120, borderRadius: '24px', background: 'var(--bg-card)', animation: 'pulse 2s infinite' }} />
            <div style={{ width: '80%', height: 28, borderRadius: '8px', background: 'var(--bg-card)', animation: 'pulse 2s infinite' }} />
            <div style={{ width: '100%', height: 48, borderRadius: '12px', background: 'var(--bg-card)', animation: 'pulse 2s infinite', marginTop: 16 }} />
          </>
        ) : (
          <>
            <div 
              style={{ 
                position: 'relative', 
                width: 120, 
                height: 120,
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: `0 12px 32px ${primaryColor}30`,
                border: '1px solid var(--border)'
              }}
            >
              <Image
                src={logoSrc}
                alt={`${schoolData.name} Logo`}
                fill
                style={{ objectFit: 'contain', background: '#fff' }}
                priority
              />
            </div>
            
            <div>
              <h1 
                style={{ 
                  fontSize: '28px', 
                  fontWeight: 700, 
                  letterSpacing: '-0.02em',
                  marginBottom: '8px',
                  background: `linear-gradient(135deg, var(--text-primary) 0%, ${primaryColor} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {schoolData.name}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                Official Attendance &amp; Operations Portal
              </p>
            </div>

            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: primaryColor,
                color: '#fff',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: `0 8px 24px ${primaryColor}40`,
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 12px 32px ${primaryColor}60`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${primaryColor}40`;
              }}
            >
              Enter Admin Portal
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}} />
    </div>
  );
}
