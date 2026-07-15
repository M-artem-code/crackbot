"""Сбор безопасных локальных артефактов прогона перед приватной загрузкой."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

SENSITIVE_ATTRIBUTES = re.compile(
    r'(?i)(value|authorization|cookie|set-cookie|token|secret|password|otp|code)=("[^"]*"|\'[^\']*\'|[^\s>]+)'
)
SENSITIVE_JSON_KEYS = re.compile(r"(?i)(password|passphrase|otp|code|token|secret|cookie|authorization)")


def redact_dom(html: str, secrets: Dict[str, str]) -> str:
    """Удаляет значения чувствительных атрибутов и известные секреты из DOM."""
    safe = SENSITIVE_ATTRIBUTES.sub(lambda match: f'{match.group(1)}="[REDACTED]"', html)
    for secret in sorted((value for value in secrets.values() if value), key=len, reverse=True):
        safe = safe.replace(secret, "[REDACTED]")
    return safe


def redact_json(value: Any, secrets: Dict[str, str]) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if SENSITIVE_JSON_KEYS.search(str(key)) else redact_json(item, secrets)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_json(item, secrets) for item in value]
    if isinstance(value, str):
        safe = value
        for secret in sorted((item for item in secrets.values() if item), key=len, reverse=True):
            safe = safe.replace(secret, "[REDACTED]")
        return safe
    return value


@dataclass
class PendingArtifact:
    path: Path
    kind: str
    content_type: str
    worker: int
    step_id: Optional[str] = None
    redacted: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


class ArtifactCollector:
    def __init__(self, root: str, run_id: str, worker: int, secrets: Dict[str, str]):
        self.directory = Path(root) / run_id / f"worker-{worker}"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.worker = worker
        self.secrets = secrets
        self.items: List[PendingArtifact] = []

    def add_existing(
        self,
        path: Path,
        kind: str,
        content_type: str,
        *,
        step_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PendingArtifact:
        artifact = PendingArtifact(
            path=path,
            kind=kind,
            content_type=content_type,
            worker=self.worker,
            step_id=step_id,
            metadata=redact_json(metadata or {}, self.secrets),
        )
        self.items.append(artifact)
        return artifact

    def write_dom(self, html: str, step_id: str, metadata: Optional[Dict[str, Any]] = None) -> PendingArtifact:
        path = self.directory / f"{step_id}-dom.html"
        path.write_text(redact_dom(html, self.secrets), encoding="utf-8")
        return self.add_existing(path, "dom", "text/html; charset=utf-8", step_id=step_id, metadata=metadata)

    def write_report(self, report: Dict[str, Any]) -> PendingArtifact:
        path = self.directory / "report.json"
        safe = redact_json(report, self.secrets)
        path.write_text(json.dumps(safe, ensure_ascii=False, indent=2), encoding="utf-8")
        return self.add_existing(path, "report", "application/json", metadata={"formatVersion": 1})
