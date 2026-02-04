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
exports.CorrelationMiddleware = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const request_context_service_1 = require("./request-context.service");
let CorrelationMiddleware = class CorrelationMiddleware {
    constructor(requestContext) {
        this.requestContext = requestContext;
    }
    use(req, res, next) {
        const headerValue = req.headers["x-correlation-id"];
        const correlationId = typeof headerValue === "string" && headerValue.trim()
            ? headerValue.trim()
            : (0, crypto_1.randomUUID)();
        req.correlationId = correlationId;
        if (typeof res.header === "function") {
            res.header("x-correlation-id", correlationId);
        }
        else if (res && typeof res.setHeader === "function") {
            res.setHeader("x-correlation-id", correlationId);
        }
        this.requestContext.run({ correlationId }, () => next());
    }
};
exports.CorrelationMiddleware = CorrelationMiddleware;
exports.CorrelationMiddleware = CorrelationMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [request_context_service_1.RequestContextService])
], CorrelationMiddleware);
