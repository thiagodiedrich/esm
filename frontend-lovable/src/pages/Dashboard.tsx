/**
 * Dashboard Page — ERP Home
 */

import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Users, 
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useHealthCheck } from '@/hooks/useHealthCheck';

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, description, trend, trendValue, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend === 'up' && (
            <ArrowUpRight className="h-3 w-3 text-success" />
          )}
          {trend === 'down' && (
            <ArrowDownRight className="h-3 w-3 text-destructive" />
          )}
          <span className={trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : ''}>
            {trendValue}
          </span>
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const currentContext = useAuthStore((s) => s.currentContext);
  const { status, isChecking, refetch } = useHealthCheck();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema
          {currentContext?.organization_name && (
            <> — {currentContext.organization_name}</>
          )}
          {currentContext?.workspace_name && (
            <> / {currentContext.workspace_name}</>
          )}
        </p>
      </div>

      {/* Backend status — health check */}
      <Card className="border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            Status do backend
          </CardTitle>
          <CardDescription>GET /api/v1/health — Status da API</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'loading' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Verificando...</span>
              </>
            )}
            {status === 'ok' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Conectado</span>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Indisponível</span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
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
        </CardContent>
      </Card>
      
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Vendas do Mês"
          value="R$ 45.231,89"
          description="vs. mês anterior"
          trend="up"
          trendValue="+20.1%"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          title="Pedidos"
          value="2.350"
          description="vs. mês anterior"
          trend="up"
          trendValue="+15%"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          title="Produtos Ativos"
          value="1.247"
          description="em estoque"
          trend="neutral"
          trendValue=""
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          title="Clientes"
          value="573"
          description="novos este mês"
          trend="up"
          trendValue="+32"
          icon={<Users className="h-4 w-4" />}
        />
      </div>
      
      {/* Charts placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Período</CardTitle>
            <CardDescription>Últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-12 w-12" />
              <p className="text-sm">Gráfico de vendas</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas atualizações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Atividade {i}</p>
                    <p className="text-xs text-muted-foreground">Há {i} hora{i > 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
