# 📊 Observabilidade Backend — FROZEN

Este documento define como o backend gera logs e métricas.

---

## 🔗 Correlation ID

- Gerado se não existir
- Repassado entre serviços
- Sempre presente em logs

---

## 📄 Logs Estruturados

Formato JSON obrigatório:

```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "service": "api-gateway|worker",
  "message": "string",
  "correlation_id": "uuid",
  "tenant_id": "uuid | null",
  "context": {},
  "data": {}
}
