"""Точка входа агента-раннера crackbot.

Главный цикл:
  1. Периодически шлёт heartbeat (в фоне), поддерживая статус "онлайн".
  2. Опрашивает /api/agent/jobs — при наличии задания захватывает его.
  3. Выполняет сценарий (runner.run_job), стримя шаги в /steps.
  4. Отправляет итог в /complete (статус, счётчики, refId).

Запуск:
  python agent.py                 # берёт agent-config.json рядом со скриптом
  python agent.py --config path   # свой путь к конфигу
  python agent.py --once          # выполнить одно задание и выйти
"""

from __future__ import annotations

import argparse
import asyncio
import time
from datetime import datetime
from typing import Any, Dict, Optional

import nodriver as uc

from api_client import ApiError, CrackbotClient, StepBuffer
from config import AgentConfig, load_config
from runner import RunnerConfig, run_job

LEVEL_ICON = {"info": "·", "success": "✓", "warn": "!", "error": "✗"}


def console(step: str, message: str, *, worker: int = 0, level: str = "info") -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    icon = LEVEL_ICON.get(level, "·")
    wtag = f"[w{worker}] " if worker else ""
    print(f"{ts} {icon} {wtag}{step}: {message}", flush=True)


async def heartbeat_loop(client: CrackbotClient, cfg: AgentConfig, stop: asyncio.Event) -> None:
    """Фоновый цикл heartbeat — держит агента онлайн (порог сервера 90с)."""
    os_label = cfg.os_label
    while not stop.is_set():
        try:
            await asyncio.to_thread(client.heartbeat, os_label)
        except ApiError as exc:
            console("heartbeat", str(exc), level="error")
        except Exception as exc:  # noqa: BLE001
            console("heartbeat", f"сеть: {exc}", level="warn")
        try:
            await asyncio.wait_for(stop.wait(), timeout=30)
        except asyncio.TimeoutError:
            pass


def make_logger(buffer: StepBuffer):
    """Строит log-функцию: пишет в консоль и буферизует шаг для отправки на сервер."""

    def log(
        step: str,
        message: str = "",
        *,
        worker: int = 0,
        level: str = "info",
        duration_ms: int = 0,
        attempt: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        console(step, message, worker=worker, level=level)
        buffer.add(
            step,
            message,
            worker=worker,
            level=level,
            duration_ms=duration_ms,
            attempt=attempt,
            metadata=metadata,
        )

    return log


async def process_job(client: CrackbotClient, cfg: AgentConfig, job: Dict[str, Any]) -> None:
    run_id = job.get("runId")
    ref = job.get("ref") or {}
    ref_id = ref.get("id")
    lease_token = str(job.get("leaseToken") or "")
    if not run_id or not lease_token:
        console("job", "Задание без runId — пропускаю", level="error")
        return

    console("job", f"Получено задание run={run_id}", level="success")
    buffer = StepBuffer(client, run_id, lease_token)
    log = make_logger(buffer)
    started = time.monotonic()
    lease_stop = asyncio.Event()

    async def lease_heartbeat() -> None:
        while not lease_stop.is_set():
            try:
                state = await asyncio.to_thread(client.run_heartbeat, run_id, lease_token)
                if state.get("cancelRequested"):
                    return
            except Exception as exc:  # noqa: BLE001
                console("run-heartbeat", f"Не удалось продлить lease: {exc}", level="warn")
            try:
                await asyncio.wait_for(lease_stop.wait(), timeout=20)
            except asyncio.TimeoutError:
                pass

    lease_task = asyncio.create_task(lease_heartbeat())

    try:
        runner_cfg = RunnerConfig.from_job(job, default_headless=cfg.headless, default_proxy=cfg.proxy)

        async def should_cancel() -> bool:
            try:
                state = await asyncio.to_thread(client.get_run_state, run_id, lease_token)
                return bool(state.get("cancelRequested")) or state.get("status") == "cancelled"
            except Exception:  # noqa: BLE001
                return False

        result = await run_job(job, runner_cfg, log, should_cancel=should_cancel)
        buffer.flush()

        uploaded = 0
        for artifact in result.artifacts:
            try:
                await asyncio.to_thread(
                    client.upload_artifact,
                    run_id,
                    path=str(artifact.path),
                    kind=artifact.kind,
                    content_type=artifact.content_type,
                    worker=artifact.worker,
                    step_id=artifact.step_id,
                    lease_token=lease_token,
                )
                uploaded += 1
            except Exception as exc:  # noqa: BLE001
                log(
                    "artifact-upload",
                    f"Не удалось загрузить {artifact.kind}: {exc}",
                    level="warn",
                    metadata={"kind": artifact.kind, "worker": artifact.worker},
                )
        buffer.flush()
        console("artifacts", f"Загружено {uploaded} из {len(result.artifacts)}")

        duration_ms = int((time.monotonic() - started) * 1000)
        status = result.status
        await asyncio.to_thread(
            client.complete_run,
            run_id,
            status=status,
            success_count=result.success_count,
            failed_count=result.failed_count,
            duration_ms=duration_ms,
            error="; ".join(result.errors[:3]) if result.errors else None,
            ref_id=ref_id,
            target_results=result.target_results,
            lease_token=lease_token,
        )
        console("complete", f"run={run_id} → {status} (успех={result.success_count}, провал={result.failed_count})",
                level="success" if status == "success" else "error")
    except Exception as exc:  # noqa: BLE001
        buffer.flush()
        duration_ms = int((time.monotonic() - started) * 1000)
        console("complete", f"Прогон упал: {exc}", level="error")
        try:
            await asyncio.to_thread(
                client.complete_run,
                run_id,
                status="failed",
                failed_count=1,
                duration_ms=duration_ms,
                error=str(exc),
                ref_id=ref_id,
                lease_token=lease_token,
            )
        except Exception as inner:  # noqa: BLE001
            console("complete", f"Не удалось отправить итог: {inner}", level="error")
    finally:
        lease_stop.set()
        lease_task.cancel()
        try:
            await lease_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


async def main_loop(cfg: AgentConfig, run_once: bool = False) -> None:
    client = CrackbotClient(cfg.server_url, cfg.api_key)

    # Проверка связи и ключа до старта основного цикла.
    try:
        await asyncio.to_thread(client.heartbeat, cfg.os_label)
        console("connect", f"Подключено к {cfg.server_url}", level="success")
    except ApiError as exc:
        console("connect", str(exc), level="error")
        return
    except Exception as exc:  # noqa: BLE001
        console("connect", f"Нет связи с сервером: {exc}", level="error")
        return

    stop = asyncio.Event()
    hb_task = asyncio.create_task(heartbeat_loop(client, cfg, stop))

    try:
        while True:
            try:
                job = await asyncio.to_thread(client.poll_job)
            except ApiError as exc:
                console("poll", str(exc), level="error")
                await asyncio.sleep(cfg.poll_interval_sec)
                continue
            except Exception as exc:  # noqa: BLE001
                console("poll", f"сеть: {exc}", level="warn")
                await asyncio.sleep(cfg.poll_interval_sec)
                continue

            if job:
                await process_job(client, cfg, job)
                if run_once:
                    break
            else:
                if run_once:
                    console("poll", "Заданий нет — выхожу (--once)")
                    break
                await asyncio.sleep(cfg.poll_interval_sec)
    finally:
        stop.set()
        hb_task.cancel()
        try:
            await hb_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="crackbot agent runner")
    parser.add_argument("--config", help="путь к agent-config.json")
    parser.add_argument("--once", action="store_true", help="выполнить одно задание и выйти")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cfg = load_config(args.config)
    console("boot", f"crackbot agent · сервер={cfg.server_url} · опрос каждые {cfg.poll_interval_sec:.0f}с")
    try:
        uc.loop().run_until_complete(main_loop(cfg, run_once=args.once))
    except KeyboardInterrupt:
        console("boot", "Остановлено пользователем")


if __name__ == "__main__":
    main()
