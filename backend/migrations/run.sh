#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_FILE="$ROOT_DIR/migrations/migrations"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ ! -f "$MIGRATIONS_FILE" ]; then
  echo "Arquivo de migrations nao encontrado: $MIGRATIONS_FILE" >&2
  exit 1
fi

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "POSTGRES_USER e POSTGRES_DB devem estar definidos no ambiente ou .env." >&2
  exit 1
fi

while IFS= read -r migration; do
  [ -z "$migration" ] && continue
  case "$migration" in
    \#*) continue ;;
  esac

  file_path="$ROOT_DIR/$migration"
  if [ ! -f "$file_path" ]; then
    echo "Migration nao encontrada: $file_path" >&2
    exit 1
  fi

  echo "Aplicando $migration"
  docker exec -i esm-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$file_path"
done < "$MIGRATIONS_FILE"

echo "Migrations aplicadas com sucesso."
