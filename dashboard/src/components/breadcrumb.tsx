'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const LABELS: Record<string, string> = {
  dashboard: 'Overview',
  attendance: 'Attendance',
  employees: 'Employees',
  branches: 'Branches',
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}
    >
      <Link
        href="/dashboard"
        style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}
      >
        <Home size={14} />
      </Link>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const href = '/' + segments.slice(0, i + 1).join('/');
        return (
          <span key={seg} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChevronRight size={14} style={{ opacity: 0.5 }} />
            {isLast ? (
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {LABELS[seg] ?? seg}
              </span>
            ) : (
              <Link href={href} style={{ color: 'var(--text-secondary)' }}>
                {LABELS[seg] ?? seg}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
