"""Stores the agent key in Windows Credential Manager via keyring."""

from __future__ import annotations

import keyring

SERVICE = "BotForge Runner"
ACCOUNT = "agent-api-key"


def save_agent_key(api_key: str) -> None:
    if not api_key.startswith("agt_") or len(api_key) < 40:
        raise ValueError("Сервер вернул некорректный ключ агента")
    keyring.set_password(SERVICE, ACCOUNT, api_key)


def load_agent_key() -> str | None:
    return keyring.get_password(SERVICE, ACCOUNT)


def delete_agent_key() -> None:
    try:
        keyring.delete_password(SERVICE, ACCOUNT)
    except keyring.errors.PasswordDeleteError:
        pass
