/**
 * Tipo do item de menu retornado pelo GET /api/v1/menu.
 * Dashboard é sempre o primeiro item (hardcoded); demais vêm de res_menus.
 */
export interface MenuItem {
  id: string;
  label: string;
  icon: string | null;
  route: string | null;
  resource: string | null;
  action: string | null;
  product_code: string | null;
  product_module_code: string | null;
  blocked?: boolean;
  children: MenuItem[];
}
