# Swagger, uso e rotas da API

**Backend API ESM — versão estável 1.9.0**

Este documento descreve como acessar o Swagger, autenticar e chamar os endpoints
expostos pelo backend.

## Swagger / OpenAPI

- URL padrão: `http://localhost:3000/docs`
- JSON OpenAPI: `http://localhost:3000/docs-json`
- Configuração: `.env` (`SWAGGER_ENABLED`, `SWAGGER_PATH`, `SWAGGER_TITLE`,
  `SWAGGER_DESCRIPTION`, `SWAGGER_VERSION`, `SWAGGER_SERVER_URL`)

## Autenticação

Existem dois tipos de autenticação:

- **userAuth**: JWT de usuário (rotas `/api/*`)
- **serviceAuth**: JWT de serviço (rotas `/internal/*`)

Os headers seguem o padrão:

- `Authorization: Bearer <token>`

## Resolução de tenant (login)

No login (`/api/v1/auth/login`), o tenant é resolvido nesta ordem (quando o request é usado):

1) **tenant_id** — header `x-tenant-id` (ou `TENANT_HEADER`): compara com `tenants.id` (numérico) ou `tenants.uuid`
2) **tenant_slug** — header `x-tenant-slug`: compara com `tenants.slug`
3) **subdomínio** — extraído do `Host` (ex.: `easytest` de `easytest.simc.com.br`), comparado com `tenants.slug`
4) **domain** — host completo (com porta), hostname (sem porta) e subdomínio comparados com o campo `tenants.domain` (lista separada por vírgula, ex.: `localhost,easytest.simc.com.br`)

**Exceção:** Se `MULTI_TENANT_ENABLED=false` e `TENANT_DEFAULT_ENABLED=true`, o login ignora headers/host e usa apenas `TENANT_DEFAULT_ID` e `TENANT_DEFAULT_SLUG` do `.env`.

Detalhes: `docs/AI/LOGIN_E_RESOLUCAO_TENANT.md`.

---

## Endpoints públicos

### Health

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/health` | Healthcheck simples |
| GET | `/api/v1/health/detailed` | Healthcheck detalhado (Postgres, Kafka, MinIO, Redis) |

O controller está registrado com `@Controller("/api/v1/health")`; não há prefixo global que duplique o path. O frontend deve usar `VITE_API_URL` terminando em `/api/v1` para que `GET {base}/health` seja `/api/v1/health`.

Resposta simples: `{ "status": "ok" }`

Resposta detalhada (exemplo):
```json
{
  "status": "healthy",
  "checks": {
    "gateway": { "status": "healthy" },
    "postgres": { "status": "healthy" },
    "kafka": { "status": "disabled" },
    "minio": { "status": "healthy", "bucket": "telemetry-raw" },
    "redis": { "status": "healthy" }
  },
  "timestamp": "2026-02-04T12:00:00.000Z"
}
```

---

## Endpoints de usuário (JWT)

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login de usuário |
| POST | `/api/v1/auth/refresh` | Refresh de token |
| GET | `/api/v1/auth/me` | Dados do usuário logado |

**Login** – Body:
```json
{
  "email": "admin@empresa.com",
  "password": "senhaSegura123"
}
```

Resposta (login/refresh):
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 900
}
```

**Refresh** – Body:
```json
{
  "refresh_token": "..."
}
```

**Me** – Resposta:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "email": "admin@empresa.com",
  "partner_id": null,
  "is_active": true
}
```

### Contexto

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/context/switch` | Troca organização/workspace (retorna novos tokens) |

Body:
```json
{
  "organization_id": "uuid",
  "workspace_id": "uuid-ou-null"
}
```

### Menu

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/menu` | Itens de menu do usuário (baseado em permissões) |

Resposta:
```json
{
  "items": [
    { "id": "menu-item-1", "title": "..." }
  ]
}
```

### Telemetry (claim-check)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/telemetry/bulk` | Envia telemetria em lote; payload é comprimido, salvo no storage e publicado no Kafka |

Body: JSON livre.

Resposta:
```json
{
  "status": "accepted",
  "event_id": "uuid",
  "claim_check": "telemetry/<tenant>/<timestamp>/<uuid>.json.gz"
}
```

### Branding

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/branding/defaults` | Valores padrão de branding (white-label) |

---

## Endpoints administrativos (JWT) – Base: `/api/v1/admin`

Requer **userAuth** (access token de usuário com perfil admin).

### Tenants

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/tenants` | Cria tenant |
| GET | `/tenants` | Lista tenants |
| GET | `/tenants/:id` | Busca tenant por id |
| PUT | `/tenants/:id` | Atualiza tenant |
| PATCH | `/tenants/:id/status` | Atualiza status de migração do tenant |

**Tenant (POST/PUT)** – Body exemplo:
```json
{
  "name": "Empresa ABC",
  "slug": "empresa-abc",
  "db_strategy": "shared",
  "control_plane_db": null,
  "erp_db": null,
  "telemetry_db": null,
  "migration_status": "pending"
}
```

**Status (PATCH)** – Body: `{ "migration_status": "completed" }`

### Planos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/plans` | Cria plano |
| GET | `/plans` | Lista planos |
| PUT | `/plans/:code` | Atualiza plano |
| PATCH | `/plans/:code/status` | Atualiza status do plano |

**Plano (POST/PUT)** – Body exemplo: `{ "code": "starter", "name": "Plano Starter", "description": "Para pequenos projetos" }`  
**Status (PATCH)** – Body: `{ "status": "active" }`

### Produtos da plataforma (Aplicativos)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/platform-products` | Cria produto da plataforma |
| GET | `/platform-products` | Lista produtos da plataforma |
| GET | `/platform-products/:id` | Busca produto por id |
| PUT | `/platform-products/:id` | Atualiza produto |
| DELETE | `/platform-products/:id` | Remove produto |

**Body (POST/PUT)**: `{ "code": "erp", "name": "ERP", "description": null }`

### Módulos de produto (módulos/aplicativos por produto)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/platform-product-modules` | Cria módulo do produto |
| GET | `/platform-product-modules` | Lista módulos (query: `?product_id=uuid`) |
| GET | `/platform-product-modules/:id` | Busca módulo por id |
| PUT | `/platform-product-modules/:id` | Atualiza módulo |
| DELETE | `/platform-product-modules/:id` | Remove módulo |

**Body (POST/PUT)**: `{ "product_id": "uuid", "code": "erp.product", "name": "Produtos" }`

### Produtos do tenant

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/tenants/:id/products` | Associa produto ao tenant |
| GET | `/tenants/:id/products` | Lista produtos do tenant |
| GET | `/tenants/:tenantId/products/:id` | Busca produto do tenant |
| PUT | `/tenants/:tenantId/products/:id` | Atualiza produto do tenant |
| DELETE | `/tenants/:tenantId/products/:id` | Remove produto do tenant |

**Body (POST/PUT)**: `{ "product_id": "uuid", "plan_id": "uuid", "is_active": true }`

### Métricas de uso do tenant

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/tenants/:id/usage-metrics` | Lista métricas de uso do tenant |

### Permissões (res_permissions)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/permissions` | Cria permissão |
| GET | `/permissions` | Lista permissões |
| GET | `/permissions/:id` | Busca permissão por id |
| PUT | `/permissions/:id` | Atualiza permissão |
| DELETE | `/permissions/:id` | Remove permissão |

**Body (POST/PUT)**: `{ "resource": "admin.tenant", "action": "read", "description": null }`

---

## Endpoints do tenant (JWT) – Base: `/api/v1/tenant`

Requer **userAuth**; tenant resolvido pelo JWT.

### Organizações (Empresas)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/organizations` | Cria organização |
| GET | `/organizations` | Lista organizações |
| PUT | `/organizations/:id` | Atualiza organização |
| DELETE | `/organizations/:id` | Remove organização |

**Body (POST/PUT)**: `{ "name": "Organização Principal", "is_default": true }`

### Configurações da organização

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/organizations/:id/settings` | Busca configurações da empresa |
| PUT | `/organizations/:id/settings` | Cria ou atualiza configurações da empresa |

**Body (PUT)**: `{ "workspace_mode": null, "remember_last_context": true, "menu_cache_ttl": null, "enable_mfa": false, "enable_oauth": false }`

### Workspaces

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/workspaces` | Cria workspace |
| GET | `/workspaces` | Lista workspaces |
| PUT | `/workspaces/:id` | Atualiza workspace |
| DELETE | `/workspaces/:id` | Remove workspace |

**Body (POST/PUT)**: `{ "organization_id": "uuid", "name": "Workspace Vendas" }`

### Usuários

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/users` | Cria usuário |
| GET | `/users` | Lista usuários |
| PUT | `/users/:id` | Atualiza usuário |
| DELETE | `/users/:id` | Remove usuário |
| PATCH | `/users/:id/password` | Atualiza senha do usuário |
| PATCH | `/users/:id/status` | Atualiza status (ativo/inativo) do usuário |

**Body (POST/PUT)**: `{ "email": "usuario@empresa.com", "password": "senhaSegura123", "partner_id": null, "is_active": true }`  
**Password (PATCH)**: `{ "password": "novaSenhaSegura123" }`  
**Status (PATCH)**: `{ "is_active": false }`

### Regras do usuário (user roles)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users/:id/roles` | Lista regras do usuário |
| POST | `/users/:id/roles` | Associa regra ao usuário |
| DELETE | `/users/:userId/roles/:roleId` | Remove regra do usuário |

**Body (POST)**: `{ "role_id": "uuid", "scope_type": null, "scope_id": null }`

### Overrides de permissão do usuário

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users/:id/permission-overrides` | Lista overrides de permissão do usuário |
| POST | `/users/:id/permission-overrides` | Adiciona override de permissão (allow/deny) |
| DELETE | `/users/:userId/permission-overrides/:permissionId` | Remove override de permissão |

**Body (POST)**: `{ "permission_id": "uuid", "effect": "allow" }` (effect: `allow` ou `deny`)

### Contatos (res_partners)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/partners` | Cria contato |
| GET | `/partners` | Lista contatos (query: `?organization_id=uuid`) |
| GET | `/partners/:id` | Busca contato por id |
| PUT | `/partners/:id` | Atualiza contato |
| DELETE | `/partners/:id` | Remove contato |

**Body (POST/PUT)**: `{ "organization_id": null, "name": "João Silva", "email": null, "telephone": null, "type": null, "document": null, "location_address": null, "location_address_number": null, "location_address_zip": null }`

### Regras de acesso (res_roles)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/roles` | Cria regra de acesso |
| GET | `/roles` | Lista regras de acesso |
| GET | `/roles/:id` | Busca regra por id |
| PUT | `/roles/:id` | Atualiza regra |
| DELETE | `/roles/:id` | Remove regra |

**Body (POST/PUT)**: `{ "name": "Vendedor", "description": null }`

---

## Endpoints internos (service token)

Requer **serviceAuth** (JWT de serviço).

### Usage Metrics

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/internal/usage/metrics` | Registra métricas de uso |

Body:
```json
{
  "metrics": [
    {
      "tenant_id": "uuid",
      "metric_key": "api.requests",
      "metric_value": 1,
      "period": "2026-02-03",
      "source": "gateway"
    }
  ]
}
```

### Tenant Migration

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/internal/tenants/migration/pointer` | Atualiza ponteiro de migração do tenant |

Body:
```json
{
  "tenant_id": "uuid",
  "db_strategy": "shared",
  "control_plane_db": null,
  "erp_db": "ERP_MAIN",
  "telemetry_db": "TEL_MAIN",
  "migration_status": "idle"
}
```

### Storage (claim-check)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/internal/storage/payloads` | Grava payload no bucket (MinIO) |
| GET | `/internal/storage/payloads/:key` | Download de payload por key (inspeção) |

Regras:

- Bucket fixo (usa `MINIO_BUCKET`).
- Rate-limit opcional (`STORAGE_DOWNLOAD_RATE_LIMIT_PER_MINUTE`).
- Key deve estar no escopo do tenant (`telemetry/<tenant>/...`).

---

## Postman

Collection completa e atualizada: **`docs/postman/ESM-API.postman_collection.json`**.

- **Variáveis:** `base_url` (ex.: `http://localhost:3000`), `tenant_slug` (ex.: `default-tenant`), `access_token`, `refresh_token`, `correlation_id`.
- **Auth:** A collection usa Bearer token nas variáveis; Login e Refresh preenchem `access_token` e `refresh_token` automaticamente (scripts de teste).
- **Pastas:** Health, Auth, Context, Menu, Branding, Telemetry, Webhooks, Tenant (CRUD: organizations, workspaces, users, partners, roles), Admin (tenants, plans, platform-products, permissions), Internal (service token).

Importe o arquivo no Postman: File → Import → Upload Files.

---

## Exemplos (curl)

**Login (fallback default tenant):**
```bash
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","password":"senhaSegura123"}'
```

**Login por slug:**
```bash
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: default-tenant" \
  -d '{"email":"admin@empresa.com","password":"senhaSegura123"}'
```

**Menu:**
```bash
curl -X GET "http://localhost:3000/api/v1/menu" \
  -H "Authorization: Bearer <access_token>"
```

**Telemetry bulk:**
```bash
curl -X POST "http://localhost:3000/api/v1/telemetry/bulk" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"device_id":"abc"}, "items":[{"temp":23.1}]}'
```

**Health detalhado:**
```bash
curl -X GET "http://localhost:3000/api/v1/health/detailed"
```
