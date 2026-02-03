import os
import psycopg2


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


def ensure_database() -> None:
    host = _get_env("POSTGRES_HOST", "localhost")
    port = int(_get_env("POSTGRES_PORT", "5432") or 5432)
    user = _get_env("POSTGRES_USER", "postgres")
    password = _get_env("POSTGRES_PASSWORD", "")
    db_name = _get_env("POSTGRES_DB", "control_plane")
    maintenance_db = _get_env("POSTGRES_MAINTENANCE_DB", "postgres")

    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=maintenance_db,
    )
    conn.autocommit = True

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            exists = cursor.fetchone() is not None
            if not exists:
                cursor.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        conn.close()
