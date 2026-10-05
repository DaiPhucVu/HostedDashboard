import json
import unittest
from unittest.mock import MagicMock, patch

from app.repositories.firebase_auth import FirebaseEmailPasswordTokenProvider


class FirebaseEmailPasswordTokenProviderTests(unittest.TestCase):
    @patch("app.repositories.firebase_auth.urlopen")
    def test_token_is_reused_until_near_expiry(self, mocked_urlopen):
        response = MagicMock()
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        response.read.return_value = json.dumps({
            "idToken": "short-lived-token",
            "expiresIn": "3600",
        }).encode("utf-8")
        mocked_urlopen.return_value = response
        provider = FirebaseEmailPasswordTokenProvider(
            "api-key",
            "admin@example.com",
            "password",
        )

        self.assertEqual("short-lived-token", provider())
        self.assertEqual("short-lived-token", provider())
        self.assertEqual(1, mocked_urlopen.call_count)


if __name__ == "__main__":
    unittest.main()
