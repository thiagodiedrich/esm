# Sugestões de alteração — integração auth, GET /me e logout

Documento apenas com **sugestões**. Nenhuma alteração foi aplicada; você pode escolher o que implementar.

---

## 1. GET /auth/me — enriquecer resposta para o frontend

**Problema:** O frontend espera `UserSession`: `user_id`, `name`, `tenant_slug`, `organizations` (com `workspaces`), `current_context`, `requires_context_selection`. Hoje o backend retorna só `id`, `tenant_id`, `partner_id`, `email`, `is_active`.

**Sugestão (backend):**

### 1.1 AuthService — novo método `getMePayload(tenantId, userId)` (ou estender `getUserById`)

- Buscar em **uma ou duas queries**:
  - `res_users`: `id`, `tenant_id`, `partner_id`, `email`, `is_active`, `organization_id`
  - `tenants`: `slug` (WHERE id = tenant_id)
  - `res_partners`: `name` (WHERE id = partner_id), para montar `name` do usuário
- Buscar **organizações** do tenant às quais o usuário tem acesso:
  - Opção A (simples): todas as organizações do tenant (`res_organizations WHERE tenant_id = $1`) com workspaces (`res_workspaces WHERE organization_id IN (...)`). O frontend usa para o dropdown; o `POST /context/switch` já valida permissão.
  - Opção B (restrito): apenas organizações onde o usuário tem vínculo (ex.: `res_users.organization_id` + organizações obtidas via `res_user_roles` com `scope_type = 'organization'` e `scope_id`), cada uma com seus workspaces.
- Montar **current_context** a partir do JWT (já disponível em `request.user` no controller): `organization_id`, `workspace_id`. Buscar nomes:
  - `organization_name`: um SELECT em `res_organizations` (WHERE id = organization_id) ou JOIN.
  - `workspace_name`: um SELECT em `res_workspaces` (WHERE id = workspace_id) ou JOIN.
  - `workspace_mode`: buscar de `res_organization_settings.workspace_mode` para a organização atual (ou default `'optional'`).

Retorno sugerido (alinhado ao `UserSession` do frontend):

```ts
{
  user_id: string;           // res_users.id
  email: string;
  name: string;              // res_partners.name ou email
  tenant_id: string;
  tenant_slug: string;       // tenants.slug
  partner_id: string | null;
  is_active: boolean | null;
  organizations: Array<{
    id: string;
    name: string;
    is_default: boolean;
    workspaces: Array<{ id: string; name: string; is_active: boolean }>;
  }>;
  current_context: {
    organization_id: string;
    organization_name: string;
    workspace_id: string | null;
    workspace_name: string | null;
    workspace_mode: 'required' | 'optional';
  } | null;
  requires_context_selection: boolean;  // true se current_context for null ou inválido
}
```

### 1.2 AuthController — rota `GET /me`

- Trocar a chamada de `getUserById` para o novo método (ex.: `getMePayload(user.tenant_id, user.sub)`).
- Atualizar **MeResponseDto** no Swagger com os novos campos (ou criar um DTO específico para “session”) para documentação.

### 1.3 JWT (opcional)

- O frontend usa `getSessionFromToken()` quando não chama `/me`. Para o ContextSwitcher e o header funcionarem sem chamar `/me`, o JWT pode incluir `tenant_slug`, `organization_name`, `workspace_name` (e, se quiser, `name` do parceiro). Assim o header e o tenant/workspace aparecem mesmo antes do `/me` responder. **Sugestão:** incluir no payload do access token pelo menos `tenant_slug` (e opcionalmente `name`, `organization_name`, `workspace_name`) no `AuthService.issueTokens` (ou no controller após issue), se a geração do token tiver acesso ao tenant slug e aos nomes.

---

## 2. POST /auth/logout — evitar 500 e comportamento estável

**Problema:** Em alguns cenários o logout retorna 500 (ex.: token expirado/inválido ou Redis indisponível), e o frontend precisa sempre conseguir “sair” (limpar estado e ir para o login).

**Sugestão (backend):**

### 2.1 AuthController — `logout`

- Envolver a lógica em `try/catch`:
  - Se `authService.logout(token, body?.refresh_token)` lançar (ex.: `UnauthorizedException` por token inválido/expirado), **não relançar**; apenas logar (opcional) e responder **204 No Content**.
- Garantir que, com ou sem token no header, a resposta seja sempre **204** (e que o frontend trate 204 como sucesso e faça logout local).

### 2.2 AuthService — `logout`

- Opcional: em vez de lançar em `verifyUserToken(accessToken)` quando o token estiver expirado/inválido, fazer um “decode” sem verificação forte (ou try/catch) e, em caso de falha, retornar `null` e não lançar. Assim o controller não precisa tratar exceção para token ruim; apenas chama logout e retorna 204. **Alternativa:** manter o `verify` e garantir no controller que qualquer exceção seja engolida e se responda 204.

---

## 3. Health check — 404

**Problema:** Frontend já usa `VITE_API_URL=http://localhost:3000/api/v1` e chama `GET {apiBaseUrl}/health` → `GET /api/v1/health`. Se ainda assim der 404, o backend não está expondo a rota nesse path.

**Sugestão (backend):**

- Confirmar que o `AppController` (ou o módulo que registra o health) está com `@Controller("/api/v1/health")` e que não há prefixo global que duplique `/api/v1` (ex.: `setGlobalPrefix('api')` resultando em `/api/api/v1/health`). Se o health estiver em outro path (ex.: `/health` na raiz), documentar e, no frontend, usar uma variável separada (ex.: `VITE_HEALTH_URL`) apontando para esse path, em vez de derivar de `VITE_API_URL`.

---

## 4. Frontend — ajustes opcionais

Nenhuma alteração obrigatória; só se quiser reforçar robustez e UX.

### 4.1 Tratamento da resposta de GET /me

- Se o backend passar a retornar `user_id` em vez de `id`, o frontend já usa `user_id` em `UserSession`. Se o backend mantiver `id`, no frontend pode mapear `me.id` → `user_id` ao montar a sessão (ex.: em `auth/hooks.ts` no `useLogin` onde chama `authApi.getMe()` e monta `session`).

### 4.2 Logout

- O frontend já chama `authApi.logout(refreshToken)` e em `onSettled` limpa auth, menu e redireciona para `/login`. Se o backend passar a retornar sempre 204 mesmo com token inválido, o fluxo atual já fica correto.

### 4.3 Perfil (ProfileDialog)

- Já usa `authApi.getMe()` e `tenantApi.users.update` / `tenantApi.partners.update`. Se GET /me passar a retornar `user_id` e `partner_id`, manter o uso de `(meData as any).user_id ?? meData.id` (ou o campo que o backend definir) para evitar que “Perfil” quebre.

---

## 5. Resumo — o que você pode escolher

| # | Onde | O que fazer |
|---|------|-------------|
| 1 | Backend: AuthService | Implementar `getMePayload(tenantId, userId)` (ou equivalente) retornando `name`, `tenant_slug`, `organizations` (com workspaces), `current_context` (com nomes e `workspace_mode`), `requires_context_selection`. |
| 2 | Backend: AuthController | GET /me passar a usar o novo método e retornar o payload de sessão; atualizar DTO do Swagger. |
| 3 | Backend: JWT (opcional) | Incluir no access token `tenant_slug` (e opcionalmente `name`, `organization_name`, `workspace_name`) para o frontend exibir header/contexto sem depender só de GET /me. |
| 4 | Backend: AuthController logout | Em `logout`, fazer try/catch e sempre responder 204, mesmo com token inválido/expirado. |
| 5 | Backend: AuthService logout | Opcional: não lançar em token inválido; retornar null e deixar o controller sempre retornar 204. |
| 6 | Backend: Health | Verificar path do health (`/api/v1/health`) e ausência de prefixo duplicado; se o health for em outro path, documentar e sugerir `VITE_HEALTH_URL` no frontend. |
| 7 | Frontend | Opcional: mapear `id` → `user_id` na resposta de GET /me se o backend não renomear; manter tratamento de 204 no logout. |

Quando quiser, diga quais itens (1–7) deseja aplicar e em qual ordem (ex.: “aplicar 1, 2 e 4”), e posso gerar os patches ou os trechos de código correspondentes.
