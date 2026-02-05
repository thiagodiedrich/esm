/**
 * API Endpoints — per contrato da API
 * Base: VITE_API_URL (ex.: http://localhost:3000/api/v1)
 */

import { api } from './client';
import { healthUrl, apiOrigin } from './config';
import {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  ContextSwitchRequest,
  ContextSwitchResponse,
  MenuResponse,
  HealthResponse,
  TelemetryBulkPayload,
  TelemetryBulkResponse,
  UserSession,
} from './types';

// ===============================
// HEALTH — GET /api/v1/health
// ===============================

const HEALTH_TIMEOUT_MS = 5000; // 5s — falha rápida para exibir banner

export const healthApi = {
  /**
   * GET /api/v1/health — Healthcheck da API. Public; no auth.
   */
  getHealth: async (): Promise<HealthResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * GET /api/v1/health/detailed — Healthcheck detalhado (dependências).
   */
  getHealthDetailed: () => api.get<Record<string, unknown>>('/health/detailed'),
};

// ===============================
// AUTH ENDPOINTS
// ===============================

export const authApi = {
  /**
   * POST /api/v1/auth/login — Login de usuário.
   */
  login: (credentials: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', credentials, {
      skipAuth: true,
      timeoutMs: 10000,
    }),

  /**
   * POST /api/v1/auth/refresh — Refresh de token.
   */
  refresh: () =>
    api.post<RefreshResponse>('/auth/refresh', undefined, { skipAuth: true }),

  /**
   * GET /api/v1/auth/me — Dados do usuário logado.
   */
  getMe: () => api.get<UserSession>('/auth/me'),

  /**
   * POST /api/v1/auth/logout — Logout: invalida token, revoga refresh, encerra sessão.
   * Enviar Authorization: Bearer <access_token> e opcionalmente body { refresh_token }.
   */
  logout: (refreshToken?: string | null) =>
    api.post<void>('/auth/logout', { refresh_token: refreshToken ?? undefined }, { skipAuth: false }),
};

// ===============================
// CONTEXT ENDPOINTS
// ===============================

export const contextApi = {
  /**
   * POST /api/v1/context/switch — Troca de contexto (org/workspace).
   */
  switch: (request: ContextSwitchRequest) =>
    api.post<ContextSwitchResponse>('/context/switch', request),
};

// ===============================
// MENU ENDPOINTS
// ===============================

/** Backend GET /menu returns { items: MenuItem[] }. Each item: id, label, icon, route, blocked, children. */
interface MenuItemRaw {
  id: string;
  label?: string;
  title?: string;
  icon?: string | null;
  route?: string | null;
  blocked?: boolean;
  children?: MenuItemRaw[];
}

interface MenuApiResponse {
  menu?: MenuResponse['menu'];
  menu_cache_ttl?: number;
  items?: MenuItemRaw[];
}

function normalizeMenuItem(it: MenuItemRaw): MenuResponse['menu'][number] {
  const label = it.label ?? it.title ?? '';
  const children = Array.isArray(it.children) ? it.children.map(normalizeMenuItem) : [];
  return {
    id: it.id,
    label,
    icon: it.icon ?? undefined,
    route: it.route ?? undefined,
    blocked: it.blocked,
    children: children.length ? children : undefined,
  };
}

function normalizeMenuResponse(data: MenuApiResponse): MenuResponse {
  if (data.menu !== undefined && data.menu_cache_ttl !== undefined) {
    return { menu: data.menu, menu_cache_ttl: data.menu_cache_ttl };
  }
  if (data.items?.length) {
    return {
      menu: data.items.map((it) => normalizeMenuItem(it)),
      menu_cache_ttl: data.menu_cache_ttl ?? 300,
    };
  }
  return { menu: [], menu_cache_ttl: 300 };
}

export const menuApi = {
  /**
   * GET /api/v1/menu — Retorna o menu do usuário logado (RBAC).
   */
  getMenu: async (): Promise<MenuResponse> => {
    const data = await api.get<MenuApiResponse>('/menu');
    return normalizeMenuResponse(data);
  },
};

// ===============================
// TELEMETRY — per backend docs/swagger.md
// ===============================

export const telemetryApi = {
  /**
   * POST /api/v1/telemetry/bulk — Ingestão bulk com claim-check.
   */
  postBulk: (payload: TelemetryBulkPayload) =>
    api.post<TelemetryBulkResponse>('/telemetry/bulk', payload),
};

// ===============================
// BRANDING — GET /api/branding/defaults (sem /v1)
// ===============================

export const brandingApi = {
  getDefaults: () =>
    fetch(`${apiOrigin}/api/branding/defaults`).then((r) => {
      if (!r.ok) throw new Error(`Branding failed: ${r.status}`);
      return r.json();
    }),
};

// ===============================
// ADMIN — Base /api/v1/admin
// ===============================

export const adminApi = {
  tenants: {
    create: (data: Record<string, unknown>) => api.post('/admin/tenants', data),
    list: () => api.get<{ items: unknown[] }>('/admin/tenants'),
    get: (id: string) => api.get<Record<string, unknown>>(`/admin/tenants/${id}`),
    update: (id: string, data: Record<string, unknown>) => api.put(`/admin/tenants/${id}`, data),
    updateStatus: (id: string, data: { migration_status?: string }) =>
      api.patch(`/admin/tenants/${id}/status`, data),
  },
  plans: {
    create: (data: Record<string, unknown>) => api.post('/admin/plans', data),
    list: () => api.get<{ items: unknown[] }>('/admin/plans'),
    update: (code: string, data: Record<string, unknown>) => api.put(`/admin/plans/${code}`, data),
    updateStatus: (code: string, data: Record<string, unknown>) =>
      api.patch(`/admin/plans/${code}/status`, data),
  },
  platformProducts: {
    create: (data: Record<string, unknown>) => api.post('/admin/platform-products', data),
    list: () => api.get<{ items: unknown[] }>('/admin/platform-products'),
    get: (id: string) => api.get<Record<string, unknown>>(`/admin/platform-products/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/admin/platform-products/${id}`, data),
    delete: (id: string) => api.delete(`/admin/platform-products/${id}`),
  },
  platformProductModules: {
    create: (data: Record<string, unknown>) =>
      api.post('/admin/platform-product-modules', data),
    list: (params?: { product_id?: string }) => {
      const qs = params?.product_id ? `?product_id=${params.product_id}` : '';
      return api.get<{ items: unknown[] }>(`/admin/platform-product-modules${qs}`);
    },
    get: (id: string) => api.get<Record<string, unknown>>(`/admin/platform-product-modules/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/admin/platform-product-modules/${id}`, data),
    delete: (id: string) => api.delete(`/admin/platform-product-modules/${id}`),
  },
  tenantProducts: {
    create: (tenantId: string, data: Record<string, unknown>) =>
      api.post(`/admin/tenants/${tenantId}/products`, data),
    list: (tenantId: string) => api.get<{ items: unknown[] }>(`/admin/tenants/${tenantId}/products`),
    get: (tenantId: string, id: string) =>
      api.get<Record<string, unknown>>(`/admin/tenants/${tenantId}/products/${id}`),
    update: (tenantId: string, id: string, data: Record<string, unknown>) =>
      api.put(`/admin/tenants/${tenantId}/products/${id}`, data),
    delete: (tenantId: string, id: string) =>
      api.delete(`/admin/tenants/${tenantId}/products/${id}`),
  },
  usageMetrics: (tenantId: string) =>
    api.get<{ items: unknown[] }>(`/admin/tenants/${tenantId}/usage-metrics`),
  permissions: {
    create: (data: Record<string, unknown>) => api.post('/admin/permissions', data),
    list: () => api.get<{ items: unknown[] }>('/admin/permissions'),
    get: (id: string) => api.get<Record<string, unknown>>(`/admin/permissions/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/admin/permissions/${id}`, data),
    delete: (id: string) => api.delete(`/admin/permissions/${id}`),
  },
};

// ===============================
// TENANT — Base /api/v1/tenant
// ===============================

export const tenantApi = {
  organizations: {
    create: (data: Record<string, unknown>) => api.post('/tenant/organizations', data),
    list: () => api.get<{ items: unknown[] }>('/tenant/organizations'),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/tenant/organizations/${id}`, data),
    delete: (id: string) => api.delete(`/tenant/organizations/${id}`),
  },
  workspaces: {
    create: (data: Record<string, unknown>) => api.post('/tenant/workspaces', data),
    list: () => api.get<{ items: unknown[] }>('/tenant/workspaces'),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/tenant/workspaces/${id}`, data),
    delete: (id: string) => api.delete(`/tenant/workspaces/${id}`),
  },
  users: {
    create: (data: Record<string, unknown>) => api.post('/tenant/users', data),
    list: () => api.get<{ items: unknown[] }>('/tenant/users'),
    get: (id: string) => api.get<Record<string, unknown>>(`/tenant/users/${id}`),
    update: (id: string, data: { email?: string; password?: string; partner_id?: string | null; is_active?: boolean }) =>
      api.put(`/tenant/users/${id}`, data),
    delete: (id: string) => api.delete(`/tenant/users/${id}`),
    updatePassword: (id: string, data: { password: string }) =>
      api.patch(`/tenant/users/${id}/password`, data),
    updateStatus: (id: string, data: { is_active: boolean }) =>
      api.patch(`/tenant/users/${id}/status`, data),
  },
  partners: {
    create: (data: Record<string, unknown>) => api.post('/tenant/partners', data),
    list: (params?: { organization_id?: string }) => {
      const qs = params?.organization_id ? `?organization_id=${params.organization_id}` : '';
      return api.get<{ items: unknown[] }>(`/tenant/partners${qs}`);
    },
    get: (id: string) => api.get<Record<string, unknown>>(`/tenant/partners/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/tenant/partners/${id}`, data),
    delete: (id: string) => api.delete(`/tenant/partners/${id}`),
  },
  roles: {
    create: (data: Record<string, unknown>) => api.post('/tenant/roles', data),
    list: () => api.get<{ items: unknown[] }>('/tenant/roles'),
    get: (id: string) => api.get<Record<string, unknown>>(`/tenant/roles/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/tenant/roles/${id}`, data),
    delete: (id: string) => api.delete(`/tenant/roles/${id}`),
  },
  userRoles: (userId: string) => api.get<{ items: unknown[] }>(`/tenant/users/${userId}/roles`),
  addUserRole: (userId: string, data: { role_id: string; scope_type?: string; scope_id?: string }) =>
    api.post(`/tenant/users/${userId}/roles`, data),
  removeUserRole: (userId: string, roleId: string) =>
    api.delete(`/tenant/users/${userId}/roles/${roleId}`),
  organizationSettings: {
    get: (orgId: string) => api.get<Record<string, unknown>>(`/tenant/organizations/${orgId}/settings`),
    update: (orgId: string, data: Record<string, unknown>) =>
      api.put(`/tenant/organizations/${orgId}/settings`, data),
  },
};
