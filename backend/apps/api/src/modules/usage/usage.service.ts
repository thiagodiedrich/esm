import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { resolveUuidToId } from "../database/uuid-resolver";

export interface UsageMetricInput {
  tenant_id: string;
  metric_key: string;
  metric_value: number;
  period: string;
  source: string;
}

const ALLOWED_METRICS = new Set([
  "api.requests",
  "telemetry.events_ingested",
  "telemetry.payload_bytes",
  "erp.purchase_requests.created",
  "erp.purchase_orders.created"
]);

@Injectable()
export class UsageService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async recordMetric(input: UsageMetricInput) {
    if (!ALLOWED_METRICS.has(input.metric_key)) {
      throw new BadRequestException("Metric key nao permitido.");
    }

    const tenantId = await resolveUuidToId(this.pool, "tenants", input.tenant_id);
    if (!tenantId) {
      throw new BadRequestException("Tenant nao encontrado.");
    }

    await this.pool.query(
      `INSERT INTO tenant_usage_metrics
       (tenant_id, metric_key, metric_value, period, source, created_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        tenantId,
        input.metric_key,
        input.metric_value,
        input.period,
        input.source
      ]
    );
  }
}
