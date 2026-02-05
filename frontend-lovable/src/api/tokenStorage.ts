/**
 * Token storage — access_token e refresh_token em memória.
 * O backend retorna tokens no body do login (não usa cookies).
 * Limpar em logout/clearAuth.
 */

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function setRefreshToken(token: string): void {
  refreshToken = token;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}
