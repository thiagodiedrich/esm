/**
 * Error Boundary — regra de ouro: frontend não pode travar.
 * Exibe mensagem ao usuário e "Tentar novamente". Após X tentativas, logout e /login.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecoveryStore } from '@/stores/recovery.store';
import { useAuthStore } from '@/stores/auth.store';
import { useMenuStore } from '@/stores/menu.store';
import { resetCorrelationId } from '@/api/client';
import { logger } from '@/lib/logger';
import type { QueryClient } from '@tanstack/react-query';

function doLogoutAndRedirect(queryClient: QueryClient) {
  useAuthStore.getState().clearAuth();
  useMenuStore.getState().clearMenu();
  useRecoveryStore.getState().resetRetry();
  queryClient.clear();
  resetCorrelationId();
  window.location.href = '/login';
}

interface AppErrorBoundaryProps {
  children: ReactNode;
  queryClient: QueryClient;
}

interface AppErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryKey: number;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
    errorInfo: null,
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logger.error('[AppErrorBoundary]', error, errorInfo.componentStack);
  }

  handleRetry = () => {
    const { queryClient } = this.props;
    const { incrementRetry, shouldLogout } = useRecoveryStore.getState();

    incrementRetry();

    if (shouldLogout()) {
      logger.debug('[AppErrorBoundary] Max retries reached, logging out');
      doLogoutAndRedirect(queryClient);
      return;
    }

    this.setState((s) => ({
      error: null,
      errorInfo: null,
      retryKey: s.retryKey + 1,
    }));
  };

  render() {
    const { children, queryClient } = this.props;
    const { error, retryKey } = this.state;
    const { retryCount, maxRetries } = useRecoveryStore.getState();

    if (error) {
      const remaining = maxRetries - retryCount;
      const willLogoutOnNext = remaining <= 1;

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Algo deu errado
              </CardTitle>
              <CardDescription className="text-base">
                Ocorreu um erro inesperado. Tente carregar a tela novamente.
                {remaining > 0 && (
                  <> Você pode tentar mais {remaining} vez{remaining !== 1 ? 'es' : ''}.</>
                )}
                {willLogoutOnNext && (
                  <> Na próxima tentativa você será deslogado e enviado à tela de login.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  {willLogoutOnNext ? (
                    <>
                      <LogOut className="h-4 w-4" />
                      Ir para o login
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Tentar novamente
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <div key={retryKey}>{children}</div>;
  }
}
