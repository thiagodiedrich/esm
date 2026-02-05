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
    print("Uso: python run_migrations.py upgrade")
    print("  Lê o arquivo backend/migrations/migrations e aplica cada SQL na ordem.")


def _collect_migrations_from_file(root_dir: Path) -> list[Path]:
    """Lê backend/migrations/migrations e retorna lista de paths (relativos ao root_dir) na ordem."""
    migrations_file = root_dir / "migrations" / "migrations"
    if not migrations_file.exists():
        return []

    paths: list[Path] = []
    with migrations_file.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            paths.append(root_dir / line)
    return paths


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] != "upgrade":
        _usage()
        return 1

    root_dir = Path(__file__).resolve().parents[2]
    sql_files = _collect_migrations_from_file(root_dir)

    if not sql_files:
        print("Nenhuma migration listada em migrations/migrations.")
        return 0

    for p in sql_files:
        if not p.exists():
            print(f"Migration nao encontrada: {p}", file=sys.stderr)
            return 1

    _load_env()
    ensure_database()

    conn_str = _build_connection_string()

    with psycopg2.connect(conn_str) as conn:
        conn.autocommit = True
        for sql_file in sql_files:
            print(f"Aplicando {sql_file.relative_to(root_dir)}")
            with sql_file.open("r", encoding="utf-8") as handle:
                conn.cursor().execute(handle.read())

    print("Migrations aplicadas com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
