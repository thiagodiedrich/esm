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
var StorageController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const storage_service_1 = require("./storage.service");
const swagger_1 = require("@nestjs/swagger");
class StorePayloadRequestDto {
}
class StorePayloadResponseDto {
}
let StorageController = StorageController_1 = class StorageController {
    constructor(storageService, configService) {
        this.storageService = storageService;
        this.configService = configService;
    }
    async storePayload(body, request) {
        if (request.user?.auth_type !== "service") {
            throw new common_1.UnauthorizedException("Service token necessario.");
        }
        const buffer = Buffer.from(body.data_base64, "base64");
        const stored = await this.storageService.upload({
            key: body.key,
            contentType: body.content_type,
            body: buffer,
            bucket: body.bucket
        });
        return { status: "ok", object: stored };
    }
    async downloadPayload(key, bucket, request, reply) {
        if (request.user?.auth_type !== "service") {
            throw new common_1.UnauthorizedException("Service token necessario.");
        }
        if (!this.isSafeKey(key)) {
            throw new common_1.BadRequestException("Key invalida.");
        }
        const rateLimitMax = Number(this.configService.get("STORAGE_DOWNLOAD_RATE_LIMIT_PER_MINUTE") ?? 0);
        if (rateLimitMax > 0 && this.isRateLimited(request, rateLimitMax)) {
            throw new common_1.HttpException("Rate limit excedido.", common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const storageConfig = this.storageService.getConfig();
        if (storageConfig.type === "local" && bucket) {
            throw new common_1.BadRequestException("Bucket nao suportado para storage local.");
        }
        let resolvedBucket;
        if (storageConfig.type === "minio") {
            resolvedBucket = storageConfig.minio.bucket ?? undefined;
            if (!resolvedBucket) {
                throw new common_1.BadRequestException("Bucket nao configurado.");
            }
            if (bucket && bucket !== resolvedBucket) {
                throw new common_1.BadRequestException("Bucket invalido.");
            }
        }
        const tenantId = request.user?.tenant_id;
        if (tenantId && !key.startsWith(`telemetry/${tenantId}/`)) {
            throw new common_1.BadRequestException("Key fora do escopo do tenant.");
        }
        const stream = await this.storageService.read({ key, bucket: resolvedBucket });
        reply.header("content-type", this.guessContentType(key));
        return reply.send(stream);
    }
    isSafeKey(key) {
        return !key.includes("..") && !key.startsWith("/") && !key.startsWith("\\");
    }
    guessContentType(key) {
        if (key.endsWith(".json.gz")) {
            return "application/gzip";
        }
        if (key.endsWith(".json")) {
            return "application/json";
        }
        return "application/octet-stream";
    }
    isRateLimited(request, limit) {
        const key = this.getClientKey(request);
        const now = Date.now();
        const existing = StorageController_1.downloadRateLimit.get(key);
        if (!existing || existing.resetAt <= now) {
            StorageController_1.downloadRateLimit.set(key, {
                count: 1,
                resetAt: now + 60 * 1000
            });
            return false;
        }
        if (existing.count >= limit) {
            return true;
        }
        existing.count += 1;
        StorageController_1.downloadRateLimit.set(key, existing);
        return false;
    }
    getClientKey(request) {
        const forwarded = request.headers["x-forwarded-for"];
        if (typeof forwarded === "string" && forwarded.trim()) {
            return forwarded.split(",")[0].trim();
        }
        return request.ip ?? "unknown";
    }
};
exports.StorageController = StorageController;
StorageController.downloadRateLimit = new Map();
__decorate([
    (0, common_1.Post)("/payloads"),
    (0, swagger_1.ApiOperation)({ summary: "Upload interno de payload (service token)" }),
    (0, swagger_1.ApiBearerAuth)("serviceAuth"),
    (0, swagger_1.ApiBody)({ type: StorePayloadRequestDto }),
    (0, swagger_1.ApiOkResponse)({ type: StorePayloadResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "storePayload", null);
__decorate([
    (0, common_1.Get)("/payloads/:key"),
    (0, swagger_1.ApiOperation)({ summary: "Download interno de payload (service token)" }),
    (0, swagger_1.ApiBearerAuth)("serviceAuth"),
    (0, swagger_1.ApiParam)({ name: "key", required: true }),
    (0, swagger_1.ApiQuery)({ name: "bucket", required: false }),
    (0, swagger_1.ApiOkResponse)({
        description: "Stream do payload (application/json ou application/gzip)."
    }),
    __param(0, (0, common_1.Param)("key")),
    __param(1, (0, common_1.Query)("bucket")),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "downloadPayload", null);
exports.StorageController = StorageController = StorageController_1 = __decorate([
    (0, common_1.Controller)("/internal/storage"),
    (0, swagger_1.ApiTags)("Internal"),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        config_1.ConfigService])
], StorageController);
