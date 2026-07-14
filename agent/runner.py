"""Универсальный исполнитель Scenario DSL v1."""

from __future__ import annotations

import asyncio
import random
import string
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

from artifacts import ArtifactCollector, PendingArtifact
from browser import Browser
from mail_client import TempMailWorldClient
from scenario import LocatorStrategy, ScenarioDefinition, ScenarioStep, parse_scenario, redact_text, resolve_value
from test_mail_client import TestStandMailClient

LogFn = Callable[..., None]
CancelFn = Callable[[], Awaitable[bool]]
TERMINAL_SUCCESS = "success"
TERMINAL_PARTIAL = "partial"
TERMINAL_FAILED = "failed"
TERMINAL_CANCELLED = "cancelled"


class StepExecutionError(RuntimeError):
    def __init__(self, message: str, *, metadata: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.metadata = metadata or {}


class RunCancelled(RuntimeError):
    pass


@dataclass
class RunnerConfig:
    headless: bool = True
    proxy: Optional[str] = None
    workers: int = 1
    screenshots_dir: str = "artifacts"

    @classmethod
    def from_job(cls, job: Dict[str, Any], default_headless: bool, default_proxy: Optional[str]) -> "RunnerConfig":
        bot = job.get("bot") or {}
        config = bot.get("config") or {}
        return cls(
            headless=bool(config.get("headless", default_headless)),
            proxy=config.get("proxy") or default_proxy,
            workers=max(1, min(10, int(bot.get("workers") or 1))),
            screenshots_dir=str(config.get("screenshots_dir") or "artifacts"),
        )


@dataclass
class RunResult:
    status: str = TERMINAL_FAILED
    success_count: int = 0
    failed_count: int = 0
    errors: List[str] = field(default_factory=list)
    artifacts: List[PendingArtifact] = field(default_factory=list)
    target_results: List[Dict[str, int]] = field(default_factory=list)


@dataclass
class ExecutionContext:
    job: Dict[str, Any]
    cfg: RunnerConfig
    scenario: ScenarioDefinition
    log: LogFn
    worker_id: int
    mail: Any
    should_cancel: CancelFn
    variables: Dict[str, str] = field(default_factory=dict)
    secrets: Dict[str, str] = field(default_factory=dict)
    browser: Optional[Browser] = None
    tab: Any = None
    mail_creds: Optional[Dict[str, Any]] = None
    artifacts: Optional[ArtifactCollector] = None

    def safe(self, value: Any) -> str:
        return redact_text(value, self.secrets)


def _random_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return f"Aa1{''.join(random.choice(alphabet) for _ in range(12))}!"


def _css_quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _strategy_selectors(strategy: LocatorStrategy) -> List[str]:
    value = _css_quote(strategy.value or strategy.name or "")
    if strategy.kind == "role":
        role = _css_quote(strategy.role or "")
        return [f'[role="{role}"][aria-label="{value}"]', f'[role="{role}"]']
    if strategy.kind == "label":
        return [f'[aria-label="{value}"]', f'input[name="{value}"]', f'input[id="{value}"]']
    if strategy.kind == "placeholder":
        return [f'[placeholder="{value}"]', f'[placeholder*="{value}" i]']
    if strategy.kind == "testId":
        return [f'[data-testid="{value}"]']
    if strategy.kind == "css":
        return [strategy.value or ""]
    return []


async def _element_by_strategy(
    tab: Any,
    strategy: LocatorStrategy,
    timeout_seconds: float = 0.5,
) -> Any:
    if strategy.kind == "text":
        return await tab.find(
            strategy.value or "",
            best_match=not strategy.exact,
            timeout=timeout_seconds,
        )
    if strategy.kind == "role":
        for selector in _strategy_selectors(strategy):
            try:
                elements = await tab.select_all(selector, timeout=timeout_seconds)
                for element in elements or []:
                    text = (getattr(element, "text", "") or "").strip().lower()
                    name = (strategy.name or "").strip().lower()
                    if not name or (text == name if strategy.exact else name in text):
                        return element
            except Exception:  # noqa: BLE001
                continue
        try:
            return await tab.find(
                strategy.name or "",
                best_match=not strategy.exact,
                timeout=timeout_seconds,
            )
        except Exception:  # noqa: BLE001
            return None
    if strategy.kind == "label":
        try:
            label = await tab.find(
                strategy.value or "",
                best_match=not strategy.exact,
                timeout=timeout_seconds,
            )
            if label:
                label_for = getattr(label, "attrs", {}).get("for") if isinstance(getattr(label, "attrs", None), dict) else None
                if label_for:
                    return await tab.select(f'#{label_for}', timeout=timeout_seconds)
        except Exception:  # noqa: BLE001
            pass
    for selector in _strategy_selectors(strategy):
        if not selector:
            continue
        try:
            element = await tab.select(selector, timeout=timeout_seconds)
            if element:
                return element
        except Exception:  # noqa: BLE001
            continue
    return None


async def find_with_fallback(tab: Any, strategies: List[LocatorStrategy], timeout_ms: int) -> Tuple[Any, LocatorStrategy, int]:
    deadline = time.monotonic() + timeout_ms / 1000
    attempts = 0
    while time.monotonic() < deadline:
        for strategy in strategies:
            attempts += 1
            remaining = max(0.05, deadline - time.monotonic())
            per_strategy_timeout = min(0.5, remaining)
            element = await _element_by_strategy(
                tab,
                strategy,
                timeout_seconds=per_strategy_timeout,
            )
            if element:
                return element, strategy, attempts
        await asyncio.sleep(0.25)
    descriptions = [f"{s.kind}:{s.name or s.value}" for s in strategies]
    raise StepExecutionError(
        f"Элемент не найден за {timeout_ms} мс. Проверены: {', '.join(descriptions)}",
        metadata={"locatorStrategies": descriptions, "locatorAttempts": attempts},
    )


async def _ensure_page(ctx: ExecutionContext) -> Any:
    if ctx.tab is None:
        raise StepExecutionError("Страница ещё не открыта")
    return ctx.tab


async def handle_navigate(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    url = resolve_value(step.url, ctx.variables)
    ctx.tab = await ctx.browser.new_page(url)  # type: ignore[union-attr]
    return {"url": url}


async def handle_wait_for_email(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    email, creds = await ctx.mail.create_email(proxy=ctx.cfg.proxy)
    if not email or not creds:
        raise StepExecutionError("Временный почтовый ящик не создан")
    ctx.variables["generated.email"] = email
    ctx.mail_creds = creds
    return {"mailboxCreated": True}


async def handle_fill(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    tab = await _ensure_page(ctx)
    value = resolve_value(step.value, ctx.variables)
    element, strategy, attempts = await find_with_fallback(tab, step.locator, step.timeout_ms)
    await element.send_keys(value)
    return {"locatorKind": strategy.kind, "locatorAttempts": attempts, "value": "[REDACTED]" if step.secret else value}


async def handle_click(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    tab = await _ensure_page(ctx)
    element, strategy, attempts = await find_with_fallback(tab, step.locator, step.timeout_ms)
    await element.click()
    return {"locatorKind": strategy.kind, "locatorAttempts": attempts}


async def handle_wait_for_element(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    tab = await _ensure_page(ctx)
    _, strategy, attempts = await find_with_fallback(tab, step.locator, step.timeout_ms)
    return {"locatorKind": strategy.kind, "locatorAttempts": attempts}


async def handle_extract_otp(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    if not ctx.mail_creds:
        raise StepExecutionError("Почтовый ящик не был создан")
    otp = await ctx.mail.wait_for_code(ctx.mail_creds, timeout=max(1, step.timeout_ms // 1000), proxy=ctx.cfg.proxy)
    if not otp:
        raise StepExecutionError("OTP не получен до истечения тайм-аута")
    ctx.variables["mail.otp"] = otp
    ctx.secrets["otp"] = otp
    return {"otpReceived": True}


async def handle_fill_otp(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    otp_step = ScenarioStep(**{**step.__dict__, "value": "{{mail.otp}}", "secret": True})
    return await handle_fill(ctx, otp_step)


async def handle_assert_text(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    tab = await _ensure_page(ctx)
    expected = resolve_value(step.value, ctx.variables)
    deadline = time.monotonic() + step.timeout_ms / 1000
    while time.monotonic() < deadline:
        content = await tab.get_content() or ""
        if expected.lower() in content.lower():
            return {"assertion": "text", "matched": expected}
        await asyncio.sleep(0.25)
    raise StepExecutionError(f"Ожидаемый текст '{expected}' не найден")


async def handle_assert_visible(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    return await handle_wait_for_element(ctx, step)


async def handle_assert_url(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    tab = await _ensure_page(ctx)
    expected = resolve_value(step.value, ctx.variables)
    current = str(getattr(tab, "url", ""))
    if expected not in current:
        raise StepExecutionError(f"URL '{current}' не содержит '{expected}'", metadata={"currentUrl": current})
    return {"currentUrl": current}


async def handle_screenshot(ctx: ExecutionContext, step: ScenarioStep) -> Dict[str, Any]:
    tab = await _ensure_page(ctx)
    directory = Path(ctx.cfg.screenshots_dir) / str(ctx.job.get("runId") or "run")
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (step.file_name or f"{step.id}.png")
    await tab.save_screenshot(str(path))
    if ctx.artifacts:
        ctx.artifacts.add_existing(
            path,
            "screenshot",
            "image/png",
            step_id=step.id,
            metadata={"currentUrl": str(getattr(tab, "url", ""))},
        )
    return {"artifactKind": "screenshot"}


HANDLERS = {
    "navigate": handle_navigate,
    "waitForEmail": handle_wait_for_email,
    "fill": handle_fill,
    "click": handle_click,
    "waitForElement": handle_wait_for_element,
    "extractOtp": handle_extract_otp,
    "fillOtp": handle_fill_otp,
    "assertText": handle_assert_text,
    "assertVisible": handle_assert_visible,
    "assertUrl": handle_assert_url,
    "screenshot": handle_screenshot,
}


async def execute_step(ctx: ExecutionContext, step: ScenarioStep) -> None:
    if await ctx.should_cancel():
        raise RunCancelled("Запуск отменён пользователем")
    handler = HANDLERS.get(step.type)
    if handler is None:
        raise StepExecutionError(f"Обработчик шага '{step.type}' не зарегистрирован")

    for attempt in range(1, step.max_attempts + 1):
        started = time.monotonic()
        ctx.log(step.id, step.name, worker=ctx.worker_id, level="running", attempt=attempt, metadata={"type": step.type})
        try:
            metadata = await asyncio.wait_for(handler(ctx, step), timeout=step.timeout_ms / 1000 + 1)
            elapsed = int((time.monotonic() - started) * 1000)
            ctx.log(step.id, step.name, worker=ctx.worker_id, level="success", duration_ms=elapsed, attempt=attempt, metadata=metadata)
            return
        except RunCancelled:
            raise
        except Exception as exc:  # noqa: BLE001
            elapsed = int((time.monotonic() - started) * 1000)
            metadata = getattr(exc, "metadata", {})
            if ctx.tab is not None:
                current_url = str(getattr(ctx.tab, "url", ""))
                metadata = {**metadata, "currentUrl": current_url}
            last = attempt >= step.max_attempts
            if last and ctx.tab is not None and ctx.artifacts:
                try:
                    screenshot_path = ctx.artifacts.directory / f"{step.id}-failure.png"
                    await ctx.tab.save_screenshot(str(screenshot_path))
                    ctx.artifacts.add_existing(
                        screenshot_path,
                        "screenshot",
                        "image/png",
                        step_id=step.id,
                        metadata={"reason": "step-failure", "currentUrl": current_url},
                    )
                    html = await ctx.tab.get_content() or ""
                    ctx.artifacts.write_dom(
                        html,
                        step.id,
                        metadata={"reason": "step-failure", "currentUrl": current_url},
                    )
                    metadata = {**metadata, "failureArtifactsCaptured": True}
                except Exception as artifact_exc:  # noqa: BLE001
                    metadata = {**metadata, "artifactWarning": ctx.safe(str(artifact_exc))}
            ctx.log(step.id, ctx.safe(str(exc)), worker=ctx.worker_id, level="error" if last else "warn", duration_ms=elapsed, attempt=attempt, metadata=metadata)
            if last:
                if step.continue_on_error:
                    return
                raise StepExecutionError(str(exc), metadata=metadata) from exc
            await asyncio.sleep(step.retry_delay_ms / 1000)


async def run_worker(worker_id: int, job: Dict[str, Any], cfg: RunnerConfig, scenario: ScenarioDefinition, mail: Any, log: LogFn, should_cancel: CancelFn) -> List[PendingArtifact]:
    bot = job.get("bot") or {}
    ref = job.get("ref") or {}
    target_url = str(ref.get("url") or bot.get("targetUrl") or "").strip()
    variables = {**scenario.variables, "targetUrl": target_url, "baseUrl": target_url}
    password = str((bot.get("config") or {}).get("password") or _random_password())
    variables["generated.password"] = password
    secrets = {"password": password}
    collector = ArtifactCollector(
        cfg.screenshots_dir,
        str(job.get("runId") or "run"),
        worker_id,
        secrets,
    )
    ctx = ExecutionContext(
        job=job,
        cfg=cfg,
        scenario=scenario,
        log=log,
        worker_id=worker_id,
        mail=mail,
        should_cancel=should_cancel,
        variables=variables,
        secrets=secrets,
        artifacts=collector,
    )
    ctx.browser = Browser(headless=cfg.headless, proxy=cfg.proxy, log_func=lambda message: log("browser", message, worker=worker_id))
    try:
        await ctx.browser.start()
        for step in scenario.steps:
            if step.enabled:
                await execute_step(ctx, step)
        collector.write_report(
            {
                "runId": job.get("runId"),
                "worker": worker_id,
                "status": "success",
                "scenario": {"version": scenario.version, "name": scenario.name},
                "targetUrl": target_url,
            }
        )
        return collector.items
    except Exception as exc:
        collector.write_report(
            {
                "runId": job.get("runId"),
                "worker": worker_id,
                "status": "failed",
                "scenario": {"version": scenario.version, "name": scenario.name},
                "targetUrl": target_url,
                "error": ctx.safe(str(exc)),
            }
        )
        setattr(exc, "artifacts", collector.items)
        raise
    finally:
        await ctx.browser.stop()


async def run_job(job: Dict[str, Any], cfg: RunnerConfig, log: LogFn, should_cancel: Optional[CancelFn] = None, mail_factory: Callable[..., Any] = TempMailWorldClient) -> RunResult:
    scenario = parse_scenario(job.get("scenario"))
    cancel = should_cancel or (lambda: asyncio.sleep(0, result=False))
    result = RunResult()
    log("start", f"Сценарий v{scenario.version}: {scenario.name}; воркеров={cfg.workers}")
    bot = job.get("bot") or {}
    bot_config = bot.get("config") or {}
    targets = job.get("targets") or ([job.get("ref")] if job.get("ref") else [])
    cancelled = False
    retry_budget = max(1, int(bot_config.get("target_retry_budget") or 3))
    for target in targets:
        if not target or await cancel():
            cancelled = True
            break
        target_id = int(target.get("id"))
        target_url = str(target.get("url") or "")
        remaining = max(0, int(target.get("remaining") or (int(target.get("successLimit") or 0) - int(target.get("successCount") or 0))))
        target_success = 0
        target_failed = 0
        failed_batches = 0
        target_label = str(target.get("label") or "")
        log("target", f"Целевая ссылка {target_label or target_url}; осталось успехов={remaining}", metadata={"targetId": target_id, "targetUrl": target_url, "targetLabel": target_label})
        while target_success < remaining and not cancelled and failed_batches < retry_budget:
            batch_size = min(cfg.workers, remaining - target_success)
            target_job = {**job, "ref": target}
            if bot_config.get("mail_provider") == "test-stand" or "/test-stand/" in target_url:
                origin = target_url.split("/test-stand/", 1)[0].rstrip("/")
                mail = TestStandMailClient(origin, log_func=lambda message: log("mail", message))
            else:
                mail = mail_factory(log_func=lambda message: log("mail", redact_text(message, {})))
            outcomes = await asyncio.gather(
                *(run_worker(index + 1, target_job, cfg, scenario, mail, log, cancel) for index in range(batch_size)),
                return_exceptions=True,
            )
            batch_success = 0
            for outcome in outcomes:
                if isinstance(outcome, list):
                    batch_success += 1
                    target_success += 1
                    result.success_count += 1
                    result.artifacts.extend(outcome)
                elif isinstance(outcome, RunCancelled):
                    cancelled = True
                    result.errors.append("Запуск отменён пользователем")
                    result.artifacts.extend(getattr(outcome, "artifacts", []))
                else:
                    target_failed += 1
                    result.failed_count += 1
                    result.errors.append(str(outcome))
                    result.artifacts.extend(getattr(outcome, "artifacts", []))
            if batch_success == 0:
                failed_batches += 1
                level = "error" if failed_batches >= retry_budget else "warn"
                log("target", f"Неуспешная партия {failed_batches}/{retry_budget}: {target_label or target_url}", level=level, metadata={"targetId": target_id, "targetUrl": target_url, "targetLabel": target_label})
            else:
                failed_batches = 0
        result.target_results.append({"id": target_id, "successCount": target_success, "failedCount": target_failed, "completed": target_success >= remaining})

    completed_targets = sum(1 for target in result.target_results if target.get("completed"))
    result.status = TERMINAL_CANCELLED if cancelled else TERMINAL_SUCCESS if completed_targets == len(result.target_results) and completed_targets > 0 else TERMINAL_PARTIAL if completed_targets > 0 else TERMINAL_FAILED
    log("finish", f"Итог: {result.status}; успех={result.success_count}; ошибок={result.failed_count}", level="success" if result.status == TERMINAL_SUCCESS else "warn" if result.status == TERMINAL_CANCELLED else "error")
    return result
