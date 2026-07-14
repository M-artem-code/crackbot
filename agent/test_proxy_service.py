import unittest
from unittest.mock import AsyncMock, patch

from proxy_service import ProxyService, normalize_proxy, safe_proxy_label


class ProxyServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_and_safe_label_hide_credentials(self):
        self.assertEqual(normalize_proxy("127.0.0.1:8080"), "http://127.0.0.1:8080")
        label = safe_proxy_label("http://user:password@proxy.example:3128")
        self.assertEqual(label, "http://proxy.example:3128")
        self.assertNotIn("password", label)

    async def test_user_proxy_has_priority_without_health_download(self):
        service = ProxyService(checker=AsyncMock(return_value=True))
        with patch.object(service, "_free_pool", AsyncMock(side_effect=AssertionError("free pool must not load"))):
            selection = await service.select("socks5://proxy.example:1080", allow_direct=False)
        self.assertEqual(selection.source, "user")
        self.assertEqual(selection.proxy, "socks5://proxy.example:1080")

    async def test_free_then_direct_then_unavailable(self):
        service = ProxyService()
        with patch.object(service, "_free_pool", AsyncMock(return_value=["http://free.example:8080"])):
            selection = await service.select(None, allow_direct=False)
        self.assertEqual(selection.source, "free")
        with patch.object(service, "_free_pool", AsyncMock(return_value=[])):
            direct = await service.select(None, allow_direct=True)
            unavailable = await service.select(None, allow_direct=False)
        self.assertEqual(direct.source, "direct")
        self.assertEqual(unavailable.source, "unavailable")


if __name__ == "__main__":
    unittest.main()
