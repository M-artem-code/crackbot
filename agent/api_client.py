"""HTTP-клиент для общения агента с сервером crackbot.

Реализует контракт эндпоинтов /api/agent/*:
  - POST /api/agent/heartbeat        — держит агента "онлайн" + сообщает ОС
  - GET  /api/agent/jobs             — атомарно захватывает один queued-прогон
  - POST /api/agent/runs/{id}/steps  — стримит шаги прогона в реальном времени
  - POST /api/agent/runs/{id}/complete — финальный статус + счётчики + refId
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

import requests


class ApiError(Exception):
    pass


class CrackbotClient:
    def __init__(self, server_url: str, api_key: str, timeout: int = 30):
        self.server_url = server_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(max_retries=3)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _url(self, path: str) -> str:
        return f"{self.server_url}{path}"

    def _post(self, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        resp = self.session.post(self._url(path), json=payload or {}, timeout=self.timeout)
        if resp.status_code == 401:
            raise ApiError("Неверный или отключённый API-ключ (401)")
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return {}

    def _get(self, path: str) -> Dict[str, Any]:
        resp = self.session.get(self._url(path), timeout=self.timeout)
        if resp.status_code == 401:
            raise ApiError("Неверный или отключённый API-ключ (401)")
        resp.raise_for_status()
        try:
            return resp.json()
        except ValueError:
            return {}

    # ----- Контрактные методы -----

    def heartbeat(self, os_label: str) -> Dict[str, Any]:
        """Сообщает серверу, что агент жив, и передаёт метку ОС."""
        return self._post("/api/agent/heartbeat", {"os": os_label})

    def poll_job(self) -> Optional[Dict[str, Any]]:
        """Пытается захватить одно задание. Возвращает job или None."""
        data = self._get("/api/agent/jobs")
        return data.get("job")

    def push_steps(self, run_id: str, steps: List[Dict[str, Any]]) -> None:
        """Отправляет пачку шагов лога для прогона."""
        if not steps:
            return
        try:
            self._post(f"/api/agent/runs/{run_id}/steps", {"steps": steps})
        except (requests.RequestException, ApiError):
            # Логи не критичны — не роняем прогон из-за сетевой ошибки.
            pass

    def complete_run(
        self,
        run_id: str,
        *,
        status: str,
        success_count: int = 0,
        failed_count: int = 0,
        duration_ms: int = 0,
        error: Optional[str] = None,
        ref_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Финализирует прогон: статус, счётчики, длительность и refId."""
        payload: Dict[str, Any] = {
            "status": "failed" if status == "failed" else "success",
            "successCount": max(0, int(success_count)),
            "failedCount": max(0, int(failed_count)),
            "durationMs": max(0, int(duration_ms)),
        }
        if error:
            payload["error"] = str(error)[:1000]
        if ref_id is not None:
            payload["refId"] = int(ref_id)
        return self._post(f"/api/agent/runs/{run_id}/complete", payload)


class StepBuffer:
    """Буферизует шаги лога и периодически сбрасывает их на сервер.

    Позволяет не делать HTTP-запрос на каждый шаг: шаги копятся и отправляются
    пачкой либо по таймеру, либо при достижении размера буфера.
    """

    def __init__(self, client: CrackbotClient, run_id: str, flush_interval: float = 2.0, max_size: int = 20):
        self.client = client
        self.run_id = run_id
        self.flush_interval = flush_interval
        self.max_size = max_size
        self._buffer: List[Dict[str, Any]] = []
        self._last_flush = time.monotonic()

    def add(self, step: str, message: str = "", *, worker: int = 0, level: str = "info", duration_ms: int = 0) -> None:
        self._buffer.append(
            {
                "worker": worker,
                "level": level,
                "step": step,
                "message": message,
                "durationMs": max(0, int(duration_ms)),
            }
        )
        if len(self._buffer) >= self.max_size or (time.monotonic() - self._last_flush) >= self.flush_interval:
            self.flush()

    def flush(self) -> None:
        if not self._buffer:
            return
        batch, self._buffer = self._buffer, []
        self._last_flush = time.monotonic()
        self.client.push_steps(self.run_id, batch)
