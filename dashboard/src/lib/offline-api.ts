// ── src/lib/offline-api.ts ──────────────────────────────────────────────────
// Offline-aware wrappers for the subset of mutating API calls that are safe
// to queue and replay later.
//
// Usage (inside any page/component):
//
//   import { offlineApi } from '@/lib/offline-api';
//
//   // Replace:  await attendanceApi.adminManualClock(data)
//   // With:     await offlineApi.adminManualClock(data)
//
// When online  → calls the real axios API exactly as before.
// When offline → saves to IndexedDB queue, returns a mock success response,
//               and dispatches a toast event so the user sees feedback.
//
// This keeps ALL existing page components and error-handling logic working
// unchanged — the only difference is that "offline success" has a different
// toast message.

import { enqueue } from './offline-queue';

// ── Build headers for a queued request ─────────────────────────────────────
// Captures the current auth token and tenant slug at the moment of queuing.
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      headers['x-tenant-slug'] = parts[0];
    }

    const impersonatedTenantId = localStorage.getItem('impersonated_tenant_id');
    if (impersonatedTenantId) {
      headers['x-tenant-id'] = impersonatedTenantId;
    }
  }

  return headers;
}

// ── Resolve the API base URL at runtime ─────────────────────────────────────
function apiBase(): string {
  // Use the same env variable the axios instance uses
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
}

// ── Dispatch a toast for offline queuing ─────────────────────────────────────
function dispatchOfflineToast(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('offline-action-queued', { detail: { message } }),
    );
    // Also update the Sync Center badge
    window.dispatchEvent(new CustomEvent('sync-center-updated'));
  }
}

// ── Generic offline-aware mutation helper ────────────────────────────────────
async function withOfflineFallback<T>(
  /** The real API call (wrapped in a lambda so we only call it when online) */
  onlineCall: () => Promise<T>,
  /** IndexedDB queue parameters for the offline path */
  queueParams: {
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;                         // e.g. '/attendance/admin-clock'
    body: Record<string, unknown> | null;
    label: string;
  },
  /** Message shown to the user when queued offline */
  offlineMessage?: string,
): Promise<T> {
  if (navigator.onLine) {
    return onlineCall();
  }

  // ── Offline path ─────────────────────────────────────────────────────────
  const url = `${apiBase()}${queueParams.path}`;
  await enqueue({
    method: queueParams.method,
    url,
    body: queueParams.body,
    headers: buildHeaders(),
    label: queueParams.label,
  });

  dispatchOfflineToast(
    offlineMessage ?? 'You are offline. This action has been saved and will sync when you reconnect.',
  );

  // Return a mock success response that matches the axios shape just enough
  // for the calling component's `.then()` to not throw.
  return { data: {}, status: 202, statusText: 'Queued Offline' } as unknown as T;
}

// ── Exported offline-aware API surface ───────────────────────────────────────
// Only covers mutations that are safe to replay (idempotent or additive).

export const offlineApi = {

  // ── Attendance ────────────────────────────────────────────────────────────

  adminManualClock: (data: {
    employeeId: string;
    type: 'clock_in' | 'clock_out';
    timestamp?: string;
    note: string;
  }) =>
    withOfflineFallback(
      () => import('./api').then(({ attendanceApi }) => attendanceApi.adminManualClock(data)),
      {
        method: 'POST',
        path: '/attendance/admin-clock',
        body: data as unknown as Record<string, unknown>,
        label: `Manual ${data.type === 'clock_in' ? 'Clock In' : 'Clock Out'}`,
      },
      'You are offline. The clocking record has been saved locally and will sync when you reconnect.',
    ),

  excuseLateness: (logId: string, reason: string) =>
    withOfflineFallback(
      () => import('./api').then(({ attendanceApi }) => attendanceApi.excuseLateness(logId, reason)),
      {
        method: 'POST',
        path: `/attendance/excuse-lateness/${logId}`,
        body: { reason },
        label: `Excuse lateness`,
      },
      'You are offline. The lateness excuse has been saved and will sync when you reconnect.',
    ),

  excuseEarlyOut: (logId: string, reason: string) =>
    withOfflineFallback(
      () => import('./api').then(({ attendanceApi }) => attendanceApi.excuseEarlyOut(logId, reason)),
      {
        method: 'POST',
        path: `/attendance/excuse-early-out/${logId}`,
        body: { reason },
        label: `Excuse early-out`,
      },
      'You are offline. The early-out excuse has been saved and will sync when you reconnect.',
    ),

  // ── Employees ─────────────────────────────────────────────────────────────

  registerEmployee: (data: {
    fullName: string;
    username: string;
    password: string;
    email?: string;
    employeeCode?: string;
    departmentId?: string;
    branchId?: string;
    shiftId?: string;
    position?: string;
    hireDate?: string;
    phone?: string;
    salary?: number;
    overtimeRate?: number;
    latenessDeductionAmount?: number;
    role?: string;
  }) =>
    withOfflineFallback(
      () => import('./api').then(({ employeesApi }) => employeesApi.register(data)),
      {
        method: 'POST',
        path: '/employees',
        body: data as unknown as Record<string, unknown>,
        label: `Register employee "${data.fullName}"`,
      },
      `You are offline. "${data.fullName}" has been queued and will be registered when you reconnect.`,
    ),

  updateEmployee: (id: string, data: Record<string, unknown>) =>
    withOfflineFallback(
      () => import('./api').then(({ employeesApi }) => employeesApi.update(id, data)),
      {
        method: 'PATCH',
        path: `/employees/${id}`,
        body: data,
        label: `Update employee`,
      },
      'You are offline. The employee update has been saved and will sync when you reconnect.',
    ),

  // ── Holidays ──────────────────────────────────────────────────────────────

  createHoliday: (data: { name: string; date: string; isRecurring?: boolean; postponeIfWeekend?: boolean; observedDate?: string | null }) =>
    withOfflineFallback(
      () => import('./api').then(({ holidaysApi }) => holidaysApi.create(data)),
      {
        method: 'POST',
        path: '/holidays',
        body: data as unknown as Record<string, unknown>,
        label: `Create holiday "${data.name}"`,
      },
      `You are offline. Holiday "${data.name}" has been queued and will sync when you reconnect.`,
    ),

  updateHoliday: (id: string, data: any) =>
    withOfflineFallback(
      () => import('./api').then(({ holidaysApi }) => holidaysApi.update(id, data)),
      {
        method: 'PATCH',
        path: `/holidays/${id}`,
        body: data as Record<string, unknown>,
        label: `Update holiday`,
      },
      'You are offline. The holiday update has been queued and will sync when you reconnect.',
    ),

  deleteHoliday: (id: string) =>
    withOfflineFallback(
      () => import('./api').then(({ holidaysApi }) => holidaysApi.delete(id)),
      {
        method: 'DELETE',
        path: `/holidays/${id}`,
        body: null,
        label: `Delete holiday`,
      },
      'You are offline. The delete has been queued and will sync when you reconnect.',
    ),

  // ── Departments ───────────────────────────────────────────────────────────

  createDepartment: (data: { name: string }) =>
    withOfflineFallback(
      () => import('./api').then(({ departmentsApi }) => departmentsApi.create(data)),
      {
        method: 'POST',
        path: '/departments',
        body: data as Record<string, unknown>,
        label: `Create department "${data.name}"`,
      },
      `You are offline. Department "${data.name}" has been queued and will sync when you reconnect.`,
    ),

  updateDepartment: (id: string, data: { name: string }) =>
    withOfflineFallback(
      () => import('./api').then(({ departmentsApi }) => departmentsApi.update(id, data)),
      {
        method: 'PATCH',
        path: `/departments/${id}`,
        body: data as Record<string, unknown>,
        label: `Rename department to "${data.name}"`,
      },
      'You are offline. The department rename has been queued and will sync when you reconnect.',
    ),

  deleteDepartment: (id: string) =>
    withOfflineFallback(
      () => import('./api').then(({ departmentsApi }) => departmentsApi.delete(id)),
      {
        method: 'DELETE',
        path: `/departments/${id}`,
        body: null,
        label: `Delete department`,
      },
      'You are offline. The delete has been queued and will sync when you reconnect.',
    ),

  // ── Shifts ────────────────────────────────────────────────────────────────

  createShift: (data: any) =>
    withOfflineFallback(
      () => import('./api').then(({ shiftsApi }) => shiftsApi.create(data)),
      {
        method: 'POST',
        path: '/shifts',
        body: data as Record<string, unknown>,
        label: `Create shift "${data.name ?? ''}"`,
      },
      'You are offline. The shift has been queued and will sync when you reconnect.',
    ),

  updateShift: (id: string, data: any) =>
    withOfflineFallback(
      () => import('./api').then(({ shiftsApi }) => shiftsApi.update(id, data)),
      {
        method: 'PATCH',
        path: `/shifts/${id}`,
        body: data as Record<string, unknown>,
        label: `Update shift`,
      },
      'You are offline. The shift update has been queued and will sync when you reconnect.',
    ),
};
