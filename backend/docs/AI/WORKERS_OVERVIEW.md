
---

# 📁 `/esm/backend/docs/AI/WORKERS_OVERVIEW.md`

```md
# ⚙️ Workers Backend — Visão Geral

Este documento define como funcionam os workers do sistema.

---

## 🧱 Estratégia

- Workers separados por DOMÍNIO
- Um worker ≠ um módulo
- Escala independente

---

## 🧪 Exemplos

### Telemetry Worker
- Kafka consumer
- Processamento pesado
- Escrita em TimescaleDB

### ERP Worker
- Processamento de pedidos
- Geração de eventos
- Integrações externas

---

## 🔐 Segurança

- Service tokens
- Escopo limitado
- Sem acesso público

---
    