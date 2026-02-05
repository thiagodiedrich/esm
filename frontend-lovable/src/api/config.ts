/**
 * API configuration — backend base URL and derived URLs.
 * Base URL no .env pode incluir /api e /v1 (ex.: http://localhost:3000/api/v1).
 * Rotas no código são relativas: /auth/login, /telemetry/bulk, etc.
 */

/** Base URL for all API requests. Incluir /api e /v1 no .env (ex.: http://localhost:3000/api/v1). */
export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '');

/** Origin (scheme + host) para rotas fora de /api/v1 (ex.: /api/branding) */
export const apiOrigin =
  typeof window !== 'undefined'
    ? new URL(apiBaseUrl).origin
    : 'http://localhost:3000';

/** Full URL for GET /api/v1/health */
export const healthUrl = `${apiBaseUrl}/health`;
