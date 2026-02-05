export type AuthFlowConfig = {
  baseUrl?: string;
  tenantSlug: string;
  correlationId?: string;
  onAuthFailure?: (message: string) => void;
  onRedirect?: (path: string) => void;
};

const AUTH_FAILURE_MESSAGE =
  "O sistema está passando por instabilidades e tentará reiniciar.";

function buildUrl(baseUrl: string | undefined, path: string) {
  if (!baseUrl) {
    return path;
  }
  return new URL(path, baseUrl).toString();
}

function buildHeaders(tenantSlug: string, correlationId?: string) {
  const headers = new Headers();
  headers.set("X-Tenant-Slug", tenantSlug);
  if (correlationId) {
    headers.set("X-Correlation-Id", correlationId);
  }
  return headers;
}

function canUseWindow() {
  return typeof window !== "undefined";
}

export function createAuthFlow({
  baseUrl,
  tenantSlug,
  correlationId,
  onAuthFailure,
  onRedirect,
}: AuthFlowConfig) {
  const notifyFailure = () => {
    if (onAuthFailure) {
      onAuthFailure(AUTH_FAILURE_MESSAGE);
      return;
    }
    if (canUseWindow()) {
      window.alert(AUTH_FAILURE_MESSAGE);
    }
  };

  const redirectToLogin = () => {
    if (onRedirect) {
      onRedirect("/login");
      return;
    }
    if (canUseWindow()) {
      window.location.assign("/login");
    }
  };

  const refreshSession = async () => {
    const response = await fetch(buildUrl(baseUrl, "/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: buildHeaders(tenantSlug, correlationId),
    });
    return response.ok;
  };

  const logout = async () => {
    try {
      await fetch(buildUrl(baseUrl, "/api/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: buildHeaders(tenantSlug, correlationId),
      });
    } catch {
      // Best effort logout only.
    }
  };

  const handleAuthFailure = async () => {
    await logout();
    notifyFailure();
    redirectToLogin();
  };

  const handleUnauthorized = async () => {
    const refreshed = await refreshSession();
    if (refreshed) {
      return true;
    }
    await handleAuthFailure();
    return false;
  };

  return {
    refreshSession,
    logout,
    handleAuthFailure,
    handleUnauthorized,
  };
}
