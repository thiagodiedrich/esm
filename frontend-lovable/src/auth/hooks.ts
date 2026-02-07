/**
 * Auth Hooks — per ARCH_FRONTEND_FROZEN.md
 *
 * Sessão derivada do token (sem GET /api/auth/session) quando o backend
 * só expõe POST /login com tokens no body. Estado mínimo para UI.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { authApi, contextApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth.store';
import { useMenuStore } from '@/stores/menu.store';
import { useRecoveryStore } from '@/stores/recovery.store';
import { LoginRequest, ContextSwitchRequest, ApiError } from '@/api/types';
import { resetCorrelationId } from '@/api/client';
import { setAccessToken, setRefreshToken, getAccessToken, getRefreshToken } from '@/api/tokenStorage';
import { getSessionFromToken } from '@/api/sessionFromToken';
import { logger } from '@/lib/logger';

// ===============================
// SESSION — derivada do token (sem chamar API)
// ===============================

export function useSession() {
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const query = useQuery({
    queryKey: ['session', getAccessToken() ?? ''],
    queryFn: () => {
      const session = getSessionFromToken();
      if (!session) throw new Error('No token');
      return session;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!getAccessToken(),
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  useEffect(() => {
    if (query.error) clearAuth();
  }, [query.error, clearAuth]);

  return query;
}

// ===============================
// LOGIN MUTATION
// ===============================

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const data = await authApi.login(credentials);
      if (data?.access_token) setAccessToken(data.access_token);
      if (data?.refresh_token) setRefreshToken(data.refresh_token);
      resetCorrelationId();
      useRecoveryStore.getState().resetRetry();
      // Busca sessão completa (organizations, tenant_slug) via auth/me
      try {
        const raw = await authApi.getMe() as Record<string, unknown>;
        const session = {
          ...raw,
          user_id: raw.user_id ?? raw.id,
          organizations: Array.isArray(raw.organizations) ? raw.organizations : [],
        };
        useAuthStore.getState().setUser(session);
      } catch {
        const fallback = getSessionFromToken();
        if (fallback) useAuthStore.getState().setUser(fallback);
      }
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      return data;
    },
    onError: (error: ApiError) => {
      logger.error('Login failed:', error.message);
    },
  });
}

// ===============================
// LOGOUT MUTATION
// ===============================

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearMenu = useMenuStore((s) => s.clearMenu);
  
  const mutation = useMutation({
    mutationFn: async () => {
      const refresh = getRefreshToken();
      try {
        await authApi.logout(refresh ?? undefined);
      } catch {
        // Rede/erro: mesmo assim limpa local e redireciona em onSettled
      }
    },
    onSettled: () => {
      clearAuth();
      clearMenu();
      queryClient.clear();
      resetCorrelationId();
      navigate('/login');
    },
  });
  
  // Listen for forced logout events per ERROR_HANDLING.md (ref evita re-registro a cada render)
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  useEffect(() => {
    const handleForceLogout = () => {
      mutateRef.current();
    };
    window.addEventListener('auth:logout', handleForceLogout);
    return () => window.removeEventListener('auth:logout', handleForceLogout);
  }, []);

  return mutation;
}

// ===============================
// CONTEXT SWITCH MUTATION
// ===============================

export function useContextSwitch() {
  const queryClient = useQueryClient();
  const setContext = useAuthStore((s) => s.setContext);
  
  return useMutation({
    mutationFn: (request: ContextSwitchRequest) => contextApi.switch(request),
    onSuccess: (response) => {
      // Update visual mirror
      setContext(response.current_context);
      
      // Refetch menu and domain data per CONTRACTS_FRONTEND.md
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      // Note: Domain-specific queries should use context in their keys
    },
  });
}

// ===============================
// AUTH EVENT HANDLERS
// ===============================

export function useAuthEvents() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleForbidden = () => {
      navigate('/403');
    };
    
    window.addEventListener('auth:forbidden', handleForbidden);
    return () => window.removeEventListener('auth:forbidden', handleForbidden);
  }, [navigate]);
}

// ===============================
// AUTH GUARD HOOK
// ===============================

export function useRequireAuth() {
  const { data: session, isLoading, error } = useSession();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isLoading && (error || !session)) {
      navigate('/login');
    }
  }, [isLoading, error, session, navigate]);
  
  return { session, isLoading, isAuthenticated: !!session };
}

// ===============================
// CONTEXT GUARD HOOK
// ===============================

export function useRequireContext() {
  const { session, isLoading, isAuthenticated } = useRequireAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isLoading && isAuthenticated && session?.requires_context_selection) {
      navigate('/select-context');
    }
  }, [isLoading, isAuthenticated, session, navigate]);
  
  return {
    session,
    isLoading,
    isAuthenticated,
    hasContext: isAuthenticated && !session?.requires_context_selection,
  };
}
