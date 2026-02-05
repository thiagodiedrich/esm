"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ServiceExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let ServiceExceptionFilter = ServiceExceptionFilter_1 = class ServiceExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(ServiceExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            return this.sendResponse(response, status, body);
        }
        const isDatabaseError = this.isDatabaseError(exception);
        const statusCode = isDatabaseError ? 503 : 500;
        const message = isDatabaseError
            ? "oops, falha de comunicacao com o banco de dados."
            : "oops, falha de comunicacao com o servico.";
        this.logger.error(message, exception?.stack);
        return this.sendResponse(response, statusCode, {
            statusCode,
            message,
            error: isDatabaseError ? "DatabaseUnavailable" : "ServiceUnavailable",
            timestamp: new Date().toISOString(),
            path: request.url
        });
    }
    sendResponse(response, statusCode, body) {
        const reply = response;
        if (reply.status && typeof reply.status === "function") {
            return reply.status(statusCode).send(body);
        }
        if (reply.send && typeof reply.send === "function") {
            return reply.send(body);
        }
        const raw = reply.raw ?? response;
        if (raw) {
            raw.statusCode = statusCode;
            raw.setHeader?.("content-type", "application/json");
            raw.end?.(JSON.stringify(body));
        }
        return undefined;
    }
    isDatabaseError(exception) {
        const error = exception;
        if (!error) {
            return false;
        }
        const code = (error.code ?? "").toString();
        if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57P01", "57P02", "57P03"].includes(code)) {
            return true;
        }
        const message = (error.message ?? "").toLowerCase();
        return (message.includes("database") ||
            message.includes("pg") ||
            message.includes("postgres") ||
            message.includes("connection") ||
            message.includes("econnrefused"));
    }
};
exports.ServiceExceptionFilter = ServiceExceptionFilter;
exports.ServiceExceptionFilter = ServiceExceptionFilter = ServiceExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], ServiceExceptionFilter);
