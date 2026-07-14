from __future__ import annotations

import asyncio
import time
import urllib.request
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional
from urllib.parse import urlsplit

FREE_PROXY_SOURCES = (
    ("http", "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.txt"),
    ("socks5", "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt"),
)


def normalize_proxy(value: object, protocol: str = "http") -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    return text if "://" in text else f"{protocol}://{text}"


def safe_proxy_label(value: str) -> str:
    parts = urlsplit(value)
    host = parts.hostname or "unknown"
    return f"{parts.scheme or 'proxy'}://{host}:{parts.port}" if parts.port else f"{parts.scheme or 'proxy'}://{host}"


def _download_source(protocol: str, url: str, limit: int) -> list[str]:
    request = urllib.request.Request(url, headers={"User-Agent": "crackbot-agent/1"})
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read(2 * 1024 * 1024).decode("utf-8", errors="ignore")
    values: list[str] = []
    for line in body.splitlines():
        proxy = normalize_proxy(line, protocol)
        if proxy and not line.lstrip().startswith("#"):
            values.append(proxy)
        if len(values) >= limit:
            break
    return values


async def check_proxy(proxy: str, timeout: float = 8.0) -> bool:
    try:
        parts = urlsplit(proxy)
        if not parts.hostname or not parts.port or parts.username or parts.password:
            return False
        reader, writer = await asyncio.wait_for(asyncio.open_connection(parts.hostname, parts.port), timeout)
        if parts.scheme == "socks5":
            writer.write(b"\x05\x01\x00")
            await writer.drain()
            ok = await asyncio.wait_for(reader.readexactly(2), timeout) == b"\x05\x00"
        else:
            writer.write(b"CONNECT 1.1.1.1:80 HTTP/1.1\r\nHost: 1.1.1.1:80\r\n\r\n")
            await writer.drain()
            ok = b" 200 " in await asyncio.wait_for(reader.read(1024), timeout)
        writer.close()
        await writer.wait_closed()
        return ok
    except (OSError, ValueError, asyncio.TimeoutError, asyncio.IncompleteReadError):
        return False


@dataclass(frozen=True)
class ProxySelection:
    proxy: Optional[str]
    source: str


class ProxyService:
    def __init__(self, *, cache_ttl: float = 300, source_limit: int = 80, checker: Callable[[str], Awaitable[bool]] = check_proxy) -> None:
        self.cache_ttl = cache_ttl
        self.source_limit = source_limit
        self.checker = checker
        self._healthy: list[str] = []
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def _free_pool(self) -> list[str]:
        if self._healthy and time.monotonic() < self._expires_at:
            return list(self._healthy)
        async with self._lock:
            if self._healthy and time.monotonic() < self._expires_at:
                return list(self._healthy)
            batches = await asyncio.gather(*(asyncio.to_thread(_download_source, protocol, url, self.source_limit) for protocol, url in FREE_PROXY_SOURCES), return_exceptions=True)
            candidates = [proxy for batch in batches if isinstance(batch, list) for proxy in batch]
            checks = await asyncio.gather(*(self.checker(proxy) for proxy in candidates), return_exceptions=True)
            self._healthy = [proxy for proxy, healthy in zip(candidates, checks) if healthy is True]
            self._expires_at = time.monotonic() + self.cache_ttl
            return list(self._healthy)

    async def select(self, user_proxy: object, *, allow_direct: bool) -> ProxySelection:
        configured = normalize_proxy(user_proxy)
        if configured:
            return ProxySelection(configured, "user")
        pool = await self._free_pool()
        if pool:
            proxy = pool.pop(0)
            self._healthy = pool + [proxy]
            return ProxySelection(proxy, "free")
        if allow_direct:
            return ProxySelection(None, "direct")
        return ProxySelection(None, "unavailable")
