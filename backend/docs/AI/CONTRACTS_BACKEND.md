# 📄 Contratos do Backend (HTTP / Eventos)

**Backend API ESM — versão estável 1.9.0**

Este documento define **todos os contratos oficiais do backend**.

Frontend, workers e integrações **devem obedecer exatamente** a estes contratos.

---

## 🔐 Autenticação

### POST /api/v1/auth/login
- Credenciais: email + password
- Tenant resolvido nesta ordem: **x-tenant-id** → **x-tenant-slug** → **subdomínio do Host** → **domain** (campo `tenants.domain`). Se `MULTI_TENANT_ENABLED=false` e `TENANT_DEFAULT_ENABLED=true`, usa `TENANT_DEFAULT_ID` / `TENANT_DEFAULT_SLUG`. Ver `docs/AI/LOGIN_E_RESOLUCAO_TENANT.md`.
- Retorna cookies httpOnly (quando configurado)

---

### POST /api/v1/auth/refresh
- Usa refresh token (cookie)
- Retorna novo access token
- Falha → 401

---

### POST /api/v1/auth/logout
- Invalida sessão
- Limpa cookies

---

## 🧭 Contexto

### POST /api/v1/context/switch

Payload:
```json
{
  "organization_id": "uuid",
  "workspace_id": "uuid | null"
}
