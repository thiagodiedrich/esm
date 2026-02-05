/**
 * Backend health status — set by BackendHealthChecker on app startup.
 * Used to show global banner when API is unavailable.
 */

import { create } from 'zustand';

type BackendHealthStatus = 'unknown' | 'ok' | 'error';

interface BackendHealthState {
  status: BackendHealthStatus;
  setStatus: (status: BackendHealthStatus) => void;
}

export const useBackendHealthStore = create<BackendHealthState>((set) => ({
  status: 'unknown',
  setStatus: (status) => set({ status }),
}));
