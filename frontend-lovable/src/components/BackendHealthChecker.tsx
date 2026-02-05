/**
 * Runs GET /health on app startup and syncs result to backendHealth store.
 * Renders nothing. Mount once inside QueryClientProvider (e.g. in App.tsx).
 */

import { useEffect } from 'react';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { useBackendHealthStore } from '@/stores/backendHealth.store';

export function BackendHealthChecker() {
  const { status } = useHealthCheck();
  const setStatus = useBackendHealthStore((s) => s.setStatus);

  useEffect(() => {
    if (status === 'ok') setStatus('ok');
    else if (status === 'error') setStatus('error');
    // keep 'unknown' while loading
  }, [status, setStatus]);

  return null;
}
