"""Движок сценария OTP-регистрации.

flowType == "otp": агент создаёт временную почту, открывает целевой URL (реф),
заполняет email/пароль несколькими стратегиями поиска полей, отправляет форму,
дожидается кода из TempMail.World, вводит его и фиксирует успех/провал.

scenarioSteps из шаблона используются только как подписи шагов в логе —
сама логика реализована здесь, в коде, и управляется параметрами конфига.
"""

from __future__ import annotations

import asyncio
import random
import string
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from browser import Browser
from mail_client import TempMailWorldClient

LogFn = Callable[..., None]

# Селекторы полей — пробуем по очереди, пока не найдём видимый элемент.
EMAIL_SELECTORS = [
    'input[type="email"]',
    'input[autocomplete="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="mail" i]',
    'input[name*="login" i]',
]
PASSWORD_SELECTORS = [
    'input[type="password"]',
    'input[autocomplete="new-password"]',
    'input[name*="pass" i]',
    'input[id*="pass" i]',
]
OTP_SELECTORS = [
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[name*="code" i]',
    'input[id*="otp" i]',
    'input[id*="code" i]',
    'input[placeholder*="code" i]',
    'input[placeholder*="код" i]',
    'input[maxlength="6"]',
]
SUBMIT_SELECTORS = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[name*="submit" i]',
]
SUBMIT_TEXTS = [
    "sign up", "signup", "register", "create account", "continue", "next",
    "get started", "join", "зарегистр", "продолжить", "далее", "создать",
]


@dataclass
class RunnerConfig:
    """Параметры прогона, собранные из template.defaultConfig + bot.config."""
    page_timeout: int = 45
    otp_timeout: int = 120
    action_delay_min: float = 0.4
    action_delay_max: float = 1.4
    workers: int = 1
    password: Optional[str] = None
    proxy: Optional[str] = None
    headless: bool = True

    @classmethod
    def from_job(cls, job: Dict[str, Any], default_headless: bool, default_proxy: Optional[str]) -> "RunnerConfig":
        template = job.get("template") or {}
        bot = job.get("bot") or {}
        merged: Dict[str, Any] = {}
        merged.update(template.get("defaultConfig") or {})
        merged.update(bot.get("config") or {})

        def num(key: str, default):
            try:
                return type(default)(merged.get(key, default))
            except (TypeError, ValueError):
                return default

        return cls(
            page_timeout=num("page_timeout", 45),
            otp_timeout=num("otp_timeout", 120),
            action_delay_min=num("action_delay_min", 0.4),
            action_delay_max=num("action_delay_max", 1.4),
            workers=max(1, int(bot.get("workers") or merged.get("workers") or 1)),
            password=merged.get("password") or None,
            proxy=merged.get("proxy") or default_proxy,
            headless=bool(merged.get("headless", default_headless)),
        )


@dataclass
class RunResult:
    success_count: int = 0
    failed_count: int = 0
    errors: List[str] = field(default_factory=list)


def _random_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    body = "".join(random.choice(alphabet) for _ in range(10))
    # Гарантируем наличие цифры, буквы и спецсимвола.
    return f"Aa1{body}!"


async def _human_delay(cfg: RunnerConfig) -> None:
    await asyncio.sleep(random.uniform(cfg.action_delay_min, cfg.action_delay_max))


async def _find_first(tab, selectors: List[str], timeout: float = 8.0):
    """Возвращает первый найденный видимый элемент по списку селекторов."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for sel in selectors:
            try:
                el = await tab.select(sel, timeout=1)
                if el:
                    return el
            except Exception:  # noqa: BLE001
                continue
        await asyncio.sleep(0.4)
    return None


async def _find_submit(tab, timeout: float = 8.0):
    el = await _find_first(tab, SUBMIT_SELECTORS, timeout=timeout / 2)
    if el:
        return el
    # Фолбэк: поиск кнопки по тексту.
    deadline = time.monotonic() + timeout / 2
    while time.monotonic() < deadline:
        for text in SUBMIT_TEXTS:
            try:
                el = await tab.find(text, best_match=True)
                if el:
                    return el
            except Exception:  # noqa: BLE001
                continue
        await asyncio.sleep(0.4)
    return None


async def _detect_success(tab) -> bool:
    """Грубая эвристика успеха регистрации по содержимому/URL страницы."""
    markers = [
        "welcome", "dashboard", "success", "verified", "confirmed",
        "спасибо", "успешно", "подтвержд", "добро пожаловать",
    ]
    try:
        content = (await tab.get_content() or "").lower()
    except Exception:  # noqa: BLE001
        content = ""
    if any(m in content for m in markers):
        return True
    # Отсутствие полей пароля/кода часто означает, что форма пройдена.
    try:
        still_password = await tab.select('input[type="password"]', timeout=1)
    except Exception:  # noqa: BLE001
        still_password = None
    return still_password is None


async def register_once(
    worker_id: int,
    job: Dict[str, Any],
    cfg: RunnerConfig,
    mail: TempMailWorldClient,
    log: LogFn,
) -> bool:
    """Одна попытка регистрации в отдельной вкладке браузера."""
    ref = job.get("ref") or {}
    bot = job.get("bot") or {}
    target_url = (ref.get("url") or bot.get("targetUrl") or "").strip()
    if not target_url:
        log("submit", "Нет целевого URL (ни реф, ни targetUrl)", worker=worker_id, level="error")
        return False

    browser = Browser(headless=cfg.headless, proxy=cfg.proxy, log_func=lambda m: log("browser", m, worker=worker_id))
    started = time.monotonic()
    try:
        await browser.start()

        # 1. Временная почта
        log("email", "Создаю временную почту", worker=worker_id)
        email, creds = await mail.create_email(proxy=cfg.proxy)
        if not email or not creds:
            log("email", "Не удалось получить почту", worker=worker_id, level="error")
            return False
        log("email", f"Почта: {email}", worker=worker_id)

        password = cfg.password or _random_password()

        # 2. Открываем целевую страницу (stealth применяется внутри new_page)
        log("open", f"Открываю {target_url}", worker=worker_id)
        tab = await browser.new_page(target_url)
        await asyncio.sleep(min(cfg.page_timeout, 6))

        # 3. Email
        email_el = await _find_first(tab, EMAIL_SELECTORS, timeout=cfg.page_timeout / 3)
        if not email_el:
            log("fill_email", "Поле email не найдено", worker=worker_id, level="error")
            return False
        await email_el.send_keys(email)
        await _human_delay(cfg)
        log("fill_email", "Email введён", worker=worker_id)

        # 4. Password (если форма его требует)
        pass_el = await _find_first(tab, PASSWORD_SELECTORS, timeout=5)
        if pass_el:
            await pass_el.send_keys(password)
            await _human_delay(cfg)
            log("fill_password", "Пароль введён", worker=worker_id)

        # 5. Отправка формы
        submit_el = await _find_submit(tab, timeout=8)
        if not submit_el:
            log("submit", "Кнопка отправки не найдена", worker=worker_id, level="error")
            return False
        await submit_el.click()
        log("submit", "Форма отправлена", worker=worker_id)
        await _human_delay(cfg)

        # 6. Ожидание OTP-кода из почты
        log("wait_code", "Жду код подтверждения", worker=worker_id)
        code = await mail.wait_for_code(creds, timeout=cfg.otp_timeout, proxy=cfg.proxy)
        if not code:
            log("wait_code", "Код не получен (таймаут)", worker=worker_id, level="error")
            return False
        log("wait_code", f"Код получен: {code}", worker=worker_id)

        # 7. Ввод кода
        otp_el = await _find_first(tab, OTP_SELECTORS, timeout=cfg.page_timeout / 3)
        if otp_el:
            await otp_el.send_keys(code)
            await _human_delay(cfg)
            confirm_el = await _find_submit(tab, timeout=6)
            if confirm_el:
                await confirm_el.click()
            log("submit_code", "Код отправлен", worker=worker_id)
            await asyncio.sleep(3)
        else:
            log("submit_code", "Поле для кода не найдено", worker=worker_id, level="warn")

        # 8. Детект успеха
        ok = await _detect_success(tab)
        elapsed = int((time.monotonic() - started) * 1000)
        if ok:
            log("done", f"Регистрация успешна ({elapsed} мс)", worker=worker_id, level="success", duration_ms=elapsed)
        else:
            log("done", "Не удалось подтвердить успех", worker=worker_id, level="error", duration_ms=elapsed)
        return ok
    except Exception as exc:  # noqa: BLE001
        log("error", f"Ошибка: {exc}", worker=worker_id, level="error")
        return False
    finally:
        await browser.stop()


async def run_job(job: Dict[str, Any], cfg: RunnerConfig, log: LogFn) -> RunResult:
    """Запускает cfg.workers параллельных регистраций против рефа задания."""
    result = RunResult()
    template = job.get("template") or {}
    flow = template.get("flowType") or "otp"

    if flow != "otp":
        log("start", f"flowType='{flow}' не поддерживается этим агентом", level="error")
        result.failed_count = cfg.workers
        result.errors.append(f"unsupported flowType: {flow}")
        return result

    log("start", f"Старт задания: воркеров={cfg.workers}, шаблон={template.get('slug')}")
    mail = TempMailWorldClient(log_func=lambda m: log("mail", m))

    semaphore = asyncio.Semaphore(cfg.workers)

    async def guarded(worker_id: int) -> bool:
        async with semaphore:
            return await register_once(worker_id, job, cfg, mail, log)

    outcomes = await asyncio.gather(
        *(guarded(i + 1) for i in range(cfg.workers)),
        return_exceptions=True,
    )

    for outcome in outcomes:
        if isinstance(outcome, Exception):
            result.failed_count += 1
            result.errors.append(str(outcome))
        elif outcome:
            result.success_count += 1
        else:
            result.failed_count += 1

    log(
        "finish",
        f"Готово: успех={result.success_count}, провал={result.failed_count}",
        level="success" if result.success_count else "error",
    )
    return result
