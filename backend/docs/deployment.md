# Deployment

## Status
Em definicao. Apenas fluxo local foi validado.

## Desenvolvimento local
1. Instalar Docker:
   - Windows: Docker Desktop (com WSL2 habilitado)
   - Linux: Docker Engine + Docker Compose plugin
2. Configurar `.env` do projeto:
   - `cp .env.example .env`
   - Para Docker: use `POSTGRES_HOST=postgres`, `KAFKA_BROKERS=kafka:9092`,
     `MINIO_ENDPOINT=http://minio:9000`, `REDIS_URL=redis://redis:6379`
3. Subir infraestrutura local (Postgres, Redis, Kafka KRaft, MinIO):
   - `docker compose -f docker-compose.yml up -d --build`
4. Rodar migrations (via container Python):
   - `docker compose --profile migrations run --rm migrations-runner`
5. Gerar chaves RS256 (opcional se usar HS256 em dev):
   - `New-Item -ItemType Directory -Force -Path apps\api\keys`
   - `openssl genrsa -out apps\api\keys\jwt_private.pem 2048`
   - `openssl rsa -in apps\api\keys\jwt_private.pem -pubout -out apps\api\keys\jwt_public.pem`
6. Subir API:
   - `docker compose up -d --build`

## Troubleshooting
- `openssl` nao encontrado:
  - Instale OpenSSL (ex.: via Chocolatey: `choco install openssl`) e reinicie o terminal.
- Erro ao ler chaves:
  - Verifique se os arquivos existem em `apps/api/keys`.
  - Confirme os paths no `.env`.
- Erro de conexao ao banco:
  - Verifique `CONTROL_PLANE_DATABASE_URL`.
  - Confirme se o Postgres esta acessivel.
- Erro ao resolver catalogo:
  - Verifique as variaveis `DB_CATALOG__*`.

## Migrations (manual)
- SQL puro, sem auto-run.
- Diretorios:
  - `backend/migrations/control-plane`
  - `backend/migrations/erp`
  - `backend/migrations/telemetry`

## Producao
Pendente de definicao nas fases posteriores (infra e observabilidade).
