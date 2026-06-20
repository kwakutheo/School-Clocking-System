'use client';
import Link from 'next/link';
import { Calendar, Clock, Building2, MapPin, Settings } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { can } from '@/lib/permissions';

const SETTINGS_CARDS = [
  { href: '/settings/school', icon: Settings,  label: 'School Settings',        description: 'Manage core school information, branding, and policies.', permission: 'permissions.manage' },
  { href: '/calendar',        icon: Calendar,  label: 'Academic Calendar',      description: 'Configure academic years, terms, and session dates.',     permission: 'calendar.view' },
  { href: '/holidays',        icon: Calendar,  label: 'Holidays',               description: 'Set up public and school holidays.',                      permission: 'holidays.manage' },
  { href: '/shifts',          icon: Clock,     label: 'Shifts (Working hours)', description: 'Define staff working schedules and shifts.',              permission: 'shifts.manage' },
  { href: '/departments',     icon: Building2, label: 'Departments',            description: 'Manage school departments and faculties.',                permission: 'departments.manage' },
  { href: '/branches',        icon: MapPin,    label: 'Branches',               description: 'Configure multi-campus or branch locations.',             permission: 'branches.manage' },
];

export default function SettingsHubPage() {
  const { user } = useAuthStore();

  return (
    <div className="dashboard-container">
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={28} style={{ color: 'var(--primary)' }} />
          Settings
        </h1>
        <p className="page-subtitle">Central configuration for your school's operating parameters.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {SETTINGS_CARDS.map((card) => {
          // Check if user has permission to view this settings section
          if (card.permission && !can(user?.role, card.permission as any)) return null;

          const Icon = card.icon;

          return (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
              <div 
                className="card" 
                style={{ 
                  padding: '24px', 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  background: 'var(--primary-dim)', 
                  color: 'var(--primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Icon size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {card.label}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
