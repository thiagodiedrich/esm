import os
from urllib.parse import urlparse, unquote

import psycopg2


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


def _parse_database_url(url: str) -> dict[str, str | int | None]:
    parsed = urlparse(url)
    return {
        "host": parsed.hostname,
        "port": parsed.port,
        "user": unquote(parsed.username) if parsed.username else None,
        "password": unquote(parsed.password) if parsed.password else None,
        "db_name": parsed.path.lstrip("/") if parsed.path else None,
    }


def ensure_database() -> None:
    url = _get_env("CONTROL_PLANE_DATABASE_URL") or _get_env("DATABASE_URL")
    parsed = _parse_database_url(url) if url else {}

    host = parsed.get("host") or _get_env("POSTGRES_HOST", "localhost")
    port = int(parsed.get("port") or _get_env("POSTGRES_PORT", "5432") or 5432)
    user = parsed.get("user") or _get_env("POSTGRES_USER", "postgres")
    password = parsed.get("password") or _get_env("POSTGRES_PASSWORD", "")
    db_name = parsed.get("db_name") or _get_env("POSTGRES_DB", "control_plane")
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
