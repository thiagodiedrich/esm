# Migrations (SQL)

## Estrutura
- `backend/workers-python/migrations/` contém o runner e os scripts auxiliares.
- `backend/workers-python/migrations/res/` guarda migrations do core (gateway/api).
- `backend/workers-python/migrations/telemetry/` e `erp/` ficam prontos para os modulos.

## Como executar via Docker (recomendado)
Usa o service temporario `migrations-runner` no `docker-compose.yml`.

```bash
# executa e encerra ao final
docker compose --profile migrations run --rm migrations-runner
```

## Como executar via Python (manual)
```bash
pip install -r workers-python/migrations/requirements.txt
python workers-python/migrations/run_migrations.py upgrade res
```

## Observacoes
- As migrations sao SQL puro e nunca auto-run em runtime.
- O runner le o `.env` da raiz para obter conexoes e credenciais.
