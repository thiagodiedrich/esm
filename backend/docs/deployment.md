# Deployment

## Status
Em definicao. Apenas fluxo local foi validado.

## Desenvolvimento local
1. Instalar dependencias:
   - `npm install`
2. Gerar chaves RS256:
   - `New-Item -ItemType Directory -Force -Path apps\api\keys`
   - `openssl genrsa -out apps\api\keys\jwt_private.pem 2048`
   - `openssl rsa -in apps\api\keys\jwt_private.pem -pubout -out apps\api\keys\jwt_public.pem`
3. Configurar `.env`:
   - `JWT_PRIVATE_KEY_PATH=./keys/jwt_private.pem`
   - `JWT_PUBLIC_KEY_PATH=./keys/jwt_public.pem`
   - `JWT_ALGORITHM=RS256`
   - `CONTROL_PLANE_DATABASE_URL=postgres://user:pass@localhost:5432/control_plane`
   - `DB_CATALOG__ERP_MAIN=postgres://user:pass@localhost:5432/erp_main`
   - `KAFKA_ENABLED=false`
   - `KAFKA_CLIENT_ID=esm-api`
   - `KAFKA_BROKERS=localhost:9092`
4. Subir API:
   - `npm run dev:api`

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

## Producao
Pendente de definicao nas fases posteriores (infra e observabilidade).
