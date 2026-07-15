"""One-time runner pairing without persisting the pairing token."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import requests

PAIR_TOKEN = re.compile(r"(pair_[A-Za-z0-9_-]{40,60})")


def token_from_installer_name(path: str) -> str | None:
    match = PAIR_TOKEN.search(Path(path).name)
    return match.group(1) if match else None


def exchange_pairing_token(server_url: str, token: str, runner_version: str) -> dict[str, Any]:
    if not PAIR_TOKEN.fullmatch(token):
        raise ValueError("Некорректный pairing token")
    response = requests.post(
        f"{server_url.rstrip('/')}/api/agent/pair",
        json={"token": token, "runnerVersion": runner_version},
        timeout=20,
        headers={"Accept": "application/json"},
    )
    if response.status_code == 401:
        raise ValueError("Код подключения истёк или уже использован. Создайте новый в BotForge.")
    response.raise_for_status()
    data = response.json()
    if not isinstance(data.get("apiKey"), str) or not isinstance(data.get("agentId"), str):
        raise ValueError("Сервер вернул некорректный ответ привязки")
    return data
