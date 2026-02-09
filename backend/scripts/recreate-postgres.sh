#!/bin/bash
# Recria o container e volume do PostgreSQL, depois executa as migrations.
# Execute na pasta backend ou a partir da raiz do projeto.
# Uso: ./scripts/recreate-postgres.sh   ou   bash scripts/recreate-postgres.sh

set -e
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"

echo "=== Parando e removendo container postgres ==="
docker compose stop postgres 2>/dev/null || true
docker compose rm -f postgres 2>/dev/null || true

echo "=== Removendo volume pg_data ==="
VOLUME_NAME=$(docker volume ls -q --filter "name=pg_data" | head -1)
if [ -n "$VOLUME_NAME" ]; then
  docker volume rm "$VOLUME_NAME"
  echo "Volume removido: $VOLUME_NAME"
else
  echo "Nenhum volume pg_data encontrado (ok para primeira execucao)"
fi

echo "=== Iniciando PostgreSQL ==="
docker compose up -d postgres

echo "=== Aguardando PostgreSQL ficar pronto (15s) ==="
sleep 15

echo "=== Executando migrations ==="
docker compose --profile migrations run --rm migrations-runner

echo ""
echo "=== Concluido. PostgreSQL recriado e migrations aplicadas. ==="
