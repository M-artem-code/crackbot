"""Docker-only executor. User code is never executed on the Windows host."""

from __future__ import annotations

import queue
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from dependency_policy import validate_requirements

BASE_IMAGE = "python:3.12.10-slim-bookworm"
MAX_SOURCE_BYTES = 512_000
MAX_OUTPUT_BYTES = 1_000_000
DEFAULT_TIMEOUT_SECONDS = 900
LABEL = "io.botforge.runner=windows-beta"


@dataclass(frozen=True)
class ExecutionResult:
    exit_code: int
    output: str
    cancelled: bool = False
    timed_out: bool = False


def docker_status() -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True, text=True, timeout=8, check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return result.returncode == 0, result.stdout.strip() or result.stderr.strip()[:160]
    except (OSError, subprocess.TimeoutExpired):
        return False, "Docker Desktop не найден или daemon не запущен"


def cleanup_orphans() -> None:
    subprocess.run(
        ["docker", "container", "prune", "-f", "--filter", f"label={LABEL}"],
        capture_output=True, timeout=20, check=False,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


def execute_python(
    run_id: str,
    source: str,
    requirements: str,
    cancel_event: threading.Event,
    on_log: Callable[[str], None],
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> ExecutionResult:
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise ValueError("bot.py превышает 500 KB")
    dependencies = validate_requirements(requirements)
    safe_run_id = "".join(ch for ch in run_id if ch.isalnum() or ch in "-_")[:80]
    if not safe_run_id:
        raise ValueError("Некорректный run id")
    container_name = f"botforge-{safe_run_id.lower()}"

    with tempfile.TemporaryDirectory(prefix="botforge-") as temp:
        root = Path(temp)
        (root / "bot.py").write_text(source, encoding="utf-8")
        (root / "requirements.txt").write_text("\n".join(dependencies), encoding="utf-8")
        install = "RUN pip install --no-cache-dir --only-binary=:all: -r /app/requirements.txt" if dependencies else ""
        dockerfile = f"""FROM {BASE_IMAGE}\nRUN useradd --create-home --uid 10001 runner\nWORKDIR /app\nCOPY requirements.txt bot.py /app/\n{install}\nUSER 10001\nCMD [\"python\", \"-I\", \"/app/bot.py\"]\n"""
        (root / "Dockerfile").write_text(dockerfile, encoding="utf-8")
        image = f"botforge-job:{safe_run_id.lower()}"
        build = subprocess.run(
            ["docker", "build", "--pull=false", "--tag", image, str(root)],
            capture_output=True, text=True, timeout=300, check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if build.returncode != 0:
            return ExecutionResult(build.returncode, (build.stdout + build.stderr)[-MAX_OUTPUT_BYTES:])

        command = [
            "docker", "run", "--name", container_name, "--label", LABEL,
            "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
            "--memory=512m", "--memory-swap=512m", "--cpus=1", "--pids-limit=256",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", image,
        ]
        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        chunks: list[str] = []
        lines: queue.Queue[str | None] = queue.Queue()
        deadline = time.monotonic() + timeout_seconds

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:
                lines.put(line)
            lines.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        timed_out = False
        try:
            while process.poll() is None or reader.is_alive():
                try:
                    line = lines.get(timeout=0.25)
                    if line is not None:
                        chunks.append(line)
                        on_log(line.rstrip()[:2_000])
                        if sum(map(len, chunks)) > MAX_OUTPUT_BYTES:
                            cancel_event.set()
                except queue.Empty:
                    pass
                if time.monotonic() >= deadline:
                    timed_out = True
                    cancel_event.set()
                if cancel_event.is_set():
                    subprocess.run(["docker", "stop", "--time", "5", container_name], capture_output=True, check=False)
                    break
            process.wait(timeout=15)
            reader.join(timeout=2)
            return ExecutionResult(process.returncode or 0, "".join(chunks)[-MAX_OUTPUT_BYTES:], cancel_event.is_set(), timed_out)
        finally:
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, check=False)
            subprocess.run(["docker", "image", "rm", "-f", image], capture_output=True, check=False)
            shutil.rmtree(root, ignore_errors=True)
