import json
import os
import time
from datetime import datetime
from typing import Any, Dict, Optional

import logging
import requests
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from kafka import KafkaConsumer
from pythonjsonlogger import jsonlogger
from minio import Minio
import gzip


def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("telemetry-worker")
    level = os.getenv("LOG_LEVEL", "info").upper()
    if (os.getenv("DEBUG", "false") or "false").lower() == "true" and level == "INFO":
        level = "DEBUG"
    logger.setLevel(level)
    handler = logging.StreamHandler()
    log_format = os.getenv("LOG_FORMAT", "json").lower()
    if log_format == "text":
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    else:
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s %(correlation_id)s"
        )
    handler.setFormatter(formatter)
    logger.handlers = [handler]
    return logger


def _get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


_pool: Optional[SimpleConnectionPool] = None
_last_cleanup_at: float = 0.0
_minio_client: Optional[Minio] = None


def _get_db_pool() -> Optional[SimpleConnectionPool]:
    global _pool
    if _pool is not None:
        return _pool

    pool_size = int(_get_env("DATABASE_POOL_SIZE", "5") or 5)
    max_overflow = int(_get_env("DATABASE_MAX_OVERFLOW", "5") or 5)
    max_conn = max(pool_size, pool_size + max_overflow)

    database_url = _get_env("DATABASE_URL")
    if not database_url:
        host = _get_env("POSTGRES_HOST", "localhost")
        port = _get_env("POSTGRES_PORT", "5432")
        user = _get_env("POSTGRES_USER", "postgres")
        password = _get_env("POSTGRES_PASSWORD", "")
        db = _get_env("POSTGRES_DB", "control_plane")
        database_url = f"postgresql://{user}:{password}@{host}:{port}/{db}"

    try:
        _pool = SimpleConnectionPool(1, max_conn, dsn=database_url)
    except Exception:
        _pool = None
    return _pool


def _build_consumer() -> KafkaConsumer:
    brokers = _get_env("KAFKA_BROKERS", "kafka:9092")
    client_id = _get_env("KAFKA_CLIENT_ID", "telemetry-worker")
    group_id = _get_env("KAFKA_GROUP_ID", "telemetry-workers")
    auto_commit = (_get_env("KAFKA_AUTO_COMMIT", "true") or "true").lower() == "true"
    batch_size = int(_get_env("KAFKA_BATCH_SIZE", "100") or 100)
    ssl_enabled = _get_env("KAFKA_SSL", "false") == "true"
    sasl_mechanism = _get_env("KAFKA_SASL_MECHANISM")
    sasl_username = _get_env("KAFKA_SASL_USERNAME")
    sasl_password = _get_env("KAFKA_SASL_PASSWORD")

    security_protocol = "PLAINTEXT"
    if ssl_enabled and sasl_mechanism:
        security_protocol = "SASL_SSL"
    elif sasl_mechanism:
        security_protocol = "SASL_PLAINTEXT"
    elif ssl_enabled:
        security_protocol = "SSL"

    return KafkaConsumer(
        _get_env("KAFKA_TOPIC", "telemetry.events"),
        bootstrap_servers=brokers.split(","),
        client_id=client_id,
        group_id=group_id,
        enable_auto_commit=auto_commit,
        auto_offset_reset="earliest",
        max_poll_records=batch_size,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        security_protocol=security_protocol,
        sasl_mechanism=sasl_mechanism,
        sasl_plain_username=sasl_username,
        sasl_plain_password=sasl_password
    )


def start_consumer() -> None:
    logger = _setup_logger()
    enabled = _get_env("KAFKA_ENABLED", "true") == "true"
    if not enabled:
        logger.info("Kafka disabled. Worker idle.")
        while True:
            time.sleep(5)

    consumer = _build_consumer()
    logger.info("Telemetry consumer started.")

    for message in consumer:
        payload = _normalize_message(message.value)
        correlation_id = _extract_correlation_id(message)
        logger.info(
            "Telemetry event received.",
            extra={"correlation_id": correlation_id, "data": payload}
        )
        _process_with_retries(payload, logger)


def _extract_correlation_id(message: Any) -> Optional[str]:
    headers = getattr(message, "headers", None)
    if not headers:
        return None
    for key, value in headers:
        if key == "x-correlation-id":
            try:
                return value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else str(value)
            except Exception:
                return None
    return None


def _normalize_message(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {"payload": value}


def _process_with_retries(payload: Dict[str, Any], logger: logging.Logger) -> None:
    max_retries = int(_get_env("MAX_RETRIES", "3") or 3)
    retry_delay = int(_get_env("RETRY_DELAY", "5") or 5)
    batch_size = int(_get_env("BULK_INSERT_BATCH_SIZE", "1000") or 1000)

    attempt = 0
    while True:
        try:
            _process_payload(payload, batch_size, logger)
            return
        except Exception as exc:
            attempt += 1
            if attempt > max_retries:
                logger.warning("Falha ao processar evento.", extra={"error": str(exc)})
                return
            time.sleep(retry_delay)


def _process_payload(payload: Dict[str, Any], batch_size: int, logger: logging.Logger) -> None:
    claim = _extract_claim_check(payload)
    if claim:
        payload = _load_claim_check_payload(claim, logger)

    items = payload.get("items")
    if isinstance(items, list):
        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]
            logger.info("Processando batch", extra={"count": len(batch)})
        _emit_usage_metrics(payload, len(items))
        _handle_files(payload, logger, claim)
        _cleanup_storage(logger)
        return
    logger.info("Processando evento unitario.")
    _emit_usage_metrics(payload, 1)
    _handle_files(payload, logger, claim)
    _cleanup_storage(logger)


def _emit_usage_metrics(payload: Dict[str, Any], event_count: int) -> None:
    if (_get_env("BILLING_USAGE_ENABLED", "false") or "false").lower() != "true":
        return
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        return

    period = datetime.utcnow().strftime("%Y-%m")
    bytes_count = len(json.dumps(payload).encode("utf-8"))
    metrics = [
        {
            "tenant_id": tenant_id,
            "metric_key": "telemetry.events_ingested",
            "metric_value": event_count,
            "period": period,
            "source": "worker"
        },
        {
            "tenant_id": tenant_id,
            "metric_key": "telemetry.payload_bytes",
            "metric_value": bytes_count,
            "period": period,
            "source": "worker"
        }
    ]

    base_url = _get_env("INTERNAL_API_BASE_URL")
    token = _get_env("SERVICE_TOKEN")
    if base_url and token:
        requests.post(
            f"{base_url}/internal/usage/metrics",
            json={"metrics": metrics},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        return

    pool = _get_db_pool()
    if not pool:
        return
    conn = pool.getconn()
    try:
        with conn.cursor() as cursor:
            for metric in metrics:
                cursor.execute(
                    """
                    INSERT INTO tenant_usage_metrics
                    (id, tenant_id, metric_key, metric_value, period, source, created_at)
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, now())
                    """,
                    [
                        metric["tenant_id"],
                        metric["metric_key"],
                        metric["metric_value"],
                        metric["period"],
                        metric["source"]
                    ]
                )
        conn.commit()
    finally:
        pool.putconn(conn)


def _handle_files(payload: Dict[str, Any], logger: logging.Logger, claim: Optional[Dict[str, Any]]) -> None:
    if (_get_env("DELETE_FILE_AFTER_PROCESSING", "false") or "false").lower() != "true":
        return
    if claim:
        _delete_claim_check_object(claim, logger)
        return
    file_path = payload.get("file_path")
    file_paths = payload.get("file_paths")
    paths = []
    if isinstance(file_path, str):
        paths.append(file_path)
    if isinstance(file_paths, list):
        paths.extend([path for path in file_paths if isinstance(path, str)])
    for path in paths:
        try:
            os.remove(path)
        except FileNotFoundError:
            continue
        except Exception as exc:
            logger.warning("Falha ao remover arquivo.", extra={"error": str(exc), "path": path})


def _cleanup_storage(logger: logging.Logger) -> None:
    global _last_cleanup_at
    retention_days = int(_get_env("FILE_RETENTION_DAYS", "0") or 0)
    if retention_days <= 0:
        return
    now = time.time()
    if now - _last_cleanup_at < 3600:
        return
    _last_cleanup_at = now

    base_path = _get_env("STORAGE_LOCAL_PATH")
    if not base_path:
        return

    cutoff = now - retention_days * 86400
    for root, _, files in os.walk(base_path):
        for filename in files:
            file_path = os.path.join(root, filename)
            try:
                if os.path.getmtime(file_path) < cutoff:
                    os.remove(file_path)
            except Exception as exc:
                logger.warning("Falha ao limpar arquivo antigo.", extra={"error": str(exc), "path": file_path})


def _extract_claim_check(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if "claim_check" in payload:
        return payload
    if "payload" in payload and isinstance(payload["payload"], dict) and "claim_check" in payload["payload"]:
        return payload["payload"]
    return None


def _load_claim_check_payload(claim: Dict[str, Any], logger: logging.Logger) -> Dict[str, Any]:
    storage_type = (claim.get("storage_type") or _get_env("STORAGE_TYPE", "minio")).lower()
    if storage_type == "local":
        key = claim.get("claim_check")
        if not key:
            return {}
        return _read_gzip_json(os.path.join(_get_env("STORAGE_LOCAL_PATH", ""), key), logger)

    client = _get_minio_client()
    bucket = claim.get("bucket") or _get_env("MINIO_BUCKET", "telemetry-raw")
    key = claim.get("claim_check")
    if not client or not key:
        return {}
    response = client.get_object(bucket, key)
    data = response.read()
    response.close()
    response.release_conn()
    return _gunzip_json_bytes(data, logger)


def _get_minio_client() -> Optional[Minio]:
    global _minio_client
    if _minio_client:
        return _minio_client
    endpoint = (_get_env("MINIO_ENDPOINT") or "").replace("http://", "").replace("https://", "")
    access_key = _get_env("MINIO_ACCESS_KEY")
    secret_key = _get_env("MINIO_SECRET_KEY")
    use_ssl = (_get_env("MINIO_USE_SSL", "false") or "false").lower() == "true"
    if not endpoint or not access_key or not secret_key:
        return None
    _minio_client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=use_ssl)
    return _minio_client


def _gunzip_json_bytes(data: bytes, logger: logging.Logger) -> Dict[str, Any]:
    try:
        raw = gzip.decompress(data)
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        logger.warning("Falha ao descompactar payload.", extra={"error": str(exc)})
        return {}


def _read_gzip_json(path: str, logger: logging.Logger) -> Dict[str, Any]:
    try:
        with gzip.open(path, "rb") as handle:
            raw = handle.read()
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        logger.warning("Falha ao ler payload local.", extra={"error": str(exc), "path": path})
        return {}


def _delete_claim_check_object(claim: Dict[str, Any], logger: logging.Logger) -> None:
    storage_type = (claim.get("storage_type") or _get_env("STORAGE_TYPE", "minio")).lower()
    key = claim.get("claim_check")
    if storage_type == "local":
        if key:
            try:
                os.remove(os.path.join(_get_env("STORAGE_LOCAL_PATH", ""), key))
            except Exception as exc:
                logger.warning("Falha ao remover claim-check local.", extra={"error": str(exc)})
        return

    client = _get_minio_client()
    bucket = claim.get("bucket") or _get_env("MINIO_BUCKET", "telemetry-raw")
    if client and key:
        try:
            client.remove_object(bucket, key)
        except Exception as exc:
            logger.warning("Falha ao remover objeto MinIO.", extra={"error": str(exc)})
