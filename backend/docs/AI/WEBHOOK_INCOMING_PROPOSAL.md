# Proposta: Recebimento de webhooks externos com persistência em banco

## Contexto

Um serviço externo envia eventos para uma URL configurável e pode enviar um header de **Authorization** (quando existir). Objetivo: receber esses webhooks de forma segura, **persistir no banco** o que foi recebido e responder rapidamente ao provedor.

## Análise

- **Backend**: NestJS + Fastify; autenticação global via JWT (`AppAuthGuard`); rotas públicas com `@Public()`.
- **Serviço externo**: envia para uma URL; opcionalmente envia `Authorization`. Não usa JWT de usuário.
- **Persistência**: tudo que for recebido (payload + metadados) é salvo na tabela `webhook_incoming_events` no banco **control-plane**, permitindo auditoria, replay e processamento assíncrono posterior.

## Desenho adotado

### 1. Rota

- **Método e path**: `POST /api/v1/webhooks/incoming`
- **Pública**: `@Public()` para não exigir JWT; segurança via validação do secret do webhook.

### 2. Autenticação do webhook

- **Variável**: `WEBHOOK_INCOMING_SECRET`
  - **Se definida**: a rota exige header `Authorization: Bearer <secret>` (ou valor igual ao secret). Caso contrário → `401`.
  - **Se vazia/ausente**: a rota aceita qualquer request (útil em dev); em produção recomenda-se configurar o secret.

### 3. Persistência no banco

- **Tabela**: `webhook_incoming_events` (migration `2026020307__webhook_incoming_events.sql`).
- **Campos principais**:
  - `id`, `uuid`: identificação
  - `source`: origem (default `external`; pode vir do header `X-Webhook-Source`)
  - `idempotency_key`: chave opcional para deduplicação (header `X-Idempotency-Key` ou `body.id`)
  - `headers_json`: cópia dos headers (sem `authorization` e `cookie`)
  - `payload_json`: body da requisição (JSON)
  - `received_at`, `created_at`: timestamps
  - `processing_status`: `pending`; depois pode ser atualizado por job (ex.: `processed`, `failed`)
  - `processed_at`, `processing_error`: para uso em processamento assíncrono

- **Idempotência**: se o provedor reenviar com o mesmo `idempotency_key` (por source), não insere duplicata; retorna o registro já existente e `duplicate: true` na resposta.

### 4. Resposta HTTP

- **Sempre** `200 OK` rápido, com body por exemplo: `{ "received": true, "id": 1, "uuid": "...", "duplicate": true }` (opcional).
- O processamento pesado (regras de negócio, notificações, etc.) fica para um job que lê da tabela (por exemplo `processing_status = 'pending'`).

### 5. Headers opcionais do provedor

- `Authorization: Bearer <WEBHOOK_INCOMING_SECRET>` — validado quando o secret está configurado.
- `X-Webhook-Source`: identificador da origem (gravado em `source`).
- `X-Idempotency-Key`: chave para deduplicação (ou usar um campo do body, ex.: `id`).

## Arquivos criados/alterados

| Item | Descrição |
|------|-----------|
| `migrations/control-plane/2026020307__webhook_incoming_events.sql` | Criação da tabela e índices |
| `modules/webhooks-incoming/webhook-incoming.guard.ts` | Guard que valida `WEBHOOK_INCOMING_SECRET` |
| `modules/webhooks-incoming/webhook-incoming.service.ts` | Serviço que persiste em `webhook_incoming_events` |
| `modules/webhooks-incoming/webhook-incoming.controller.ts` | Controller `POST /api/v1/webhooks/incoming` |
| `modules/webhooks-incoming/webhook-incoming.module.ts` | Módulo NestJS |
| `app.module.ts` | Import de `WebhookIncomingModule` |
| `.env.example` | Variável `WEBHOOK_INCOMING_SECRET` |

## Configuração

No `.env` (ou ambiente):

```env
# Obrigatório em produção se quiser exigir auth no webhook.
WEBHOOK_INCOMING_SECRET=seu-token-secreto-aqui
```

No serviço externo:

- **URL**: `https://seu-dominio/api/v1/webhooks/incoming`
- **Authorization** (se o provedor suportar): `Bearer seu-token-secreto-aqui`
- **Body**: JSON livre; será salvo em `payload_json`.

## Próximos passos (opcional)

- **Job de processamento**: worker/cron que consulta `webhook_incoming_events` com `processing_status = 'pending'`, processa e atualiza `processed_at`, `processing_status` e eventualmente `processing_error`.
- **Retenção**: política de limpeza ou arquivamento de registros antigos (ex.: por `received_at`).
