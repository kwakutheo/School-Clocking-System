'use client';
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  username?: string;
  role: 'employee' | 'supervisor' | 'hr_admin' | 'super_admin';
  isActive: boolean;
  tenantId: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
    logoUrl: string | null;
    customDomain: string | null;
  } | null;
}

export interface ImpersonatedTenant {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  logoUrl: string | null;
  customDomain: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isHydrated: boolean;
  impersonatedTenant: ImpersonatedTenant | null;
  setAuth: (user: AuthUser, token: string) => void;
  setImpersonatedTenant: (tenant: ImpersonatedTenant | null) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrated: false,
  impersonatedTenant: null,

  setAuth: (user, token) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },

  setImpersonatedTenant: (tenant) => {
    if (tenant) {
      localStorage.setItem('impersonated_tenant_id', tenant.id);
      localStorage.setItem('impersonated_tenant', JSON.stringify(tenant));
    } else {
      localStorage.removeItem('impersonated_tenant_id');
      localStorage.removeItem('impersonated_tenant');
    }
    set({ impersonatedTenant: tenant });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('impersonated_tenant_id');
    localStorage.removeItem('impersonated_tenant');
    set({ user: null, token: null, impersonatedTenant: null });
    window.location.href = '/login';
  },

  hydrate: () => {
    const token = localStorage.getItem('access_token');
    const raw = localStorage.getItem('user');
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    
    const impRaw = localStorage.getItem('impersonated_tenant');
    const impersonatedTenant = impRaw ? (JSON.parse(impRaw) as ImpersonatedTenant) : null;
    
    set({ user, token, impersonatedTenant, isHydrated: true });
  },
}));

export const initials = (name?: string) =>
  name
    ?.split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() ?? '?';

export const roleLabel: Record<string, string> = {
  employee: 'Employee',
  supervisor: 'Supervisor',
  hr_admin: 'HR Admin',
  super_admin: 'Super Admin',
};
