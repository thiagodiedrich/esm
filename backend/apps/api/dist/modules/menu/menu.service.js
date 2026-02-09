"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
const ioredis_1 = __importDefault(require("ioredis"));
const super_user_service_1 = require("../auth/super-user.service");
/** Primeira opção do menu, sempre exibida (hardcoded). */
const DASHBOARD_ITEM = {
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
let MenuService = class MenuService {
    constructor(pool, configService, superUserService) {
        this.pool = pool;
        this.configService = configService;
        this.superUserService = superUserService;
        this.cache = new Map();
        const redisUrl = this.configService.get("REDIS_URL");
        this.redis = redisUrl ? new ioredis_1.default(redisUrl) : null;
    }
    async getMenu(user) {
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
        const [dbMenus, userOverrides, rolePermissions, activeProducts, activeModules, ttlSeconds] = await Promise.all([
            this.getMenusFromDb(),
            this.getUserPermissionOverrides(user.sub),
            this.getUserPermissionsFromRoles(user.sub),
            this.getActiveProducts(user.tenant_id),
            this.getActiveModules(user.tenant_id),
            this.getMenuCacheTtl(user.organization_id)
        ]);
        const permissions = new Set(user.permissions ?? []);
        for (const key of rolePermissions) {
            permissions.add(key);
        }
        const overrides = new Map((user.permission_overrides ?? []).map((item) => [
            item.permission,
            item.effect
        ]));
        for (const row of userOverrides) {
            const key = `${row.resource}:${row.action}`;
            if (row.effect === "allow") {
                permissions.add(key);
            }
            overrides.set(key, row.effect);
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
    async getMenusFromDb() {
        const result = await this.pool.query(`SELECT m.id, m.uuid, m.parent_id, p.uuid AS parent_uuid, m.label, m.icon, m.route, m.resource, m.action,
              m.product_code, m.product_module_code, m.sequence, m.scope
       FROM res_menus m
       LEFT JOIN res_menus p ON p.id = m.parent_id
       ORDER BY CASE m.scope WHEN 'tenant' THEN 0 ELSE 1 END, m.sequence ASC, m.label ASC`);
        return result.rows;
    }
    /** Carrega overrides de permissão do usuário (allow/deny) para filtrar o menu. */
    async getUserPermissionOverrides(userUuid) {
        const result = await this.pool.query(`SELECT p.resource, p.action, o.effect
       FROM res_user_permission_overrides o
       JOIN res_users u ON u.id = o.user_id
       JOIN res_permissions p ON p.id = o.permission_id
       WHERE u.uuid = $1`, [userUuid]);
        return result.rows;
    }
    /** Carrega permissões herdadas das roles do usuário (res_user_roles -> res_role_permissions -> res_permissions). */
    async getUserPermissionsFromRoles(userUuid) {
        const result = await this.pool.query(`SELECT DISTINCT p.resource, p.action
       FROM res_user_roles ur
       JOIN res_users u ON u.id = ur.user_id
       JOIN res_role_permissions rp ON rp.role_id = ur.role_id
       JOIN res_permissions p ON p.id = rp.permission_id
       WHERE u.uuid = $1`, [userUuid]);
        return result.rows.map((r) => `${r.resource}:${r.action}`);
    }
    /** Monta árvore de menu a partir da lista plana (parent_id). Usa uuid como id no MenuItem. */
    buildMenuTree(rows) {
        const byUuid = new Map();
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
        const roots = [];
        for (const r of rows) {
            const item = byUuid.get(r.uuid);
            if (!r.parent_uuid) {
                roots.push(item);
            }
            else {
                const parent = byUuid.get(r.parent_uuid);
                if (parent) {
                    parent.children.push(item);
                }
                else {
                    roots.push(item);
                }
            }
        }
        for (const item of byUuid.values()) {
            item.children.sort((a, b) => rows.findIndex((r) => r.uuid === a.id) -
                rows.findIndex((r) => r.uuid === b.id));
        }
        return roots;
    }
    async getFromCache(cacheKey, now) {
        if (this.redis) {
            const value = await this.redis.get(`menu:${cacheKey}`);
            if (value) {
                return JSON.parse(value);
            }
        }
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.items;
        }
        return null;
    }
    async saveCache(cacheKey, items, ttlMs, now) {
        if (ttlMs <= 0) {
            return;
        }
        if (this.redis) {
            await this.redis.set(`menu:${cacheKey}`, JSON.stringify(items), "PX", ttlMs);
            return;
        }
        this.cache.set(cacheKey, { expiresAt: now + ttlMs, items });
    }
    filterMenu(items, context) {
        return items
            .map((item) => this.filterItem(item, context))
            .filter((item) => item !== null);
    }
    filterItem(item, context) {
        const hasPermission = this.hasPermission(item, context.permissions, context.overrides);
        if (!hasPermission) {
            return null;
        }
        const children = this.filterMenu(item.children ?? [], context);
        const blocked = this.isBlocked(item, context.activeProducts, context.activeModules);
        if (!item.resource &&
            !item.action &&
            children.length === 0 &&
            item.children?.length) {
            return null;
        }
        return {
            ...item,
            blocked,
            children
        };
    }
    hasPermission(item, permissions, overrides) {
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
    isBlocked(item, activeProducts, activeModules) {
        if (item.product_code && !activeProducts.has(item.product_code)) {
            return true;
        }
        if (item.product_module_code &&
            !activeModules.has(item.product_module_code)) {
            return true;
        }
        return false;
    }
    async getActiveProducts(tenantUuid) {
        const result = await this.pool.query(`SELECT pp.code
       FROM tenant_platform_products tpp
       JOIN tenants t ON t.id = tpp.tenant_id
       JOIN platform_products pp ON pp.id = tpp.product_id
       WHERE t.uuid = $1 AND tpp.is_active = true`, [tenantUuid]);
        return new Set(result.rows.map((row) => row.code));
    }
    async getActiveModules(tenantUuid) {
        const result = await this.pool.query(`SELECT ppm.code
       FROM tenant_platform_product_modules tppm
       JOIN tenant_platform_products tpp ON tpp.id = tppm.tenant_product_id
       JOIN tenants t ON t.id = tpp.tenant_id
       JOIN platform_product_modules ppm ON ppm.id = tppm.product_module_id
       WHERE t.uuid = $1 AND tpp.is_active = true AND tppm.is_active = true`, [tenantUuid]);
        return new Set(result.rows.map((row) => row.code));
    }
    async getMenuCacheTtl(organizationUuid) {
        const result = await this.pool.query(`SELECT s.menu_cache_ttl FROM res_organization_settings s
       JOIN res_organizations o ON o.id = s.organization_id
       WHERE o.uuid = $1`, [organizationUuid]);
        if ((result.rowCount ?? 0) === 0) {
            return null;
        }
        return result.rows[0].menu_cache_ttl;
    }
};
exports.MenuService = MenuService;
exports.MenuService = MenuService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool,
        config_1.ConfigService,
        super_user_service_1.SuperUserService])
], MenuService);
