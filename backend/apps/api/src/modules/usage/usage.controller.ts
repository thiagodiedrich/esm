import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags
} from "@nestjs/swagger";
import { UsageService, UsageMetricInput } from "./usage.service";
import { FastifyRequest } from "fastify";

class UsageMetricInputDto implements UsageMetricInput {
  @ApiProperty()
  tenant_id!: string;

  @ApiProperty({
    enum: [
      "api.requests",
      "telemetry.events_ingested",
      "telemetry.payload_bytes",
      "erp.purchase_requests.created",
      "erp.purchase_orders.created"
    ]
  })
  metric_key!: string;

  @ApiProperty()
  metric_value!: number;

  @ApiProperty({ example: "2026-02-03" })
  period!: string;

  @ApiProperty({ example: "gateway" })
  source!: string;
}

class UsageRequestDto {
  @ApiProperty({ type: [UsageMetricInputDto] })
  metrics!: UsageMetricInputDto[];
}

class StatusResponseDto {
  @ApiProperty({ example: "ok" })
  status!: string;
}

interface UsageRequest {
  metrics: UsageMetricInput[]; 
}

@ApiTags("Internal")
@Controller("/internal/usage/metrics")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Post()
  @ApiOperation({ summary: "Registra metricas internas (service token)" })
  @ApiBearerAuth("serviceAuth")
  @ApiBody({ type: UsageRequestDto })
  @ApiOkResponse({ type: StatusResponseDto })
  async recordMetrics(@Body() body: UsageRequest, @Req() request: FastifyRequest) {
    if (request.user?.auth_type !== "service") {
      throw new UnauthorizedException("Service token necessario.");
    }

    if (!body.metrics?.length) {
      return { status: "ignored" };
    }

    for (const metric of body.metrics) {
      await this.usageService.recordMetric(metric);
    }

    return { status: "ok" };
  }
}
