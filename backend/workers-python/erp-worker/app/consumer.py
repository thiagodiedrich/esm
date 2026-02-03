import json
import os
import time
from typing import Any, Dict, Optional

from kafka import KafkaConsumer
from pythonjsonlogger import jsonlogger
import logging


def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("erp-worker")
    level = os.getenv("LOG_LEVEL", "info").upper()
    logger.setLevel(level)
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s %(correlation_id)s"
    )
    handler.setFormatter(formatter)
    logger.handlers = [handler]
    return logger


def _get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


def _build_consumer() -> KafkaConsumer:
    brokers = _get_env("KAFKA_BROKERS", "kafka:9092")
    client_id = _get_env("KAFKA_CLIENT_ID", "erp-worker")
    group_id = _get_env("KAFKA_GROUP_ID", "erp-workers")
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
        _get_env("KAFKA_TOPIC", "erp.events"),
        bootstrap_servers=brokers.split(","),
        client_id=client_id,
        group_id=group_id,
        enable_auto_commit=True,
        auto_offset_reset="earliest",
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
    logger.info("ERP consumer started.")

    for message in consumer:
        payload = _normalize_message(message.value)
        correlation_id = _extract_correlation_id(message)
        logger.info(
            "ERP event received.",
            extra={"correlation_id": correlation_id, "data": payload}
        )
        # TODO: process payload and emit usage metrics


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
