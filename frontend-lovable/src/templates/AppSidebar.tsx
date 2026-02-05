/**
 * App Sidebar — per ARCH_FRONTEND_FROZEN.md
 * 
 * Rules:
 * - Menu comes 100% from backend
 * - NEVER hardcode menu items
 * - blocked=true items show tooltip "Funcionalidade não disponível no seu plano"
 * - Frontend renders EXACTLY what backend provides
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Package, 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  ShoppingCart,
  Building2,
  Layers,
  Lock,
  ChevronDown,
  Box,
  Tag,
  ClipboardList,
  Activity,
  Cpu,
  List,
  CreditCard,
  Grid,
  Shield,
  Folder,
  User,
  type LucideIcon
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { NavLink } from '@/components/NavLink';
import { useMenuStore } from '@/stores/menu.store';
import { MenuItem } from '@/api/types';
import { cn } from '@/lib/utils';

// ===============================
// ICON MAPPING
// ===============================

// Ícones alinhados ao backend: menu.base (home, box, tag, clipboard, file-text, activity, cpu, list) e res_menus seed
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  box: Box,
  package: Package,
  tag: Tag,
  clipboard: ClipboardList,
  'file-text': FileText,
  document: FileText,
  activity: Activity,
  cpu: Cpu,
  list: List,
  users: Users,
  user: User,
  settings: Settings,
  chart: BarChart3,
  'bar-chart': BarChart3,
  cart: ShoppingCart,
  building: Building2,
  building2: Building2,
  layers: Layers,
  'credit-card': CreditCard,
  grid: Grid,
  shield: Shield,
  folder: Folder,
};

function getIcon(iconName?: string): LucideIcon {
  if (!iconName) return Layers;
  return iconMap[iconName] || Layers;
}

// ===============================
// BLOCKED ITEM WRAPPER
// ===============================

interface BlockedItemProps {
  children: React.ReactNode;
  blocked?: boolean;
}

function BlockedItemWrapper({ children, blocked }: BlockedItemProps) {
  if (!blocked) return <>{children}</>;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative cursor-not-allowed opacity-60">
          {children}
          <Lock className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-sidebar-muted" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Funcionalidade não disponível no seu plano</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ===============================
// MENU ITEM COMPONENT
// ===============================

interface MenuItemComponentProps {
  item: MenuItem;
  collapsed: boolean;
}

function MenuItemComponent({ item, collapsed }: MenuItemComponentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = getIcon(item.icon);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.route ? location.pathname.startsWith(item.route) : false;
  
  const handleClick = (e: React.MouseEvent) => {
    if (item.blocked) {
      e.preventDefault();
      return;
    }
    if (item.route) {
      navigate(item.route);
    }
  };
  
  // Item with children (collapsible)
  if (hasChildren) {
    return (
      <Collapsible defaultOpen={isActive} className="group/collapsible">
        <SidebarMenuItem>
          <BlockedItemWrapper blocked={item.blocked}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className={cn(
                  'w-full justify-between',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {!collapsed && <span>{item.label}</span>}
                </span>
                {!collapsed && (
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </BlockedItemWrapper>
          
          {!collapsed && (
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.children!.map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    <BlockedItemWrapper blocked={child.blocked}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={child.route === location.pathname}
                      >
                        {child.blocked ? (
                          <span className="cursor-not-allowed">{child.label}</span>
                        ) : (
                          <NavLink to={child.route || '#'}>
                            {child.label}
                          </NavLink>
                        )}
                      </SidebarMenuSubButton>
                    </BlockedItemWrapper>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          )}
        </SidebarMenuItem>
      </Collapsible>
    );
  }
  
  // Simple item
  return (
    <SidebarMenuItem>
      <BlockedItemWrapper blocked={item.blocked}>
        <SidebarMenuButton
          asChild={!item.blocked}
          isActive={isActive}
          onClick={item.blocked ? handleClick : undefined}
        >
          {item.blocked ? (
            <span className="flex items-center gap-2 cursor-not-allowed">
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </span>
          ) : (
            <NavLink to={item.route || '#'}>
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )}
        </SidebarMenuButton>
      </BlockedItemWrapper>
    </SidebarMenuItem>
  );
}

// ===============================
// MAIN SIDEBAR COMPONENT
// ===============================

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const menu = useMenuStore((s) => s.menu);
  
  return (
    <Sidebar
      className="border-r border-sidebar-border"
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider">
            {!collapsed && 'Menu'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {menu.length === 0 ? (
              !collapsed && (
                <p className="px-2 py-3 text-xs text-sidebar-muted">
                  Nenhum item de menu disponível. Verifique se você selecionou organização e workspace ou se seu usuário tem permissões de acesso.
                </p>
              )
            ) : (
              <SidebarMenu>
                {menu.map((item) => (
                  <MenuItemComponent
                    key={item.id}
                    item={item}
                    collapsed={collapsed}
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
