# Análise: Tenant (Code 7) e CORS

**Estado atual (v1.9.0):** O campo `domain` foi adicionado em `tenants` e a resolução por domain está implementada no login (`AuthTenantService`) e no `TenancyMiddleware`. O **CorsValidationMiddleware foi removido**; CORS é tratado apenas no hook `onRequest` em `main.ts` e no `ServiceExceptionFilter` para erros. Ver `docs/AI/CORS_ESTRATEGIA.md` e `docs/AI/LOGIN_E_RESOLUCAO_TENANT.md`.

## Resumo executivo

Há dois problemas distintos:

1. **Code 7 (Tenant não encontrado)** — A resolução de tenant usa `slug` (ou subdomínio), mas `localhost`, `easytest`, `easytestapi` não existem como `slug` no banco. O tenant principal tem slug `default-tenant`.

2. **CORS** — Swagger funciona (mesma origem ou sem Origin), mas chamadas do frontend falham. O `CorsValidationMiddleware` adiciona validação extra que pode estar bloqueando requests ou gerando respostas 400 sem os headers CORS necessários para o browser expor a resposta.

---

## Parte 1: Problema do Tenant (Code 7)

### 1.1 Fluxo atual

**Backend (TenancyMiddleware):**
- Fontes de tenant: `x-tenant-id` (UUID), `x-tenant-slug`, `Host` (subdomínio).
- `extractTenantFromHost()`: pega `host.split(":")[0]`, depois `host.split(".")[0]`.
  - `localhost:3000` → `"localhost"`
  - `easytest.simc.com.br` → `"easytest"`
  - `easytestapi.simc.com.br` → `"easytestapi"`
- Consulta: `SELECT id FROM tenants WHERE slug = $1` (ou uuid para x-tenant-id).

**Frontend (client.ts – getTenantSlug()):**
- `localhost` / `127.0.0.1` → `"default-tenant"`
- `easytest.simc.com.br` (parts.length > 2) → `"easytest"` (subdomínio)
- `easytestapi.simc.com.br` → `"easytestapi"`
- Envia sempre `X-Tenant-Slug` nas requisições.

### 1.2 Onde está o erro

| Cenário | X-Tenant-Slug enviado | Host usado pelo backend | Lookup no banco | Resultado |
|---------|------------------------|--------------------------|------------------|-----------|
| localhost | default-tenant | localhost | slug = "default-tenant" | ✓ se existir |
| easytest.simc.com.br | easytest | easytest | slug = "easytest" | ✗ Code 7 |
| easytestapi.simc.com.br | easytestapi | easytestapi | slug = "easytestapi" | ✗ Code 7 |

O tenant principal costuma ter `slug = "default-tenant"`, mas **não** `"localhost"`, `"easytest"` ou `"easytestapi"`. Por isso o `ensureTenantExists` falha com Code 7.

### 1.3 Hipótese e solução proposta

**Hipótese:** Falta um mapeamento explícito entre domínio/host e tenant. O `slug` foi pensado para subdomínios (ex.: `cliente1.seudominio.com` → slug `cliente1`), mas não para domínios inteiros como `localhost`, `easytest.simc.com.br`, `easytestapi.simc.com.br`.

**Solução proposta: campo `domain` no tenant**

1. Novos conceitos:
   - `domain` (ou `domains`): lista de hosts/subdomínios que mapeiam para aquele tenant.
   - `TENANT_DEFAULT_DOMAIN` no `.env`: domínios padrão do tenant principal (ex.: `localhost,localhost:3000,localhost:8080,easytest.simc.com.br,easytestapi.simc.com.br`).

2. Migração:
   - `tenant_domains` (ou coluna `domains` JSONB em `tenants`):
     - `tenant_id`, `domain` (VARCHAR) UNIQUE.
   - Ou coluna `domain` em `tenants` aceitando múltiplos valores separados por vírgula.

3. Lógica de resolução:
   - Ordem: `x-tenant-id` → `x-tenant-slug` → `Host` por `domain`.
   - Para Host: usar `Host` completo (ex.: `localhost:3000`, `easytest.simc.com.br`).
   - Query: `SELECT t.id FROM tenants t JOIN tenant_domains td ON t.id = td.tenant_id WHERE td.domain = $1` (ou equivalente com `domains` em JSONB).

4. Migration de seed:
   - Inserir no tenant principal os domínios:
     - `localhost`, `localhost:3000`, `localhost:8080`
     - `easytest.simc.com.br`, `easytestapi.simc.com.br`
   - Pode existir também `default-tenant` como slug para compatibilidade.

### 1.4 Alternativa mais simples (sem migration de schema)

- Usar `TENANT_DEFAULT_DOMAIN` no `.env`.
- Se `Host` estiver em `TENANT_DEFAULT_DOMAIN` → resolver como tenant default (por `TENANT_DEFAULT_ID` ou slug default).
- Não exige nova tabela; apenas lógica no middleware.

---

## Parte 2: Problema do CORS

### 2.1 Arquitetura atual

1. **main.ts** — `app.enableCors({ origin: [...], credentials: true })` com lista de `CORS_ORIGINS`.
2. **CorsValidationMiddleware** — Valida `Origin` contra `CORS_ORIGINS`. Se não permitido → `BadRequestException("Code 0: Cors Origins inválido")`.
3. **API_PUBLIC_ROUTES** — Rotas excluídas da cadeia de middlewares (incluindo CORS): `/api/v1/health`, `/docs`.

### 2.2 Por que o Swagger funciona

- Swagger em `https://easytestapi.simc.com.br/docs` → mesmo host da API.
- Requisições “Try it out” são same-origin → sem `Origin` ou `Origin` igual ao servidor.
- CorsValidationMiddleware: se `!origin` → `next()`.
- Sem validação de CORS nesse caso.

### 2.3 Por que o frontend pode falhar

- Frontend em `https://easytest.simc.com.br` → API em `https://easytestapi.simc.com.br`.
- Cross-origin → `Origin: https://easytest.simc.com.br`.
- CorsValidationMiddleware compara com `CORS_ORIGINS`.

Possíveis causas:

| Causa | Exemplo |
|-------|---------|
| **http vs https** | Frontend em `http://easytest.simc.com.br:8080`, CORS só com `https://` |
| **Porta ausente** | Frontend em `https://easytest.simc.com.br:8443`, CORS só com `https://easytest.simc.com.br` (443) |
| **Trailing slash** | `https://easytest.simc.com.br/` vs `https://easytest.simc.com.br` |
| **400 sem CORS** | Middleware retorna 400 sem `Access-Control-Allow-Origin` → browser bloqueia a resposta e o frontend vê erro de CORS |
| **CORS_ORIGINS errado** | Domínio do frontend não está na lista |

### 2.4 CORS_ORIGINS atual (.env)

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,https://easytest.simc.com.br,https://easytest.simc.com.br:8080,https://easytestapi.simc.com.br,https://easytestapi.simc.com.br:8080
```

Origens esperadas:
- Frontend dev: `http://localhost:8080`
- Frontend prod: `https://easytest.simc.com.br` ou `https://easytest.simc.com.br:8080`

Se o frontend for acessado por `http://easytest.simc.com.br` (sem HTTPS), não há match. Verificar no browser qual `Origin` está sendo enviado.

### 2.5 Opções de correção

#### Opção A: Remover CorsValidationMiddleware (recomendado para desbloquear)

- Remover o middleware; manter apenas `app.enableCors()`.
- O Fastify/Nest continua aplicando CORS segundo `CORS_ORIGINS`.
- Menos validação server-side; o browser continua fazendo a checagem de CORS.
- **Vantagem:** Simples, desbloqueia logo.
- **Desvantagem:** Perde o “Code 0” explícito; falhas de CORS continuam como erro genérico no browser.

#### Opção B: Colocar rotas públicas em API_PUBLIC_ROUTES

- Adicionar `/api/v1/auth/login`, `/api/v1/auth/refresh` (e outras que precisem) em `API_PUBLIC_ROUTES`.
- Essas rotas não passam por CorsValidationMiddleware nem TenancyMiddleware.
- **Problema:** Login ainda precisa de tenant para emitir o token (se o fluxo depender de tenant). E TenancyMiddleware não roda em rotas públicas.
- **Uso adequado:** Para rotas que não dependem de tenant (ex.: health, docs). Para login, o tenant continua necessário.

#### Opção C: Manter middleware e garantir CORS em respostas de erro

- Em `ServiceExceptionFilter` (ou equivalente), incluir `Access-Control-Allow-Origin` nas respostas de erro quando a origem for permitida.
- Assim, mesmo com 400, o browser consegue ler a resposta e o frontend exibe “Code 0” ou “Code 7”.
- **Vantagem:** Mantém o “Code 0” e melhora debugging.
- **Desvantagem:** Mais código e risco de esquecer em algum filtro.

#### Opção D: Reverter alterações recentes de CORS

- Se houver histórico de commits, remover a introdução do CorsValidationMiddleware.
- Voltar ao comportamento anterior.

---

## Parte 3: Sobre “fica carregando” (Code 7)

- A API retorna 400 com “Code 7: Tenant não encontrado”.
- O frontend pode estar:
  - Mostrando loading indefinido por não tratar 400 corretamente.
  - Em retry (ex.: lógica de retry para 5xx).
  - Recebendo erro de CORS: o browser bloqueia a resposta e o `fetch` falha sem corpo, o que pode ser tratado como “falha de rede” e manter o loading.

Correções sugeridas:
- Tratar 400 como erro exibível (mensagem, toast, etc.).
- Não dar retry automático em 400.
- Resolver o Code 7 com a lógica de domain/tenant descrita acima.

---

## Recomendações

### Para Tenant (Code 7)

1. **Curto prazo:** Usar `TENANT_DEFAULT_DOMAIN` no `.env` e, no middleware, se `Host` estiver na lista, resolver como tenant default.
2. **Médio prazo:** Introduzir tabela `tenant_domains` (ou coluna `domains`) e migration para popular o tenant principal com os domínios indicados.

### Para CORS

1. **Curto prazo:** Remover `CorsValidationMiddleware` e depender apenas de `app.enableCors()`.
2. **Validação:** Checar no DevTools (Network) qual `Origin` está sendo enviado e comparar com `CORS_ORIGINS`.
3. **API_PUBLIC_ROUTES:** Usar apenas para rotas que realmente não precisam de tenant/CORS restritivo (health, docs, etc.). Login provavelmente deve continuar passando pelo fluxo normal.

### Checklist antes de implementar

- [ ] Confirmar `Origin` enviado pelo frontend (inspecionar requisição no DevTools).
- [ ] Confirmar se `MULTI_TENANT_ENABLED` está `true` ou `false` no ambiente onde o erro ocorre.
- [ ] Confirmar qual `slug` o tenant principal tem no banco (`default-tenant` ou outro).
- [ ] Decidir entre abordagem com `TENANT_DEFAULT_DOMAIN` (rápida) vs. `tenant_domains` (mais flexível).
