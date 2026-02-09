import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { MenuItem } from "./menu.types";
import Redis from "ioredis";
import { AuthUser, PermissionOverrideEffect } from "../auth/auth.types";
import { SuperUserService } from "../auth/super-user.service";

/** Primeira opção do menu, sempre exibida (hardcoded). */
const DASHBOARD_ITEM: MenuItem = {
  id: "dashboard",
  label: "Dashboard",
  icon: "home",
  route: "/dashboard",
  resource: null,
  action: null,
  product_code: null,
  product_module_code: null,
  children: []
};

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

interface ResMenuRow {
  id: number;
  uuid: string;
  parent_id: number | null;
  parent_uuid: string | null;
  label: string;
  icon: string | null;
  route: string | null;
  resource: string | null;
  action: string | null;
  product_code: string | null;
  product_module_code: string | null;
  sequence: number;
  scope: string;
}

interface UserOverrideRow {
  resource: string;
  action: string;
  effect: string;
}

interface RolePermissionRow {
  resource: string;
  action: string;
}

@Injectable()
export class MenuService {
  private readonly cache = new Map<string, MenuCacheEntry>();
  private readonly redis: Redis | null;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly configService: ConfigService,
    private readonly superUserService: SuperUserService
  ) {
    const redisUrl = this.configService.get<string>("REDIS_URL");
    this.redis = redisUrl ? new Redis(redisUrl) : null;
  }

  async getMenu(user: AuthUser): Promise<MenuItem[]> {
    if (!user.tenant_id || !user.organization_id) {
      return [DASHBOARD_ITEM];
    }

    if (await this.superUserService.hasFullAccess(user)) {
      const dbMenus = await this.getMenusFromDb();
      const tree = this.buildMenuTree(dbMenus);
      return [DASHBOARD_ITEM, ...tree];
    }

    const cacheKey = `${user.tenant_id}:${user.organization_id}`;
    const now = Date.now();
    const cached = await this.getFromCache(cacheKey, now);
    if (cached) {
      return cached;
    }

    const [dbMenus, userOverrides, rolePermissions, activeProducts, activeModules, ttlSeconds] =
      await Promise.all([
        this.getMenusFromDb(),
        this.getUserPermissionOverrides(user.sub),
        this.getUserPermissionsFromRoles(user.sub),
        this.getActiveProducts(user.tenant_id),
        this.getActiveModules(user.tenant_id),
        this.getMenuCacheTtl(user.organization_id)
      ]);

    const permissions = new Set<string>(user.permissions ?? []);
    for (const key of rolePermissions) {
      permissions.add(key);
    }
    const overrides = new Map(
      (user.permission_overrides ?? []).map((item) => [
        item.permission,
        item.effect
      ])
    );
    for (const row of userOverrides) {
      const key = `${row.resource}:${row.action}`;
      if (row.effect === "allow") {
        permissions.add(key);
      }
      overrides.set(key, row.effect as PermissionOverrideEffect);
    }

    const tree = this.buildMenuTree(dbMenus);
    const filtered = this.filterMenu(tree, {
      permissions,
      overrides,
      activeProducts,
      activeModules
    });

    const items = [DASHBOARD_ITEM, ...filtered];
    const ttlMs = Math.max(0, (ttlSeconds ?? 0) * 1000);
    await this.saveCache(cacheKey, items, ttlMs, now);

    return items;
  }

  /** Carrega itens de menu da tabela res_menus (tenant e admin), ordenados por scope e sequence. */
  private async getMenusFromDb(): Promise<ResMenuRow[]> {
    const result = await this.pool.query<ResMenuRow>(
      `SELECT m.id, m.uuid, m.parent_id, p.uuid AS parent_uuid, m.label, m.icon, m.route, m.resource, m.action,
              m.product_code, m.product_module_code, m.sequence, m.scope
       FROM res_menus m
       LEFT JOIN res_menus p ON p.id = m.parent_id
       ORDER BY CASE m.scope WHEN 'tenant' THEN 0 ELSE 1 END, m.sequence ASC, m.label ASC`
    );
    return result.rows;
  }

  /** Carrega overrides de permissão do usuário (allow/deny) para filtrar o menu. */
  private async getUserPermissionOverrides(
    userUuid: string
  ): Promise<UserOverrideRow[]> {
    const result = await this.pool.query<UserOverrideRow>(
      `SELECT p.resource, p.action, o.effect
       FROM res_user_permission_overrides o
       JOIN res_users u ON u.id = o.user_id
       JOIN res_permissions p ON p.id = o.permission_id
       WHERE u.uuid = $1`,
      [userUuid]
    );
    return result.rows;
  }

  /** Carrega permissões herdadas das roles do usuário (res_user_roles -> res_role_permissions -> res_permissions). */
  private async getUserPermissionsFromRoles(
    userUuid: string
  ): Promise<string[]> {
    const result = await this.pool.query<RolePermissionRow>(
      `SELECT DISTINCT p.resource, p.action
       FROM res_user_roles ur
       JOIN res_users u ON u.id = ur.user_id
       JOIN res_role_permissions rp ON rp.role_id = ur.role_id
       JOIN res_permissions p ON p.id = rp.permission_id
       WHERE u.uuid = $1`,
      [userUuid]
    );
    return result.rows.map((r) => `${r.resource}:${r.action}`);
  }

  /** Monta árvore de menu a partir da lista plana (parent_id). Usa uuid como id no MenuItem. */
  private buildMenuTree(rows: ResMenuRow[]): MenuItem[] {
    const byUuid = new Map<string, MenuItem>();
    for (const r of rows) {
      byUuid.set(r.uuid, {
        id: r.uuid,
        label: r.label,
        icon: r.icon,
        route: r.route,
        resource: r.resource,
        action: r.action,
        product_code: r.product_code,
        product_module_code: r.product_module_code,
        children: []
      });
    }
    const roots: MenuItem[] = [];
    for (const r of rows) {
      const item = byUuid.get(r.uuid)!;
      if (!r.parent_uuid) {
        roots.push(item);
      } else {
        const parent = byUuid.get(r.parent_uuid);
        if (parent) {
          parent.children.push(item);
        } else {
          roots.push(item);
        }
      }
    }
    for (const item of byUuid.values()) {
      item.children.sort(
        (a, b) =>
          rows.findIndex((r) => r.uuid === a.id) -
          rows.findIndex((r) => r.uuid === b.id)
      );
    }
    return roots;
  }

  private async getFromCache(
    cacheKey: string,
    now: number
  ): Promise<MenuItem[] | null> {
    if (this.redis) {
      const value = await this.redis.get(`menu:${cacheKey}`);
      if (value) {
        return JSON.parse(value) as MenuItem[];
      }
    }

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.items;
    }

    return null;
  }

  private async saveCache(
    cacheKey: string,
    items: MenuItem[],
    ttlMs: number,
    now: number
  ) {
    if (ttlMs <= 0) {
      return;
    }

    if (this.redis) {
      await this.redis.set(
        `menu:${cacheKey}`,
        JSON.stringify(items),
        "PX",
        ttlMs
      );
      return;
    }

    this.cache.set(cacheKey, { expiresAt: now + ttlMs, items });
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
    const hasPermission = this.hasPermission(
      item,
      context.permissions,
      context.overrides
    );
    if (!hasPermission) {
      return null;
    }

    const children = this.filterMenu(item.children ?? [], context);
    const blocked = this.isBlocked(
      item,
      context.activeProducts,
      context.activeModules
    );

    if (
      !item.resource &&
      !item.action &&
      children.length === 0 &&
      item.children?.length
    ) {
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

    if (
      item.product_module_code &&
      !activeModules.has(item.product_module_code)
    ) {
      return true;
    }

    return false;
  }

  private async getActiveProducts(tenantUuid: string): Promise<Set<string>> {
    const result = await this.pool.query<ProductRow>(
      `SELECT pp.code
       FROM tenant_platform_products tpp
       JOIN tenants t ON t.id = tpp.tenant_id
       JOIN platform_products pp ON pp.id = tpp.product_id
       WHERE t.uuid = $1 AND tpp.is_active = true`,
      [tenantUuid]
    );

    return new Set(result.rows.map((row) => row.code));
  }

  private async getActiveModules(tenantUuid: string): Promise<Set<string>> {
    const result = await this.pool.query<ProductModuleRow>(
      `SELECT ppm.code
       FROM tenant_platform_product_modules tppm
       JOIN tenant_platform_products tpp ON tpp.id = tppm.tenant_product_id
       JOIN tenants t ON t.id = tpp.tenant_id
       JOIN platform_product_modules ppm ON ppm.id = tppm.product_module_id
       WHERE t.uuid = $1 AND tpp.is_active = true AND tppm.is_active = true`,
      [tenantUuid]
    );

    return new Set(result.rows.map((row) => row.code));
  }

  private async getMenuCacheTtl(
    organizationUuid: string
  ): Promise<number | null> {
    const result = await this.pool.query<OrganizationSettingsRow>(
      `SELECT s.menu_cache_ttl FROM res_organization_settings s
       JOIN res_organizations o ON o.id = s.organization_id
       WHERE o.uuid = $1`,
      [organizationUuid]
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return result.rows[0].menu_cache_ttl;
  }
}
