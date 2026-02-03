import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

from ensure_database import ensure_database


def _load_env() -> None:
    root_dir = Path(__file__).resolve().parents[2]
    env_file = root_dir / ".env"
    if env_file.exists():
        load_dotenv(env_file)


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


def _build_connection_string() -> str:
    url = _get_env("CONTROL_PLANE_DATABASE_URL") or _get_env("DATABASE_URL")
    if url:
        return url

    host = _get_env("POSTGRES_HOST", "localhost")
    port = _get_env("POSTGRES_PORT", "5432")
    user = _get_env("POSTGRES_USER", "postgres")
    password = _get_env("POSTGRES_PASSWORD", "")
    db_name = _get_env("POSTGRES_DB", "control_plane")
    return f"postgresql://{user}:{password}@{host}:{port}/{db_name}"


def _usage() -> None:
    print("Uso: python run_migrations.py upgrade <modulo>")
    print("Exemplo: python run_migrations.py upgrade res")


def main() -> int:
    if len(sys.argv) < 3 or sys.argv[1] != "upgrade":
        _usage()
        return 1

    module_name = sys.argv[2]
    base_dir = Path(__file__).resolve().parent
    module_dir = base_dir / module_name

    if not module_dir.exists() or not module_dir.is_dir():
        print(f"Modulo de migrations nao encontrado: {module_dir}")
        return 1

    _load_env()
    ensure_database()

    conn_str = _build_connection_string()
    sql_files = sorted(module_dir.glob("*.sql"))

    if not sql_files:
        print("Nenhuma migration encontrada.")
        return 0

    with psycopg2.connect(conn_str) as conn:
        conn.autocommit = True
        for sql_file in sql_files:
            print(f"Aplicando {sql_file.name}")
            with sql_file.open("r", encoding="utf-8") as handle:
                conn.cursor().execute(handle.read())

    print("Migrations aplicadas com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
