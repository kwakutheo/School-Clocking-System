'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore, initials, roleLabel } from '@/lib/store';
import { fetchAndCachePermissions, can, type Permission } from '@/lib/permissions';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  MapPin, 
  Building2, 
  UserCircle, 
  LogOut, 
  ShieldCheck,
  ShieldAlert,
  Calendar,
  ChevronLeft,
  Menu,
  Sun,
  Moon,
  Smartphone,
  FileText,
  Megaphone,
  Settings,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Maximize2,
  Minimize2,
  Trophy
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: any;
  label: string;
  permission?: Permission | Permission[];
  globalRoles?: string[];
}

const NAV: NavItem[] = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Overview'    },
  { href: '/attendance',  icon: Clock,            label: 'Attendance Report',          permission: 'attendance.view'    },
  { href: '/employees',   icon: Users,            label: 'Staff Registry',             permission: 'employees.view'     },
  { href: '/leaves',      icon: FileText,         label: 'Permissions & Leaves',       permission: 'leaves.manage'      },
  { href: '/rankings',    icon: Trophy,           label: 'Performance Rankings',       permission: 'attendance.view'    },
  { href: '/mobile-app',  icon: Smartphone,       label: 'Mobile App',                 permission: 'employees.view'     },
  { href: '/settings',    icon: Settings,         label: 'Settings',                   permission: [
    'permissions.manage',
    'calendar.view',
    'holidays.manage',
    'shifts.manage',
    'departments.manage',
    'branches.manage'
  ] },
  { href: '/permissions', icon: ShieldAlert,      label: 'Permissions',                permission: 'permissions.manage' },
  { href: '/audit',       icon: ShieldCheck,      label: 'Audit Logs',                 permission: 'audit.view'         },
];

const DEVELOPER_NAV: NavItem[] = [
  { href: '/saas-admin',         icon: LayoutDashboard, label: 'Overview' },
  { href: '/saas-admin/schools', icon: Building2,        label: 'Schools Registry' },
  { href: '/saas-admin/employees', icon: Users,          label: 'Staff Registry' },
  { href: '/saas-admin/reports',  icon: BarChart2,        label: 'Reports & Export' },
  { href: '/saas-admin/calendar', icon: Calendar,         label: 'Academic Calendar' },
  { href: '/saas-admin/holidays', icon: Calendar,         label: 'Holidays' },
  { href: '/saas-admin/bulletins', icon: Megaphone,      label: 'Announcements', globalRoles: ['super_admin', 'hr_admin'] },
  { href: '/saas-admin/admins',  icon: ShieldCheck,      label: 'Admins', globalRoles: ['super_admin'] },
  { href: '/saas-admin/audit',   icon: ShieldAlert,      label: 'Audit Logs', globalRoles: ['super_admin'] },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, hydrate, logout, impersonatedTenant, setImpersonatedTenant } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [bannerPosition, setBannerPosition] = useState<'top' | 'bottom'>('top');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [permissionsTick, setPermissionsTick] = useState(0);

  const activeTenant = impersonatedTenant || (user ? user.tenant : null);

  useEffect(() => { 
    hydrate(); 
    fetchAndCachePermissions();

    const token = localStorage.getItem('access_token');
    if (token) {
      import('@/lib/api').then(({ authApi }) => {
        authApi.me().then(res => {
          const { user: currentUser } = useAuthStore.getState();
          if (currentUser) {
            useAuthStore.getState().setAuth(res.data, token);
          }
        }).catch(() => {});
      });
    }
  }, [hydrate]);

  useEffect(() => {
    const handlePermissionsUpdated = () => setPermissionsTick(prev => prev + 1);
    window.addEventListener('permissionsUpdated', handlePermissionsUpdated);
    return () => window.removeEventListener('permissionsUpdated', handlePermissionsUpdated);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved === 'true') setCollapsed(true);
      
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }

      const savedBannerPos = localStorage.getItem('impersonation-banner-position') as 'top' | 'bottom' | null;
      if (savedBannerPos) {
        setBannerPosition(savedBannerPos);
      }
    }
  }, []);

  // Dynamically apply multi-tenant whitelabel primary brand colors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const primaryColor = activeTenant?.primaryColor || (user?.role === 'super_admin' ? '#ec4899' : '#3b82f6');
      document.documentElement.style.setProperty('--primary', primaryColor);
      
      // Calculate active dark/light hover variations safely
      document.documentElement.style.setProperty('--primary-dim', primaryColor + '18');
    }
  }, [user, impersonatedTenant, activeTenant]);

  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

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

  // Sync isFullscreen state with browser fullscreen events
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // F key shortcut — skip when focus is inside an input/textarea/select
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (isHydrated && !user) {
      router.push('/login');
      return;
    }
    if (isHydrated && user && user.tenantId === null && !impersonatedTenant && (pathname === '/dashboard' || pathname === '/')) {
      router.push('/saas-admin');
      return;
    }
    if (isHydrated && user && user.isDashboardBlocked && pathname !== '/dashboard-blocked') {
      router.push('/dashboard-blocked');
      return;
    }
  }, [isHydrated, user, impersonatedTenant, router, pathname]);

  if (!isHydrated || !user) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''} ${impersonatedTenant ? 'impersonated-readonly' : ''}`}>
      {/* ── Impersonation / View Mode Floating Banner ──────────────────── */}
      {impersonatedTenant && (
        <div className={`impersonation-banner banner-${bannerPosition}`}>
          <div className="banner-content">
            <span className="banner-badge">Super Admin Mode</span>
            <span className="banner-badge-readonly">View-Only Mode</span>
            <span className="banner-text">
              Viewing <strong>{impersonatedTenant.name}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="banner-toggle-pos-btn"
              onClick={() => {
                const newPos = bannerPosition === 'top' ? 'bottom' : 'top';
                setBannerPosition(newPos);
                localStorage.setItem('impersonation-banner-position', newPos);
              }}
              title={bannerPosition === 'top' ? "Move to bottom" : "Move to top"}
              aria-label={bannerPosition === 'top' ? "Move to bottom" : "Move to top"}
            >
              {bannerPosition === 'top' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            </button>
            <button 
              className="banner-exit-btn"
              onClick={() => {
                setImpersonatedTenant(null);
                router.push('/saas-admin');
              }}
            >
              Return to Central Management Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile Header ────────────────────────────────────────────────── */}
      <header className="mobile-header">
        <button 
          className="mobile-menu-btn" 
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="mobile-logo">
          {activeTenant?.logoUrl ? (
            <img
              src={activeTenant.logoUrl}
              alt={`${activeTenant.name} Crest`}
              width={32}
              height={32}
              style={{ borderRadius: '6px', objectFit: 'contain', maxHeight: 32, maxWidth: 32 }}
            />
          ) : (
            <Image
              src="/logo.png"
              alt="Logo"
              width={32}
              height={32}
              style={{ borderRadius: '6px' }}
            />
          )}
          <span>{activeTenant?.name ?? 'TK Clocking'}</span>
        </div>
        <button 
          className="mobile-theme-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* ── Overlay ──────────────────────────────────────────────────────── */}
      <div 
        className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`} 
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            {activeTenant?.logoUrl ? (
              <img
                src={activeTenant.logoUrl}
                alt={`${activeTenant.name} Crest`}
                width={36}
                height={36}
                style={{ borderRadius: '8px', flexShrink: 0, objectFit: 'contain', maxHeight: 36, maxWidth: 36 }}
              />
            ) : (
              <Image
                src="/logo.png"
                alt="TK Clocking Logo"
                width={36}
                height={36}
                style={{ borderRadius: '8px', flexShrink: 0 }}
                priority
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, paddingRight: '8px' }}>
              <div className="sidebar-logo-text">
                {activeTenant?.name ?? 'TK Clocking'}
              </div>
              <div className="sidebar-logo-sub">
                {activeTenant ? `${activeTenant.slug.toUpperCase()} Portal` : 'Central Management Dashboard'}
              </div>
            </div>
          </div>
          <button 
            className="sidebar-toggle" 
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="sidebar-nav">
          <span className="nav-section-label">Main Menu</span>
          <nav>
            {(user?.tenantId === null && !impersonatedTenant ? DEVELOPER_NAV : NAV).filter(item => {
              if (item.globalRoles && !item.globalRoles.includes(user?.role ?? '')) return false;
              if (!item.permission) return true;
              if (Array.isArray(item.permission)) {
                return item.permission.some(p => can(user?.role, p));
              }
              return can(user?.role, item.permission);
            }).map((item) => {
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-item-icon"><Icon size={18} /></span>
                  {(collapsed && !mobileOpen) ? null : item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div 
            className="user-card" 
            title="Go to My Profile"
            onClick={() => { setMobileOpen(false); router.push('/profile'); }}
            style={{ cursor: 'pointer' }}
          >
            <div className="user-avatar" style={{ 
              background: 'linear-gradient(135deg, var(--primary), #a855f7)',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}>{initials(user.fullName)}</div>
            {(!collapsed || mobileOpen) && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name" style={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  {user.fullName}
                </div>
                <div className="user-role" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {roleLabel[user.role]}
                </div>
              </div>
            )}
            {(!collapsed || mobileOpen) && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowLogoutConfirm(true); }}
                aria-label="Sign out"
                title="Sign out"
                className="btn-ghost"
                style={{ padding: '6px', borderRadius: '8px', minWidth: 'auto', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '24px' }}>
          <button 
            className="theme-toggle-btn desktop-only"
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
          
          {/* ── Fullscreen toggle (F key shortcut) ──────────────────────── */}
          <button
            className="theme-toggle-btn desktop-only"
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
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        <div style={{ flex: 1 }}>
          {children}
        </div>
      </main>

      {/* ── Logout Confirmation Modal ────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: 'var(--danger)' }}>
              <LogOut size={48} strokeWidth={1.5} />
            </div>
            <h3 style={{ marginBottom: '12px', fontSize: '20px' }}>Confirm Logout</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '15px' }}>
              Are you sure you want to sign out of your account?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ background: 'var(--danger)', color: 'white', flex: 1, border: 'none' }} 
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
