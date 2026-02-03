import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import { UsageService, UsageMetricInput } from "./usage.service";
import { FastifyRequest } from "fastify";

interface UsageRequest {
  metrics: UsageMetricInput[];
}

@Controller("/internal/usage/metrics")
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Post()
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
