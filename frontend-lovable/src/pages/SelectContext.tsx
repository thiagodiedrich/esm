/**
 * Context Selection Page — per CONTRACTS_FRONTEND.md
 * 
 * Shown when workspace_required and no context is set
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Layers, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { useContextSwitch } from '@/auth/hooks';
import { cn } from '@/lib/utils';

export default function SelectContextPage() {
  const user = useAuthStore((s) => s.user);
  const contextSwitch = useContextSwitch();
  const navigate = useNavigate();
  
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  
  if (!user) {
    navigate('/login');
    return null;
  }
  
  const selectedOrgData = user.organizations.find((o) => o.id === selectedOrg);
  const workspaceMode = user.current_context?.workspace_mode || 'optional';
  const hasWorkspaces = selectedOrgData?.workspaces && selectedOrgData.workspaces.length > 0;
  const needsWorkspace = workspaceMode === 'required' && hasWorkspaces;
  
  const canProceed = selectedOrg && (!needsWorkspace || selectedWorkspace);
  
  const handleProceed = () => {
    if (!selectedOrg) return;
    
    contextSwitch.mutate(
      {
        organization_id: selectedOrg,
        workspace_id: selectedWorkspace,
      },
      {
        onSuccess: () => {
          navigate('/dashboard');
        },
      }
    );
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Selecione o Contexto
          </CardTitle>
          <CardDescription>
            Escolha a organização {needsWorkspace && 'e workspace'} para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Organization Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">
              Organização
            </label>
            <div className="grid gap-2">
              {user.organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectedOrg(org.id);
                    setSelectedWorkspace(null);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                    'hover:border-primary hover:bg-accent/50',
                    selectedOrg === org.id && 'border-primary bg-accent'
                  )}
                >
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{org.name}</p>
                    {org.is_default && (
                      <p className="text-xs text-muted-foreground">Padrão</p>
                    )}
                  </div>
                  {selectedOrg === org.id && (
                    <ChevronRight className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Workspace Selection (if needed) */}
          {selectedOrg && hasWorkspaces && (
            <div className="space-y-3 animate-fade-in">
              <label className="text-sm font-medium text-muted-foreground">
                Workspace {workspaceMode === 'optional' && '(opcional)'}
              </label>
              <div className="grid gap-2">
                {workspaceMode === 'optional' && (
                  <button
                    onClick={() => setSelectedWorkspace(null)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      'hover:border-primary hover:bg-accent/50',
                      selectedWorkspace === null && 'border-primary bg-accent'
                    )}
                  >
                    <span className="text-sm">Sem workspace</span>
                  </button>
                )}
                {selectedOrgData?.workspaces
                  .filter((ws) => ws.is_active)
                  .map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => setSelectedWorkspace(workspace.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                        'hover:border-primary hover:bg-accent/50',
                        selectedWorkspace === workspace.id && 'border-primary bg-accent'
                      )}
                    >
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{workspace.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
          
          {/* Error message */}
          {contextSwitch.error && (
            <div className="system-message system-message--error">
              <p>{contextSwitch.error.message || 'Erro ao selecionar contexto'}</p>
            </div>
          )}
          
          {/* Proceed button */}
          <Button
            onClick={handleProceed}
            disabled={!canProceed || contextSwitch.isPending}
            className="w-full"
          >
            {contextSwitch.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Continuar'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
