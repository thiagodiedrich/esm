BEGIN;

-- Eventos recebidos de webhooks externos (payload bruto + metadados).
-- Permite auditoria, replay e processamento assíncrono posterior.
CREATE TABLE IF NOT EXISTS webhook_incoming_events (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  source VARCHAR(255) NOT NULL DEFAULT 'external',
  idempotency_key VARCHAR(512),
  headers_json JSONB,
  payload_json JSONB NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT now(),
  processed_at TIMESTAMP,
  processing_status VARCHAR(64) DEFAULT 'pending',
  processing_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_incoming_events_received_at
  ON webhook_incoming_events (received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_incoming_events_idempotency
  ON webhook_incoming_events (source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
