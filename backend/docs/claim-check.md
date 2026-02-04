# Claim Check (Kafka)

## Status
Implementado para telemetria.

## Objetivo
Definir o uso de claim check para cargas grandes em eventos Kafka, quando aplicavel.

## Observacoes
- Implementado em `POST /api/v1/telemetry/bulk`.
- O payload bruto e salvo no MinIO como JSON compactado (gzip).
- O Kafka recebe apenas o claim-check no payload.
- Download interno para inspecao: `GET /internal/storage/payloads/:key` (service token).
- Envelope padrao respeitado:
  {
    event_id,
    event_type,
    tenant_id,
    payload,
    created_at
  }

## Payload enviado ao Kafka
{
  claim_check,
  storage_type,
  storage_endpoint,
  bucket,
  file_size,
  original_size,
  compression,
  timestamp,
  metadata
}
