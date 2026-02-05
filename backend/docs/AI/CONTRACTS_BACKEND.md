# 📄 Contratos do Backend (HTTP / Eventos)

Este documento define **todos os contratos oficiais do backend**.

Frontend, workers e integrações **devem obedecer exatamente** a estes contratos.

---

## 🔐 Autenticação

### POST /api/v1/auth/login
- Credenciais: email + password
- Tenant resolvido por domínio/subdomínio
- Retorna cookies httpOnly

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
