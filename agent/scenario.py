"""Строгая модель Scenario DSL v1 без выполнения произвольного кода."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional

SCENARIO_VERSION = 1
STEP_TYPES = {
    "navigate", "fill", "click", "waitForElement", "waitForEmail",
    "extractOtp", "fillOtp", "assertText", "assertVisible", "assertUrl",
    "screenshot",
}
LOCATOR_KINDS = {"role", "label", "placeholder", "testId", "text", "css"}
LOCATOR_STEPS = {"fill", "click", "waitForElement", "fillOtp", "assertVisible"}
VARIABLE_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")
SECRET_KEYS = {"password", "otp", "token", "cookie", "secret", "authorization"}


class ScenarioValidationError(ValueError):
    pass


@dataclass(frozen=True)
class LocatorStrategy:
    kind: str
    value: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    exact: bool = False


@dataclass(frozen=True)
class ScenarioStep:
    id: str
    name: str
    type: str
    timeout_ms: int = 15_000
    max_attempts: int = 1
    retry_delay_ms: int = 0
    continue_on_error: bool = False
    enabled: bool = True
    secret: bool = False
    url: Optional[str] = None
    value: Optional[str] = None
    locator: List[LocatorStrategy] = field(default_factory=list)
    file_name: Optional[str] = None


@dataclass(frozen=True)
class ScenarioDefinition:
    version: int
    name: str
    variables: Dict[str, str]
    steps: List[ScenarioStep]


def _required_string(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ScenarioValidationError(f"{path} обязателен")
    return value.strip()


def _parse_locator(raw: Any, path: str) -> List[LocatorStrategy]:
    if not isinstance(raw, dict) or not isinstance(raw.get("strategies"), list) or not raw["strategies"]:
        raise ScenarioValidationError(f"{path}.strategies должен содержать хотя бы одну стратегию")
    result: List[LocatorStrategy] = []
    for index, item in enumerate(raw["strategies"]):
        item_path = f"{path}.strategies[{index}]"
        if not isinstance(item, dict) or item.get("kind") not in LOCATOR_KINDS:
            raise ScenarioValidationError(f"{item_path}.kind не поддерживается")
        kind = item["kind"]
        if kind == "role":
            role = _required_string(item.get("role"), f"{item_path}.role")
            name = _required_string(item.get("name"), f"{item_path}.name")
            result.append(LocatorStrategy(kind=kind, role=role, name=name, exact=bool(item.get("exact"))))
        else:
            result.append(LocatorStrategy(
                kind=kind,
                value=_required_string(item.get("value"), f"{item_path}.value"),
                exact=bool(item.get("exact")),
            ))
    return result


def parse_scenario(raw: Any) -> ScenarioDefinition:
    if not isinstance(raw, dict):
        raise ScenarioValidationError("Сценарий должен быть объектом")
    if raw.get("version") != SCENARIO_VERSION:
        raise ScenarioValidationError(f"Поддерживается только версия {SCENARIO_VERSION}")
    name = _required_string(raw.get("name"), "name")
    variables_raw = raw.get("variables") or {}
    if not isinstance(variables_raw, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in variables_raw.items()):
        raise ScenarioValidationError("variables должен быть объектом строк")
    steps_raw = raw.get("steps")
    if not isinstance(steps_raw, list) or not steps_raw:
        raise ScenarioValidationError("steps должен содержать хотя бы один шаг")

    ids = set()
    steps: List[ScenarioStep] = []
    for index, item in enumerate(steps_raw):
        path = f"steps[{index}]"
        if not isinstance(item, dict):
            raise ScenarioValidationError(f"{path} должен быть объектом")
        step_id = _required_string(item.get("id"), f"{path}.id")
        if step_id in ids:
            raise ScenarioValidationError(f"{path}.id должен быть уникальным")
        ids.add(step_id)
        step_type = item.get("type")
        if step_type not in STEP_TYPES:
            raise ScenarioValidationError(f"{path}.type не поддерживается")
        timeout_ms = item.get("timeoutMs", 15_000)
        if not isinstance(timeout_ms, int) or not 100 <= timeout_ms <= 300_000:
            raise ScenarioValidationError(f"{path}.timeoutMs должен быть от 100 до 300000")
        retry = item.get("retry") or {}
        max_attempts = retry.get("maxAttempts", 1)
        retry_delay_ms = retry.get("delayMs", 0)
        if not isinstance(max_attempts, int) or not 1 <= max_attempts <= 5:
            raise ScenarioValidationError(f"{path}.retry.maxAttempts должен быть от 1 до 5")
        if not isinstance(retry_delay_ms, int) or not 0 <= retry_delay_ms <= 30_000:
            raise ScenarioValidationError(f"{path}.retry.delayMs должен быть от 0 до 30000")
        locator = _parse_locator(item.get("locator"), f"{path}.locator") if step_type in LOCATOR_STEPS else []
        url = item.get("url")
        value = item.get("value")
        if step_type == "navigate":
            url = _required_string(url, f"{path}.url")
        if step_type in {"fill", "assertText", "assertUrl"} and not isinstance(value, str):
            raise ScenarioValidationError(f"{path}.value обязателен для {step_type}")
        steps.append(ScenarioStep(
            id=step_id,
            name=_required_string(item.get("name"), f"{path}.name"),
            type=step_type,
            timeout_ms=timeout_ms,
            max_attempts=max_attempts,
            retry_delay_ms=retry_delay_ms,
            continue_on_error=bool(item.get("continueOnError")),
            enabled=item.get("enabled", True) is not False,
            secret=bool(item.get("secret")),
            url=url,
            value=value,
            locator=locator,
            file_name=item.get("fileName") if isinstance(item.get("fileName"), str) else None,
        ))
    return ScenarioDefinition(version=SCENARIO_VERSION, name=name, variables=dict(variables_raw), steps=steps)


def resolve_value(value: Optional[str], variables: Mapping[str, str]) -> str:
    if value is None:
        return ""

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in variables:
            raise KeyError(f"Переменная '{key}' не определена")
        return str(variables[key])

    return VARIABLE_RE.sub(replace, value)


def redact_text(value: Any, secrets: Mapping[str, str]) -> str:
    text = str(value)
    for key, secret in secrets.items():
        if secret and (key.lower() in SECRET_KEYS or len(secret) >= 4):
            text = text.replace(secret, "[REDACTED]")
    text = re.sub(r"(?i)(password|otp|token|authorization|cookie)(\s*[:=]\s*)\S+", r"\1\2[REDACTED]", text)
    return text
