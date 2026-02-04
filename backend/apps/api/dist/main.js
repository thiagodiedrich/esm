"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
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
    const host = config.get("HOST") || "0.0.0.0";
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
