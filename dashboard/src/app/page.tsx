'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { tenantsApi } from '@/lib/api';
import { ArrowRight, Sun, Moon, Maximize, Minimize } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [schoolData, setSchoolData] = useState<{
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  }>({
    name: 'TK Clocking System',
  });

  // Handle Theme and Fullscreen Logic
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        // Start with light theme by default as requested
        setTheme('light');
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Fetch Branding
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

  // Enter key navigates to login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('from_welcome', 'true');
        }
        router.push('/login');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Use system primary if not configured
  const primaryColor = schoolData.primaryColor || 'var(--primary)';

  return (
    <div 
      className="welcome-page-root"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Background Decorators */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        background: schoolData.primaryColor ? `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)` : 'radial-gradient(circle, var(--primary-dim) 0%, transparent 70%)',
        filter: 'blur(100px)',
        zIndex: 0
      }} />
      
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Top Left: Welcome Text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            TK Clocking - Your Digital Time Keeper.
          </div>
        </div>

        {/* Top Right: Theme & Fullscreen Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: theme === 'light' ? 'transparent' : 'var(--bg-card)',
              border: theme === 'light' ? 'none' : '1px solid var(--border)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: theme === 'light' ? 'none' : 'var(--shadow)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = theme === 'light' ? 'rgba(128,128,128,0.12)' : 'var(--bg-card-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = theme === 'light' ? 'transparent' : 'var(--bg-card)'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: theme === 'light' ? 'transparent' : 'var(--bg-card)',
              border: theme === 'light' ? 'none' : '1px solid var(--border)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: theme === 'light' ? 'none' : 'var(--shadow)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = theme === 'light' ? 'rgba(128,128,128,0.12)' : 'var(--bg-card-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = theme === 'light' ? 'transparent' : 'var(--bg-card)'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 24px',
        position: 'relative',
        zIndex: 10,
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%' }}>
            <div style={{ width: '60%', height: '80px', borderRadius: '16px', background: 'var(--bg-card)', animation: 'pulse 2s infinite' }} />
            <div style={{ width: '80%', height: '60px', borderRadius: '12px', background: 'var(--bg-card)', animation: 'pulse 2s infinite' }} />
          </div>
        ) : (
          <div style={{ animation: 'fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%' }}>
            
            {/* Logo and Titles Wrapper as a Wide Elevated Card */}
            <div className="school-card">
              
              {/* Massive School Crest on the left */}
              {schoolData.logoUrl && (
                <div className="school-logo-container">
                  <Image
                    src={schoolData.logoUrl}
                    alt="School Crest"
                    width={180}
                    height={180}
                    style={{ objectFit: 'contain', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.15))' }}
                  />
                </div>
              )}

              {/* Text Block */}
              <div className="school-text-container">
                {/* Dynamic School Name (Big and Bold) */}
                <h1 
                  className="school-name"
                  style={{ color: primaryColor }}
                >
                  {schoolData.name.toUpperCase()}
                </h1>

                {/* Subtitle */}
                <h2 
                  className="school-subtitle"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Digital Attendance Tracking System
                </h2>
              </div>
            </div>

            {/* Footer / Action Row */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '32px',
              flexWrap: 'wrap',
              padding: '0 32px',
              marginBottom: '64px'
            }}>

              {/* Action Button */}
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('from_welcome', 'true');
                  }
                  router.push('/login');
                }}
                className="action-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: schoolData.primaryColor ? `${primaryColor}15` : 'var(--primary-dim)',
                  border: `1px solid ${schoolData.primaryColor ? `${primaryColor}40` : 'var(--primary)'}`,
                  color: primaryColor,
                  cursor: 'pointer',
                  padding: '16px 40px',
                  borderRadius: '100px',
                  fontSize: '18px',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  flexShrink: 0
                }}
              >
                <span>Click Here to Sign In</span>
                <ArrowRight size={20} style={{ marginLeft: 8 }} />
              </button>
            </div>
          </div>
        )}

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .action-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important;
        }

        /* Responsive Card Classes */
        .school-card {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 48px;
          margin-bottom: 48px;
          text-align: center;
          background: var(--bg-surface);
          padding: 64px;
          border-radius: 32px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
          border: 1px solid var(--border);
          width: 100%;
          container-type: inline-size;
          container-name: schoolCard;
        }
        .school-logo-container {
          flex-shrink: 0;
        }
        .school-text-container {
          min-width: 0;
          flex: 1;
          text-align: center;
        }
        .school-name {
          font-size: clamp(24px, 6cqw, 96px);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.03em;
          margin-bottom: 16px;
          word-wrap: break-word;
          text-shadow: 
            1px 1px 0px rgba(0, 0, 0, 0.1),
            2px 2px 0px rgba(0, 0, 0, 0.08),
            3px 3px 0px rgba(0, 0, 0, 0.06),
            4px 4px 0px rgba(0, 0, 0, 0.05),
            5px 5px 12px rgba(0, 0, 0, 0.15);
        }
        .school-subtitle {
          font-size: clamp(16px, 3.5cqw, 64px);
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        
        /* Fallback for browsers that don't support container queries yet */
        @supports not (container-type: inline-size) {
          .school-name { font-size: clamp(24px, 5vw, 96px); }
          .school-subtitle { font-size: clamp(16px, 3vw, 64px); }
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .school-card {
            flex-direction: column;
            text-align: center;
            gap: 24px;
            padding: 32px;
          }
          .school-text-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .desktop-br {
            display: none;
          }
        }
      `}} />
    </div>
  );
}
