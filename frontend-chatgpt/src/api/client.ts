export type ApiClientConfig = {
  baseUrl?: string;
  tenantSlug: string;
  onAuthFailure?: (message: string) => void;
  onForbidden?: () => void;
  onNetworkError?: (message: string) => void;
  maxNetworkRetries?: number;
};

type RequestOptions = RequestInit & {
  skipAuthRefresh?: boolean;
};

const AUTH_FAILURE_MESSAGE =
  "O sistema está passando por instabilidades e tentará reiniciar.";
const NETWORK_ERROR_MESSAGE = "Problemas de conexão. Tentaremos novamente.";

let currentCorrelationId: string | null = null;

const DEFAULT_MAX_NETWORK_RETRIES = 2;
const NETWORK_RETRY_BASE_DELAY_MS = 5000;

function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  return Math.random().toString(16).slice(2);
}

function getCorrelationId(): string {
  if (!currentCorrelationId) {
    currentCorrelationId = generateCorrelationId();
  }
  return currentCorrelationId;
}

function updateCorrelationIdFromResponse(response: Response) {
  const headerValue = response.headers.get("x-correlation-id");
  if (headerValue) {
    currentCorrelationId = headerValue;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildUrl(baseUrl: string | undefined, path: string) {
  if (!baseUrl) {
    return path;
  }
  return new URL(path, baseUrl).toString();
}

function canUseWindow() {
  return typeof window !== "undefined";
}

export function createApiClient({
  baseUrl,
  tenantSlug,
  onAuthFailure,
  onForbidden,
  onNetworkError,
  maxNetworkRetries = DEFAULT_MAX_NETWORK_RETRIES,
}: ApiClientConfig) {
  const handleAuthFailure = () => {
    if (onAuthFailure) {
      onAuthFailure(AUTH_FAILURE_MESSAGE);
      return;
    }
    if (canUseWindow()) {
      window.alert(AUTH_FAILURE_MESSAGE);
    }
  };

  const handleForbidden = () => {
    if (onForbidden) {
      onForbidden();
      return;
    }
    if (canUseWindow()) {
      window.location.assign("/403");
    }
  };

  const handleNetworkError = () => {
    if (onNetworkError) {
      onNetworkError(NETWORK_ERROR_MESSAGE);
      return;
    }
    if (canUseWindow()) {
      window.alert(NETWORK_ERROR_MESSAGE);
    }
  };

  const buildHeaders = (initHeaders?: HeadersInit) => {
    const headers = new Headers(initHeaders);
    headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Correlation-Id", getCorrelationId());
    return headers;
  };

  const doFetch = async (path: string, options: RequestOptions = {}) => {
    const url = buildUrl(baseUrl, path);
    const headers = buildHeaders(options.headers);
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
    updateCorrelationIdFromResponse(response);
    return response;
  };

  const fetchWithRetry = async (path: string, options: RequestOptions = {}) => {
    let attempt = 0;
    let lastError: unknown;
    const totalAttempts = maxNetworkRetries + 1;

    while (attempt < totalAttempts) {
      try {
        return await doFetch(path, options);
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt >= totalAttempts) {
          break;
        }
        const delay = NETWORK_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    handleNetworkError();
    throw lastError;
  };

  const refreshSession = async () => {
    const response = await doFetch("/api/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true,
    });
    return response.ok;
  };

  const logout = async () => {
    try {
      await doFetch("/api/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      });
    } catch {
      // Best effort logout; no extra handling.
    }
  };

  const request = async (path: string, options: RequestOptions = {}) => {
    const response = await fetchWithRetry(path, options);

    if (response.status === 401 && !options.skipAuthRefresh) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return fetchWithRetry(path, { ...options, skipAuthRefresh: true });
      }

      await logout();
      handleAuthFailure();
      if (canUseWindow()) {
        window.location.assign("/login");
      }
    }

    if (response.status === 403) {
      handleForbidden();
    }

    return response;
  };

  return {
    request,
  };
}
