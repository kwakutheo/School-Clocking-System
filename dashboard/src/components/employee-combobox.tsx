'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'lucide-react';

interface Employee {
  id: string;
  status: 'active' | 'suspended' | 'inactive' | string;
  user?: { fullName: string };
  fullName?: string;
}

export function EmployeeCombobox({
  employees,
  value,
  onChange,
  placeholder = '— Select Employee —',
}: {
  employees: Employee[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = employees.find(e => e.id === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => {
      const name = (e.user?.fullName ?? e.fullName ?? '').toLowerCase();
      if (!includeInactive && e.status === 'inactive') return false;
      return name.includes(q);
    });
  }, [employees, search, includeInactive]);

  const groups = useMemo(() => [
    { label: 'Active Employees',    status: 'active',    items: filtered.filter(e => e.status === 'active') },
    { label: 'Suspended Employees', status: 'suspended', items: filtered.filter(e => e.status === 'suspended') },
    { label: 'Inactive Employees',  status: 'inactive',  items: filtered.filter(e => e.status === 'inactive') },
  ].filter(g => g.items.length > 0), [filtered]);

  const statusBadge = (status: string) => {
    if (status === 'suspended') return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: 'rgba(244,63,94,0.15)', color: '#f43f5e', flexShrink: 0,
        border: '1px solid rgba(244,63,94,0.25)',
      }}>SUSPENDED</span>
    );
    if (status === 'inactive') return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: 'rgba(148,163,184,0.15)', color: '#94a3b8', flexShrink: 0,
        border: '1px solid rgba(148,163,184,0.25)',
      }}>INACTIVE</span>
    );
    return null;
  };

  // Determine row background — explicit rgba values that work in both themes
  const getItemBg = (empId: string): string => {
    if (empId === hoveredId) return 'rgba(99,102,241,0.13)';  // hovered: indigo tint
    if (empId === value)     return 'rgba(59,130,246,0.10)';  // selected: blue tint
    return 'transparent';
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* ── Trigger ───────────────────────────────────────────── */}
      <div
        onClick={() => { setOpen(o => !o); if (!open) setSearch(''); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--bg-card)',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 14, gap: 8, userSelect: 'none',
          boxShadow: open ? '0 0 0 2px var(--primary)' : 'none',
          transition: 'box-shadow 0.15s',
          minHeight: '42px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          <User size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? (selected.user?.fullName ?? selected.fullName) : placeholder}
          </span>
          {selected && statusBadge(selected.status)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Dropdown panel ────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000,
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}>
          {/* Search + toggle */}
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 8,
            background: 'var(--bg-surface)',
          }}>
            <input
              autoFocus
              type="text"
              placeholder="Search employee name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 13, background: 'var(--bg-card-alt)',
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={e => setIncludeInactive(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              Include Inactive Staff
            </label>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 280, overflowY: 'auto', background: 'var(--bg-surface)' }}>
            {groups.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No employees found.
              </div>
            ) : groups.map(group => (
              <div key={group.status}>
                {/* Group label */}
                <div style={{
                  padding: '8px 14px 4px', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: 1,
                  color: 'var(--text-muted)', background: 'var(--bg-surface)',
                }}>
                  {group.label}
                </div>

                {group.items.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => { onChange(emp.id); setOpen(false); setSearch(''); setHoveredId(null); }}
                    onMouseEnter={() => setHoveredId(emp.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                      cursor: 'pointer', fontSize: 14,
                      background: getItemBg(emp.id),
                      color: emp.status === 'inactive' ? 'var(--text-muted)' : 'var(--text-primary)',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Avatar initials */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: emp.status === 'inactive'  ? 'rgba(148,163,184,0.15)'
                               : emp.status === 'suspended' ? 'rgba(244,63,94,0.12)'
                               : 'rgba(59,130,246,0.12)',
                      color: emp.status === 'inactive'  ? '#94a3b8'
                           : emp.status === 'suspended' ? '#f43f5e'
                           : 'var(--primary)',
                    }}>
                      {(emp.user?.fullName ?? emp.fullName ?? '?')
                        .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Name */}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.user?.fullName ?? emp.fullName}
                    </span>

                    {/* Status badge */}
                    {statusBadge(emp.status)}

                    {/* Selected tick */}
                    {emp.id === value && (
                      <span style={{ color: 'var(--primary)', fontSize: 14, flexShrink: 0, fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
