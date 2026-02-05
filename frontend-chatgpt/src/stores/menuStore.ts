import { create } from "zustand";

export type MenuItem = {
  id: string;
  label: string;
  icon: string | null;
  route: string | null;
  blocked: boolean;
  children: MenuItem[];
};

type MenuState = {
  menu: MenuItem[];
  setMenu: (menu: MenuItem[]) => void;
};

export const useMenuStore = create<MenuState>((set) => ({
  menu: [],
  setMenu: (menu) => set({ menu }),
}));
