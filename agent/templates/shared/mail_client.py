import asyncio
import json
import random
import re
import time
from typing import Optional, Tuple, Dict, Any, List

import requests


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
]


class TempMailWorldClient:
    BASE_URL = "https://tempmail.world"
    PAGE_PATH = "/ru"
    INBOX_PATH = "/api/guestInbox"
    MESSAGE_PATH = "/api/guestInbox/message/{id}"
    MAILBOX_RE = re.compile(r'emailJson\\":(\{[^}]+\})')
    EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
    CODE_RE = re.compile(r"(?<!\d)(\d{6})(?!\d)")

    def __init__(self, log_func=None):
        self.log = log_func or (lambda msg: None)

    @staticmethod
    def _requests_proxies(proxy: Optional[str]) -> Optional[Dict[str, str]]:
        if not proxy:
            return None
        proxy_url = proxy if "://" in proxy else f"http://{proxy}"
        return {"http": proxy_url, "https": proxy_url}

    def _new_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{self.BASE_URL}{self.PAGE_PATH}",
        })
        return session

    def _request(
        self,
        session: requests.Session,
        method: str,
        path: str,
        timeout: int,
        proxy: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> requests.Response:
        url = path if path.startswith("http") else f"{self.BASE_URL}{path}"
        request_kwargs: Dict[str, Any] = {"timeout": timeout}
        proxies = self._requests_proxies(proxy)
        if proxies:
            request_kwargs["proxies"] = proxies
        if headers:
            request_kwargs["headers"] = headers
        return session.request(method, url, **request_kwargs)

    def _parse_mailbox(self, page_html: str) -> Dict[str, Any]:
        match = self.MAILBOX_RE.search(page_html)
        if match:
            raw_json = match.group(1).replace('\\"', '"')
            mailbox = json.loads(raw_json)
        else:
            fallback = self.EMAIL_RE.search(page_html)
            if not fallback:
                raise ValueError("TempMail.World mailbox not found in page")
            email = fallback.group(0)
            name, domain = email.split("@", 1)
            mailbox = {"email": email, "name": name, "domain": domain}

        email = mailbox.get("email")
        if not email or "@" not in email:
            raise ValueError(f"TempMail.World returned invalid mailbox: {mailbox!r}")
        mailbox.setdefault("name", email.split("@", 1)[0])
        mailbox.setdefault("domain", email.split("@", 1)[1])
        return mailbox

    @staticmethod
    def _message_text(message: Dict[str, Any]) -> str:
        fields = ("subject", "body", "htmlBody", "textBody", "html", "text")
        return " ".join(str(message.get(field) or "") for field in fields)

    def _extract_code(self, message: Dict[str, Any]) -> Optional[str]:
        match = self.CODE_RE.search(self._message_text(message))
        return match.group(1) if match else None

    async def create_email(self, proxy: Optional[str] = None) -> Tuple[Optional[str], Optional[Dict]]:
        self.log("Создаю mailbox TempMail.World...")

        for attempt in range(1, 3):
            session = self._new_session()
            try:
                loop = asyncio.get_event_loop()
                resp = await loop.run_in_executor(None, lambda: self._request(
                    session,
                    "GET",
                    self.PAGE_PATH,
                    timeout=15,
                    proxy=proxy,
                    headers={"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"},
                ))
                resp.raise_for_status()

                mailbox = self._parse_mailbox(resp.text)
                token = session.cookies.get("sessionToken")
                if not token:
                    raise RuntimeError("TempMail.World did not set sessionToken cookie")

                mailbox["sessionToken"] = token
                email = mailbox["email"]
                self.log(f"[+] Mailbox: {email}")
                return email, {
                    "session": session,
                    "mailbox": mailbox,
                    "sessionToken": token,
                    "email": email,
                    "login": mailbox["name"],
                    "domain": mailbox["domain"],
                }
            except requests.exceptions.RequestException as e:
                status = e.response.status_code if e.response is not None else "no-response"
                self.log(f"TempMail.World request error: status={status}, error={e}")
            except (json.JSONDecodeError, ValueError, RuntimeError) as e:
                self.log(f"TempMail.World mailbox error: {e}")

            if attempt < 2:
                await asyncio.sleep(2)
        return None, None

    async def check_inbox(
        self,
        creds: Dict,
        proxy: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        session = creds.get("session")
        if not isinstance(session, requests.Session):
            self.log("TempMail.World session missing")
            return []

        try:
            resp = self._request(
                session,
                "GET",
                self.INBOX_PATH,
                timeout=15,
                proxy=proxy,
                headers={"Accept": "application/json"},
            )
            if resp.status_code == 401:
                self.log("TempMail.World session expired")
                return []
            resp.raise_for_status()
            messages = resp.json()
            if not isinstance(messages, list):
                self.log(f"Unexpected inbox response: {messages!r}")
                return []
            return messages
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            self.log(f"Check inbox error: {e}")
            return []

    async def wait_for_code(
        self,
        creds: Dict,
        timeout: int = 120,
        proxy: Optional[str] = None,
    ) -> Optional[str]:
        self.log("Жду код TempMail.World...")
        session = creds.get("session")
        if not isinstance(session, requests.Session):
            self.log("TempMail.World session missing")
            return None

        start = asyncio.get_event_loop().time()
        checked = set()
        last_status_log = 0

        while True:
            await asyncio.sleep(3)
            elapsed = int(asyncio.get_event_loop().time() - start)
            if elapsed > timeout:
                self.log("Таймаут ожидания кода")
                return None

            try:
                resp = self._request(
                    session,
                    "GET",
                    self.INBOX_PATH,
                    timeout=15,
                    proxy=proxy,
                    headers={"Accept": "application/json"},
                )
                if resp.status_code == 401:
                    self.log("TempMail.World session expired")
                    return None
                resp.raise_for_status()

                messages = resp.json()
                if not isinstance(messages, list):
                    continue

                for message in messages:
                    if not isinstance(message, dict):
                        continue

                    code = self._extract_code(message)
                    if code:
                        self.log(f"[+] Код: {code}")
                        return code

                    message_id = message.get("id")
                    if not message_id or message_id in checked:
                        continue

                    detail_resp = self._request(
                        session,
                        "GET",
                        self.MESSAGE_PATH.format(id=message_id),
                        timeout=15,
                        proxy=proxy,
                        headers={"Accept": "application/json"},
                    )
                    detail_resp.raise_for_status()
                    details = detail_resp.json()
                    checked.add(message_id)

                    if isinstance(details, dict):
                        code = self._extract_code(details)
                        if code:
                            self.log(f"[+] Код: {code}")
                            return code
            except requests.exceptions.JSONDecodeError as e:
                pass
            except requests.exceptions.RequestException as e:
                pass
            except Exception as e:
                pass

            if elapsed - last_status_log >= 15:
                last_status_log = elapsed
                self.log(f"Ожидание... ({elapsed}s)")
