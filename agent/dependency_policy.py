"""Strict dependency policy for BotForge Runner beta."""

from __future__ import annotations

import re

MAX_REQUIREMENTS_BYTES = 8_192
ALLOWED_PACKAGES = {
    "requests",
    "rich",
    "nodriver",
    "httpx",
    "pydantic",
    "python-telegram-bot",
    "beautifulsoup4",
    "lxml",
    "python-dateutil",
    "tenacity",
}
PINNED = re.compile(r"^([a-zA-Z0-9][a-zA-Z0-9._-]*)==([a-zA-Z0-9][a-zA-Z0-9._+-]*)$")


def validate_requirements(raw: str) -> list[str]:
    if len(raw.encode("utf-8")) > MAX_REQUIREMENTS_BYTES:
        raise ValueError("requirements.txt превышает 8 KB")
    normalized: list[str] = []
    for number, original in enumerate(raw.splitlines(), 1):
        line = original.strip()
        if not line or line.startswith("#"):
            continue
        if any(marker in line for marker in ("--", ";", "@", "://", "../", "\\", "#")):
            raise ValueError(f"Строка {number}: URL, options и markers запрещены")
        match = PINNED.fullmatch(line)
        if not match:
            raise ValueError(f"Строка {number}: требуется точный pin package==version")
        package = match.group(1).lower().replace("_", "-")
        if package not in ALLOWED_PACKAGES:
            raise ValueError(f"Строка {number}: пакет {package} не разрешён")
        normalized.append(f"{package}=={match.group(2)}")
    return normalized
