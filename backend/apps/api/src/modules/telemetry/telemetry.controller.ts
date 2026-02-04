import { BadRequestException, Body, Controller, Post, Req } from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { gzipSync } from "zlib";
import { KafkaService } from "../kafka/kafka.service";
import { StorageService } from "../storage/storage.service";
import { RequestContextService } from "../observability/request-context.service";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

class TelemetryBulkResponseDto {
  status!: string;
  event_id!: string;
  claim_check!: string;
}

@Controller("/api/v1/telemetry")
@ApiTags("Telemetry")
export class TelemetryController {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly storageService: StorageService,
    private readonly requestContext: RequestContextService,
    private readonly configService: ConfigService
  ) {}

  @Post("/bulk")
  @ApiOperation({ summary: "Ingestao bulk com claim-check" })
  @ApiBearerAuth("userAuth")
  @ApiBody({ schema: { type: "object", additionalProperties: true } })
  @ApiOkResponse({ type: TelemetryBulkResponseDto })
  async ingestBulk(@Body() body: Record<string, unknown>, @Req() req: FastifyRequest) {
    const tenantId = req.user?.tenant_id ?? this.requestContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException("Tenant nao informado.");
    }

    const eventId = randomUUID();
    const timestamp = new Date().toISOString();
    const folder = timestamp.replace(/[:.]/g, "-");
    const key = `telemetry/${tenantId}/${folder}/${eventId}.json.gz`;

    const payloadJson = JSON.stringify(body ?? {});
    const originalSize = Buffer.byteLength(payloadJson);
    const gzipped = gzipSync(payloadJson);

    const storageConfig = this.storageService.getConfig();
    const bucket = storageConfig.minio.bucket ?? "telemetry-raw";

    const stored = await this.storageService.upload({
      key,
      contentType: "application/gzip",
      body: gzipped,
      bucket
    });

    const claim = {
      claim_check: stored.key,
      storage_type: storageConfig.type,
      storage_endpoint: storageConfig.minio.endpoint ?? "minio",
      bucket,
      file_size: stored.size,
      original_size: originalSize,
      compression: "gzip",
      timestamp,
      metadata: (body?.metadata as Record<string, unknown>) ?? {}
    };

    const topic = this.configService.get<string>("KAFKA_TOPIC") ?? "telemetry.raw";
    await this.kafkaService.publish(topic, {
      event_id: eventId,
      event_type: "telemetry.bulk.claim_check",
      tenant_id: tenantId,
      payload: claim,
      created_at: timestamp
    });

    return { status: "accepted", event_id: eventId, claim_check: stored.key };
  }
}
