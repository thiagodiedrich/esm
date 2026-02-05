/**
 * Menu Store — Zustand (visual mirror only)
 * 
 * Rules per ARCH_FRONTEND_FROZEN.md:
 * - Menu comes 100% from backend via GET /api/menu
 * - NEVER hardcode menu items
 * - Zustand mirrors menu for layout rendering only
 * - TanStack Query is the source of truth with TTL
 */

import { create } from 'zustand';
import { MenuItem } from '@/api/types';

interface MenuState {
  // Visual state mirrors
  menu: MenuItem[];
  cacheTtl: number; // seconds
  sidebarCollapsed: boolean;
  
  // Actions (visual updates only)
  setMenu: (menu: MenuItem[], ttl: number) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  clearMenu: () => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  menu: [],
  cacheTtl: 300, // default 5 minutes
  sidebarCollapsed: false,
  
  setMenu: (menu, ttl) =>
    set({ menu, cacheTtl: ttl }),
  
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),
  
  clearMenu: () =>
    set({ menu: [], cacheTtl: 300 }),
}));
