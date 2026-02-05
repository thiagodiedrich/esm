"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createApiClient } from "@/src/api";

type TelemetryHomeResponse = {
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
    devices_total: number;
    devices_online: number;
    events_last_24h: number;
    alerts_active: number;
  };
};

const getTenantSlug = () => window.location.hostname;

function isEmptyState(data: TelemetryHomeResponse) {
  const metricsEmpty =
    data.metrics.devices_total === 0 &&
    data.metrics.devices_online === 0 &&
    data.metrics.events_last_24h === 0 &&
    data.metrics.alerts_active === 0;
  const workspaceEmpty = data.workspace.id === null;
  return metricsEmpty && workspaceEmpty;
}

export default function TelemetryHomePage() {
  const apiClient = useMemo(() => {
    return createApiClient({ tenantSlug: getTenantSlug() });
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["telemetry", "home"],
    queryFn: async () => {
      const response = await apiClient.request("/api/telemetry/home", {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("Telemetry home request failed.");
      }
      return (await response.json()) as TelemetryHomeResponse;
    },
  });

  if (isLoading) {
    return <div className="text-sm text-slate-500">Carregando...</div>;
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-slate-500">
        Não foi possível carregar o painel de Telemetria.
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
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">Dispositivos totais</div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.devices_total}
          </div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">Dispositivos online</div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.devices_online}
          </div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">Eventos (24h)</div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.events_last_24h}
          </div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-slate-500">Alertas ativos</div>
          <div className="text-lg font-semibold text-slate-900">
            {data.metrics.alerts_active}
          </div>
        </div>
      </div>
    </div>
  );
}
