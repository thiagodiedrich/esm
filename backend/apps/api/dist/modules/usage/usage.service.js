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
exports.UsageService = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const crypto_1 = require("crypto");
const database_module_1 = require("../database/database.module");
const ALLOWED_METRICS = new Set([
    "api.requests",
    "telemetry.events_ingested",
    "telemetry.payload_bytes",
    "erp.purchase_requests.created",
    "erp.purchase_orders.created"
]);
let UsageService = class UsageService {
    constructor(pool) {
        this.pool = pool;
    }
    async recordMetric(input) {
        if (!ALLOWED_METRICS.has(input.metric_key)) {
            throw new common_1.BadRequestException("Metric key nao permitido.");
        }
        await this.pool.query(`INSERT INTO tenant_usage_metrics
       (id, tenant_id, metric_key, metric_value, period, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`, [
            (0, crypto_1.randomUUID)(),
            input.tenant_id,
            input.metric_key,
            input.metric_value,
            input.period,
            input.source
        ]);
    }
};
exports.UsageService = UsageService;
exports.UsageService = UsageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [pg_1.Pool])
], UsageService);
