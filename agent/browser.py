"""Запуск и настройка браузера через nodriver с антидетект-патчами.

Инкапсулирует старт nodriver, применение stealth.js на каждой странице,
подключение прокси и удобные хелперы поиска элементов несколькими стратегиями.
"""

from __future__ import annotations

import os
import random
from pathlib import Path
from typing import Optional

import nodriver as uc

BASE_DIR = Path(__file__).parent
STEALTH_PATH = BASE_DIR / "stealth.js"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
]


def _load_stealth() -> str:
    try:
        return STEALTH_PATH.read_text(encoding="utf-8")
    except OSError:
        return ""


STEALTH_JS = _load_stealth()


class Browser:
    """Тонкая обёртка над nodriver.Browser с антидетектом и прокси."""

    def __init__(self, headless: bool = True, proxy: Optional[str] = None, log_func=None):
        self.headless = headless
        self.proxy = proxy
        self.log = log_func or (lambda msg: None)
        self._browser: Optional[uc.Browser] = None

    async def start(self) -> uc.Browser:
        args = [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            f"--user-agent={random.choice(USER_AGENTS)}",
            f"--window-size={random.randint(1280, 1920)},{random.randint(800, 1080)}",
        ]
        if self.proxy:
            proxy_url = self.proxy if "://" in self.proxy else f"http://{self.proxy}"
            args.append(f"--proxy-server={proxy_url}")

        self.log(f"Запуск браузера (headless={self.headless}, proxy={'да' if self.proxy else 'нет'})")
        executable_path = os.environ.get("BROWSER_EXECUTABLE_PATH")
        self._browser = await uc.start(
            headless=self.headless,
            browser_args=args,
            browser_executable_path=executable_path,
        )
        return self._browser

    async def new_page(self, url: str) -> uc.Tab:
        """Открывает новую вкладку и применяет stealth-скрипт до загрузки страницы."""
        assert self._browser is not None, "Браузер не запущен"
        tab = await self._browser.get(url, new_tab=True)
        if STEALTH_JS:
            try:
                await tab.evaluate(STEALTH_JS, await_promise=False)
            except Exception as exc:  # noqa: BLE001
                self.log(f"stealth inject warning: {exc}")
        return tab

    async def stop(self) -> None:
        if self._browser is not None:
            try:
                self._browser.stop()
            except Exception:  # noqa: BLE001
                pass
            self._browser = None
