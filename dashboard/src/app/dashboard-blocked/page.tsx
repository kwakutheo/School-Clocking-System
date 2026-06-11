'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function DashboardBlockedPage() {
  const router = useRouter();
  const { user, isHydrated, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isHydrated && mounted) {
      if (!user) {
        router.push('/login');
      } else if (!user.isDashboardBlocked) {
        router.push('/dashboard');
      }
    }
  }, [isHydrated, user, mounted, router]);

  if (!mounted || !isHydrated || !user || !user.isDashboardBlocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-page)]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: 'var(--bg-page)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Background decoration */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at center, var(--primary) 0%, transparent 40%)',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%'
        }}
      />

      <div 
        className="max-w-md w-full z-10 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div 
          className="absolute top-0 left-0 w-full h-1"
          style={{ background: 'var(--danger, #ef4444)' }}
        />
        
        <div 
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--danger, #ef4444)'
          }}
        >
          <Lock size={36} strokeWidth={2} />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ letterSpacing: '-0.02em' }}>
          Access Restricted
        </h1>
        
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Hello <strong>{user.fullName}</strong>, your access to the school administrative dashboard has been temporarily restricted by your school super administrator.
        </p>

        {user.dashboardBlockReason && (
          <div 
            className="w-full p-4 rounded-xl mb-8 text-left"
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <span className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--danger, #ef4444)' }}>
              Reason for restriction
            </span>
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {user.dashboardBlockReason}
            </span>
          </div>
        )}

        <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>
          Note: You can still use the mobile application for normal clocking activities if applicable.
        </p>

        <button 
          onClick={logout}
          className="btn flex items-center justify-center gap-2 w-full"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '12px',
            borderRadius: '8px',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
