
---

# 📁 `/esm/frontend-chatgpt/docs/AI/CONTRACTS_FRONTEND.md`

```md
# 📄 Contratos Frontend ↔ Backend

Este documento define **como o frontend consome o backend**.
Nada fora daqui pode ser assumido.

---

## 🔐 Auth

### POST /api/auth/refresh
- Usa refresh token (cookie)
- Retorna novo access token (cookie)
- Se falhar → frontend faz logout

---

## 🔄 Context Switch

### POST /api/context/switch

Payload:
```json
{
  "organization_id": "uuid",
  "workspace_id": "uuid | null"
}
