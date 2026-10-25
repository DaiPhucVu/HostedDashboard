import unittest
from urllib.parse import parse_qs, urlsplit
from unittest.mock import MagicMock, patch

from app.repositories.firebase_rest import FirebaseRestClient


class FirebaseRestClientTests(unittest.TestCase):
    def test_auth_token_is_sent_as_firebase_auth_query_parameter(self):
        client = FirebaseRestClient(
            "https://example.firebaseio.com",
            "example-project",
            "id-token",
        )

        parsed = urlsplit(client._url("Job/job-1"))
        query = parse_qs(parsed.query)

        self.assertEqual(["example-project"], query["ns"])
        self.assertEqual(["id-token"], query["auth"])

    def test_token_provider_is_used_when_configured(self):
        client = FirebaseRestClient(
            "https://example.firebaseio.com",
            "example-project",
            auth_token_provider=lambda: "refreshed-token",
        )

        query = parse_qs(urlsplit(client._url("Job/job-1")).query)

        self.assertEqual(["refreshed-token"], query["auth"])

    @patch("app.repositories.firebase_rest.urlopen")
    def test_conditional_null_write_sends_json_null(self, mocked_urlopen):
        response = MagicMock()
        response.read.return_value = b"null"
        response.headers.items.return_value = []
        mocked_urlopen.return_value.__enter__.return_value = response
        client = FirebaseRestClient("http://127.0.0.1:9000", "test")

        self.assertTrue(client.put_if_unchanged("lease", None, '"etag"'))
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(b"null", request.data)
        self.assertEqual('"etag"', request.headers["If-match"])


if __name__ == "__main__":
    unittest.main()
