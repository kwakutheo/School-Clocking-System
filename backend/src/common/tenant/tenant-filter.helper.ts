import { tenantLocalStorage } from './tenant.context';

/**
 * Returns the active tenant ID from the async-local-storage context.
 * Returns null for SaaS super-admin (global) requests.
 */
export function getCurrentTenantId(): string | null {
  return tenantLocalStorage.getStore() ?? null;
}
