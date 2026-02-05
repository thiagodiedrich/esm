"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { createApiClient } from "@/src/api";
import { useMenuStore, type MenuItem } from "@/src/stores/menuStore";

type MenuResponse = {
  menu: MenuItem[];
  menu_cache_ttl: number;
};

const BLOCKED_TOOLTIP_TEXT = "Funcionalidade não disponível no seu plano";

const getTenantSlug = () => window.location.hostname;

function isGroup(item: MenuItem) {
  return item.children.length > 0;
}

function MenuNode({ item }: { item: MenuItem }) {
  if (isGroup(item)) {
    return (
      <details className="space-y-2" aria-label={item.label}>
        <summary className="cursor-pointer list-none rounded px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100">
          <span className="flex items-center gap-2">
            {item.icon ? (
              <span className="text-xs text-slate-400">{item.icon}</span>
            ) : null}
            {item.label}
          </span>
        </summary>
        <div className="ml-3 border-l pl-3">
          <MenuList items={item.children} />
        </div>
      </details>
    );
  }

  if (item.blocked) {
    return (
      <span
        title={BLOCKED_TOOLTIP_TEXT}
        className="block cursor-not-allowed rounded px-2 py-1 text-sm text-slate-400"
        aria-disabled="true"
      >
        {item.label}
      </span>
    );
  }

  if (item.route) {
    return (
      <a
        href={item.route}
        className="block rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
      >
        {item.label}
      </a>
    );
  }

  return (
    <span className="block rounded px-2 py-1 text-sm text-slate-700">
      {item.label}
    </span>
  );
}

function MenuList({ items }: { items: MenuItem[] }) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <MenuNode key={item.id} item={item} />
      ))}
    </div>
  );
}

export default function MenuSidebar() {
  const setMenu = useMenuStore((state) => state.setMenu);
  const menu = useMenuStore((state) => state.menu);
  const [staleTimeMs, setStaleTimeMs] = useState(0);

  const apiClient = useMemo(() => {
    return createApiClient({ tenantSlug: getTenantSlug() });
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const response = await apiClient.request("/api/menu", { method: "GET" });
      if (!response.ok) {
        throw new Error("Menu request failed.");
      }
      return (await response.json()) as MenuResponse;
    },
    staleTime: staleTimeMs,
  });

  useEffect(() => {
    if (!data) {
      return;
    }
    setMenu(data.menu);
    const ttlMs = Math.max(0, data.menu_cache_ttl * 1000);
    if (ttlMs !== staleTimeMs) {
      setStaleTimeMs(ttlMs);
    }
  }, [data, setMenu, staleTimeMs]);

  if (isLoading) {
    return <div className="px-2 text-sm text-slate-400">Carregando...</div>;
  }

  if (isError) {
    return (
      <div className="px-2 text-sm text-slate-400">
        Falha ao carregar o menu.
      </div>
    );
  }

  return <MenuList items={menu} />;
}
