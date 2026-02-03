# Claim Check (Kafka)

## Status
Pendente.

## Objetivo
Definir o uso de claim check para cargas grandes em eventos Kafka, quando aplicavel.

## Observacoes
- Nenhuma implementacao ainda.
- Deve respeitar o envelope de eventos padrao:
  {
    event_id,
    event_type,
    tenant_id,
    payload,
    created_at
  }
