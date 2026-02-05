/**
 * Sessão derivada apenas do access_token (payload do JWT).
 * Usado quando o backend não expõe GET /auth/session.
 * Apenas leitura do payload (base64); não valida assinatura — a API valida o token.
 */

import { getAccessToken } from './tokenStorage';
import type { UserSession, CurrentContext } from './types';

interface JwtPayload {
  sub?: string;
  tenant_id?: string;
  tenant_slug?: string;
  organization_id?: string;
  organization_name?: string;
  workspace_id?: string | null;
  workspace_name?: string | null;
  email?: string;
  name?: string;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/** Lê o payload do JWT sem validar assinatura (só para exibir estado no cliente). */
export function decodeJwtPayload(accessToken: string): JwtPayload {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return {};
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
}

function buildMinimalSession(payload: JwtPayload): UserSession | null {
  const sub = payload.sub;
  const tenantId = payload.tenant_id;
  if (!sub || !tenantId) return null;

  const organizationId = payload.organization_id ?? null;
  const workspaceId = payload.workspace_id ?? null;

  const currentContext: CurrentContext | null =
    organizationId != null
      ? {
          organization_id: organizationId,
          organization_name: payload.organization_name ?? 'Organização',
          workspace_id: workspaceId,
          workspace_name: payload.workspace_name ?? (workspaceId ? 'Workspace' : null),
          workspace_mode: 'optional',
        }
      : null;

  return {
    user_id: sub,
    email: payload.email ?? '',
    name: payload.name ?? 'Usuário',
    tenant_id: tenantId,
    tenant_slug: payload.tenant_slug ?? '',
    organizations: [],
    current_context: currentContext,
    requires_context_selection: organizationId == null,
  };
}

/** Obtém sessão mínima a partir do token em memória (sem chamar a API). */
export function getSessionFromToken(): UserSession | null {
  const token = getAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return buildMinimalSession(payload);
}
