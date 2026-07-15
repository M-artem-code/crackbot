import asyncio
import os

from runner import RunnerConfig, run_job


def scenario(assertion: str = "Welcome") -> dict:
    return {
        "version": 1,
        "name": "Registration with email OTP",
        "steps": [
            {"id": "open", "name": "Открыть регистрацию", "type": "navigate", "url": "{{baseUrl}}"},
            {"id": "email", "name": "Создать временную почту", "type": "waitForEmail"},
            {"id": "fill-email", "name": "Ввести email", "type": "fill", "value": "{{generated.email}}", "secret": True, "locator": {"strategies": [{"kind": "label", "value": "Email"}, {"kind": "css", "value": "input[type=email]"}]}},
            {"id": "fill-password", "name": "Ввести пароль", "type": "fill", "value": "{{generated.password}}", "secret": True, "locator": {"strategies": [{"kind": "label", "value": "Password"}, {"kind": "css", "value": "input[type=password]"}]}},
            {"id": "submit", "name": "Отправить форму", "type": "click", "locator": {"strategies": [{"kind": "role", "role": "button", "name": "Create account"}, {"kind": "css", "value": "button[type=submit]"}]}},
            {"id": "wait-otp", "name": "Получить OTP", "type": "extractOtp", "timeoutMs": 30000},
            {"id": "fill-otp", "name": "Ввести OTP", "type": "fillOtp", "secret": True, "locator": {"strategies": [{"kind": "label", "value": "Verification code"}, {"kind": "css", "value": "input[autocomplete=one-time-code]"}]}},
            {"id": "verify", "name": "Подтвердить OTP", "type": "click", "locator": {"strategies": [{"kind": "role", "role": "button", "name": "Verify"}, {"kind": "css", "value": "button[type=submit]"}]}},
            {"id": "success", "name": "Проверить успех", "type": "assertText", "value": assertion, "timeoutMs": 10000},
        ],
    }


async def execute(base_url: str, assertion: str = "Welcome"):
    messages = []

    def log(step, message="", **kwargs):
        messages.append({"step": step, "message": message, **kwargs})

    job = {
        "scenario": scenario(assertion),
        "bot": {"targetUrl": base_url, "workers": 1, "config": {"headless": True, "mail_provider": "test-stand"}},
        "ref": None,
    }
    result = await run_job(job, RunnerConfig(headless=True), log)
    return result, messages


async def main():
    base_url = os.environ.get("TEST_STAND_URL", "http://localhost:3000/test-stand/register")
    for attempt in range(1, 4):
        result, messages = await execute(base_url)
        if result.status != "success":
            raise RuntimeError(
                f"Позитивный E2E #{attempt} завершился: {result.status}: {result.errors}; logs={messages}"
            )
        print(f"positive-e2e-{attempt}: success")

    result, messages = await execute(base_url, "This text must never exist")
    if result.status != "failed":
        raise RuntimeError(f"Негативный E2E должен завершаться failed, получено {result.status}")
    failed_steps = [
        entry
        for entry in messages
        if entry.get("level") == "error" and entry.get("step") == "success"
    ]
    if not failed_steps or not failed_steps[-1].get("metadata", {}).get("currentUrl"):
        raise RuntimeError(f"Негативный E2E не сформировал диагностический отчёт: {messages}")
    print("negative-e2e: failed-with-diagnostics")


if __name__ == "__main__":
    asyncio.run(main())
