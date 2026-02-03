# aaPanel + Docker (passo a passo)

## Confirmacao de containers
Cada modulo roda em um container separado:
- Gateway/API: `api`
- PostgreSQL: `postgres`
- Redis: `redis`
- Kafka (KRaft): `kafka`
- MinIO: `minio`
- Workers (telemetry/erp): containers separados via profile `workers`.

## 1) Preparar o servidor
1. Instale Docker e Docker Compose no aaPanel.
2. Garanta que as portas estejam liberadas (80/443 para o gateway e as portas internas se necessario).

## 2) Subir o projeto no servidor
1. Envie o repositorio para o servidor (ex.: `/www/wwwroot/esm/backend`).
2. Entre na pasta `backend`.

## 3) Configurar variaveis de ambiente do Docker
1. Copie o exemplo:
   - `cp .env.example .env`
2. Ajuste os valores conforme o servidor (portas e credenciais).

## 4) Configurar variaveis da API
1. Ajuste no mesmo `.env`:
   - `CONTROL_PLANE_DATABASE_URL`
   - `DB_CATALOG__ERP_MAIN`
   - `JWT_ALGORITHM` (HS256 em dev ou RS256 em prod)
   - `JWT_SECRET` (se HS256)
2. Copie o exemplo dos workers:
   - `cp workers-python/telemetry-worker/.env.example workers-python/telemetry-worker/.env`
   - `cp workers-python/erp-worker/.env.example workers-python/erp-worker/.env`
3. Ajuste `SERVICE_TOKEN` em cada worker.

## 5) Subir os containers
- `docker compose up -d --build`

## 5.1) Subir workers (quando necessario)
- `docker compose --profile workers up -d`

## 6) Configurar o proxy no aaPanel
1. Crie o site no aaPanel para seu dominio.
2. Configure reverse proxy para `http://127.0.0.1:${PORT}`.
3. Habilite wildcard para subdominios (ex.: `*.seudominio.com`) para resolver tenants.

## 7) Validar
- `GET /health` deve retornar `{ "status": "ok" }`.

## Observacoes
- Workers ainda nao estao implementados no codigo; os containers sao placeholders.
- Kafka esta em PLAINTEXT (dev). Em prod sera SASL/SSL.
