import os


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    return value if value is not None and value != "" else default


def webhooks_enabled() -> bool:
    return (_get_env("WEBHOOKS_ENABLED", "false") or "false").lower() == "true"

