import json
import logging
import os
from typing import Any, Dict, Optional

import requests

from config import webhooks_enabled


def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("webhook-worker")
    level = os.getenv("LOG_LEVEL", "info").upper()
    logger.setLevel(level)
    handler = logging.StreamHandler()
    logger.handlers = [handler]
    return logger


def send_webhook(url: str, payload: Dict[str, Any], timeout_seconds: int = 5) -> None:
    logger = _setup_logger()

    if not webhooks_enabled():
        logger.info("WEBHOOKS_ENABLED=false; envio ignorado.")
        return

    try:
        response = requests.post(url, json=payload, timeout=timeout_seconds)
        logger.info(
            "Webhook enviado.",
            extra={"status_code": response.status_code, "url": url}
        )
    except Exception as exc:
        logger.warning("Falha ao enviar webhook.", extra={"error": str(exc), "url": url})


def process_alerts(alerts: Optional[list[Dict[str, Any]]] = None) -> None:
    if not alerts:
        return
    for alert in alerts:
        url = alert.get("webhook_url")
        if not url:
            continue
        send_webhook(url, alert)
