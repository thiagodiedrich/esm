/**
 * API Types — Based on ERD_FROZEN.md and CONTRACTS_BACKEND.md
 * DO NOT modify without ERD changes
 */

// ===============================
// CORRELATION & OBSERVABILITY
// ===============================

export interface CorrelationContext {
  correlationId: string;
  tenantSlug: string;
  organizationId?: string;
  workspaceId?: string;
}

// ===============================
// ERROR HANDLING — per ERROR_HANDLING.md
// ===============================

export type ErrorType = 
  | 'AUTH_ERROR'      // 401
  | 'PERMISSION_ERROR' // 403
  | 'SERVER_ERROR'     // 5xx
  | 'NETWORK_ERROR'    // Network failures
  | 'VALIDATION_ERROR' // 400
  | 'NOT_FOUND';       // 404

export interface ApiError {
  type: ErrorType;
  status?: number;
  message: string;
  correlationId?: string;
  retryable: boolean;
}

// ===============================
// HEALTH — per backend docs/swagger.md
// ===============================

export interface HealthResponse {
  status: 'ok';
}

// ===============================
// AUTH — per CONTRACTS_BACKEND.md & swagger.md
// ===============================

export interface LoginRequest {
  email: string;
  password: string;
}

/** Backend may return tokens in body (swagger) or set httpOnly cookies */
export interface LoginResponse {
  success?: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface RefreshResponse {
  success: boolean;
}

// ===============================
// CONTEXT — per CONTRACTS_BACKEND.md
// ===============================

export interface ContextSwitchRequest {
  organization_id: string;
  workspace_id: string | null;
}

export interface ContextSwitchResponse {
  success: boolean;
  current_context: CurrentContext;
}

export interface CurrentContext {
  organization_id: string;
  organization_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_mode: 'required' | 'optional';
}

// ===============================
// MENU — per CONTRACTS_BACKEND.md
// ===============================

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  blocked?: boolean; // upsell feature
  children?: MenuItem[];
}

export interface MenuResponse {
  menu: MenuItem[];
  menu_cache_ttl: number; // seconds
}

// ===============================
// USER SESSION
// ===============================

export interface UserSession {
  user_id: string;
  email: string;
  name: string;
  tenant_id: string;
  tenant_slug: string;
  organizations: Organization[];
  current_context: CurrentContext | null;
  requires_context_selection: boolean;
}

export interface Organization {
  id: string;
  name: string;
  is_default: boolean;
  workspaces: Workspace[];
}

export interface Workspace {
  id: string;
  name: string;
  is_active: boolean;
}

// ===============================
// ERD ENTITIES — Subset for frontend
// Based on ERD_FROZEN.md
// ===============================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface ResPartner {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  telephone: string;
  type: 'pf' | 'pj';
  document: string;
  location_address: string;
  location_address_number: string;
  location_address_zip: string;
}

export interface ResOrganization {
  id: string;
  tenant_id: string;
  partner_id: string;
  name: string;
  is_default: boolean;
}

export interface ResWorkspace {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
}

export interface ResUser {
  id: string;
  tenant_id: string;
  partner_id: string;
  email: string;
  is_active: boolean;
}

export interface ResRole {
  id: string;
  tenant_id: string;
  name: string;
  scope_type: 'tenant' | 'organization' | 'workspace';
}

export interface PlatformProduct {
  id: string;
  code: string;
  name: string;
}

export interface PlatformProductModule {
  id: string;
  product_id: string;
  code: string;
  name: string;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
}

// ===============================
// TELEMETRY — per backend docs/swagger.md
// ===============================

/** POST /telemetry/bulk — body is free JSON */
export type TelemetryBulkPayload = Record<string, unknown>;

export interface TelemetryBulkResponse {
  status: 'accepted';
  event_id: string;
  claim_check: string;
}
