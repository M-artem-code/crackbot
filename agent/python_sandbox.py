from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List


@dataclass
class SandboxResult:
    status: str
    success_count: int = 0
    failed_count: int = 0
    errors: List[str] = field(default_factory=list)
    output: str = ""
    artifact_paths: List[Path] = field(default_factory=list)
    target_results: List[Dict[str, Any]] = field(default_factory=list)


async def run_python_sandbox(job: Dict[str, Any], log: Callable[..., None]) -> SandboxResult:
    scenario = job.get("scenario") or {}
    python_files = scenario.get("python") or job.get("python") or {}
    code = str(python_files.get("code") or "")
    requirements = str(python_files.get("requirements") or "")
    targets = job.get("targets") or []
    if not code.strip():
        return SandboxResult(status="failed", failed_count=1, errors=["В Python snapshot отсутствует bot.py"])

    runtime = shutil.which("docker") or shutil.which("podman")
    if not runtime:
        return SandboxResult(status="failed", failed_count=1, errors=["Для Python workspace установите Docker или Podman на машине агента"])

    target = next((item for item in targets if int(item.get("id", 0)) == int(scenario.get("targetId", 0))), targets[0] if targets else None)
    if not target:
        return SandboxResult(status="failed", failed_count=1, errors=["В пуле нет цели для Python-прогона"])

    root = Path(tempfile.mkdtemp(prefix="crackbot-python-"))
    artifacts = root / "artifacts"
    artifacts.mkdir(mode=0o700)
    (root / "bot.py").write_text(code, encoding="utf-8")
    (root / "requirements.txt").write_text(requirements, encoding="utf-8")
    payload = {"runId": job.get("runId"), "bot": job.get("bot"), "target": target, "config": (job.get("bot") or {}).get("config") or {}}
    (root / "input.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    wrapper = "set -eu; python -m pip install --disable-pip-version-check --no-input --requirement /workspace/requirements.txt; CRACKBOT_INPUT=/workspace/input.json python /workspace/bot.py"
    command = [runtime, "run", "--rm", "--init", "--network", "bridge", "--cpus", "2", "--memory", "2g", "--pids-limit", "256", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m", "--security-opt", "no-new-privileges", "--cap-drop", "ALL", "--user", "1000:1000", "-v", f"{root}:/workspace:rw", "-w", "/workspace", "mcr.microsoft.com/playwright/python:v1.55.0-noble", "bash", "-lc", wrapper]
    log("python-sandbox", f"Запуск bot.py для {target.get('url')}", metadata={"targetId": target.get("id")})
    try:
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, env={"PATH": os.environ.get("PATH", "")})
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=900)
        output = stdout.decode("utf-8", errors="replace")[-50_000:]
        result_line = next((line for line in reversed(output.splitlines()) if line.strip().startswith("{") and line.strip().endswith("}")), "")
        parsed = json.loads(result_line) if result_line else {}
        success = process.returncode == 0 and bool(parsed.get("success"))
        paths = [path for path in artifacts.rglob("*") if path.is_file() and path.stat().st_size <= 25 * 1024 * 1024]
        return SandboxResult(status="success" if success else "failed", success_count=1 if success else 0, failed_count=0 if success else 1, errors=[] if success else [str(parsed.get("message") or f"bot.py завершился с кодом {process.returncode}")], output=output, artifact_paths=paths, target_results=[{"id": int(target["id"]), "successCount": 1 if success else 0, "failedCount": 0 if success else 1}])
    except asyncio.TimeoutError:
        process.kill(); await process.wait()
        return SandboxResult(status="failed", failed_count=1, errors=["Python sandbox превысил лимит 15 минут"], output="Timeout")
    finally:
        # Artifact files are copied by the caller before this directory can be removed.
        pass
