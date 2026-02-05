/**
 * Auth Store — Zustand (visual mirror only)
 * 
 * Rules per ARCH_FRONTEND_FROZEN.md:
 * - Zustand is for visual state ONLY
 * - NEVER fetch data from stores
 * - TanStack Query is the source of truth
 */

import { create } from 'zustand';
import { UserSession, CurrentContext } from '@/api/types';
import { clearTokens } from '@/api/tokenStorage';

interface AuthState {
  // Visual state mirrors
  isAuthenticated: boolean;
  user: UserSession | null;
  currentContext: CurrentContext | null;
  
  // Actions (visual updates only)
  setUser: (user: UserSession | null) => void;
  setContext: (context: CurrentContext | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  currentContext: null,
  
  setUser: (user) =>
    set({
      isAuthenticated: !!user,
      user,
      currentContext: user?.current_context ?? null,
    }),
  
  setContext: (context) =>
    set({ currentContext: context }),
  
  clearAuth: () => {
    clearTokens();
    set({
      isAuthenticated: false,
      user: null,
      currentContext: null,
    });
  },
}));
