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
exports.AuditMiddleware = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const request_context_service_1 = require("./request-context.service");
let AuditMiddleware = class AuditMiddleware {
    constructor(configService, requestContext) {
        this.configService = configService;
        this.requestContext = requestContext;
    }
    use(req, res, next) {
        const enabled = (this.configService.get("AUDIT_LOG_ENABLED") ?? "false").toLowerCase() ===
            "true";
        if (!enabled) {
            return next();
        }
        const startedAt = Date.now();
        const logEntry = () => {
            const durationMs = Date.now() - startedAt;
            const user = req.user;
            const correlationId = this.requestContext.getCorrelationId();
            const payload = {
                timestamp: new Date().toISOString(),
                level: "log",
                service: this.configService.get("SERVICE_NAME") || "esm-api",
                correlation_id: correlationId,
                tenant_id: user?.tenant_id,
                organization_id: user?.organization_id,
                workspace_id: user?.workspace_id,
                message: "audit",
                context: "AuditMiddleware",
                data: {
                    method: req.method,
                    url: req.url,
                    status_code: res.statusCode,
                    duration_ms: durationMs,
                    ip: req.ip
                }
            };
            process.stdout.write(`${JSON.stringify(payload)}\n`);
        };
        const raw = res.raw;
        if (raw && typeof raw.on === "function") {
            raw.on("finish", logEntry);
        }
        else if (typeof res.on === "function") {
            res.on("finish", logEntry);
        }
        next();
    }
};
exports.AuditMiddleware = AuditMiddleware;
exports.AuditMiddleware = AuditMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        request_context_service_1.RequestContextService])
], AuditMiddleware);
