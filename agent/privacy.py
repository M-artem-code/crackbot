from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

EMAIL_PATTERN = re.compile(r"(?i)(?<![\w.+-])([\w.+-]{1,64})@([\w.-]+\.[a-z]{2,})(?![\w.-])")
URL_PATTERN = re.compile(r"https?://[^\s<>'\"]+")


def mask_email(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        local, domain = match.groups()
        visible = local[:1] if local else ""
        return f"{visible}***@{domain}"

    return EMAIL_PATTERN.sub(replace, value)


def safe_url(value: Any) -> str:
    try:
        parts = urlsplit(str(value or ""))
        if not parts.scheme or not parts.netloc:
            return str(value or "")
        query = urlencode([(key, "[REDACTED]") for key, _ in parse_qsl(parts.query, keep_blank_values=True)])
        return urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))
    except ValueError:
        return "[invalid-url]"


def sanitize_text(value: Any) -> str:
    text = mask_email(str(value))
    return URL_PATTERN.sub(lambda match: safe_url(match.group(0)), text)
