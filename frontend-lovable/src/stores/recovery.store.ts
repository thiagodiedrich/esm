/**
 * Recovery store — regra de ouro: contagem de tentativas "Tentar novamente"
 * antes de forçar logout. Max retries vem de VITE_MAX_RECOVERY_RETRIES.
 */

import { create } from 'zustand';

const maxFromEnv = Number(import.meta.env.VITE_MAX_RECOVERY_RETRIES);
const MAX_RETRIES = Number.isFinite(maxFromEnv) && maxFromEnv > 0 ? maxFromEnv : 3;

interface RecoveryState {
  retryCount: number;
  maxRetries: number;
  incrementRetry: () => void;
  resetRetry: () => void;
  /** true quando retryCount >= maxRetries (deve fazer logout) */
  shouldLogout: () => boolean;
}

export const useRecoveryStore = create<RecoveryState>((set, get) => ({
  retryCount: 0,
  maxRetries: MAX_RETRIES,

  incrementRetry: () =>
    set((s) => ({ retryCount: s.retryCount + 1 })),

  resetRetry: () => set({ retryCount: 0 }),

  shouldLogout: () => get().retryCount >= get().maxRetries,
}));
