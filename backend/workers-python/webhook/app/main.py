import os
import time

from config import webhooks_enabled
from alert_worker import process_alerts


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


def main() -> None:
    poll_seconds = int(_get_env("ALERT_POLL_SECONDS", "60"))
    alerts_enabled = _get_env("ALERTS_ENABLED", "false").lower() == "true"

    if not alerts_enabled:
        while True:
            time.sleep(poll_seconds)

    while True:
        if webhooks_enabled():
            # Placeholder: nenhum datasource de alertas ainda.
            process_alerts([])
        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
