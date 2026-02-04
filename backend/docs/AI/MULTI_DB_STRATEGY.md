
---

# 📁 `/esm/backend/docs/AI/MULTI_DB_STRATEGY.md`

```md
# 🗄 Estratégia Multi-DB — FROZEN

Este documento define como o backend resolve bancos de dados.

---

## 🎯 Princípios

- Control Plane sempre fixo
- Data Plane pode variar por tenant
- Backend decide o DB por request

---

## 🔑 Catálogo de DB

- Definido via .env
- Exemplo:

```env
DB_CATALOG_JSON={
  "control_plane": "postgres://...",
  "erp_main": "postgres://...",
  "telemetry_tenant_a": "postgres://..."
}
