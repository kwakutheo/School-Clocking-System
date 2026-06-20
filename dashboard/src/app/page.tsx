'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { tenantsApi } from '@/lib/api';
import { Monitor, Smartphone, BarChart3, ShieldCheck, ArrowRight } from 'lucide-react';

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

  const primaryColor = schoolData.primaryColor || '#3b82f6';
  
  // Create gradient variations based on primary color
  const gradientStart = primaryColor;
  // To create a gradient effect, we'll use a complementary or slightly shifted hue 
  // For default (#3b82f6 blue), the end could be a teal or green. We'll use a generic bright gradient mix if primary is default,
  // or a variation of the custom primary color.
  const isDefaultPrimary = primaryColor === '#3b82f6';
  const textGradient = isDefaultPrimary 
    ? 'linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #f59e0b 100%)' // Green to Blue to Gold
    : `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor}80 100%)`; // Custom color gradient

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
        background: `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)`,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {schoolData.logoUrl && !loading ? (
            <Image
              src={schoolData.logoUrl}
              alt="School Crest"
              width={48}
              height={48}
              style={{ objectFit: 'contain' }}
            />
          ) : (
             <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Monitor size={24} color={primaryColor} />
             </div>
          )}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          TK Clocking System
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
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
          <div style={{ animation: 'fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            {/* Dynamic School Name (Big and Bold) */}
            <h1 
              style={{
                fontSize: 'clamp(48px, 6vw, 96px)',
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '16px',
                background: textGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block'
              }}
            >
              {schoolData.name.toUpperCase()}
            </h1>

            {/* Subtitle */}
            <h2 style={{
              fontSize: 'clamp(32px, 4vw, 64px)',
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginBottom: '32px'
            }}>
              Smart School Attendance <br/>&amp; Staff Management System
            </h2>

            {/* Description Subtext */}
            <p style={{
              fontSize: 'clamp(18px, 2vw, 24px)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              maxWidth: '800px',
              margin: '0 auto 64px auto',
              lineHeight: 1.5
            }}>
              The complete and secure portal to manage your school's daily operations, attendance reporting, and staff dashboard.
            </p>

            {/* Pills / Action Row */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '16px',
              marginBottom: '64px'
            }}>
              <div className="feature-pill">
                <Smartphone size={18} color="#10b981" /> Mobile App
              </div>
              
              {/* This is the primary action button masquerading as a pill */}
              <button 
                onClick={() => router.push('/login')}
                className="feature-pill action-pill"
                style={{
                  background: `${primaryColor}15`,
                  borderColor: `${primaryColor}40`,
                  color: primaryColor,
                  cursor: 'pointer',
                  padding: '12px 32px'
                }}
              >
                <Monitor size={18} color={primaryColor} /> 
                <span style={{ fontWeight: 700 }}>Admin Dashboard</span>
                <ArrowRight size={18} style={{ marginLeft: 8 }} />
              </button>

              <div className="feature-pill">
                <BarChart3 size={18} color="#f59e0b" /> Reports
              </div>
              <div className="feature-pill">
                <ShieldCheck size={18} color="#3b82f6" /> Secure
              </div>
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
        .feature-pill {
          display: flex;
          alignItems: center;
          gap: 10px;
          padding: 12px 24px;
          border-radius: 100px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          font-weight: 600;
          font-size: 16px;
          color: var(--text-primary);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transition: all 0.2s ease;
        }
        .action-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
      `}} />
    </div>
  );
}
