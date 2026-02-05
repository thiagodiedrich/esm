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
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_decorators_1 = require("./auth/auth.decorators");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const database_module_1 = require("./database/database.module");
const kafkajs_1 = require("kafkajs");
const storage_service_1 = require("./storage/storage.service");
const minio_1 = require("minio");
const ioredis_1 = __importDefault(require("ioredis"));
class HealthResponseDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: "ok" }),
    __metadata("design:type", String)
], HealthResponseDto.prototype, "status", void 0);
class HealthDetailedDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({
        example: "healthy",
        description: "healthy = todas dependencias ok; degraded = alguma falhou."
    }),
    __metadata("design:type", String)
], HealthDetailedDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: "Estado de cada dependencia: gateway, postgres, kafka, minio, redis.",
        example: {
            gateway: { status: "healthy" },
            postgres: { status: "healthy" },
            kafka: { status: "disabled" },
            minio: { status: "healthy", bucket: "telemetry-raw" },
            redis: { status: "healthy" }
        }
    }),
    __metadata("design:type", Object)
], HealthDetailedDto.prototype, "checks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: "2026-02-04T12:00:00.000Z" }),
    __metadata("design:type", String)
], HealthDetailedDto.prototype, "timestamp", void 0);
let AppController = class AppController {
    constructor(configService, storageService, pool) {
        this.configService = configService;
        this.storageService = storageService;
        this.pool = pool;
    }
    health() {
        return { status: "ok" };
    }
    async detailed() {
        const checks = {
            gateway: { status: "healthy" }
        };
        let overall = "healthy";
        try {
            await this.pool.query("SELECT 1");
            checks.postgres = { status: "healthy" };
        }
        catch (error) {
            overall = "degraded";
            checks.postgres = { status: "degraded", error: error.message };
        }
        const kafkaEnabled = (this.configService.get("KAFKA_ENABLED") ?? "false").toLowerCase() === "true";
        const brokersRaw = this.configService.get("KAFKA_BROKERS") ?? "";
        const brokers = brokersRaw.split(",").map((b) => b.trim()).filter(Boolean);
        if (!kafkaEnabled) {
            checks.kafka = { status: "disabled" };
        }
        else {
            try {
                const kafka = new kafkajs_1.Kafka({
                    clientId: this.configService.get("KAFKA_CLIENT_ID") ?? "esm-api",
                    brokers,
                    logLevel: kafkajs_1.logLevel.NOTHING
                });
                const admin = kafka.admin();
                await admin.connect();
                const topics = await admin.listTopics();
                const cluster = await admin.describeCluster();
                await admin.disconnect();
                checks.kafka = {
                    status: "healthy",
                    topics: topics.length,
                    brokers: cluster.brokers?.length ?? 0
                };
            }
            catch (error) {
                overall = "degraded";
                checks.kafka = { status: "degraded", error: error.message };
            }
        }
        const storageConfig = this.storageService.getConfig();
        if (storageConfig.type === "minio") {
            try {
                if (!storageConfig.minio.endpoint || !storageConfig.minio.accessKey || !storageConfig.minio.secretKey) {
                    throw new Error("MinIO nao configurado.");
                }
                const endpoint = storageConfig.minio.endpoint.replace(/^https?:\/\//, "");
                const [host, portRaw] = endpoint.split(":");
                const port = storageConfig.minio.useSsl ? 443 : Number(portRaw || 9000);
                const client = new minio_1.Client({
                    endPoint: host,
                    port,
                    useSSL: storageConfig.minio.useSsl,
                    accessKey: storageConfig.minio.accessKey,
                    secretKey: storageConfig.minio.secretKey
                });
                const bucket = storageConfig.minio.bucket ?? "";
                if (!bucket) {
                    throw new Error("Bucket nao definido.");
                }
                const exists = await client.bucketExists(bucket);
                checks.minio = { status: exists ? "healthy" : "degraded", bucket };
                if (!exists) {
                    overall = "degraded";
                }
            }
            catch (error) {
                overall = "degraded";
                checks.minio = { status: "degraded", error: error.message };
            }
        }
        else {
            checks.storage = { status: "healthy", type: storageConfig.type };
        }
        const redisUrl = this.configService.get("REDIS_URL");
        if (redisUrl) {
            const redis = new ioredis_1.default(redisUrl, { lazyConnect: true });
            try {
                await redis.connect();
                await redis.ping();
                checks.redis = { status: "healthy" };
            }
            catch (error) {
                overall = "degraded";
                checks.redis = { status: "degraded", error: error.message };
            }
            finally {
                await redis.quit().catch(() => undefined);
            }
        }
        else {
            checks.redis = { status: "disabled" };
        }
        return {
            status: overall,
            checks,
            timestamp: new Date().toISOString()
        };
    }
};
exports.AppController = AppController;
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: "Healthcheck da API" }),
    (0, swagger_1.ApiOkResponse)({ type: HealthResponseDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
__decorate([
    (0, auth_decorators_1.Public)(),
    (0, common_1.Get)("/detailed"),
    (0, swagger_1.ApiOperation)({
        summary: "Healthcheck detalhado (dependencias)",
        description: "Valida gateway, Postgres, Kafka (se habilitado), MinIO e Redis. Retorna status healthy ou degraded."
    }),
    (0, swagger_1.ApiOkResponse)({
        type: HealthDetailedDto,
        description: "healthy = todas ok; degraded = alguma dependencia falhou ou nao configurada.",
        schema: {
            example: {
                status: "healthy",
                checks: {
                    gateway: { status: "healthy" },
                    postgres: { status: "healthy" },
                    kafka: { status: "disabled" },
                    minio: { status: "healthy", bucket: "telemetry-raw" },
                    redis: { status: "healthy" }
                },
                timestamp: "2026-02-04T12:00:00.000Z"
            }
        }
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "detailed", null);
exports.AppController = AppController = __decorate([
    (0, swagger_1.ApiTags)("Health"),
    (0, common_1.Controller)("/api/v1/health"),
    __param(2, (0, common_1.Inject)(database_module_1.PG_POOL)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        storage_service_1.StorageService,
        pg_1.Pool])
], AppController);
