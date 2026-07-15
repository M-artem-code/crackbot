"""Детерминированный mail provider для разрешённого Crackbot OTP-стенда."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional, Tuple

import requests


class TestStandMailClient:
    def __init__(self, base_url: str, log_func=None):
        self.base_url = base_url.rstrip("/")
        self.log = log_func or (lambda message: None)

    async def create_email(self, proxy: Optional[str] = None) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        del proxy

        def create() -> Dict[str, Any]:
            response = requests.post(f"{self.base_url}/api/test-stand/mailboxes", timeout=15)
            response.raise_for_status()
            return response.json()

        try:
            mailbox = await asyncio.to_thread(create)
            email = mailbox.get("email")
            token = mailbox.get("mailboxToken")
            if not email or not token:
                raise ValueError("Стенд вернул неполный mailbox")
            self.log("Тестовый mailbox создан")
            return str(email), {"mailboxToken": str(token)}
        except Exception as exc:  # noqa: BLE001
            self.log(f"Тестовый mailbox не создан: {exc}")
            return None, None

    async def wait_for_code(
        self,
        creds: Dict[str, Any],
        timeout: int = 120,
        proxy: Optional[str] = None,
    ) -> Optional[str]:
        del proxy
        token = creds.get("mailboxToken")
        if not token:
            return None
        deadline = asyncio.get_running_loop().time() + timeout
        while asyncio.get_running_loop().time() < deadline:
            try:
                response = await asyncio.to_thread(
                    requests.get,
                    f"{self.base_url}/api/test-stand/mailboxes",
                    params={"token": token},
                    timeout=15,
                )
                if response.status_code == 200:
                    payload = response.json()
                    code = payload.get("code")
                    if code:
                        self.log("OTP получен из тестового mailbox")
                        return str(code)
                elif response.status_code == 410:
                    return None
            except requests.RequestException:  # Сетевой сбой повторяется до общего timeout.
                pass
            await asyncio.sleep(1)
        return None
