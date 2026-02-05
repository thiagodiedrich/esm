"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createApiClient } from "@/src/api";

type ErpHomeResponse = {
  tenant: {
    id: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
  workspace: {
    id: string | null;
    name: string | null;
  };
  metrics: {
    pending_purchase_requests: number;
    pending_purchase_orders: number;
    low_stock_products: number;
  };
};

const getTenantSlug = () => window.location.hostname;

function isEmptyState(data: ErpHomeResponse) {
  const metricsEmpty =
    data.metrics.pending_purchase_requests === 0 &&
    data.metrics.pending_purchase_orders === 0 &&
    data.metrics.low_stock_products === 0;
  const workspaceEmpty = data.workspace.id === null;
  return metricsEmpty && workspaceEmpty;
}

export default function ERPHomePage() {
  const apiClient = useMemo(() => {
    return createApiClient({ tenantSlug: getTenantSlug() });
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["erp", "home"],
    queryFn: async () => {
      const response = await apiClient.request("/api/erp/home", {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("ERP home request failed.");
      }
      return (await response.json()) as ErpHomeResponse;
    },
  });

  if (isLoading) {
    return <div className="text-sm text-slate-500">Carregando...</div>;
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-slate-500">
        Não foi possível carregar o painel do ERP.
      </div>
    );
  }

  if (isEmptyState(data)) {
    return (
      <div className="text-sm text-slate-500">
        Sem dados disponíveis no momento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-slate-500">Tenant</div>
        <div className="text-base font-medium text-slate-900">
          {data.tenant.name}
        </div>
      </div>
      <div>
        <div className="text-sm text-slate-500">Organização</div>
        <div className="text-base font-medium text-slate-900">
          {data.organization.name}
        </div>
      </div>
      <div>
        <div className="text-sm text-slate-500">Workspace</div>
        <div className="text-base font-medium text-slate-900">
          {data.workspace.name ?? "Sem workspace"}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">
            Solicitações pendentes
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.pending_purchase_requests}
          </div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">Pedidos pendentes</div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.pending_purchase_orders}
          </div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">Estoque baixo</div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.low_stock_products}
          </div>
        </div>
      </div>
    </div>
  );
}
