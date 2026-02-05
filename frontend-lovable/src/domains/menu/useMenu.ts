/**
 * Menu Hook — per ARCH_FRONTEND_FROZEN.md
 * 
 * Rules:
 * - Menu comes ONLY from GET /api/menu
 * - Menu is already filtered by RBAC
 * - Cache TTL is provided by backend (menu_cache_ttl)
 * - blocked=true items are visible but navigation is blocked
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { menuApi } from '@/api/endpoints';
import { useMenuStore } from '@/stores/menu.store';

export function useMenu() {
  const setMenu = useMenuStore((s) => s.setMenu);
  const cacheTtl = useMenuStore((s) => s.cacheTtl);
  
  const query = useQuery({
    queryKey: ['menu'],
    queryFn: menuApi.getMenu,
    staleTime: cacheTtl * 1000, // Convert seconds to ms
    retry: 2,
  });
  
  // Sync to Zustand visual mirror
  useEffect(() => {
    if (query.data) {
      setMenu(query.data.menu, query.data.menu_cache_ttl);
    }
  }, [query.data, setMenu]);
  
  return query;
}
