
---

# 📁 `/esm/frontend-chatgpt/docs/AI/ERROR_HANDLING.md`

```md
# 🛑 Error Handling & Resiliência — Frontend

Objetivo:
- UX resiliente
- Sistema nunca “quebra”
- Usuário sempre informado

---

## 🔥 Regras Gerais

- UI nunca pode travar
- Nunca exibir erro técnico cru
- Sempre fallback visual

---

## 🔄 Erro Crítico (usuário logado)

Definição:
- 500 repetido
- JWT inválido
- Erro de contexto
- Falha de refresh token

Fluxo:
1. Tentar refresh
2. Se falhar:
   - logout automático
   - redirect `/login`
   - popup:

> “O sistema está passando por instabilidades e tentará reiniciar.”

---

## 🌐 Network Error

Fluxo:
- Primeira falha → retry após 5s
- Até 2–3 tentativas
- Backoff progressivo
- Depois:
  - pausa
  - mensagem clara
  - botão “Tentar novamente”

Nunca:
- Floodar API
- Retry infinito

---

## 🧠 Classificação de Erros

| Tipo | Ação |
|---|---|
| AUTH_ERROR (401) | Refresh → Login |
| PERMISSION_ERROR (403) | Página `/403` |
| SERVER_ERROR (5xx) | Fallback UI |
| NETWORK_ERROR | Retry com backoff |
