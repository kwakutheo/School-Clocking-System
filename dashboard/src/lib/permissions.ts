// ── Permission Definitions ─────────────────────────────────────────────────

export type Role = 'super_admin' | 'hr_admin' | 'supervisor' | 'employee';

export type Permission =
  // Employee Management
  | 'employees.view'
  | 'employees.create'
  | 'employees.edit'
  | 'employees.delete'
  | 'employees.reset_password'
  | 'employees.toggle_status'
  // Attendance
  | 'attendance.view'
  | 'attendance.view_live'
  | 'attendance.edit'
  | 'attendance.export'
  | 'attendance.admin_clock'
  // Academic Calendar
  | 'calendar.view'
  | 'calendar.create'
  | 'calendar.edit'
  | 'calendar.delete'
  // System Settings
  | 'shifts.manage'
  | 'departments.manage'
  | 'branches.manage'
  | 'holidays.manage'
  | 'leaves.manage'
  | 'audit.view'
  | 'permissions.manage';

export type PermissionMatrix = Record<Role, Permission[]>;

export const PERMISSION_LABELS: Record<Permission, string> = {
  'employees.view': 'View All Employees',
  'employees.create': 'Register New Employee',
  'employees.edit': 'Edit Employee Details',
  'employees.delete': 'Delete Employee',
  'employees.reset_password': 'Reset Employee Password',
  'employees.toggle_status': 'Toggle Employee Status',
  'attendance.view': 'View All Attendance',
  'attendance.view_live': 'View Live Attendance',
  'attendance.edit': 'Edit / Correct Clocking Times',
  'attendance.export': 'Export Attendance Reports',
  'attendance.admin_clock': 'Manual Clock Override (on behalf of employees)',
  'calendar.view': 'View Academic Calendar',
  'calendar.create': 'Create Academic Years & Terms',
  'calendar.edit': 'Edit Terms & Breaks',
  'calendar.delete': 'Delete Terms',
  'shifts.manage': 'Manage Shifts',
  'departments.manage': 'Manage Departments',
  'branches.manage': 'Manage Branches',
  'holidays.manage': 'Manage Holidays',
  'leaves.manage': 'Manage Leave Requests',
  'audit.view': 'View Audit Logs',
  'permissions.manage': 'Manage Roles & Permissions',
};

export const PERMISSION_GROUPS: { label: string; icon: string; permissions: Permission[] }[] = [
  {
    label: 'Employee Management',
    icon: '👥',
    permissions: [
      'employees.view',
      'employees.create',
      'employees.edit',
      'employees.delete',
      'employees.reset_password',
      'employees.toggle_status',
    ],
  },
  {
    label: 'Attendance',
    icon: '🕐',
    permissions: [
      'attendance.view',
      'attendance.view_live',
      'attendance.export',
      'attendance.admin_clock',
    ],
  },
  {
    label: 'Academic Calendar',
    icon: '📅',
    permissions: [
      'calendar.view',
      'calendar.create',
      'calendar.edit',
      'calendar.delete',
    ],
  },
  {
    label: 'System Settings',
    icon: '⚙️',
    permissions: [
      'shifts.manage',
      'departments.manage',
      'branches.manage',
      'holidays.manage',
      'leaves.manage',
      'audit.view',
      'permissions.manage',
    ],
  },
];

export const ROLES: { key: Role; label: string; color: string }[] = [
  { key: 'super_admin', label: 'Super Admin', color: '#1105faff' },
  { key: 'hr_admin',    label: 'HR Admin',    color: '#11b802c2' },
  { key: 'supervisor',  label: 'Supervisor',  color: '#eab308' },
];

// ── Default Permissions ────────────────────────────────────────────────────

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  super_admin: [
    'employees.view', 'employees.create', 'employees.edit', 'employees.delete',
    'employees.reset_password', 'employees.toggle_status',
    'attendance.view', 'attendance.view_live', 'attendance.export', 'attendance.admin_clock',
    'calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete',
    'shifts.manage', 'departments.manage', 'branches.manage', 'holidays.manage', 'leaves.manage',
    'audit.view', 'permissions.manage',
  ],
  hr_admin: [
    'employees.view', 'employees.create', 'employees.edit',
    'employees.reset_password', 'employees.toggle_status',
    'attendance.view', 'attendance.view_live', 'attendance.export', 'attendance.admin_clock',
    'calendar.view', 'calendar.create', 'calendar.edit',
    'holidays.manage', 'leaves.manage',
  ],
  supervisor: [
    'employees.view',
    'attendance.view', 'attendance.view_live',
    'calendar.view',
  ],
  employee: [],
};

const STORAGE_KEY = 'tk_permissions';

// ── Cache helpers (localStorage acts as a fast local cache) ────────────────
export function loadPermissions(): PermissionMatrix {
  if (typeof window === 'undefined') return DEFAULT_PERMISSIONS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_PERMISSIONS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_PERMISSIONS;
}

export function savePermissions(matrix: PermissionMatrix): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
  window.dispatchEvent(new Event('permissionsUpdated'));
}

// ── API-backed load: fetches from server, updates cache ───────────────────
export async function fetchAndCachePermissions(): Promise<PermissionMatrix> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return loadPermissions();

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
    const res = await fetch(`${base}/settings/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();

    if (data && typeof data === 'object') {
      const merged: PermissionMatrix = { ...DEFAULT_PERMISSIONS, ...data };
      savePermissions(merged);
      return merged;
    }
  } catch {
    // Network error — use cached / defaults
  }
  return loadPermissions();
}

// ── Sync can() — reads from cache (populated at login / page load) ─────────
export function can(role: Role | string | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  const matrix = loadPermissions();
  const rolePerms = matrix[role as Role] ?? [];
  return rolePerms.includes(permission);
}
