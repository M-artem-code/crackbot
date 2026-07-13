"""Загрузка конфигурации агента.

Агент читает agent-config.json (скачивается из дашборда crackbot на странице
"Агенты"). Файл содержит адрес сервера, API-ключ агента и интервал опроса.

Значения можно переопределить переменными окружения:
  CRACKBOT_SERVER_URL, CRACKBOT_API_KEY, CRACKBOT_POLL_INTERVAL, CRACKBOT_PROXY
"""

from __future__ import annotations

import json
import os
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).parent
DEFAULT_CONFIG_FILE = BASE_DIR / "agent-config.json"


@dataclass
class AgentConfig:
    server_url: str
    api_key: str
    poll_interval_sec: float = 5.0
    # Необязательный дефолтный прокси, если бот не задаёт свой.
    proxy: Optional[str] = None
    # Запуск браузера без окна (по умолчанию headless).
    headless: bool = True

    @property
    def os_label(self) -> str:
        """Человекочитаемая метка ОС для heartbeat (показывается в дашборде)."""
        try:
            return f"{platform.system()} {platform.release()}".strip() or platform.platform()
        except Exception:
            return "unknown"


def _env(name: str) -> Optional[str]:
    value = os.environ.get(name)
    return value.strip() if isinstance(value, str) and value.strip() else None


def load_config(path: str | Path | None = None) -> AgentConfig:
    """Читает agent-config.json и накладывает переопределения из окружения."""
    config_path = Path(path) if path else DEFAULT_CONFIG_FILE

    raw: dict = {}
    if config_path.exists():
        try:
            raw = json.loads(config_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            raise SystemExit(f"Не удалось прочитать {config_path}: {exc}")

    server_url = _env("CRACKBOT_SERVER_URL") or (raw.get("server_url") or "").strip()
    api_key = _env("CRACKBOT_API_KEY") or (raw.get("api_key") or "").strip()

    if not server_url:
        raise SystemExit(
            "Не задан server_url. Скачайте agent-config.json из дашборда "
            "или задайте CRACKBOT_SERVER_URL."
        )
    if not api_key:
        raise SystemExit(
            "Не задан api_key. Скачайте agent-config.json из дашборда "
            "или задайте CRACKBOT_API_KEY."
        )

    poll_raw = _env("CRACKBOT_POLL_INTERVAL") or raw.get("poll_interval_sec")
    try:
        poll_interval = float(poll_raw) if poll_raw is not None else 5.0
    except (TypeError, ValueError):
        poll_interval = 5.0

    headless_env = _env("CRACKBOT_HEADLESS")
    if headless_env is not None:
        headless = headless_env.lower() not in ("0", "false", "no")
    else:
        headless = bool(raw.get("headless", True))

    return AgentConfig(
        server_url=server_url.rstrip("/"),
        api_key=api_key,
        poll_interval_sec=max(1.0, poll_interval),
        proxy=_env("CRACKBOT_PROXY") or (raw.get("proxy") or None),
        headless=headless,
    )
