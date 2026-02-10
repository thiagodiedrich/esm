/**
 * API Client — per CONTRACTS_BACKEND.md and ERROR_HANDLING.md
 * 
 * Rules:
 * - Always send X-Tenant-Slug header
 * - Always send X-Correlation-Id header
 * - Handle 401 with refresh flow
 * - Handle 403 by redirecting to /403
 * - Network errors: retry with exponential backoff (max 3 attempts)
 */

import { ApiError, ErrorType } from './types';
import { apiBaseUrl } from './config';
import { getAccessToken } from './tokenStorage';

const API_BASE_URL = apiBaseUrl;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 5000; // 5 seconds per ERROR_HANDLING.md

// ===============================
// CORRELATION ID
// ===============================

function generateCorrelationId(): string {
  return crypto.randomUUID();
}

let currentCorrelationId: string = generateCorrelationId();

export function getCorrelationId(): string {
  return currentCorrelationId;
}

export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export function resetCorrelationId(): void {
  currentCorrelationId = generateCorrelationId();
}

// ===============================
// TENANT RESOLUTION
// ===============================

function getTenantSlug(): string {
  // VITE_TENANT_SLUG: override fixo (ex.: default-tenant quando o tenant no banco e esse)
  const override = import.meta.env.VITE_TENANT_SLUG;
  if (typeof override === 'string' && override.trim()) {
    return override.trim();
  }

  // VITE_USE_DEFAULT_TENANT=true: usa default-tenant em qualquer host (testes, quando subdominio nao bate com o banco)
  if (import.meta.env.VITE_USE_DEFAULT_TENANT === 'true') {
    return import.meta.env.VITE_DEFAULT_TENANT || 'default-tenant';
  }

  // Per CONTRACTS_BACKEND.md: resolved by domain/subdomain
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // In development, use a default tenant
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEFAULT_TENANT || 'default-tenant';
  }
  
  // Extract subdomain as tenant slug
  if (parts.length > 2) {
    return parts[0];
  }
  
  return import.meta.env.VITE_DEFAULT_TENANT || 'default-tenant';
}

// ===============================
// ERROR CLASSIFICATION — per ERROR_HANDLING.md
// ===============================

function classifyError(status: number | undefined): ErrorType {
  if (!status) return 'NETWORK_ERROR';
  if (status === 401) return 'AUTH_ERROR';
  if (status === 403) return 'PERMISSION_ERROR';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400) return 'VALIDATION_ERROR';
  if (status >= 500) return 'SERVER_ERROR';
  return 'SERVER_ERROR';
}

function isRetryable(errorType: ErrorType): boolean {
  return errorType === 'NETWORK_ERROR' || errorType === 'SERVER_ERROR';
}

// ===============================
// STRUCTURED LOGGING — per OBSERVABILITY_BACKEND.md
// ===============================

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  correlation_id: string;
  route: string;
  context: Record<string, unknown>;
  data?: Record<string, unknown>;
}

function log(entry: Omit<LogEntry, 'timestamp' | 'correlation_id'>): void {
  if (import.meta.env.VITE_DEBUG !== 'true') return;
  
  const fullEntry: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    correlation_id: currentCorrelationId,
  };
  
  console.log(JSON.stringify(fullEntry));
}

// ===============================
// REFRESH TOKEN FLOW
// ===============================

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Tenant-Slug': getTenantSlug(),
          'X-Correlation-Id': currentCorrelationId,
        },
      });
      
      if (response.ok) {
        log({
          level: 'info',
          message: 'Token refresh successful',
          route: '/auth/refresh',
          context: {},
        });
        return true;
      }
      
      log({
        level: 'warn',
        message: 'Token refresh failed',
        route: '/auth/refresh',
        context: { status: response.status },
      });
      return false;
    } catch {
      log({
        level: 'error',
        message: 'Token refresh network error',
        route: '/auth/refresh',
        context: {},
      });
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

// ===============================
// REQUEST WITH RETRY
// ===============================

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  retryCount?: number;
  /** Timeout em ms (ex.: 10000 para login não travar). */
  timeoutMs?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, retryCount = 0, timeoutMs, ...fetchOptions } = options;
  
  const headers = new Headers(fetchOptions.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Tenant-Slug', getTenantSlug());
  headers.set('X-Correlation-Id', currentCorrelationId);
  const token = !skipAuth ? getAccessToken() : null;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller && timeoutMs
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;
  
  log({
    level: 'info',
    message: `API Request: ${fetchOptions.method || 'GET'} ${endpoint}`,
    route: endpoint,
    context: { retryCount },
  });
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller?.signal,
    });
    
    // Update correlation ID if backend returns a different one
    const backendCorrelationId = response.headers.get('X-Correlation-Id');
    if (backendCorrelationId && backendCorrelationId !== currentCorrelationId) {
      setCorrelationId(backendCorrelationId);
    }
    
    // Handle 401 — per ERROR_HANDLING.md
    if (response.status === 401 && !skipAuth) {
      log({
        level: 'warn',
        message: 'Received 401, attempting refresh',
        route: endpoint,
        context: {},
      });
      
      const refreshSuccess = await attemptRefresh();
      
      if (refreshSuccess) {
        // Retry original request
        return apiRequest<T>(endpoint, { ...options, retryCount: 0 });
      }
      
      // Refresh failed — trigger logout flow
      const error: ApiError = {
        type: 'AUTH_ERROR',
        status: 401,
        message: 'O sistema está passando por instabilidades e tentará reiniciar.',
        correlationId: currentCorrelationId,
        retryable: false,
      };
      
      // Dispatch logout event for auth handlers
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: error }));
      throw error;
    }
    
    // Handle 403 — per ERROR_HANDLING.md
    if (response.status === 403) {
      const error: ApiError = {
        type: 'PERMISSION_ERROR',
        status: 403,
        message: 'Acesso negado',
        correlationId: currentCorrelationId,
        retryable: false,
      };
      
      // Dispatch permission error for routing
      window.dispatchEvent(new CustomEvent('auth:forbidden', { detail: error }));
      throw error;
    }
    
    // Handle other errors (400, 404, 500, etc.) — temos resposta da API, usar mensagem do body
    if (!response.ok) {
      const errorType = classifyError(response.status);

      // Retry if retryable and under limit
      if (isRetryable(errorType) && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        log({
          level: 'warn',
          message: `Request failed, retrying in ${delay}ms`,
          route: endpoint,
          context: { status: response.status, retryCount: retryCount + 1 },
        });
        
        await sleep(delay);
        return apiRequest<T>(endpoint, { ...options, retryCount: retryCount + 1 });
      }
      
      let errorMessage = 'Erro ao processar requisição';
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorMessage;
      } catch {
        // Ignore parse errors
      }
      
      const error: ApiError = {
        type: errorType,
        status: response.status,
        message: errorMessage,
        correlationId: currentCorrelationId,
        retryable: isRetryable(errorType),
      };
      
      throw error;
    }
    
    // Success
    if (response.status === 204) {
      return {} as T;
    }
    
    return response.json();
  } catch (error) {
    // Erro de comunicacao: so quando nao ha resposta (fetch falhou, timeout, CORS bloqueou)
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const isNetwork = error instanceof TypeError && error.message.includes('fetch');
    if (isAbort || isNetwork) {
      const isTimeout = isAbort;
      if (!isTimeout && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        log({
          level: 'warn',
          message: `Network error, retrying in ${delay}ms`,
          route: endpoint,
          context: { retryCount: retryCount + 1 },
        });
        
        await sleep(delay);
        return apiRequest<T>(endpoint, { ...options, retryCount: retryCount + 1 });
      }
      
      const networkError: ApiError = {
        type: 'NETWORK_ERROR',
        message: isTimeout
          ? 'Sem comunicação com o backend. Verifique se a API está em execução.'
          : 'Problemas de conexão. Tentaremos novamente.',
        correlationId: currentCorrelationId,
        retryable: !isTimeout,
      };
      
      throw networkError;
    }
    
    // Re-throw ApiError
    if ((error as ApiError).type) {
      throw error;
    }
    
    // Unknown error
    throw {
      type: 'SERVER_ERROR',
      message: 'Erro inesperado',
      correlationId: currentCorrelationId,
      retryable: false,
    } as ApiError;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ===============================
// CONVENIENCE METHODS
// ===============================

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
