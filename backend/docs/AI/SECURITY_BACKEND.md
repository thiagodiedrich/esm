
---

# 📁 `/esm/backend/docs/AI/SECURITY_BACKEND.md`

```md
# 🔐 Segurança Backend — FROZEN

Este documento define as **regras de segurança definitivas** do backend.

---

## 🔑 Autenticação

- JWT RS256
- Chaves privadas fora do código
- Cookies httpOnly
- Refresh token separado

---

## 🔐 Autorização (RBAC)

- Baseada em:
  - res_roles
  - res_permissions
  - res_user_roles
  - res_user_permission_overrides
- Avaliação sempre no backend
- Escopo respeitado (tenant/org/workspace)

---

## 🛡 Rate Limit

- Aplicado por plano
- Aplicado por endpoint
- Redis como backend

---

## 🔒 Zero Trust

- Nenhum serviço confia em outro sem token
- Workers usam service tokens
- APIs internas protegidas

---

## 🔐 MFA (Fase futura)

- Não entra no MVP
- Arquitetura preparada

---
