/**
 * Banner shown when GET /health fails. Used in AppLayout and PublicLayout.
 * Inclui botão "Continuar para login" e redirecionamento automático após X segundos.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBackendHealthStore } from '@/stores/backendHealth.store';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { AlertTriangle, Loader2, LogIn, RefreshCw } from 'lucide-react';

const REDIRECT_SECONDS = Number(import.meta.env.VITE_BACKEND_DOWN_REDIRECT_SECONDS) || 30;

export function BackendUnavailableBanner() {
  const navigate = useNavigate();
  const backendStatus = useBackendHealthStore((s) => s.status);
  const { refetch, isChecking } = useHealthCheck();
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  // Redirecionamento automático para /login após X segundos (só se > 0).
  // Hooks devem ser sempre chamados na mesma ordem (sem early return antes).
  useEffect(() => {
    if (backendStatus !== 'error' || REDIRECT_SECONDS <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          navigate('/login', { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [backendStatus, navigate]);

  if (backendStatus !== 'error') return null;

  const goToLogin = () => navigate('/login', { replace: true });

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm bg-destructive/15 text-destructive border-b border-destructive/20"
      role="alert"
    >
      <span className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Sem comunicação com o backend. Verifique se a API está em execução (ex.: http://localhost:3000).
        {REDIRECT_SECONDS > 0 && countdown > 0 && (
          <span className="text-muted-foreground font-normal">
            Redirecionando para login em {countdown}s
          </span>
        )}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => refetch()}
          disabled={isChecking}
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Verificar novamente</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={goToLogin}
        >
          <LogIn className="h-4 w-4" />
          <span className="ml-2">Continuar para login</span>
        </Button>
      </div>
    </div>
  );
}
