# 🧊 Arquitetura Frontend — FROZEN (Fases 8.x)

Este documento é a **fonte única da verdade** para o frontend do SaaS ERP.

❌ Nenhuma regra aqui pode ser alterada sem decisão humana explícita.  
🤖 IA deve apenas EXECUTAR, nunca DECIDIR.

---

## 🎯 Objetivo do Frontend

- Cliente determinístico do backend
- Zero lógica de negócio
- Zero RBAC real
- UX resiliente e previsível

---

## 🔧 Stack (CONGELADA)

- Next.js (App Router)
- React
- TypeScript
- TanStack Query (server state)
- Zustand (estado visual apenas)
- Tailwind CSS
- Auth via cookies httpOnly
- Monorepo compatible

---

## 🧱 Princípios Imutáveis

- Backend é a fonte da verdade
- Frontend reage, não decide
- Frontend não interpreta JWT
- Menu vem 100% do backend
- RBAC real = backend
- RBAC visual = frontend

---

## 🗂 Estrutura Oficial de Pastas

```text
frontend/
├── app/                    # Rotas e layouts apenas
│   ├── (public)/
│   │   ├── login/
│   │   └── layout.tsx
│   ├── erp/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── telemetry/
│       ├── layout.tsx
│       └── page.tsx
│
├── src/
│   ├── templates/           # Layouts visuais
│   ├── domains/             # Lógica por domínio
│   ├── ui/                  # Componentes puros
│   ├── api/                 # Client HTTP
│   ├── auth/                # Auth hooks
│   └── stores/              # Zustand
