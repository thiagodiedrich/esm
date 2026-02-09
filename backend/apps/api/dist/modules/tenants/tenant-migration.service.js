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
exports.TenantMigrationService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_module_1 = require("../database/database.module");
const VALID_DB_STRATEGIES = new Set(["shared", "dedicated", "hybrid"]);
const VALID_MIGRATION_STATUS = new Set(["idle", "migrating", "failed"]);
let TenantMigrationService = class TenantMigrationService {
    constructor(pool) {
        this.pool = pool;
    }
    async updatePointers(input) {
        if (!VALID_DB_STRATEGIES.has(input.db_strategy)) {
            throw new common_1.BadRequestException("db_strategy invalido.");
        }
        if (!VALID_MIGRATION_STATUS.has(input.migration_status)) {
            throw new common_1.BadRequestException("migration_status invalido.");
        }
        const result = await this.pool.query(`UPDATE tenants
       SET db_strategy = $1,
           control_plane_db = $2,
           erp_db = $3,
           telemetry_db = $4,
           migration_status = $5,
           updated_at = now()
       WHERE uuid = $6`, [
            input.db_strategy,
            input.control_plane_db ?? null,
            input.erp_db ?? null,
            input.telemetry_db ?? null,
            input.migration_status,
            input.tenant_id
        ]);
        if ((result.rowCount ?? 0) === 0) {
            throw new common_1.BadRequestException("Code 9: Tenant nao encontrado");
        }
    }
};
exports.TenantMigrationService = TenantMigrationService;
exports.TenantMigrationService = TenantMigrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], TenantMigrationService);
