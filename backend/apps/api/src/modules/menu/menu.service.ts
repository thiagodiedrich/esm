import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { MenuItem, MENU_BASE } from "./menu.base";
import { AuthUser } from "../auth/auth.types";

interface MenuCacheEntry {
  expiresAt: number;
  items: MenuItem[];
}

interface OrganizationSettingsRow {
  menu_cache_ttl: number | null;
}

interface ProductRow {
  code: string;
}

interface ProductModuleRow {
  code: string;
}

@Injectable()
export class MenuService {
  private readonly cache = new Map<string, MenuCacheEntry>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getMenu(user: AuthUser): Promise<MenuItem[]> {
    if (!user.tenant_id || !user.organization_id) {
      return [];
    }

    const cacheKey = `${user.tenant_id}:${user.organization_id}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.items;
    }

    const [activeProducts, activeModules, ttlSeconds] = await Promise.all([
      this.getActiveProducts(user.tenant_id),
      this.getActiveModules(user.tenant_id),
      this.getMenuCacheTtl(user.organization_id)
    ]);

    const permissions = new Set(user.permissions ?? []);
    const overrides = new Map(
      (user.permission_overrides ?? []).map((item) => [item.permission, item.effect])
    );

    const filtered = this.filterMenu(MENU_BASE, {
      permissions,
      overrides,
      activeProducts,
      activeModules
    });

    const ttlMs = Math.max(0, (ttlSeconds ?? 0) * 1000);
    if (ttlMs > 0) {
      this.cache.set(cacheKey, { expiresAt: now + ttlMs, items: filtered });
    }

    return filtered;
  }

  private filterMenu(
    items: MenuItem[],
    context: {
      permissions: Set<string>;
      overrides: Map<string, string>;
      activeProducts: Set<string>;
      activeModules: Set<string>;
    }
  ): MenuItem[] {
    return items
      .map((item) => this.filterItem(item, context))
      .filter((item): item is MenuItem => item !== null);
  }

  private filterItem(
    item: MenuItem,
    context: {
      permissions: Set<string>;
      overrides: Map<string, string>;
      activeProducts: Set<string>;
      activeModules: Set<string>;
    }
  ): MenuItem | null {
    const hasPermission = this.hasPermission(item, context.permissions, context.overrides);
    if (!hasPermission) {
      return null;
    }

    const children = this.filterMenu(item.children ?? [], context);
    const blocked = this.isBlocked(item, context.activeProducts, context.activeModules);

    if (!item.resource && !item.action && children.length === 0 && item.children?.length) {
      return null;
    }

    return {
      ...item,
      blocked,
      children
    };
  }

  private hasPermission(
    item: MenuItem,
    permissions: Set<string>,
    overrides: Map<string, string>
  ) {
    if (!item.resource || !item.action) {
      return true;
    }

    const key = `${item.resource}:${item.action}`;
    const override = overrides.get(key);

    if (override === "deny") {
      return false;
    }

    if (override === "allow") {
      return true;
    }

    return permissions.has(key);
  }

  private isBlocked(
    item: MenuItem,
    activeProducts: Set<string>,
    activeModules: Set<string>
  ) {
    if (item.product_code && !activeProducts.has(item.product_code)) {
      return true;
    }

    if (item.product_module_code && !activeModules.has(item.product_module_code)) {
      return true;
    }

    return false;
  }

  private async getActiveProducts(tenantId: string): Promise<Set<string>> {
    const result = await this.pool.query<ProductRow>(
      `SELECT pp.code
       FROM tenant_platform_products tpp
       JOIN platform_products pp ON pp.id = tpp.product_id
       WHERE tpp.tenant_id = $1 AND tpp.is_active = true`,
      [tenantId]
    );

    return new Set(result.rows.map((row) => row.code));
  }

  private async getActiveModules(tenantId: string): Promise<Set<string>> {
    const result = await this.pool.query<ProductModuleRow>(
      `SELECT ppm.code
       FROM tenant_platform_product_modules tppm
       JOIN tenant_platform_products tpp ON tpp.id = tppm.tenant_product_id
       JOIN platform_product_modules ppm ON ppm.id = tppm.product_module_id
       WHERE tpp.tenant_id = $1 AND tpp.is_active = true AND tppm.is_active = true`,
      [tenantId]
    );

    return new Set(result.rows.map((row) => row.code));
  }

  private async getMenuCacheTtl(organizationId: string): Promise<number | null> {
    const result = await this.pool.query<OrganizationSettingsRow>(
      "SELECT menu_cache_ttl FROM res_organization_settings WHERE organization_id = $1",
      [organizationId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return result.rows[0].menu_cache_ttl;
  }
}
