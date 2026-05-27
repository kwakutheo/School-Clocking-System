'use client';
import React, { useState, useCallback, useEffect, Fragment } from 'react';
import useSWR from 'swr';
import { ShieldCheck } from 'lucide-react';

import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLES,
  DEFAULT_PERMISSIONS,
  loadPermissions,
  savePermissions,
  type PermissionMatrix,
  type Permission,
  type Role,
} from '@/lib/permissions';
import { settingsApi } from '@/lib/api';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Full system control. Cannot be restricted.',
  hr_admin: 'Manages the workforce day-to-day.',
  supervisor: 'Monitors their team\'s attendance.',
  employee: 'Standard staff member.',
};

export default function PermissionsPage() {
  const { data: serverMatrix, isLoading, mutate } = useSWR('settings-permissions', () =>
    settingsApi.getPermissions().then((r) => r.data).catch(() => null),
    { revalidateOnFocus: false }
  );

  const [matrix, setMatrix] = useState<PermissionMatrix>(() => loadPermissions());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasUnsavedChanges = React.useRef(false);

  // Sync server data into local state + cache once loaded
  useEffect(() => {
    if (serverMatrix && typeof serverMatrix === 'object') {
      const merged: PermissionMatrix = { ...DEFAULT_PERMISSIONS, ...serverMatrix };
      setMatrix(merged);
      savePermissions(merged); // update local cache
    }
  }, [serverMatrix]);

  const toggle = useCallback((role: Role, perm: Permission) => {
    if (role === 'super_admin') return; // Super Admin is immutable
    hasUnsavedChanges.current = true;
    setMatrix(prev => {
      const current = prev[role] ?? [];
      const updated = current.includes(perm)
        ? current.filter(p => p !== perm)
        : [...current, perm];
      return { ...prev, [role]: updated };
    });
    setSaved(false);
  }, []);

  const handleSave = async (matrixToSave: PermissionMatrix = matrix) => {
    hasUnsavedChanges.current = false;
    setSaving(true);
    try {
      await settingsApi.updatePermissions(matrixToSave as unknown as Record<string, string[]>);
      savePermissions(matrixToSave); // update local cache too
      mutate(matrixToSave, false); // sync SWR cache instantly without re-fetching
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Failed to save permissions. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save debouncer
  useEffect(() => {
    if (!hasUnsavedChanges.current) return;

    const timer = setTimeout(() => {
      hasUnsavedChanges.current = false;
      handleSave(matrix);
    }, 1200);

    return () => clearTimeout(timer);
  }, [matrix]);

  const handleReset = async () => {
    if (!confirm('Reset all permissions to their default values?')) return;
    setSaving(true);
    try {
      await settingsApi.updatePermissions(DEFAULT_PERMISSIONS as unknown as Record<string, string[]>);
      setMatrix(DEFAULT_PERMISSIONS);
      savePermissions(DEFAULT_PERMISSIONS);
      mutate(DEFAULT_PERMISSIONS, false); // sync SWR cache instantly without re-fetching
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert('Failed to reset permissions.');
    } finally {
      setSaving(false);
    }
  };

  const countGranted = (role: Role) =>
    role === 'super_admin'
      ? Object.keys(PERMISSION_LABELS).length
      : (matrix[role] ?? []).length;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Roles &amp; Permissions</h1>
          <p className="page-subtitle">Define exactly what each role can and cannot do in the system.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleReset} disabled={saving}>
            Reset to Defaults
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave()}
            disabled={saving}
            style={{ minWidth: 120, transition: 'background 0.3s' }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Role Summary Cards ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {ROLES.map(r => (
          <div
            key={r.key}
            style={{
              background: 'var(--bg-secondary)',
              border: `1px solid var(--border)`,
              borderTop: `3px solid ${r.color}`,
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: r.color, flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {ROLE_DESCRIPTIONS[r.key]}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: r.color }}>
                {countGranted(r.key)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                / {Object.keys(PERMISSION_LABELS).length} permissions
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Permissions Matrix ──────────────────────────────────────────────── */}
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 700, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '45%', textAlign: 'left', padding: '12px 20px', borderBottom: '2px solid var(--border)' }}>
                Permission
              </th>
              {ROLES.map(r => (
                <th
                  key={r.key}
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    borderBottom: '2px solid var(--border)',
                    borderLeft: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span
                      style={{
                        display: 'inline-block', padding: '2px 10px',
                        borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: r.color + '22', color: r.color,
                        border: `1px solid ${r.color}55`,
                      }}
                    >
                      {r.label}
                    </span>
                    {r.key === 'super_admin' && (
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Always full access</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PERMISSION_GROUPS.map((group, gi) => (
              <Fragment key={gi}>
                {/* Group Header */}
                <tr key={`group-${gi}`} style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <td
                    colSpan={4}
                    style={{
                      padding: '10px 20px',
                      fontWeight: 700,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderTop: gi > 0 ? '2px solid var(--border)' : undefined,
                    }}
                  >
                    {group.icon}&nbsp;&nbsp;{group.label}
                  </td>
                </tr>

                {/* Permission Rows */}
                {group.permissions.map((perm, pi) => (
                  <tr
                    key={perm}
                    style={{
                      background: pi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '11px 20px', fontSize: 14 }}>
                      {PERMISSION_LABELS[perm]}
                    </td>

                    {ROLES.map(r => {
                      const granted =
                        r.key === 'super_admin' || (matrix[r.key] ?? []).includes(perm);
                      const locked = r.key === 'super_admin';

                      return (
                        <td
                          key={r.key}
                          style={{
                            textAlign: 'center',
                            padding: '11px 16px',
                            borderLeft: '1px solid var(--border)',
                          }}
                        >
                          <button
                            onClick={() => toggle(r.key, perm)}
                            disabled={locked}
                            title={locked ? 'Super Admin always has this permission' : granted ? 'Click to revoke' : 'Click to grant'}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: granted
                                ? `2px solid ${r.color}`
                                : '2px solid var(--border)',
                              background: granted ? r.color + '22' : 'transparent',
                              color: granted ? r.color : 'var(--text-secondary)',
                              cursor: locked ? 'default' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              transition: 'all 0.2s',
                              opacity: locked ? 0.7 : 1,
                            }}
                            aria-label={`${granted ? 'Revoke' : 'Grant'} ${PERMISSION_LABELS[perm]} for ${r.label}`}
                          >
                            {granted ? '✓' : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>


    </>
  );
}
