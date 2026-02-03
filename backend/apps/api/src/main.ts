import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./modules/app.module";
import { JsonLoggerService } from "./modules/observability/json-logger.service";
import { RequestContextService } from "./modules/observability/request-context.service";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  const config = app.get(ConfigService);
  const requestContext = app.get(RequestContextService);
  const serviceName = config.get<string>("SERVICE_NAME") || "esm-api";
  app.useLogger(new JsonLoggerService(requestContext, serviceName));
  const port = Number(config.get("PORT")) || 3000;
  const host = config.get<string>("HOST") || "0.0.0.0";

  await app.listen(port, host);
}

bootstrap();
