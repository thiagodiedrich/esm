/**
 * Context Switcher — per CONTRACTS_FRONTEND.md
 * 
 * Rules:
 * - Context = organization_id + workspace_id (per ERD)
 * - Backend ALWAYS decides active context
 * - Frontend mirrors visually only
 * - On switch: POST /api/context/switch then refetch menu + domain data
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Layers, Globe, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useContextSwitch } from '@/auth/hooks';
import { Organization, Workspace } from '@/api/types';
import { cn } from '@/lib/utils';

export function ContextSwitcher() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const currentContext = useAuthStore((s) => s.currentContext);
  const contextSwitch = useContextSwitch();
  const [open, setOpen] = useState(false);

  const handleSwitch = (orgId: string, workspaceId: string | null) => {
    contextSwitch.mutate(
      { organization_id: orgId, workspace_id: workspaceId },
      { onSuccess: () => setOpen(false) }
    );
  };
  
  const tenantSlug = user?.tenant_slug || (user?.tenant_id ?? '').slice(0, 8) || '';
  const currentOrgName = currentContext?.organization_name || 'Selecionar organização';
  const currentWorkspaceName = currentContext?.workspace_name;
  const organizations = user?.organizations ?? [];
  const hasOrganizations = organizations.length > 0;

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-3 text-sm font-normal"
          disabled={contextSwitch.isPending}
        >
          {tenantSlug && (
            <>
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[100px] truncate text-muted-foreground">
                {tenantSlug}
              </span>
              <span className="text-muted-foreground">/</span>
            </>
          )}
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[150px] truncate">{currentOrgName}</span>
          {currentWorkspaceName && (
            <>
              <span className="text-muted-foreground">/</span>
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-[100px] truncate text-muted-foreground">
                {currentWorkspaceName}
              </span>
            </>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!hasOrganizations && (
          <DropdownMenuItem onClick={() => { setOpen(false); navigate('/select-context'); }}>
            <Settings className="mr-2 h-4 w-4" />
            Selecionar organização e workspace
          </DropdownMenuItem>
        )}
        {hasOrganizations && organizations.map((org) => (
          <OrganizationItem
            key={org.id}
            organization={org}
            currentContext={currentContext}
            workspaceMode={currentContext?.workspace_mode || 'optional'}
            onSelect={handleSwitch}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ===============================
// ORGANIZATION ITEM
// ===============================

interface OrganizationItemProps {
  organization: Organization;
  currentContext: {
    organization_id: string;
    workspace_id: string | null;
    workspace_mode: 'required' | 'optional';
  } | null;
  workspaceMode: 'required' | 'optional';
  onSelect: (orgId: string, workspaceId: string | null) => void;
}

function OrganizationItem({
  organization,
  currentContext,
  workspaceMode,
  onSelect,
}: OrganizationItemProps) {
  const isCurrentOrg = currentContext?.organization_id === organization.id;
  const hasWorkspaces = organization.workspaces.length > 0;
  
  // If workspaces exist and mode is required, show submenu
  if (hasWorkspaces) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className={cn(isCurrentOrg && 'bg-accent')}
        >
          <Building2 className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{organization.name}</span>
          {organization.is_default && (
            <span className="ml-2 text-xs text-muted-foreground">(padrão)</span>
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          {workspaceMode === 'optional' && (
            <>
              <DropdownMenuItem
                onClick={() => onSelect(organization.id, null)}
                className={cn(
                  isCurrentOrg && !currentContext?.workspace_id && 'bg-accent'
                )}
              >
                <span>Sem workspace</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {organization.workspaces
            .filter((ws) => ws.is_active)
            .map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => onSelect(organization.id, workspace.id)}
                className={cn(
                  currentContext?.workspace_id === workspace.id && 'bg-accent'
                )}
              >
                <Layers className="mr-2 h-3 w-3" />
                <span className="truncate">{workspace.name}</span>
              </DropdownMenuItem>
            ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  
  // No workspaces, direct selection
  return (
    <DropdownMenuItem
      onClick={() => onSelect(organization.id, null)}
      className={cn(isCurrentOrg && 'bg-accent')}
    >
      <Building2 className="mr-2 h-4 w-4" />
      <span className="flex-1 truncate">{organization.name}</span>
      {organization.is_default && (
        <span className="ml-2 text-xs text-muted-foreground">(padrão)</span>
      )}
    </DropdownMenuItem>
  );
}
