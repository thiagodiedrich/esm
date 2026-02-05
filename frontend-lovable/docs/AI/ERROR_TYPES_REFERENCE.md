# Tipos e códigos de erro no frontend

Referência dos erros que podem aparecer no frontend-lovable: **API**, **JavaScript/runtime** e **Node/Vite** (build e dev).

---

## 1. Erros da API (respostas HTTP / client)

Originam do `apiRequest` em `src/api/client.ts`. São tipados como `ApiError` em `src/api/types.ts`.

### Tipo (`ErrorType`) e código HTTP

| Tipo                | Código HTTP | Descrição                          | Retentável | Ação no frontend                          |
|---------------------|------------|-------------------------------------|------------|-------------------------------------------|
| `AUTH_ERROR`        | 401        | Não autenticado / token inválido   | Não        | Refresh token → se falhar, logout + `/login` |
| `PERMISSION_ERROR`  | 403        | Sem permissão para o recurso       | Não        | Evento `auth:forbidden` → redirect `/403` |
| `NOT_FOUND`         | 404        | Recurso não encontrado             | Não        | Erro lançado (caller pode tratar)         |
| `VALIDATION_ERROR`  | 400       | Dados inválidos (body/query)       | Não        | Erro lançado; mensagem do backend         |
| `SERVER_ERROR`      | 5xx        | Erro no servidor                   | Sim        | Retry com backoff (5s, 10s, 20s); depois fallback |
| `NETWORK_ERROR`     | —          | Falha de rede (fetch falhou)       | Sim        | Retry com backoff; depois mensagem genérica |

### Forma do objeto (`ApiError`)

```ts
interface ApiError {
  type: ErrorType;           // um dos tipos acima
  status?: number;           // código HTTP (ausente em NETWORK_ERROR)
  message: string;           // mensagem para o usuário ou log
  correlationId?: string;   // id de correlação (X-Correlation-Id)
  retryable: boolean;       // se faz retry automático
}
```

### Mensagens padrão (client)

- 401 após falha de refresh: *"O sistema está passando por instabilidades e tentará reiniciar."*
- 403: *"Acesso negado"*
- Outros (4xx/5xx): corpo da resposta (`message`) ou *"Erro ao processar requisição"*
- Rede após esgotar retries: *"Problemas de conexão. Tentaremos novamente."*
- Erro inesperado (não classificado): *"Erro inesperado"* com `type: 'SERVER_ERROR'` e `retryable: false`

---

## 2. Health check (GET /health)

Não passa pelo `apiRequest`; usa `fetch(healthUrl)` em `src/api/endpoints.ts`.

- **Sucesso:** `{ status: 'ok' }` (sem erro).
- **Falha:** é lançado `new Error('Health check failed: ' + response.status)` (ex.: `Health check failed: 502`).
- **Uso:** TanStack Query no `useHealthCheck`; o store `backendHealth` fica `'error'` quando a query falha (qualquer erro, inclusive rede).

---

## 3. Erros de JavaScript / runtime (navegador)

Erros que ocorrem durante a execução do app no browser (React, handlers, etc.).

- **Forma:** objetos `Error` nativos (ou subclasses), com `message` e opcionalmente `stack`.
- **Onde aparecem:** console do navegador; se não forem tratados, podem quebrar a árvore de React (sem Error Boundary no projeto hoje).
- **Exemplos:**
  - `TypeError` (ex.: propriedade de `undefined`)
  - `ReferenceError` (variável não definida)
  - Erros em event handlers (ex.: `onClick`) se não tiverem `try/catch`
  - Falhas em `response.json()` (resposta não-JSON) — o client trata e converte em `ApiError` quando possível
- **Códigos:** não há códigos numéricos padronizados; só `name` e `message` (e `stack` em dev).

---

## 4. Erros do Node / Vite (build e dev server)

Ocorrem no ambiente do projeto (Node), não no browser.

### Dev server (`npm run dev` / `vite`)

- **Porta em uso:** EADDRINUSE (ex.: porta 8080).
- **Arquivo não encontrado / módulo quebrado:** mensagem de erro no terminal (stack do Node/Vite).
- **HMR:** no projeto o overlay está desligado (`hmr.overlay: false`), então erros de runtime não mostram overlay; aparecem só no console.

### Build (`npm run build`)

- **TypeScript:** erros de tipo (TS23xx, etc.) — build falha.
- **ESLint:** se o script de build rodar lint, violações podem falhar o build (depende do script).
- **Módulos:** "Module not found" ou erros de import.
- **Saída:** Vite usa exit code **1** em falha e **0** em sucesso; não há códigos de erro numéricos próprios do app.

---

## 5. Resumo por origem

| Origem        | Onde aparece              | Tipos / códigos principais |
|---------------|---------------------------|----------------------------|
| **API**       | Promessas do `api.*` / hooks | `ApiError.type` + `status` (HTTP); ver tabela acima |
| **Health**    | `healthApi.getHealth()`   | `Error` com mensagem `Health check failed: <status>` |
| **Backend status (UI)** | Store + banner | `useBackendHealthStore`: `'unknown' \| 'ok' \| 'error'` |
| **JS/runtime**| Console (e possivelmente tela se quebrar React) | `Error.name`, `Error.message` (sem código numérico) |
| **Node/Vite** | Terminal (dev/build)      | Mensagens do Vite/Node; exit code 1 em falha |

---

## 6. Páginas de erro de rota (UI)

- **403:** rota `/403` — exibida quando o client dispara `auth:forbidden` (resposta 403 da API).
- **404:** rota `/404` e `<Route path="*">` — rota não encontrada no React Router (não é obrigatoriamente 404 da API).

Para erros 5xx ou erros inesperados da API, o projeto não tem hoje uma página dedicada (ex.: `/500`); o componente que chama a API pode mostrar fallback ou toast.
