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
  ArrowDown
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: any;
  label: string;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Overview'    },
  { href: '/attendance',  icon: Clock,            label: 'Attendance',        permission: 'attendance.view'    },
  { href: '/employees',   icon: Users,            label: 'Employees',         permission: 'employees.view'     },
  { href: '/leaves',      icon: FileText,         label: 'Leave Requests'                                       },
  { href: '/shifts',      icon: Clock,            label: 'Shifts',            permission: 'shifts.manage'      },
  { href: '/holidays',    icon: Calendar,         label: 'Holidays',          permission: 'holidays.manage'    },
  { href: '/calendar',    icon: Calendar,         label: 'Academic Calendar', permission: 'calendar.view'      },
  { href: '/audit',       icon: ShieldCheck,      label: 'Audit Logs',        permission: 'audit.view'         },
  { href: '/permissions', icon: ShieldAlert,      label: 'Permissions',       permission: 'permissions.manage' },
  { href: '/departments', icon: Building2,        label: 'Departments',       permission: 'departments.manage' },
  { href: '/branches',    icon: MapPin,           label: 'Branches',          permission: 'branches.manage'    },
  { href: '/mobile-app',  icon: Smartphone,       label: 'Mobile App',        permission: 'employees.view'     },
  { href: '/settings',    icon: Settings,         label: 'School Settings',   permission: 'permissions.manage' },
  { href: '/profile',     icon: UserCircle,       label: 'My Profile'   },
];

const DEVELOPER_NAV: NavItem[] = [
  { href: '/saas-admin',         icon: LayoutDashboard, label: 'SaaS Overview' },
  { href: '/saas-admin/schools', icon: Building2,        label: 'Schools Registry' },
  { href: '/saas-admin/calendar', icon: Calendar,         label: 'Global Calendar' },
  { href: '/saas-admin/holidays', icon: Calendar,         label: 'Global Holidays' },
  { href: '/saas-admin/bulletins', icon: Megaphone,      label: 'Announcements' },
  { href: '/profile',            icon: UserCircle,       label: 'My Profile' },
];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, hydrate, logout, impersonatedTenant, setImpersonatedTenant } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [bannerPosition, setBannerPosition] = useState<'top' | 'bottom'>('top');

  const [permissionsTick, setPermissionsTick] = useState(0);

  const activeTenant = impersonatedTenant || (user ? user.tenant : null);

  useEffect(() => { 
    hydrate(); 
    fetchAndCachePermissions();
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

  useEffect(() => {
    if (isHydrated && !user) {
      router.push('/login');
      return;
    }
    if (isHydrated && user && user.tenantId === null && !impersonatedTenant && (pathname === '/dashboard' || pathname === '/')) {
      router.push('/saas-admin');
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
              Return to Global Console
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
            <div>
              <div className="sidebar-logo-text" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: collapsed ? '0px' : '130px' }}>
                {activeTenant?.name ?? 'TK Clocking'}
              </div>
              <div className="sidebar-logo-sub">
                {activeTenant ? `${activeTenant.slug.toUpperCase()} Portal` : 'Global Console'}
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
            {(user?.tenantId === null && !impersonatedTenant ? DEVELOPER_NAV : NAV).filter(item => !item.permission || can(user?.role, item.permission)).map((item) => {
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
          <div className="user-card" title={collapsed ? user.fullName : undefined}>
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
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="btn-ghost"
                style={{ padding: '6px', borderRadius: '8px', minWidth: 'auto' }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="main-content" style={{ position: 'relative' }}>
        <button 
          className="theme-toggle-btn desktop-only"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          style={{
            position: 'absolute',
            top: '24px',
            right: '32px',
            zIndex: 10,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {children}
      </main>
    </div>
  );
}
