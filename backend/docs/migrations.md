# Migrations (SQL)

## Regra ao criar migration
**Sempre que criar uma migration:**
1. Salvar o arquivo `.sql` na pasta correta do módulo (ex.: `migrations/control-plane/`, `migrations/erp/`, `workers-python/migrations/telemetry/`).
2. **Incluir o caminho no arquivo `migrations/migrations`** na ordem em que a migration deve ser executada (uma linha por migration, caminho relativo ao diretório backend).  
Se não for adicionada aqui, o runner não a executará.

## Estrutura
- `backend/workers-python/migrations/` contém o runner e os scripts auxiliares.
- O runner lê a lista em `backend/migrations/migrations` (caminhos relativos ao backend) e aplica cada SQL na ordem, independente da pasta (control-plane, erp, telemetry, etc.).

## Como executar via Docker (recomendado)
Usa o service temporario `migrations-runner` no `docker-compose.yml`.

```bash
# executa e encerra ao final
docker compose --profile migrations run --rm migrations-runner
```

## Como executar via Python (manual)
```bash
pip install -r workers-python/migrations/requirements.txt
python workers-python/migrations/run_migrations.py upgrade
```

## Observacoes
- As migrations sao SQL puro e nunca auto-run em runtime.
- O runner le o `.env` da raiz para obter conexoes e credenciais.
