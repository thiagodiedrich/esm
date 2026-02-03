"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./modules/app.module");
const json_logger_service_1 = require("./modules/observability/json-logger.service");
const request_context_service_1 = require("./modules/observability/request-context.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    const config = app.get(config_1.ConfigService);
    const requestContext = app.get(request_context_service_1.RequestContextService);
    const serviceName = config.get("SERVICE_NAME") || "esm-api";
    app.useLogger(new json_logger_service_1.JsonLoggerService(requestContext, serviceName));
    const port = Number(config.get("PORT")) || 3000;
    await app.listen(port, "0.0.0.0");
}
bootstrap();
