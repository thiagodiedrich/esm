import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import rateLimit from "@fastify/rate-limit";
import fastifyRedis from "@fastify/redis";
import { AppModule } from "./modules/app.module";
import { JsonLoggerService } from "./modules/observability/json-logger.service";
import { RequestContextService } from "./modules/observability/request-context.service";
import { ServiceExceptionFilter } from "./modules/observability/service-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  const config = app.get(ConfigService);
  const requestContext = app.get(RequestContextService);
  const serviceName = config.get<string>("SERVICE_NAME") || "esm-api";
  const debugEnabled =
    (config.get<string>("DEBUG") ?? "false").toLowerCase() === "true";
  const format =
    (config.get<string>("LOG_FORMAT") ?? "json").toLowerCase() === "text"
      ? "text"
      : "json";
  const levelValue = (config.get<string>("LOG_LEVEL") ?? "log").toLowerCase();
  const allowedLevels = ["error", "warn", "log", "debug", "verbose"] as const;
  const normalizedLevel =
    levelValue === "info"
      ? "log"
      : allowedLevels.includes(levelValue as any)
      ? (levelValue as (typeof allowedLevels)[number])
      : "log";
  const level = debugEnabled && normalizedLevel === "log" ? "debug" : normalizedLevel;
  app.useLogger(new JsonLoggerService(requestContext, serviceName, { level, format }));
  app.useGlobalFilters(new ServiceExceptionFilter(config));
  const port = Number(config.get("PORT")) || 3000;
  const host = config.get<string>("HOST") || "0.0.0.0";

  const corsOriginsRaw = config.get<string>("CORS_ORIGINS")?.trim();
  const nodeEnv = (config.get<string>("NODE_ENV") ?? "development").toLowerCase();
  const isProduction = nodeEnv === "production";

  if (corsOriginsRaw) {
    const origins = corsOriginsRaw.split(",").map((origin) => origin.trim()).filter(Boolean);
    const originsLower = origins.map((o) => o.trim().toLowerCase()).filter(Boolean);
    app.enableCors({
      origin: origins.length > 0 ? origins : false,
      credentials: true
    });

    const setCorsHeader = (reply: any, name: string, value: string) => {
      if (typeof reply?.header === "function") {
        reply.header(name, value);
      } else if (typeof reply?.raw?.setHeader === "function") {
        reply.raw.setHeader(name, value);
      } else if (typeof reply?.setHeader === "function") {
        reply.setHeader(name, value);
      }
    };

    const fastify = app.getHttpAdapter().getInstance() as {
      addHook: (name: string, fn: (...args: any[]) => void | Promise<void>) => void;
    };

    // CORS: definir no inicio de TODA requisicao para a resposta final ter os headers (funciona atras de proxy/gateway)
    fastify.addHook("onRequest", async (request: any, reply: any) => {
      const origin = request.headers?.origin;
      const originAllowed =
        typeof origin === "string" &&
        origin.trim() &&
        originsLower.some((o: string) => o === origin.trim().toLowerCase());

      if (originAllowed) {
        setCorsHeader(reply, "Access-Control-Allow-Origin", origin.trim());
        setCorsHeader(reply, "Access-Control-Allow-Credentials", "true");
      }
      setCorsHeader(reply, "Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      setCorsHeader(
        reply,
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Tenant-Id, X-Organization-Id, X-Workspace-Id, X-Tenant-Slug, X-Correlation-Id"
      );
      setCorsHeader(reply, "Access-Control-Max-Age", "86400");

      if (String(request.method).toUpperCase() === "OPTIONS") {
        return reply.status(204).send();
      }
    });
  } else {
    const bootstrapLogger = new Logger("Bootstrap");
    if (isProduction) {
      bootstrapLogger.warn(
        "CORS_ORIGINS nao configurado. Requisicoes cross-origin serao bloqueadas pelo navegador. Configure CORS_ORIGINS no .env."
      );
    } else {
      app.enableCors({ origin: true, credentials: true });
      bootstrapLogger.warn(
        "CORS_ORIGINS vazio ou ausente; permitindo todas as origens (NODE_ENV=development)."
      );
    }
  }

  const rateLimitMax = Number(config.get("RATE_LIMIT_PER_MINUTE") ?? 0);
  const redisUrl = config.get<string>("REDIS_URL");
  const useRedis = Boolean(redisUrl && redisUrl.trim());

  if (rateLimitMax > 0) {
    if (useRedis) {
      await app.register(fastifyRedis as any, { url: redisUrl });
      const fastify = app.getHttpAdapter().getInstance() as any;
      await app.register(rateLimit as any, {
        max: rateLimitMax,
        timeWindow: "1 minute",
        redis: fastify.redis
      });
    } else {
      await app.register(rateLimit as any, {
        max: rateLimitMax,
        timeWindow: "1 minute"
      });
    }
  }

  const swaggerEnabled =
    (config.get<string>("SWAGGER_ENABLED") ?? "true").toLowerCase() === "true";

  if (swaggerEnabled) {
    const builder = new DocumentBuilder()
      .setTitle(config.get<string>("SWAGGER_TITLE") ?? "ESM API")
      .setDescription(
        config.get<string>("SWAGGER_DESCRIPTION") ?? "Documentacao da API ESM"
      )
      .setVersion(config.get<string>("SWAGGER_VERSION") ?? "1.0.0")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "userAuth"
      )
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "serviceAuth"
      )
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Secret",
          description: "Opcional: valor de WEBHOOK_INCOMING_SECRET (se configurado no servidor)"
        },
        "webhookAuth"
      );

    const serverUrl = config.get<string>("SWAGGER_SERVER_URL");
    if (serverUrl) {
      builder.addServer(serverUrl);
    }

    const document = SwaggerModule.createDocument(app, builder.build());
    const swaggerPath = config.get<string>("SWAGGER_PATH") || "docs";
    SwaggerModule.setup(swaggerPath, app, document);
  }

  await app.listen(port, host);
}

bootstrap();
