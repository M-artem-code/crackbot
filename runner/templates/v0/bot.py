#!/usr/bin/env python3
"""v0 Registration Bot — Console v2 with RefPool and Rich Live Dashboard"""

import asyncio
import json
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import nodriver as uc
from nodriver.cdp import input_ as cdp_input, page as cdp_page, network as cdp_network, runtime as cdp_runtime
from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.columns import Columns
from rich.text import Text
from rich.layout import Layout
from rich.table import Table

from mail_client import TempMailWorldClient
from ref_pool import RefPool, SUCCESS_LIMIT

BLOCKED_RESOURCES = [
    "*perimeterx*", "*px-cdn*", "*captcha*",
    "*humansecurity*", "*pxhsk*",
    "*doubleclick*", "*googleadservices*",
    "*google-analytics*", "*googletagmanager*", "*facebook*",
    "*.woff*", "*.woff2*", "*.ttf*", "*.eot*",
    "*.png*", "*.jpg*", "*.jpeg*", "*.gif*", "*.svg*", "*.webp*", "*.ico*",
]

RESULTS_FILE = Path(__file__).parent / "results.jsonl"

LOCATION_FREEZE = """
(() => {
    let locked = true;
    const desc = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
        get() { return desc.get.call(window); },
        set(v) {
            if (locked && typeof v === 'string' && v.startsWith('https://vercel.com/signup/v0')) {
                locked = false;
            }
            desc.set.call(window, v);
        }
    });
    setTimeout(() => { locked = false; }, 5000);
})();
"""

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

console = Console()
pool = RefPool()
pool_lock = asyncio.Lock()


def cleanup_temp_dirs():
    temp = Path(tempfile.gettempdir())
    count = 0
    for item in temp.iterdir():
        if not item.is_dir():
            continue
        name = item.name
        if name.startswith("tmp") and "_w" in name or name.startswith("uc_"):
            try:
                shutil.rmtree(item, ignore_errors=True)
                count += 1
            except:
                pass
    if count:
        console.print(f"  [dim]🧹 Зачищено {count} старых папок[/dim]")


@dataclass
class WorkerState:
    worker_id: int
    status: str = "idle"
    email: str = ""
    duration: float = 0.0
    ref: str = ""
    reason: str = ""
    started_at: float = 0.0


class DashboardState:
    def __init__(self):
        self.workers: dict[int, WorkerState] = {}
        self._lock = asyncio.Lock()
        self.start_time = time.time()
        self.total_success = 0
        self.total_failed = 0
        self.total_duration = 0.0

    async def set_worker(self, wid: int, ws: WorkerState):
        async with self._lock:
            self.workers[wid] = ws


def write_result(email: str, status: str, duration: float, ref: str, reason: str | None = None):
    data = {
        "email": email,
        "status": status,
        "duration": round(duration, 1),
        "ref": ref,
    }
    if reason:
        data["reason"] = reason
    try:
        with open(RESULTS_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[results] write error: {e}")


def kill_chrome_processes():
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True, timeout=5)
            subprocess.run(["taskkill", "/F", "/IM", "chromedriver.exe"], capture_output=True, timeout=5)
    except:
        pass


async def insert_text(page, text: str):
    await page.send(cdp_input.insert_text(text=text))


async def focus_tab(page):
    try:
        await page.send(cdp_page.bring_to_front())
        await asyncio.sleep(0.3)
    except:
        pass


async def wait_for(check_func, timeout=10, interval=0.5):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        try:
            r = check_func()
            if asyncio.iscoroutine(r):
                r = await r
            if r:
                return r
        except:
            pass
        await asyncio.sleep(interval)
    return None


async def do_with_verify(label, step_name, do_func, verify_func, retries=3, timeout=10):
    for attempt in range(1, retries + 1):
        try:
            await do_func()
        except Exception as e:
            pass
        ok = await wait_for(verify_func, timeout)
        if ok:
            return True
    return False


async def find_accept_button(page):
    for method in ("find", "query_all"):
        try:
            if method == "find":
                btn = await page.find("Accept and Continue", best_match=True)
                if btn:
                    return btn
            else:
                for b in await page.query_selector_all("button, [role='button']"):
                    try:
                        t = (b.text_all or "").lower()
                        if "accept" in t and "continue" in t:
                            return b
                    except:
                        pass
        except:
            pass
    return None


def format_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m}m"
    elif m:
        return f"{m}m {s}s"
    return f"{s}s"


async def run_one(page, mail, ref_url: str, label: str) -> dict:
    """Run one registration cycle. Returns dict with status/email/reason/duration."""
    start = time.time()
    email_used = ""
    result_status = "failed"
    result_reason = "unknown"

    email_task = asyncio.create_task(mail.create_email())
    await page.send(cdp_page.navigate(url=ref_url))

    email, creds = await email_task
    if not email:
        return {"status": "failed", "email": "", "reason": "no email", "duration": time.time() - start}
    email_used = email

    async def _page_ready():
        try:
            r = await page.send(cdp_runtime.evaluate(expression="document.readyState"))
            return getattr(r, 'result', {}).get('value') == 'complete'
        except:
            return False
    await wait_for(_page_ready, timeout=20, interval=0.3)

    for attempt in range(1, 6):
        if attempt > 1:
            await asyncio.sleep(3)

        await focus_tab(page)

        inp = await wait_for(
            lambda: page.query_selector(
                "input[aria-label='Email Address'], "
                "input[type='email'], input[name='email'], "
                "input[aria-label*='email' i], input[placeholder*='email' i]"
            ),
            timeout=15, interval=0.5,
        )
        if not inp:
            return {"status": "failed", "email": email_used, "reason": "input not found", "duration": time.time() - start}

        try:
            for _ in range(random.randint(3, 6)):
                await page.send(cdp_input.dispatch_mouse_event(
                    type_="mouseMoved",
                    x=random.randint(100, 700),
                    y=random.randint(100, 500),
                ))
                await asyncio.sleep(random.uniform(0.1, 0.3))
        except:
            pass

        await page.send(cdp_runtime.evaluate(expression=f"""
            (() => {{
                const sels = ['input[aria-label="Email Address"]','input[type="email"]','input[name="email"]'];
                let el;
                for (const s of sels) {{ el = document.querySelector(s); if (el) break; }}
                if (!el) return;
                el.focus(); el.select();
                try {{ const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; ns.call(el,{json.dumps(email)}); }}
                catch(e) {{ el.value = {json.dumps(email)}; }}
                el.dispatchEvent(new Event('input', {{bubbles:true}}));
                el.dispatchEvent(new Event('change', {{bubbles:true}}));
            }})()
        """))
        await asyncio.sleep(0.3)

        await page.send(cdp_runtime.evaluate(expression="""
            (() => {
                const btn = Array.from(document.querySelectorAll('button'))
                    .find(b => { const t = b.textContent.toLowerCase(); return t.includes('continue') || t.includes('sign up') || t.includes('submit'); });
                if (btn) btn.click();
            })()
        """))

        await asyncio.sleep(2)
        url_after = page.url or ""
        if "/ref/" in url_after:
            continue

        await asyncio.sleep(5)
        page_html = await page.get_content() or ""
        if "You just made an attempt" in page_html:
            await asyncio.sleep(30)
            page_html = await page.get_content() or ""
        if "/ref/" in page_html:
            continue

        code_ok = False
        deadline = asyncio.get_event_loop().time() + 15
        while asyncio.get_event_loop().time() < deadline:
            try:
                ci = await page.query_selector("input[autocomplete='one-time-code'], input[inputmode='numeric']")
                if ci:
                    code_ok = True
                    break
            except:
                pass
            await asyncio.sleep(0.5)

        if code_ok:
            break
    else:
        return {"status": "failed", "email": email_used, "reason": "continue rejected 5x", "duration": time.time() - start}

    code = await mail.wait_for_code(creds, timeout=135)
    if not code:
        return {"status": "failed", "email": email_used, "reason": "no code", "duration": time.time() - start}

    await focus_tab(page)

    async def _insert_code():
        inp = await page.query_selector("input[autocomplete='one-time-code'], input[inputmode='numeric']")
        if inp:
            await inp.focus()
            await asyncio.sleep(0.2)
            await insert_text(page, code)
        else:
            digits = await page.query_selector_all("input:not([type='hidden']):not([disabled])")
            targets = [d for d in digits if hasattr(d, 'node_type') and d.node_type == 1][-6:]
            if len(targets) >= 6:
                for i, d in enumerate(targets):
                    await d.focus()
                    await insert_text(page, code[i])
                    await asyncio.sleep(0.1)
            else:
                raise Exception("no code input found")

    ok = await do_with_verify(label, "insert code", _insert_code, lambda: True, timeout=1)
    if not ok:
        return {"status": "failed", "email": email_used, "reason": "code insert failed", "duration": time.time() - start}

    await asyncio.sleep(2)
    await focus_tab(page)

    async def _click_verify():
        for t in ("Verify", "Submit", "Continue", "Log in", "Sign in"):
            btn = await page.find(t, best_match=True)
            if btn:
                await btn.click()
                return
        raise Exception("verify btn not found")

    async def _verify_login():
        try:
            url = page.url or ""
            return bool(url.startswith("https://v0.app/") and "/ref/" not in url)
        except:
            return False

    ok = await do_with_verify(label, "click Verify", _click_verify, _verify_login, timeout=20, retries=3)
    if not ok:
        return {"status": "failed", "email": email_used, "reason": "no login redirect", "duration": time.time() - start}

    await focus_tab(page)
    for accept_attempt in range(1, 4):
        await focus_tab(page)
        btn = await find_accept_button(page)
        if not btn:
            await asyncio.sleep(3)
            continue
        try:
            await btn.scroll_into_view()
        except:
            pass
        await asyncio.sleep(0.5)
        await btn.click()
        await asyncio.sleep(5)
        return {"status": "success", "email": email_used, "reason": None, "duration": time.time() - start}

    return {"status": "failed", "email": email_used, "reason": "accept modal never appeared", "duration": time.time() - start}


async def worker(worker_id: int, ref_url: str, state: DashboardState, batch_id: float | None = None, proxy: str | None = None):
    label = f"[W{worker_id}]"
    browser = None
    profile_dir = None
    mail = TempMailWorldClient(log_func=lambda msg: None)

    ws = WorkerState(worker_id=worker_id, status="busy", ref=ref_url, started_at=time.time())
    await state.set_worker(worker_id, ws)

    try:
        profile_dir = tempfile.mkdtemp(suffix=f"_w{worker_id}")
        browser_args = [
            f"--user-data-dir={profile_dir}",
            f"--remote-debugging-port={9200 + worker_id}",
            "--no-first-run",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--blink-settings=imagesEnabled=false",
        ]
        if proxy:
            browser_args.append(f"--proxy-server={proxy}")
        browser = await uc.start(browser_args=browser_args)
        page = await browser.get("about:blank", new_tab=False)

        try:
            await page.send(cdp_network.set_blocked_urls(urls=BLOCKED_RESOURCES))
        except:
            pass
        try:
            await page.send(cdp_page.add_script_to_evaluate_on_new_document(source=LOCATION_FREEZE))
        except:
            pass

        try:
            result = await asyncio.wait_for(run_one(page, mail, ref_url, label), timeout=130)
        except asyncio.TimeoutError:
            result = {"status": "failed", "email": "", "reason": "таймаут 130с", "duration": 130}

    except Exception as e:
        result = {"status": "failed", "email": "", "reason": str(e), "duration": 0}
    finally:
        if browser:
            try: browser.stop()
            except: pass
            try:
                temp = Path(tempfile.gettempdir())
                for item in temp.iterdir():
                    if item.is_dir() and (item.name.startswith("chrome_chrome_BITS_") or item.name.startswith("uc_")):
                        shutil.rmtree(item, ignore_errors=True)
            except:
                pass
        if profile_dir:
            try: shutil.rmtree(profile_dir, ignore_errors=True)
            except: pass

        dur = result.get("duration", 0)

        async with pool_lock:
            pool.record_result_by_url(ref_url, result["status"], dur, batch_id=batch_id)
            pool.advance_if_needed()

        write_result(result.get("email", ""), result["status"], dur, ref_url, result.get("reason"))

        ws.status = result["status"]
        ws.email = result.get("email", "")
        ws.duration = dur
        ws.reason = result.get("reason", "")
        await state.set_worker(worker_id, ws)

        async with state._lock:
            if result["status"] == "success":
                state.total_success += 1
                state.total_duration += dur
            else:
                state.total_failed += 1

    return result


def make_dashboard(state: DashboardState, ref_url: str, start_time: float):
    elapsed = format_time(time.time() - start_time)

    active_idx = pool.data["active_index"]
    total_links = len(pool.data["links"])
    done_links = sum(1 for l in pool.data["links"] if l["status"] == "done")
    ref_short = ref_url.split("/")[-1][:8] if ref_url else "—"
    avg_time = f"{state.total_duration / state.total_success:.1f}с" if state.total_success else "—"

    header = (
        f"Воркеры: {len(state.workers)}  |  "
        f"Реф: #{active_idx + 1} {ref_short}  |  "
        f"Пул: {done_links}/{total_links} готово  |  "
        f"Заход: {state.total_success} ✅ {state.total_failed} ❌  |  "
        f"Среднее: {avg_time}  |  "
        f"В работе: {elapsed}"
    )

    wids = sorted(state.workers.keys())
    workers_section = "\n".join(
        f"  W{ws.worker_id:<2} {'🔄' if ws.status=='busy' else '✅' if ws.status=='success' else '❌' if ws.status=='failed' else '⏳'} "
        f"{'работа' if ws.status=='busy' else 'готово' if ws.status=='success' else 'провал' if ws.status=='failed' else 'ждет':<7} "
        f"{ws.email:<20} "
        f"{f'{ws.duration:.1f}с' if ws.duration and ws.status!='busy' else '—':>6}"
        for wid in wids
        for ws in [state.workers[wid]]
    ) if wids else "  (воркеры стартуют...)"

    cards = []
    for i, link in enumerate(pool.data["links"]):
        border = "green" if link["status"] == "done" else "yellow" if link["status"] == "active" else "grey35"
        code = link["url"].split("/")[-1][:8]
        s = link["success"]
        f_str = f"[red] ❌{link['failed']}[/red]" if link["failed"] else ""
        total_str = format_time(link["total_time"]) if link["total_time"] else "—"
        avg = f"⏱{link['avg_time']:.1f}с" if link["avg_time"] else "—"
        content = f"[bold]{code}[/bold]\n{s}/{SUCCESS_LIMIT}{f_str}\n[dim]∑ {total_str}[/dim]\n[dim]{avg}[/dim]"
        cards.append(Panel(content, border_style=border, width=16, padding=(0, 1)))

    pool_section = Columns(cards, equal=True, expand=True)

    top_height = min(len([w for w in state.workers.values() if w.status != "idle"]) + 8, 18)
    layout = Layout()
    layout.split_column(
        Layout(
            Panel(Text(f"{header}\n\n{workers_section}"), border_style="green", title="🔥 v0 Registration Bot"),
            size=top_height,
        ),
        Layout(
            Panel(pool_section, border_style="green", title="📦 Пул рефок"),
        ),
    )
    return layout


async def console_setup() -> int | None:
    console.clear()
    console.print(Panel.fit(
        "[bold]🔥 v0 Registration Bot — Console v2[/bold]\n"
        "Авто-рега на v0.app с управлением пулом рефок.\n"
        "Ctrl+C — остановка.",
        border_style="green",
    ))

    if not pool.data["links"]:
        console.print("\n[yellow]Нет реф ссылок! Добавьте:[/yellow]")
        console.print("Каждая с новой строки, пустая строка = конец:\n")
        urls = []
        while True:
            line = input("  > ").strip()
            if not line:
                break
            urls.append(line)
        if urls:
            pool.add_links(urls)
            console.print(f"\n[green]✅ Добавлено {len(urls)} ссылок[/green]")
        else:
            console.print("[red]Нет ссылок. Выход.[/red]")
            return None
    else:
        console.print(f"\n{pool.stats_string()}\n")
        console.print("[yellow]Меню:[/yellow]")
        console.print("  1 — Запустить регистрацию")
        console.print("  2 — Добавить ссылки")
        console.print("  3 — Сбросить счетчики")
        console.print("  4 — Выход")
        choice = input("\nВыбор [1]: ").strip() or "1"

        if choice == "2":
            console.print("\nКаждая с новой строки, пустая строка = конец:\n")
            urls = []
            while True:
                line = input("  > ").strip()
                if not line:
                    break
                urls.append(line)
            if urls:
                pool.add_links(urls)
                console.print(f"\n[green]✅ Добавлено {len(urls)} ссылок[/green]")
            return await console_setup()

        elif choice == "3":
            pool.reset()
            console.print("[green]✅ Счетчики сброшены[/green]")
            return await console_setup()

        elif choice == "4":
            return None

    workers_input = input(f"\n👥 Воркеры [2]: ").strip()
    workers = int(workers_input) if workers_input.isdigit() else 2
    workers = max(1, min(20, workers))

    return workers


async def main():
    # Clean up stale nodriver profiles
    for d in Path(tempfile.gettempdir()).glob("uc_*"):
        shutil.rmtree(d, ignore_errors=True)
    kill_chrome_processes()

    cleanup_temp_dirs()

    workers_count = await console_setup()
    if workers_count is None:
        return

    start_time = time.time()
    all_success = 0
    all_failed = 0

    while True:
        async with pool_lock:
            ref_url = pool.current_url()
            if ref_url is None:
                break

        state = DashboardState()
        batch_id = time.time()
        tasks = [asyncio.create_task(worker(i + 1, ref_url, state, batch_id)) for i in range(workers_count)]

        try:
            with Live(console=console, screen=True, refresh_per_second=4) as live:
                while not all(t.done() for t in tasks):
                    live.update(make_dashboard(state, ref_url, start_time))
                    await asyncio.sleep(0.25)
                live.update(make_dashboard(state, ref_url, start_time))

            await asyncio.gather(*tasks, return_exceptions=True)
        except KeyboardInterrupt:
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            console.print("\n[yellow]Остановлено.[/yellow]")
            return

        all_success += state.total_success
        all_failed += state.total_failed

    console.clear()
    elapsed = format_time(time.time() - start_time)
    total = all_success + all_failed
    rate = f"{all_success / total * 100:.1f}%" if total else "—"
    console.print(Panel.fit(
        f"[bold green]✅ Все рефки обработаны![/bold green]\n\n"
        f"Успешно: {all_success}\n"
        f"Провал:  {all_failed}\n"
        f"Процент: {rate}\n"
        f"Время:   {elapsed}",
        border_style="green",
        title="📊 Итоговая статистика",
    ))

    # per‑link summary
    if pool.data["links"]:
        link_table = Table.grid(padding=(1, 2))
        link_table.add_column("#", style="bold")
        link_table.add_column("Рефка")
        link_table.add_column("Успешно", justify="right")
        link_table.add_column("Провал", justify="right")
        link_table.add_column("Общее время", justify="right")
        link_table.add_column("Среднее", justify="right")
        link_table.add_column("Статус")
        for i, link in enumerate(pool.data["links"]):
            code = link["url"].split("/")[-1][:8]
            s = link["success"]
            f = link["failed"]
            total_t = format_time(link["total_time"]) if link["total_time"] else "—"
            avg = f"{link['avg_time']:.1f}с" if link["avg_time"] else "—"
            status_icon = "✅" if link["status"] == "done" else "▶️" if link["status"] == "active" else "⏳"
            link_table.add_row(str(i + 1), code, f"{s}/{SUCCESS_LIMIT}", str(f), total_t, avg, status_icon)
        console.print()
        console.print(Panel(link_table, border_style="green", title="📋 Статистика по рефкам"))

    input("\nНажми Enter для выхода...")


async def crackbot_job_main():
    """Run one managed Crackbot job while preserving the original nodriver/CDP flow."""
    input_path = os.environ.get("CRACKBOT_INPUT")
    if not input_path:
        await main()
        return

    payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
    target = payload.get("target") or {}
    config = payload.get("config") or {}
    ref_url = str(target.get("url") or "").strip()
    if not ref_url:
        print(json.dumps({"success": False, "message": "target.url is required"}, ensure_ascii=False))
        return

    pool.reset()
    pool.add_links([ref_url])
    state = DashboardState()
    proxy = str(config.get("runtimeProxy") or "").strip() or None
    result = await worker(1, ref_url, state, batch_id=time.time(), proxy=proxy)
    safe_result = {
        "success": result.get("status") == "success",
        "message": result.get("reason") or result.get("status", "failed"),
        "status": result.get("status", "failed"),
        "duration": result.get("duration", 0),
        "metrics": {
            "successCount": state.total_success,
            "failedCount": state.total_failed,
            "completedRefs": 1 if result.get("status") == "success" else 0,
            "totalRefs": 1,
        },
    }
    print(json.dumps(safe_result, ensure_ascii=False))


if __name__ == "__main__":
    if os.environ.get("CRACKBOT_INPUT"):
        asyncio.run(crackbot_job_main())
    else:
        while True:
            asyncio.run(main())
            time.sleep(1)

