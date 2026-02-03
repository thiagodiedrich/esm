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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
const menu_base_1 = require("./menu.base");
let MenuService = class MenuService {
    constructor(pool) {
        this.pool = pool;
        this.cache = new Map();
    }
    async getMenu(user) {
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
        const overrides = new Map((user.permission_overrides ?? []).map((item) => [item.permission, item.effect]));
        const filtered = this.filterMenu(menu_base_1.MENU_BASE, {
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
        if (!item.resource && !item.action && children.length === 0 && item.children?.length) {
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
        if (item.product_module_code && !activeModules.has(item.product_module_code)) {
            return true;
        }
        return false;
    }
    async getActiveProducts(tenantId) {
        const result = await this.pool.query(`SELECT pp.code
       FROM tenant_platform_products tpp
       JOIN platform_products pp ON pp.id = tpp.product_id
       WHERE tpp.tenant_id = $1 AND tpp.is_active = true`, [tenantId]);
        return new Set(result.rows.map((row) => row.code));
    }
    async getActiveModules(tenantId) {
        const result = await this.pool.query(`SELECT ppm.code
       FROM tenant_platform_product_modules tppm
       JOIN tenant_platform_products tpp ON tpp.id = tppm.tenant_product_id
       JOIN platform_product_modules ppm ON ppm.id = tppm.product_module_id
       WHERE tpp.tenant_id = $1 AND tpp.is_active = true AND tppm.is_active = true`, [tenantId]);
        return new Set(result.rows.map((row) => row.code));
    }
    async getMenuCacheTtl(organizationId) {
        const result = await this.pool.query("SELECT menu_cache_ttl FROM res_organization_settings WHERE organization_id = $1", [organizationId]);
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
    __metadata("design:paramtypes", [pg_1.Pool])
], MenuService);
