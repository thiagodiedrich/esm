import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Public } from "./auth/auth.decorators";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { PG_POOL } from "./database/database.module";
import { Kafka, logLevel } from "kafkajs";
import { StorageService } from "./storage/storage.service";
import { Client as MinioClient } from "minio";
import Redis from "ioredis";

class HealthResponseDto {
  @ApiProperty({ example: "ok" })
  status!: string;
}

class HealthDetailedDto {
  @ApiProperty({
    example: "healthy",
    description: "healthy = todas dependencias ok; degraded = alguma falhou."
  })
  status!: string;

  @ApiProperty({
    description: "Estado de cada dependencia: gateway, postgres, kafka, minio, redis.",
    example: {
      gateway: { status: "healthy" },
      postgres: { status: "healthy" },
      kafka: { status: "disabled" },
      minio: { status: "healthy", bucket: "telemetry-raw" },
      redis: { status: "healthy" }
    }
  })
  checks!: Record<string, unknown>;

  @ApiProperty({ example: "2026-02-04T12:00:00.000Z" })
  timestamp!: string;
}

@ApiTags("Health")
@Controller("/api/v1/health")
export class AppController {
  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    @Inject(PG_POOL) private readonly pool: Pool
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Healthcheck da API" })
  @ApiOkResponse({ type: HealthResponseDto })
  health() {
    return { status: "ok" };
  }

  @Public()
  @Get("/detailed")
  @ApiOperation({
    summary: "Healthcheck detalhado (dependencias)",
    description:
      "Valida gateway, Postgres, Kafka (se habilitado), MinIO e Redis. Retorna status healthy ou degraded."
  })
  @ApiOkResponse({
    type: HealthDetailedDto,
    description: "healthy = todas ok; degraded = alguma dependencia falhou ou nao configurada.",
    schema: {
      example: {
        status: "healthy",
        checks: {
          gateway: { status: "healthy" },
          postgres: { status: "healthy" },
          kafka: { status: "disabled" },
          minio: { status: "healthy", bucket: "telemetry-raw" },
          redis: { status: "healthy" }
        },
        timestamp: "2026-02-04T12:00:00.000Z"
      }
    }
  })
  async detailed() {
    const checks: Record<string, unknown> = {
      gateway: { status: "healthy" }
    };

    let overall = "healthy";

    try {
      await this.pool.query("SELECT 1");
      checks.postgres = { status: "healthy" };
    } catch (error) {
      overall = "degraded";
      checks.postgres = { status: "degraded", error: (error as Error).message };
    }

    const kafkaEnabled =
      (this.configService.get<string>("KAFKA_ENABLED") ?? "false").toLowerCase() === "true";
    const brokersRaw = this.configService.get<string>("KAFKA_BROKERS") ?? "";
    const brokers = brokersRaw.split(",").map((b) => b.trim()).filter(Boolean);
    if (!kafkaEnabled) {
      checks.kafka = { status: "disabled" };
    } else {
      try {
        const kafka = new Kafka({
          clientId: this.configService.get<string>("KAFKA_CLIENT_ID") ?? "esm-api",
          brokers,
          logLevel: logLevel.NOTHING
        });
        const admin = kafka.admin();
        await admin.connect();
        const topics = await admin.listTopics();
        const cluster = await admin.describeCluster();
        await admin.disconnect();
        checks.kafka = {
          status: "healthy",
          topics: topics.length,
          brokers: cluster.brokers?.length ?? 0
        };
      } catch (error) {
        overall = "degraded";
        checks.kafka = { status: "degraded", error: (error as Error).message };
      }
    }

    const storageConfig = this.storageService.getConfig();
    if (storageConfig.type === "minio") {
      try {
        if (!storageConfig.minio.endpoint || !storageConfig.minio.accessKey || !storageConfig.minio.secretKey) {
          throw new Error("MinIO nao configurado.");
        }
        const endpoint = storageConfig.minio.endpoint.replace(/^https?:\/\//, "");
        const [host, portRaw] = endpoint.split(":");
        const port = storageConfig.minio.useSsl ? 443 : Number(portRaw || 9000);
        const client = new MinioClient({
          endPoint: host,
          port,
          useSSL: storageConfig.minio.useSsl,
          accessKey: storageConfig.minio.accessKey,
          secretKey: storageConfig.minio.secretKey
        });
        const bucket = storageConfig.minio.bucket ?? "";
        if (!bucket) {
          throw new Error("Bucket nao definido.");
        }
        const exists = await client.bucketExists(bucket);
        checks.minio = { status: exists ? "healthy" : "degraded", bucket };
        if (!exists) {
          overall = "degraded";
        }
      } catch (error) {
        overall = "degraded";
        checks.minio = { status: "degraded", error: (error as Error).message };
      }
    } else {
      checks.storage = { status: "healthy", type: storageConfig.type };
    }

    const redisUrl = this.configService.get<string>("REDIS_URL");
    if (redisUrl) {
      const redis = new Redis(redisUrl, { lazyConnect: true });
      try {
        await redis.connect();
        await redis.ping();
        checks.redis = { status: "healthy" };
      } catch (error) {
        overall = "degraded";
        checks.redis = { status: "degraded", error: (error as Error).message };
      } finally {
        await redis.quit().catch(() => undefined);
      }
    } else {
      checks.redis = { status: "disabled" };
    }

    return {
      status: overall,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}
