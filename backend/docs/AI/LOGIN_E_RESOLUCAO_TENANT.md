# Login e resolução de tenant

## Onde o tenant é resolvido no login

O login (`POST /api/v1/auth/login`) usa **só** o `AuthTenantService.resolveTenantOrFail(request)`.  
O **TenancyMiddleware** não define o tenant do login; ele só valida que um tenant existe quando `MULTI_TENANT_ENABLED=true` (e a rota não é pública). O controller de auth chama `resolveTenantOrFail` em toda requisição de login.

---

## Ordem de pesquisa do tenant no login

Em **todas** as combinações de config abaixo, a ordem de tentativa é:

1. **tenant_id** — header `x-tenant-id` (ou `TENANT_HEADER`): compara com `tenants.id` (se numérico) ou `tenants.uuid`
2. **tenant_slug** — header `x-tenant-slug`: compara com `tenants.slug`
3. **subdomain** — extraído do `Host`: primeiro segmento antes do primeiro `.` (ex.: `easytest` de `easytest.simc.com.br`), comparado com `tenants.slug`
4. **domain** — host completo (com porta), hostname (sem porta) e subdomain: comparados com o campo `tenants.domain` (lista separada por vírgula, ex.: `localhost,easytest.simc.com.br`)

Código que implementa essa ordem (resumo):

```ts
// auth.tenant.service.ts — resolveMultiTenant() e resolveTenantFromRequest()

// 1) tenant_id (header)
const tenantId = this.getTenantIdFromHeader(request);  // x-tenant-id
if (tenantId) {
  const tenant = await this.findTenantById(tenantId);   // WHERE id = $1 ou WHERE uuid = $1
  if (tenant) return tenant;
}

// 2) tenant_slug (header)
const tenantSlug = this.getTenantSlugFromHeader(request);  // x-tenant-slug
if (tenantSlug) {
  const tenant = await this.findTenantBySlug(tenantSlug);   // WHERE slug = $1
  if (tenant) return tenant;
}

// 3) subdomain do Host
const hostSlug = this.extractTenantSlugFromHost(request);  // ex.: easytest de easytest.simc.com.br
if (hostSlug) {
  const tenant = await this.findTenantBySlug(hostSlug);     // WHERE slug = $1
  if (tenant) return tenant;
}

// 4) domain (campo tenants.domain)
const hostCandidates = this.getHostCandidatesForDomain(request);  // [ "easytestapi.simc.com.br", "easytestapi", ... ]
if (hostCandidates?.length) {
  const tenant = await this.findTenantByDomain(hostCandidates);    // WHERE domain contém um dos candidatos
  if (tenant) return tenant;
}

throw new BadRequestException("Code 1: Tenant não encontrado");  // ou Code 3
```

---

## Quando essa lógica roda e o que muda com as variáveis

A resolução acima **sempre** acontece no login: não existe “desligar” a pesquisa por tenant_id/slug/subdomain/domain. O que muda é **qual ramo** do `resolveTenantOrFail` é usado e se o request é considerado ou não.

### 1) `MULTI_TENANT_ENABLED = true`

- **TenancyMiddleware:** roda e exige que um tenant exista (por header, slug ou domain); rotas em `API_PUBLIC_ROUTES` não passam por essa validação.
- **Login:** chama `resolveTenantOrFail(request)` → entra em **resolveMultiTenant(request)** e usa a ordem: **tenant_id → tenant_slug → subdomain → domain**.

### 2) `MULTI_TENANT_ENABLED = false` e `TENANT_DEFAULT_ENABLED = true`

- **TenancyMiddleware:** não valida tenant (dá `next()` direto).
- **Login:** chama `resolveTenantOrFail(request)` → entra em **resolveDefaultTenant()** e **ignora o request**:
  - Tenta **TENANT_DEFAULT_ID** (id/uuid no banco)
  - Se não achar, tenta **TENANT_DEFAULT_SLUG**
  - Não usa header, host nem domain.

### 3) `MULTI_TENANT_ENABLED = false` e `TENANT_DEFAULT_ENABLED = false`

- **TenancyMiddleware:** não valida tenant.
- **Login:** chama `resolveTenantOrFail(request)` → entra em **resolveTenantFromRequest(request)** e usa a **mesma ordem** do multi-tenant: **tenant_id → tenant_slug → subdomain → domain**.

---

## Resumo

| Variável                     | Efeito no login                                                                 |
|-----------------------------|----------------------------------------------------------------------------------|
| `MULTI_TENANT_ENABLED`      | Não altera a *ordem* de pesquisa; só define se o default é por config ou por request. |
| `TENANT_DEFAULT_ENABLED`    | Se `true` e multi-tenant `false`: login usa só `TENANT_DEFAULT_ID` / `TENANT_DEFAULT_SLUG` (sem request). |
| Request (headers / host)    | Usado quando `resolveMultiTenant` ou `resolveTenantFromRequest` rodam (multi-tenant ou default desligado). |

A chamada de login **sempre** tenta, nessa ordem: **tenant_id → tenant_slug → subdomain → domain**. A única exceção é quando `MULTI_TENANT_ENABLED=false` e `TENANT_DEFAULT_ENABLED=true`, aí o login usa apenas os defaults de config e ignora headers/host.
