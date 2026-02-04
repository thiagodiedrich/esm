import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyReply, FastifyRequest } from "fastify";
import { StorageService } from "./storage.service";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

interface StorePayloadRequest {
  key: string;
  content_type: string;
  data_base64: string;
  bucket?: string;
}

class StorePayloadRequestDto {
  key!: string;
  content_type!: string;
  data_base64!: string;
  bucket?: string;
}

class StorePayloadResponseDto {
  status!: string;
  object!: {
    key: string;
    contentType: string;
    size: number;
    etag?: string;
  };
}

@Controller("/internal/storage")
@ApiTags("Internal")
export class StorageController {
  private static readonly downloadRateLimit = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {}

  @Post("/payloads")
  @ApiOperation({ summary: "Upload interno de payload (service token)" })
  @ApiBearerAuth("serviceAuth")
  @ApiBody({ type: StorePayloadRequestDto })
  @ApiOkResponse({ type: StorePayloadResponseDto })
  async storePayload(@Body() body: StorePayloadRequest, @Req() request: FastifyRequest) {
    if (request.user?.auth_type !== "service") {
      throw new UnauthorizedException("Service token necessario.");
    }

    const buffer = Buffer.from(body.data_base64, "base64");
    const stored = await this.storageService.upload({
      key: body.key,
      contentType: body.content_type,
      body: buffer,
      bucket: body.bucket
    });

    return { status: "ok", object: stored };
  }

  @Get("/payloads/:key")
  @ApiOperation({ summary: "Download interno de payload (service token)" })
  @ApiBearerAuth("serviceAuth")
  @ApiParam({ name: "key", required: true })
  @ApiQuery({ name: "bucket", required: false })
  @ApiOkResponse({
    description: "Stream do payload (application/json ou application/gzip)."
  })
  async downloadPayload(
    @Param("key") key: string,
    @Query("bucket") bucket: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    if (request.user?.auth_type !== "service") {
      throw new UnauthorizedException("Service token necessario.");
    }

    if (!this.isSafeKey(key)) {
      throw new BadRequestException("Key invalida.");
    }

    const rateLimitMax = Number(
      this.configService.get<string>("STORAGE_DOWNLOAD_RATE_LIMIT_PER_MINUTE") ?? 0
    );
    if (rateLimitMax > 0 && this.isRateLimited(request, rateLimitMax)) {
      throw new HttpException("Rate limit excedido.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const storageConfig = this.storageService.getConfig();
    if (storageConfig.type === "local" && bucket) {
      throw new BadRequestException("Bucket nao suportado para storage local.");
    }

    let resolvedBucket: string | undefined;
    if (storageConfig.type === "minio") {
      resolvedBucket = storageConfig.minio.bucket ?? undefined;
      if (!resolvedBucket) {
        throw new BadRequestException("Bucket nao configurado.");
      }
      if (bucket && bucket !== resolvedBucket) {
        throw new BadRequestException("Bucket invalido.");
      }
    }

    const tenantId = request.user?.tenant_id;
    if (tenantId && !key.startsWith(`telemetry/${tenantId}/`)) {
      throw new BadRequestException("Key fora do escopo do tenant.");
    }

    const stream = await this.storageService.read({ key, bucket: resolvedBucket });
    reply.header("content-type", this.guessContentType(key));
    return reply.send(stream);
  }

  private isSafeKey(key: string) {
    return !key.includes("..") && !key.startsWith("/") && !key.startsWith("\\");
  }

  private guessContentType(key: string) {
    if (key.endsWith(".json.gz")) {
      return "application/gzip";
    }
    if (key.endsWith(".json")) {
      return "application/json";
    }
    return "application/octet-stream";
  }

  private isRateLimited(request: FastifyRequest, limit: number) {
    const key = this.getClientKey(request);
    const now = Date.now();
    const existing = StorageController.downloadRateLimit.get(key);
    if (!existing || existing.resetAt <= now) {
      StorageController.downloadRateLimit.set(key, {
        count: 1,
        resetAt: now + 60 * 1000
      });
      return false;
    }
    if (existing.count >= limit) {
      return true;
    }
    existing.count += 1;
    StorageController.downloadRateLimit.set(key, existing);
    return false;
  }

  private getClientKey(request: FastifyRequest) {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim();
    }
    return request.ip ?? "unknown";
  }
}
