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

export const MENU_BASE: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "home",
    route: "/dashboard",
    resource: null,
    action: null,
    product_code: null,
    product_module_code: null,
    children: []
  },
  {
    id: "erp",
    label: "ERP",
    icon: "box",
    route: "/erp",
    resource: null,
    action: null,
    product_code: "erp",
    product_module_code: null,
    children: [
      {
        id: "erp.products",
        label: "Produtos",
        icon: "tag",
        route: "/erp/products",
        resource: "erp.product",
        action: "read",
        product_code: "erp",
        product_module_code: "erp.product",
        children: []
      },
      {
        id: "erp.purchase_requests",
        label: "Solicitacoes de Compra",
        icon: "clipboard",
        route: "/erp/purchase-requests",
        resource: "erp.purchase_request",
        action: "read",
        product_code: "erp",
        product_module_code: "erp.purchase_request",
        children: []
      },
      {
        id: "erp.purchase_orders",
        label: "Pedidos de Compra",
        icon: "file-text",
        route: "/erp/purchase-orders",
        resource: "erp.purchase_order",
        action: "read",
        product_code: "erp",
        product_module_code: "erp.purchase_order",
        children: []
      }
    ]
  },
  {
    id: "telemetry",
    label: "Telemetria",
    icon: "activity",
    route: "/telemetry",
    resource: null,
    action: null,
    product_code: "telemetry",
    product_module_code: null,
    children: [
      {
        id: "telemetry.devices",
        label: "Dispositivos",
        icon: "cpu",
        route: "/telemetry/devices",
        resource: "telemetry.device",
        action: "read",
        product_code: "telemetry",
        product_module_code: "telemetry.device",
        children: []
      },
      {
        id: "telemetry.events",
        label: "Eventos",
        icon: "list",
        route: "/telemetry/events",
        resource: "telemetry.event",
        action: "read",
        product_code: "telemetry",
        product_module_code: "telemetry.event",
        children: []
      }
    ]
  }
];
