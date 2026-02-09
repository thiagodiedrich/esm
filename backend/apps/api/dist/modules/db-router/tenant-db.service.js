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
exports.TenantDbService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
const db_catalog_service_1 = require("./db-catalog.service");
let TenantDbService = class TenantDbService {
    constructor(controlPlanePool, catalog) {
        this.controlPlanePool = controlPlanePool;
        this.catalog = catalog;
        this.poolCache = new Map();
    }
    async getErpPool(tenantId) {
        const logicalName = await this.getTenantErpLogicalName(tenantId);
        if (!logicalName) {
            throw new common_1.BadRequestException("ERP DB nao configurado para o tenant.");
        }
        const connectionString = this.catalog.resolveConnectionString(logicalName);
        if (!connectionString) {
            throw new common_1.BadRequestException("Connection string nao encontrada no catalogo.");
        }
        const cached = this.poolCache.get(logicalName);
        if (cached) {
            return cached;
        }
        const pool = new pg_1.Pool({ connectionString });
        this.poolCache.set(logicalName, pool);
        return pool;
    }
    async getTenantErpLogicalName(tenantId) {
        const result = await this.controlPlanePool.query("SELECT erp_db FROM tenants WHERE id = $1", [tenantId]);
        if ((result.rowCount ?? 0) === 0) {
            throw new common_1.BadRequestException("Code 6: Tenant nao encontrado");
        }
        return result.rows[0].erp_db;
    }
};
exports.TenantDbService = TenantDbService;
exports.TenantDbService = TenantDbService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool,
        db_catalog_service_1.DbCatalogService])
], TenantDbService);
