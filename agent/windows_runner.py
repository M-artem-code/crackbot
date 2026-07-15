"""BotForge Windows Runner beta: pairing, heartbeat, one-job Docker loop."""

from __future__ import annotations

import json
import os
import platform
import threading
import time
from pathlib import Path
from typing import Callable

from api_client import CrackbotClient, StepBuffer
from credential_store import load_agent_key, save_agent_key
from docker_executor import cleanup_orphans, docker_status, execute_python
from pairing import exchange_pairing_token

VERSION = "0.1.0-beta.1"
DEFAULT_SERVER = os.environ.get("BOTFORGE_SERVER_URL", "http://localhost:3000").rstrip("/")
CONFIG_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "BotForge" / "Runner"
CONFIG_FILE = CONFIG_DIR / "config.json"


class Runner:
    def __init__(self, on_state: Callable[[str, str], None], on_log: Callable[[str], None]):
        self.on_state = on_state
        self.on_log = on_log
        self.stop_event = threading.Event()
        self.cancel_event = threading.Event()
        self.paused = False
        self.config = self._read_config()

    def _read_config(self) -> dict[str, object]:
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {"serverUrl": DEFAULT_SERVER}

    def _write_config(self, agent_id: str, server_url: str) -> None:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps({"serverUrl": server_url, "agentId": agent_id}, indent=2), encoding="utf-8")
        self.config = self._read_config()

    def pair(self, token: str, server_url: str = DEFAULT_SERVER) -> None:
        self.on_state("connecting", "Привязываем раннер")
        result = exchange_pairing_token(server_url, token, VERSION)
        save_agent_key(result["apiKey"])
        self._write_config(result["agentId"], server_url)
        self.on_state("offline", "Привязка завершена")

    def pause(self, value: bool) -> None:
        self.paused = value
        self.on_state("paused" if value else "online", "Приостановлен" if value else "Готов к работе")

    def cancel_current(self) -> None:
        self.cancel_event.set()

    def stop(self) -> None:
        self.stop_event.set()
        self.cancel_current()

    def run_forever(self) -> None:
        api_key = load_agent_key()
        server_url = str(self.config.get("serverUrl") or DEFAULT_SERVER)
        if not api_key:
            self.on_state("unpaired", "Требуется подключение")
            return
        ok, docker_version = docker_status()
        if not ok:
            self.on_state("docker_required", docker_version)
            return
        cleanup_orphans()
        client = CrackbotClient(server_url, api_key)
        delay = 2.0
        while not self.stop_event.is_set():
            try:
                client.heartbeat(f"Windows {platform.release()} · Docker {docker_version}")
                if self.paused:
                    time.sleep(2)
                    continue
                self.on_state("online", "Готов к работе")
                job = client.poll_job()
                if not job:
                    time.sleep(3)
                    continue
                self._execute_job(client, job)
                delay = 2.0
            except Exception as exc:
                self.on_log(f"Связь с сервером: {str(exc)[:240]}")
                self.on_state("offline", "Повторное подключение")
                time.sleep(delay)
                delay = min(delay * 1.7, 30.0)

    def _execute_job(self, client: CrackbotClient, job: dict[str, object]) -> None:
        run_id = str(job.get("runId") or "")
        lease = str(job.get("leaseToken") or "")
        python_job = job.get("python")
        if not run_id or not lease or not isinstance(python_job, dict):
            raise ValueError("Runner получил неподдерживаемое задание")
        code = python_job.get("code")
        requirements = python_job.get("requirements", "")
        if not isinstance(code, str) or not isinstance(requirements, str):
            raise ValueError("Некорректный Python payload")

        self.cancel_event.clear()
        self.on_state("running", f"Выполняется {run_id}")
        logs = StepBuffer(client, run_id, lease, flush_interval=1, max_size=10)
        started = time.monotonic()

        monitor_stop = threading.Event()

        def monitor_lease() -> None:
            while not monitor_stop.wait(20):
                try:
                    state = client.run_heartbeat(run_id, lease)
                    if state.get("cancelRequested"):
                        self.cancel_event.set()
                        return
                except Exception as exc:
                    self.on_log(f"Не удалось продлить lease: {str(exc)[:160]}")

        monitor = threading.Thread(target=monitor_lease, daemon=True)
        monitor.start()

        def send_log(line: str) -> None:
            self.on_log(line)
            logs.add("python.stdout", line)

        try:
            result = execute_python(run_id, code, requirements, self.cancel_event, send_log)
            logs.flush()
            status = "cancelled" if result.cancelled else ("success" if result.exit_code == 0 else "failed")
            client.complete_run(
                run_id, lease, status=status,
                success_count=1 if status == "success" else 0,
                failed_count=1 if status == "failed" else 0,
                duration_ms=int((time.monotonic() - started) * 1000),
                error=None if status == "success" else result.output[-1000:],
            )
        finally:
            monitor_stop.set()
            monitor.join(timeout=2)
            self.on_state("online", "Готов к работе")
