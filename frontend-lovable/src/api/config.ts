/**
 * API configuration — 100% baseado em VITE_API_URL do .env.
 * Todas as requisições (auth, menu, tenant, health, etc.) usam essa base.
 */

const raw = import.meta.env.VITE_API_URL ?? '';
/** Garante que a base tenha scheme (evita URL relativa e "repetição" do host no path). */
function normalizeBaseUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  if (!trimmed) return 'http://localhost:3000/api/v1';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
/** Base URL para todas as requisições da API. Obrigatório no .env como VITE_API_URL (use URL completa com https://). */
export const apiBaseUrl = normalizeBaseUrl(typeof raw === 'string' && raw.trim() ? raw : 'http://localhost:3000/api/v1');

/** Origin (scheme + host) derivado de VITE_API_URL. */
export const apiOrigin = (() => {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
})();

/** URL do health check: GET {apiBaseUrl}/health */
export const healthUrl = `${apiBaseUrl}/health`;
