import axios from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Attach token from localStorage on every request ────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Inject impersonated tenant ID if active
    const impersonatedTenantId = localStorage.getItem("impersonated_tenant_id");
    if (impersonatedTenantId) {
      config.headers["x-tenant-id"] = impersonatedTenantId;

      // Block mutating requests when impersonating (except global saas-admin and auth endpoints)
      const method = config.method?.toUpperCase() ?? "";
      const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
      const isSaaSOrAuth =
        config.url?.includes("/saas-admin") || config.url?.includes("/auth");
      if (isMutating && !isSaaSOrAuth) {
        const error = new Error(
          "Portal is in view-only mode. Changes are disabled.",
        );
        (error as any).isViewOnlyBlock = true;
        return Promise.reject(error);
      }
    }

    // Dynamically extract tenant slug from subdomain and inject into headers
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "localhost") {
      config.headers["x-tenant-slug"] = parts[0];
    }
  }
  return config;
});

// ── Redirect to login on 401 ───────────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (typeof window !== "undefined") {
      const isViewOnlyError =
        err.isViewOnlyBlock ||
        err.response?.data?.message?.includes("view-only") ||
        err.response?.data?.message?.includes("View-Only") ||
        (err.response?.status === 403 &&
          String(err.response?.data?.message).includes("disabled"));
      if (isViewOnlyError) {
        alert(
          "🚫 View-Only Mode: You cannot create, edit, or delete items while viewing this school portal.",
        );
        return Promise.reject(err);
      }
    }
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (identifier: string, password: string) =>
    api.post("/auth/login", { identifier, password }),
  me: () => api.get("/auth/me"),
  updateProfile: (data: {
    fullName?: string;
    email?: string;
    phone?: string;
    username?: string;
    password?: string;
  }) => api.patch("/employees/me", data),
  updateMyBranding: (data: {
    name?: string;
    primaryColor?: string;
    logoUrl?: string;
    initials?: string;
  }) => api.put("/tenants/branding", data),
  requestPasswordReset: (email: string) =>
    api.post("/auth/request-password-reset", { email }),
  completePasswordReset: (data: {
    username: string;
    pin: string;
    newPassword: string;
  }) => api.post("/auth/complete-password-reset", data),
};

// ── Attendance ─────────────────────────────────────────────────────────────
export const attendanceApi = {
  history: (page = 1, limit = 20) =>
    api.get(`/attendance/history?page=${page}&limit=${limit}`),
  live: (date?: string) => api.get("/attendance/live", { params: { date } }),
  stats: (date?: string) => api.get("/attendance/stats", { params: { date } }),
  list: (params: any) => api.get("/attendance", { params }),
  getReport: (employeeId: string, month: number, year: number) =>
    api.get(`/attendance/report/${employeeId}`, { params: { month, year } }),
  getTermReport: (employeeId: string, termId: string) =>
    api.get(`/attendance/report/${employeeId}/term/${termId}`),
  /** Returns all employees the acting admin is allowed to clock (excludes self). */
  clockableEmployees: () => api.get("/attendance/clockable-employees"),
  adminManualClock: (data: {
    employeeId: string;
    type: "clock_in" | "clock_out";
    timestamp?: string;
    note: string;
  }) => api.post("/attendance/admin-clock", data),
  exportMonthlyPdf: (employeeId: string, month: number, year: number) =>
    api.get(`/attendance/export/pdf/monthly/${employeeId}`, {
      params: { month, year },
      responseType: "blob",
    }),
  exportTermPdf: (employeeId: string, termId: string) =>
    api.get(`/attendance/export/pdf/term/${employeeId}/term/${termId}`, {
      responseType: "blob",
    }),
  exportBulkMonthlyPdf: (
    month: number,
    year: number,
    branchId?: string,
    branchName?: string,
  ) =>
    api.get(`/attendance/export/bulk/pdf/monthly`, {
      params: { month, year, branchId, branchName },
      responseType: "blob",
    }),
  exportBulkTermPdf: (
    termId: string,
    branchId?: string,
    branchName?: string,
    termName?: string,
  ) =>
    api.get(`/attendance/export/bulk/pdf/term/${termId}`, {
      params: { branchId, branchName, termName },
      responseType: "blob",
    }),
};

// ── Holidays ───────────────────────────────────────────────────────────────
export const holidaysApi = {
  list: () => api.get("/holidays"),
  create: (data: any) => api.post("/holidays", data),
  update: (id: string, data: any) => api.patch(`/holidays/${id}`, data),
  delete: (id: string) => api.delete(`/holidays/${id}`),
};

// ── Shifts ────────────────────────────────────────────────────────────────
export const shiftsApi = {
  list: () => api.get("/shifts"),
  create: (data: any) => api.post("/shifts", data),
  update: (id: string, data: any) => api.patch(`/shifts/${id}`, data),
  delete: (id: string) => api.delete(`/shifts/${id}`),
};

// ── Employees ──────────────────────────────────────────────────────────────
export const employeesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    branchId?: string;
  }) =>
    api.get<{
      data: any[];
      total: number;
      page: number;
      limit: number;
      counts: {
        all: number;
        active: number;
        inactive: number;
        suspended: number;
      };
    }>("/employees", { params }),
  listAll: async () => {
    const res = await api.get<{ data: any[] }>("/employees", {
      params: { limit: 1000 },
    });
    return { ...res, data: res.data.data };
  },
  getById: (id: string) => api.get(`/employees/${id}`),
  register: (data: {
    fullName: string;
    username: string;
    password: string;
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
  }) => api.post("/employees", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  resetPassword: (id: string, adminPassword: string) =>
    api.post(`/employees/${id}/reset-password`, { adminPassword }),
};

// ── Academic Calendar ─────────────────────────────────────────────────────
export const calendarApi = {
  listTerms: () => api.get("/academic-calendar/terms"),
  createTerm: (data: any) => api.post("/academic-calendar/terms", data),
  updateTerm: (id: string, data: any) =>
    api.put(`/academic-calendar/terms/${id}`, data),
  deleteTerm: (id: string) => api.delete(`/academic-calendar/terms/${id}`),
  createBreak: (termId: string, data: any) =>
    api.post(`/academic-calendar/terms/${termId}/breaks`, data),
  deleteBreak: (id: string) => api.delete(`/academic-calendar/breaks/${id}`),
  listGlobalTemplates: () => api.get("/academic-calendar/global-templates"),
  cloneTemplate: (academicYear: string, overwrite?: boolean) =>
    api.post("/academic-calendar/clone-template", { academicYear, overwrite }),
};

// ── Departments ────────────────────────────────────────────────────────────
export const departmentsApi = {
  list: () => api.get("/departments"),
  create: (data: { name: string }) => api.post("/departments", data),
  update: (id: string, data: { name: string }) =>
    api.patch(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
};

// ── Branches ───────────────────────────────────────────────────────────────
export const branchesApi = {
  list: () => api.get("/branches"),
  create: (data: {
    name: string;
    latitude?: number;
    longitude?: number;
    allowedRadius?: number;
  }) => api.post("/branches", data),
  update: (
    id: string,
    data: {
      name?: string;
      latitude?: number;
      longitude?: number;
      allowedRadius?: number;
    },
  ) => api.patch(`/branches/${id}`, data),
  delete: (id: string) => api.delete(`/branches/${id}`),
  getQr: (id: string) => api.get(`/branches/${id}/qr-code`),
  regenerateQr: (id: string, password: string) =>
    api.post(`/branches/${id}/qr-code`, { password }),
};

// ── Audit Logs ─────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: Record<string, any>) => api.get('/audit', { params }),
};

export const usersApi = {
  checkUsername: (username: string, fullName?: string) =>
    api.get<{ available: boolean; suggestions?: string[] }>('/users/check-username', {
      params: { username, fullName },
    }),
};

// ── Settings ───────────────────────────────────────────────────────────────
export const settingsApi = {
  getPermissions: () => api.get("/settings/permissions"),
  updatePermissions: (data: Record<string, string[]>) =>
    api.patch("/settings/permissions", data),
};

// ── SaaS Admin ─────────────────────────────────────────────────────────────
export const saasAdminApi = {
  getStats: (timeframe?: string) =>
    api.get("/saas-admin/stats", { params: { timeframe } }),
  listTenants: (timeframe?: string, params?: Record<string, any>) =>
    api.get("/saas-admin/tenants", { params: { timeframe, ...params } }),
  onboardTenant: (data: {
    name: string;
    slug: string;
    initials: string;
    primaryColor?: string;
    adminUsername: string;
    adminPasswordHash: string;
  }) => api.post("/saas-admin/tenants", data),
  toggleStatus: (id: string, isActive: boolean) =>
    api.put(`/saas-admin/tenants/${id}/status`, { isActive }),
  updateBranding: (
    id: string,
    data: {
      name?: string;
      slug?: string;
      initials?: string;
      primaryColor?: string;
      logoUrl?: string;
      customDomain?: string;
    },
  ) => api.put(`/saas-admin/tenants/${id}`, data),
  deleteTenant: (id: string) => api.delete(`/saas-admin/tenants/${id}`),

  // Bulletins Management (Admin)
  getBulletins: () => api.get("/saas-admin/bulletins"),
  publishBulletin: (data: {
    title: string;
    content: string;
    type: string;
    targetTenantIds?: string[];
  }) => api.post("/saas-admin/bulletins", data),
  updateBulletin: (
    id: string,
    data: {
      title?: string;
      content?: string;
      type?: string;
      isActive?: boolean;
    },
  ) => api.put(`/saas-admin/bulletins/${id}`, data),
  deleteBulletin: (id: string) => api.delete(`/saas-admin/bulletins/${id}`),

  // Bulletins Query (School Users / Public)
  getActiveBulletins: () => api.get("/saas-admin/bulletins/active"),

  // Employee Performance Rankings
  getEmployeeRankings: (params?: {
    timeframe?: string;
    sort?: "best" | "worst";
    page?: number;
    limit?: number;
    search?: string;
    school?: string;
  }) => api.get("/saas-admin/rankings/employees", { params }),
};
