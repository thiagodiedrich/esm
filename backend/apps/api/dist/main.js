"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const redis_1 = __importDefault(require("@fastify/redis"));
const app_module_1 = require("./modules/app.module");
const json_logger_service_1 = require("./modules/observability/json-logger.service");
const request_context_service_1 = require("./modules/observability/request-context.service");
const service_exception_filter_1 = require("./modules/observability/service-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    const config = app.get(config_1.ConfigService);
    const requestContext = app.get(request_context_service_1.RequestContextService);
    const serviceName = config.get("SERVICE_NAME") || "esm-api";
    const debugEnabled = (config.get("DEBUG") ?? "false").toLowerCase() === "true";
    const format = (config.get("LOG_FORMAT") ?? "json").toLowerCase() === "text"
        ? "text"
        : "json";
    const levelValue = (config.get("LOG_LEVEL") ?? "log").toLowerCase();
    const allowedLevels = ["error", "warn", "log", "debug", "verbose"];
    const normalizedLevel = levelValue === "info"
        ? "log"
        : allowedLevels.includes(levelValue)
            ? levelValue
            : "log";
    const level = debugEnabled && normalizedLevel === "log" ? "debug" : normalizedLevel;
    app.useLogger(new json_logger_service_1.JsonLoggerService(requestContext, serviceName, { level, format }));
    app.useGlobalFilters(new service_exception_filter_1.ServiceExceptionFilter());
    const port = Number(config.get("PORT")) || 3000;
    const host = config.get("HOST") || "0.0.0.0";
    const corsOriginsRaw = config.get("CORS_ORIGINS");
    if (corsOriginsRaw) {
        const origins = corsOriginsRaw.split(",").map((origin) => origin.trim()).filter(Boolean);
        app.enableCors({
            origin: origins.length > 0 ? origins : false,
            credentials: true
        });
    }
    const rateLimitMax = Number(config.get("RATE_LIMIT_PER_MINUTE") ?? 0);
    const redisUrl = config.get("REDIS_URL");
    const useRedis = Boolean(redisUrl && redisUrl.trim());
    if (rateLimitMax > 0) {
        if (useRedis) {
            await app.register(redis_1.default, { url: redisUrl });
            const fastify = app.getHttpAdapter().getInstance();
            await app.register(rate_limit_1.default, {
                max: rateLimitMax,
                timeWindow: "1 minute",
                redis: fastify.redis
            });
        }
        else {
            await app.register(rate_limit_1.default, {
                max: rateLimitMax,
                timeWindow: "1 minute"
            });
        }
    }
    const swaggerEnabled = (config.get("SWAGGER_ENABLED") ?? "true").toLowerCase() === "true";
    if (swaggerEnabled) {
        const builder = new swagger_1.DocumentBuilder()
            .setTitle(config.get("SWAGGER_TITLE") ?? "ESM API")
            .setDescription(config.get("SWAGGER_DESCRIPTION") ?? "Documentacao da API ESM")
            .setVersion(config.get("SWAGGER_VERSION") ?? "1.0.0")
            .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "userAuth")
            .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "serviceAuth");
        const serverUrl = config.get("SWAGGER_SERVER_URL");
        if (serverUrl) {
            builder.addServer(serverUrl);
        }
        const document = swagger_1.SwaggerModule.createDocument(app, builder.build());
        const swaggerPath = config.get("SWAGGER_PATH") || "docs";
        swagger_1.SwaggerModule.setup(swaggerPath, app, document);
    }
    await app.listen(port, host);
}
bootstrap();
