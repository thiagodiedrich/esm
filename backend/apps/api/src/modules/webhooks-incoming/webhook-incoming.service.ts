import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import { IncomingHttpHeaders } from "http";

export interface SaveWebhookParams {
  source?: string;
  idempotencyKey?: string | null;
  headers?: IncomingHttpHeaders;
  payload: Record<string, unknown>;
}

@Injectable()
export class WebhookIncomingService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Persiste o evento de webhook no banco (control-plane).
   * Em caso de idempotency_key duplicado, ignora inserção e retorna o id existente (idempotência).
   */
  async save(params: SaveWebhookParams): Promise<{ id: number; uuid: string; isDuplicate: boolean }> {
    const source = params.source ?? "external";
    const headersJson = params.headers ? sanitizeHeadersForStorage(params.headers) : null;
    const payloadJson = params.payload ?? {};
    const idempotencyKey = params.idempotencyKey?.trim() || null;

    if (idempotencyKey) {
      const existing = await this.pool.query<{ id: number; uuid: string }>(
        `SELECT id, uuid FROM webhook_incoming_events
         WHERE source = $1 AND idempotency_key = $2
         LIMIT 1`,
        [source, idempotencyKey]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return { id: row.id, uuid: row.uuid, isDuplicate: true };
      }
    }

    const insert = await this.pool.query<{ id: number; uuid: string }>(
      `INSERT INTO webhook_incoming_events (source, idempotency_key, headers_json, payload_json, received_at, processing_status)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, now(), 'pending')
       RETURNING id, uuid`,
      [source, idempotencyKey, JSON.stringify(headersJson), JSON.stringify(payloadJson)]
    );
    const row = insert.rows[0];
    return { id: row.id, uuid: row.uuid, isDuplicate: false };
  }
}

/** Remove headers sensíveis e normaliza para objeto serializável. */
function sanitizeHeadersForStorage(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  const skip = new Set(["authorization", "cookie"]);
  for (const [k, v] of Object.entries(headers)) {
    if (skip.has(k.toLowerCase())) continue;
    if (v === undefined || v === null) continue;
    out[k] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return out;
}
