#!/usr/bin/env python3

import asyncio
import base64
import json
import os
import random
import secrets
import shutil
import subprocess
import tempfile
import time
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import requests

import nodriver as uc
from nodriver.cdp import page as cdp_page, network as cdp_network, runtime as cdp_runtime

from mail_client import TempMailWorldClient

REF_URL = "https://adflex.ai/register?ref=766a7443"

STEALTH_JS = Path(__file__).parent / "stealth.js"
try:
    STEALTH_SOURCE = STEALTH_JS.read_text(encoding="utf-8")
except Exception:
    STEALTH_SOURCE = ""


async def js(page, code: str) -> str:
    try:
        r = await page.send(cdp_runtime.evaluate(expression=code))
        return getattr(r, 'result', {}).get('value', '')
    except Exception:
        return ''


async def wait_for_inputs(page, min_count=1, timeout=30, interval=0.3):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            els = await page.query_selector_all(
                "input:not([type=hidden]):not([type=submit]):not([type=file])"
            )
            if len(els) >= min_count:
                return True
        except Exception:
            pass
        await asyncio.sleep(interval)
    return False


async def wait_for_button(page, text_fragment, timeout=25, interval=0.5):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            for sel in ("button", "[role='button']", "input[type='submit']", "a[class*='btn']"):
                els = await page.query_selector_all(sel)
                for el in els:
                    try:
                        t = (el.text_all or "").strip().lower()
                        if text_fragment.lower() in t:
                            return el
                    except Exception:
                        continue
        except Exception:
            pass
        await asyncio.sleep(interval)
    return None


async def click_button(page, label, wait_after=3, max_retries=2) -> bool:
    for _ in range(max_retries):
        btn = await wait_for_button(page, label, timeout=10)
        if not btn:
            return False
        try:
            await btn.scroll_into_view()
        except Exception:
            pass
        await asyncio.sleep(0.3)
        try:
            await btn.click()
        except Exception:
            pass
        await asyncio.sleep(wait_after)
        return True
    return False


def generate_profile():
    first_names = ["James","Olivia","Liam","Emma","Noah","Ava","Ethan","Sophia","Mason","Isabella",
                   "Logan","Mia","Lucas","Charlotte","Alexander","Amelia","Elijah","Harper","Oliver","Evelyn",
                   "Daniel","Abigail","Henry","Emily","Jack","Ella","Owen","Avery","Ryan","Scarlett"]
    last_names = ["Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez",
                  "Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee",
                  "Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker"]
    first = random.choice(first_names)
    last = random.choice(last_names)
    passwd = f"{secrets.token_hex(6)}!A1"
    return first, last, passwd


async def fill_form(page, first_name, last_name, email, password):
    result = await js(page, f"""
        (() => {{
            const inputs = [...document.querySelectorAll(
                'input:not([type="hidden"]):not([type="submit"]):not([type="file"]):not([disabled])'
            )];
            const visible = inputs.filter(i => {{
                const r = i.getBoundingClientRect();
                return r.width > 5 && r.height > 5 && r.top >= -50;
            }});
            const textTypes = ['text', 'email', 'password', 'tel', 'search', 'url'];
            const textInputs = visible.filter(i => textTypes.includes(i.type) || i.type === '');
            let idx = 0;
            const values = [
                {json.dumps(first_name)},
                {json.dumps(last_name)},
                {json.dumps(email)},
                {json.dumps(password)},
                {json.dumps(password)},
            ];
            for (const inp of textInputs) {{
                if (idx >= values.length) break;
                const val = values[idx];
                inp.focus(); inp.select();
                try {{
                    const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    ns.call(inp, val);
                }} catch(e) {{ inp.value = val; }}
                inp.dispatchEvent(new Event('input', {{bubbles:true}}));
                inp.dispatchEvent(new Event('change', {{bubbles:true}}));
                inp.dispatchEvent(new Event('blur', {{bubbles:true}}));
                idx++;
            }}
            for (const inp of visible) {{
                if (inp.type === 'checkbox' && !inp.checked) {{
                    inp.click();
                    inp.dispatchEvent(new Event('change', {{bubbles:true}}));
                    break;
                }}
            }}
            return JSON.stringify({{filled: idx, textTotal: textInputs.length, allVisible: visible.length}});
        }})()
    """)
    return result


async def check_page_error(page) -> str:
    text = await js(page, """
        (() => (document.body?.textContent || '').slice(0, 5000))()
    """)
    if not text:
        return ""
    for kw in ["throttlerexception", "too many requests", "429", "rate limit",
               "please wait", "try again later", "blocked", "access denied",
               "failed to fetch"]:
        if kw in text.lower():
            return text[:250].replace("\n", " ")
    return ""


async def check_postsubmit_errors(page, interval=1):
    while True:
        await asyncio.sleep(interval)
        try:
            text = await js(page, """
                (() => (document.body?.textContent || '').slice(0, 5000))()
            """)
            if text:
                log(f"[page check] {text[:200]!r}")
                tl = text.lower()
                if "throttlerexception" in tl:
                    return "throttled"
                if "failed to fetch" in tl:
                    return "failed to fetch"

            found = await js(page, """
                (() => {
                    const walker = document.createTreeWalker(document.body, 4, null, false);
                    let n;
                    while (n = walker.nextNode()) {
                        const t = n.textContent.toLowerCase();
                        if (t.includes('throttlerexception')) return 'throttled';
                        if (t.includes('failed to fetch')) return 'failed_to_fetch';
                    }
                    return '';
                })()
            """)
            if found:
                return found
        except Exception:
            return None


async def wait_for_confirm_email(mail, creds, timeout=120) -> str:
    already_seen = set()
    start = time.time()
    while time.time() - start < timeout:
        try:
            messages = await mail.check_inbox(creds)
            if messages:
                for msg in messages:
                    msg_id = str(msg.get("id", ""))
                    if not msg_id or msg_id in already_seen:
                        continue
                    already_seen.add(msg_id)
                    details = None
                    session = creds.get("session")
                    if session:
                        try:
                            resp = mail._request(session, "GET", f"/api/guestInbox/message/{msg_id}", timeout=15)
                            if resp.ok:
                                details = resp.json()
                        except Exception:
                            pass
                    full_text = str(msg)
                    if details:
                        full_text += " " + str(details)
                    all_urls = re.findall(r'https?://[^\s"\'<>)]+', full_text)
                    for u in all_urls:
                        if "sendgrid.net/ls/click" in u.lower():
                            return u
                    for u in all_urls:
                        ul = u.lower()
                        if "adflex.ai" in ul:
                            path = u.split("adflex.ai")[-1].lower()
                            if any(kw in path for kw in ("confirm", "verify", "token", "auth", "email", "welcome", "signup", "activate", "verif")):
                                return u
                    for u in all_urls:
                        if "adflex.ai" in u.lower():
                            return u
        except Exception:
            pass
        await asyncio.sleep(3)
    return ""


_logfile: str | None = None

def set_logfile(path: str | None):
    global _logfile
    _logfile = path

def log(msg: str):
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if _logfile:
        try:
            with open(_logfile, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception:
            pass


class LocalProxy:
    """Local HTTP forward proxy — Chrome connects here, we add auth and forward to Webshare."""

    def __init__(self, upstream_url: str):
        parsed = urlparse(upstream_url)
        self.upstream_host = parsed.hostname
        self.upstream_port = parsed.port
        auth_str = f"{parsed.username}:{parsed.password}"
        self.proxy_auth = f"Basic {base64.b64encode(auth_str.encode()).decode()}"
        self.server = None
        self.port = 0

    async def start(self):
        self.server = await asyncio.start_server(
            self._handle_client, '127.0.0.1', 0
        )
        self.port = self.server.sockets[0].getsockname()[1]
        log(f"proxy: 127.0.0.1:{self.port} -> {self.upstream_host}:{self.upstream_port}")
        asyncio.create_task(self.server.serve_forever())
        return self.port

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()

    async def _read_request(self, reader):
        """Read full HTTP request: first line + headers."""
        first = await asyncio.wait_for(reader.readuntil(b'\r\n'), timeout=10)
        rest = b''
        while True:
            line = await asyncio.wait_for(reader.readuntil(b'\r\n'), timeout=10)
            rest += line
            if line == b'\r\n':
                break
        return first + rest

    async def _handle_client(self, reader, writer):
        try:
            request = await self._read_request(reader)
        except Exception:
            writer.close()
            return
        first_line = request.split(b'\r\n')[0].decode('utf-8', errors='replace')
        if first_line.startswith('CONNECT '):
            await self._handle_connect(reader, writer, request)
        else:
            await self._handle_http(reader, writer, request)

    async def _handle_connect(self, client_reader, client_writer, request):
        # Inject Proxy-Authorization, forward full request to upstream
        to_upstream = self._inject_auth(request)
        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(self.upstream_host, self.upstream_port),
                timeout=15,
            )
        except Exception:
            client_writer.close()
            return
        remote_writer.write(to_upstream)
        await remote_writer.drain()
        try:
            resp = await asyncio.wait_for(remote_reader.readuntil(b'\r\n\r\n'), timeout=15)
        except Exception:
            client_writer.close()
            remote_writer.close()
            return
        if b'200' not in resp.split(b'\r\n')[0]:
            client_writer.close()
            remote_writer.close()
            return
        client_writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        await client_writer.drain()
        await self._relay(client_reader, client_writer, remote_reader, remote_writer)

    async def _handle_http(self, client_reader, client_writer, request):
        to_upstream = self._inject_auth(request)
        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(self.upstream_host, self.upstream_port),
                timeout=15,
            )
        except Exception:
            client_writer.close()
            return
        remote_writer.write(to_upstream)
        await remote_writer.drain()
        await self._relay(client_reader, client_writer, remote_reader, remote_writer)

    def _inject_auth(self, request: bytes) -> bytes:
        if b'Proxy-Authorization:' in request:
            return request
        # Insert Proxy-Authorization before the final \r\n\r\n
        return request.rstrip(b'\r\n\r\n') + f"\r\nProxy-Authorization: {self.proxy_auth}\r\n\r\n".encode()

    async def _relay(self, r1, w1, r2, w2):
        async def forward(r, w):
            try:
                while True:
                    data = await r.read(65536)
                    if not data:
                        break
                    w.write(data)
                    await w.drain()
            except Exception:
                pass
            try:
                w.close()
            except Exception:
                pass
        await asyncio.gather(forward(r1, w2), forward(r2, w1))


FREE_HTTP_URL = "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.txt"
FREE_SOCKS5_URL = "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt"


def _fetch_free_list(url, protocol="http"):
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
    except Exception:
        return []
    proxies = []
    for raw in r.text.split("\n"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if any(line.startswith(p) for p in ("http://", "https://", "socks5://", "socks4://")):
            proxies.append(line)
        elif ":" in line:
            proxies.append(f"{protocol}://{line}")
    return proxies


async def _test_http_proxy(proxy_url: str) -> bool:
    try:
        raw = proxy_url.replace("http://", "")
        host, port = raw.rsplit(":", 1)
        r, w = await asyncio.wait_for(asyncio.open_connection(host, int(port)), timeout=8)
        w.write(b"CONNECT 1.1.1.1:80 HTTP/1.1\r\nHost: 1.1.1.1:80\r\n\r\n")
        await w.drain()
        resp = await asyncio.wait_for(r.read(1024), timeout=8)
        w.close()
        return b"200" in resp
    except Exception:
        return False


async def _test_socks5_proxy(proxy_url: str) -> bool:
    try:
        raw = proxy_url.replace("socks5://", "")
        host, port = raw.rsplit(":", 1)
        r, w = await asyncio.wait_for(asyncio.open_connection(host, int(port)), timeout=8)
        w.write(b'\x05\x01\x00')
        await w.drain()
        resp = await asyncio.wait_for(r.read(2), timeout=8)
        if resp != b'\x05\x00':
            w.close()
            return False
        w.write(b'\x05\x01\x00\x01' + b'\x01\x01\x01\x01' + (80).to_bytes(2, 'big'))
        await w.drain()
        resp = await asyncio.wait_for(r.read(10), timeout=8)
        w.close()
        return len(resp) >= 2 and resp[1] == 0
    except Exception:
        return False


async def fetch_working_free_proxies() -> list:
    try:
        loop = asyncio.get_event_loop()
        http_urls, socks5_urls = await asyncio.gather(
            loop.run_in_executor(None, lambda: _fetch_free_list(FREE_HTTP_URL, "http")),
            loop.run_in_executor(None, lambda: _fetch_free_list(FREE_SOCKS5_URL, "socks5")),
            return_exceptions=True,
        )
        http_urls = http_urls if isinstance(http_urls, list) else []
        socks5_urls = socks5_urls if isinstance(socks5_urls, list) else []

        log(f"free proxies: testing CONNECT {len(http_urls)} + SOCKS5 {len(socks5_urls)}...")

        http_tasks = [_test_http_proxy(u) for u in http_urls]
        socks5_tasks = [_test_socks5_proxy(u) for u in socks5_urls]

        results = await asyncio.gather(*http_tasks, *socks5_tasks, return_exceptions=True)
        http_ok = [u for u, ok in zip(http_urls, results[:len(http_urls)]) if ok is True]
        socks5_ok = [u for u, ok in zip(socks5_urls, results[len(http_urls):]) if ok is True]

        total = http_ok + socks5_ok
        log(f"free proxies: HTTP {len(http_ok)}/{len(http_urls)} + SOCKS5 {len(socks5_ok)}/{len(socks5_urls)} = {len(total)} working")
        return total
    except Exception as e:
        log(f"free proxies error: {e}")
        return []


async def run_once(ref_url: str, proxy: str | None = None, logfile: str | None = None) -> str:
    if logfile:
        set_logfile(logfile)
    start = time.time()
    mail = TempMailWorldClient(log_func=lambda msg: log(f"mail: {msg}"))

    # free proxies → mail goes direct (requests fails through many free proxies)
    mail_proxy = proxy if (proxy and urlparse(proxy).username) else None
    email_task = asyncio.create_task(mail.create_email(proxy=mail_proxy))

    local_proxy = None
    profile_dir = tempfile.mkdtemp(suffix="_turbo")
    browser = None
    try:
        pw = random.choice([700])
        ph = random.choice([900])
        browser_args = [
            f"--user-data-dir={profile_dir}",
            "--no-first-run", "--no-default-browser-check",
            f"--window-size={pw},{ph}",
            "--window-position=0,0",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
        ]
        if proxy:
            if proxy.startswith("socks5://"):
                browser_args.append(f"--proxy-server={proxy}")
            elif urlparse(proxy).username:
                local_proxy = LocalProxy(proxy)
                local_port = await local_proxy.start()
                browser_args.append(f"--proxy-server=http://127.0.0.1:{local_port}")
            else:
                browser_args.append(f"--proxy-server={proxy}")
        browser = await uc.start(browser_args=browser_args)
        chrome_pid = browser._process.pid if browser._process else None
        try:
            page = await asyncio.wait_for(browser.get(ref_url, new_tab=False), timeout=30)
        except asyncio.TimeoutError:
            log("FAIL: browser.get() timeout 30s — proxy too slow")
            return "proxy dead"

        if STEALTH_SOURCE:
            try:
                await js(page, STEALTH_SOURCE)
            except Exception:
                pass

        try:
            await page.send(cdp_network.set_blocked_urls(urls=[
                "*perimeterx*", "*px-cdn*", "*captcha*",
                "*humansecurity*", "*pxhsk*",
                "*doubleclick*", "*googleadservices*",
                "*google-analytics*", "*googletagmanager*", "*facebook*",
                "*.woff*", "*.woff2*", "*.ttf*", "*.eot*",
            ]))
        except Exception:
            pass

        log("page opened, waiting for form + email...")

        form_task = asyncio.create_task(wait_for_inputs(page, min_count=3, timeout=120))

        done, pending = await asyncio.wait(
            [email_task, form_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        if email_task in done:
            email, creds = email_task.result()
            if not email:
                for t in pending:
                    t.cancel()
                if proxy:
                    log("FAIL: proxy dead — mail failed")
                    return "proxy dead"
                log("FAIL: no email")
                return "no email"
            await asyncio.wait([form_task])
        else:
            email, creds = await email_task
            if not email:
                for t in pending:
                    t.cancel()
                if proxy:
                    log("FAIL: proxy dead — mail failed")
                    return "proxy dead"
                log("FAIL: no email")
                return "no email"

        form_ok = form_task.result()
        if not form_ok:
            err = await check_page_error(page)
            if err:
                log(f"FAIL: page error — {err[:80]}")
                return f"blocked: {err[:60]}"
            log("FAIL: form not found")
            return "no form"

        log(f"email: {email} — filling form...")
        first_name, last_name, password = generate_profile()
        await fill_form(page, first_name, last_name, email, password)
        log(f"filled: {first_name} {last_name}")

        await asyncio.sleep(random.uniform(1, 3))

        log("submit...")
        ok = await click_button(page, "create account", wait_after=5)
        if not ok:
            ok = await click_button(page, "register", wait_after=5)
        if not ok:
            ok = await click_button(page, "continue", wait_after=5)
        if not ok:
            log("FAIL: no submit button")
            return "no submit btn"

        err = await check_page_error(page)
        if err:
            log(f"FAIL: throttled — {err[:80]}")
            return f"throttled: {err[:60]}"

        log("submitted, waiting for confirmation email (15s)...")
        confirm_url = await wait_for_confirm_email(mail, creds, timeout=15)
        if not confirm_url:
            log("FAIL: no confirmation email — moving on")
            return "no confirm email"

        log(f"confirmation link received, navigating...")
        await page.send(cdp_page.navigate(url=confirm_url))
        await asyncio.sleep(8)

        dur = time.time() - start
        log(f"SUCCESS ({dur:.0f}s)")
        return "success"

    except asyncio.CancelledError:
        log("cancelled")
        return "cancelled"
    except Exception as e:
        log(f"error: {e}")
        return f"error: {str(e)[:80]}"
    finally:
        if local_proxy:
            try:
                local_proxy.server.close()
            except Exception:
                pass
        if chrome_pid:
            try:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(chrome_pid)], capture_output=True, timeout=5)
            except Exception:
                pass
        try:
            subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True, timeout=5)
        except Exception:
            pass
        try:
            shutil.rmtree(profile_dir, ignore_errors=True)
        except Exception:
            pass


PROXY_POOL_FILE = Path(__file__).parent / "proxy_pool.txt"

def load_proxy_pool():
    pool = ["DIRECT"]
    try:
        with open(PROXY_POOL_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    pool.append(line)
    except FileNotFoundError:
        pass
    return pool

_base_pool = load_proxy_pool()
_free_pool: list[str] = []
_proxy_pool = _base_pool + _free_pool
_proxy_index = 0


async def main():
    global _proxy_index

    raw = _proxy_pool[_proxy_index % len(_proxy_pool)]
    _proxy_index += 1
    proxy = None if raw == "DIRECT" else raw

    log(f"TURBO — {REF_URL}" + ("  proxy: OFF" if not proxy else f"  proxy: ON"))
    result = await run_once(REF_URL, proxy=proxy)
    log(f"result: {result}")
    await asyncio.sleep(2)


if __name__ == "__main__":
    free = asyncio.run(fetch_working_free_proxies())
    if free:
        _free_pool = free
        _proxy_pool = _base_pool + _free_pool
        log(f"total pool: {len(_proxy_pool)} proxies ({len(_free_pool)} free)")

    while True:
        try:
            asyncio.run(main())
        except Exception as e:
            import traceback
            traceback.print_exc()
            time.sleep(3)
