/**
 * App Layout — Main authenticated layout
 * 
 * Per ARCH_FRONTEND_FROZEN.md:
 * - templates NEVER fetch domain data
 * - templates are visual layout only
 */

import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useMenu } from '@/domains/menu';
import { useAuthEvents } from '@/auth/hooks';
import { BackendUnavailableBanner } from '@/components/BackendUnavailableBanner';
import { Loader2 } from 'lucide-react';

export function AppLayout() {
  // Initialize menu and auth event handlers
  const { isLoading: menuLoading, error: menuError } = useMenu();
  useAuthEvents();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <BackendUnavailableBanner />
          <AppHeader />
          <main className="flex-1 overflow-auto p-6 bg-background">
            {menuLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : menuError ? (
              <div className="system-message system-message--error">
                <p>Erro ao carregar menu. Tentando novamente...</p>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
