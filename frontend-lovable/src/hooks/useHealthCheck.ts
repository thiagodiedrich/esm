/**
 * Health check hook — GET /health
 * Use on Dashboard or layout to show backend status and allow manual recheck.
 */

import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/api/endpoints';

const HEALTH_QUERY_KEY = ['health'];

export function useHealthCheck(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: healthApi.getHealth,
    staleTime: 30 * 1000, // 30s
    retry: 0, // falha rápida para exibir banner (~5s com timeout do health)
    enabled: options?.enabled ?? true,
  });

  return {
    status: query.isLoading
      ? ('loading' as const)
      : query.isError
        ? ('error' as const)
        : ('ok' as const),
    isChecking: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
