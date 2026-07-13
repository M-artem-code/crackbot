import asyncio
import unittest

from runner import find_with_fallback
from scenario import LocatorStrategy, parse_scenario, redact_text, resolve_value


class ScenarioTests(unittest.TestCase):
    def test_parse_rejects_unknown_step(self):
        with self.assertRaises(ValueError):
            parse_scenario({"version": 1, "name": "bad", "steps": [{"id": "x", "name": "x", "type": "shell"}]})

    def test_resolve_variables(self):
        self.assertEqual(
            resolve_value("{{baseUrl}}/welcome/{{generated.email}}", {"baseUrl": "https://example.test", "generated.email": "a@example.test"}),
            "https://example.test/welcome/a@example.test",
        )

    def test_unresolved_variable_fails(self):
        with self.assertRaises(KeyError):
            resolve_value("{{missing}}", {})

    def test_redacts_secrets(self):
        self.assertEqual(redact_text("password=Secret123", {"password": "Secret123"}), "password=[REDACTED]")


class FakeTab:
    async def select(self, selector, timeout=1):
        del timeout
        return object() if selector == "[data-testid=submit]" else None

    async def select_all(self, selector):
        del selector
        return []


class LocatorTests(unittest.IsolatedAsyncioTestCase):
    async def test_fallback_locator_uses_later_strategy(self):
        element, strategy, attempts = await find_with_fallback(
            FakeTab(),
            [LocatorStrategy(kind="css", value=".missing"), LocatorStrategy(kind="css", value="[data-testid=submit]")],
            500,
        )
        self.assertIsNotNone(element)
        self.assertEqual(strategy.value, "[data-testid=submit]")
        self.assertEqual(attempts, 2)


if __name__ == "__main__":
    unittest.main()
