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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorsValidationMiddleware = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let CorsValidationMiddleware = class CorsValidationMiddleware {
    constructor(configService) {
        this.configService = configService;
    }
    use(req, _res, next) {
        const corsOriginsRaw = this.configService.get("CORS_ORIGINS")?.trim();
        if (!corsOriginsRaw) {
            return next();
        }
        const origins = corsOriginsRaw
            .split(",")
            .map((o) => o.trim().toLowerCase())
            .filter(Boolean);
        if (origins.length === 0) {
            return next();
        }
        const origin = req.headers.origin;
        if (typeof origin !== "string" || !origin.trim()) {
            return next();
        }
        const normalizedOrigin = origin.trim().toLowerCase();
        const allowed = origins.some((o) => o === normalizedOrigin);
        if (!allowed) {
            throw new common_1.BadRequestException("0 - Cors Origins inválido");
        }
        next();
    }
};
exports.CorsValidationMiddleware = CorsValidationMiddleware;
exports.CorsValidationMiddleware = CorsValidationMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], CorsValidationMiddleware);
