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
exports.TelemetryController = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const kafka_service_1 = require("../kafka/kafka.service");
const storage_service_1 = require("../storage/storage.service");
const request_context_service_1 = require("../observability/request-context.service");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
class TelemetryBulkResponseDto {
}
let TelemetryController = class TelemetryController {
    constructor(kafkaService, storageService, requestContext, configService) {
        this.kafkaService = kafkaService;
        this.storageService = storageService;
        this.requestContext = requestContext;
        this.configService = configService;
    }
    async ingestBulk(body, req) {
        const tenantId = req.user?.tenant_id ?? this.requestContext.getTenantId();
        if (!tenantId) {
            throw new common_1.BadRequestException("Tenant nao informado.");
        }
        const eventId = (0, crypto_1.randomUUID)();
        const timestamp = new Date().toISOString();
        const folder = timestamp.replace(/[:.]/g, "-");
        const key = `telemetry/${tenantId}/${folder}/${eventId}.json.gz`;
        const payloadJson = JSON.stringify(body ?? {});
        const originalSize = Buffer.byteLength(payloadJson);
        const gzipped = (0, zlib_1.gzipSync)(payloadJson);
        const storageConfig = this.storageService.getConfig();
        const bucket = storageConfig.minio.bucket ?? "telemetry-raw";
        const stored = await this.storageService.upload({
            key,
            contentType: "application/gzip",
            body: gzipped,
            bucket
        });
        const claim = {
            claim_check: stored.key,
            storage_type: storageConfig.type,
            storage_endpoint: storageConfig.minio.endpoint ?? "minio",
            bucket,
            file_size: stored.size,
            original_size: originalSize,
            compression: "gzip",
            timestamp,
            metadata: body?.metadata ?? {}
        };
        const topic = this.configService.get("KAFKA_TOPIC") ?? "telemetry.raw";
        await this.kafkaService.publish(topic, {
            event_id: eventId,
            event_type: "telemetry.bulk.claim_check",
            tenant_id: tenantId,
            payload: claim,
            created_at: timestamp
        });
        return { status: "accepted", event_id: eventId, claim_check: stored.key };
    }
};
exports.TelemetryController = TelemetryController;
__decorate([
    (0, common_1.Post)("/bulk"),
    (0, swagger_1.ApiOperation)({ summary: "Ingestao bulk com claim-check" }),
    (0, swagger_1.ApiBearerAuth)("userAuth"),
    (0, swagger_1.ApiBody)({ schema: { type: "object", additionalProperties: true } }),
    (0, swagger_1.ApiOkResponse)({ type: TelemetryBulkResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TelemetryController.prototype, "ingestBulk", null);
exports.TelemetryController = TelemetryController = __decorate([
    (0, common_1.Controller)("/api/v1/telemetry"),
    (0, swagger_1.ApiTags)("Telemetry"),
    __metadata("design:paramtypes", [kafka_service_1.KafkaService,
        storage_service_1.StorageService,
        request_context_service_1.RequestContextService,
        config_1.ConfigService])
], TelemetryController);
