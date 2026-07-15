import unittest

from privacy import mask_email, safe_url, sanitize_text


class PrivacyTests(unittest.TestCase):
    def test_masks_email_local_part(self):
        self.assertEqual(mask_email("mailbox user.name+tag@example.com ready"), "mailbox u***@example.com ready")

    def test_redacts_query_values_and_fragment(self):
        value = safe_url("https://example.com/ref/path?token=secret&campaign=summer#private")
        self.assertEqual(value, "https://example.com/ref/path?token=%5BREDACTED%5D&campaign=%5BREDACTED%5D")
        self.assertNotIn("secret", value)
        self.assertNotIn("private", value)

    def test_sanitizes_urls_and_emails_inside_message(self):
        value = sanitize_text("user@example.com opened https://site.test/join?ref=abc")
        self.assertEqual(value, "u***@example.com opened https://site.test/join?ref=%5BREDACTED%5D")


if __name__ == "__main__":
    unittest.main()
