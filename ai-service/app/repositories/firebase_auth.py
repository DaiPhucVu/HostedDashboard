import json
import threading
import time
from urllib.request import Request, urlopen


class FirebaseEmailPasswordTokenProvider:
    def __init__(
        self,
        api_key: str,
        email: str,
        password: str,
        timeout_seconds: int = 20,
    ):
        self.api_key = api_key
        self.email = email
        self.password = password
        self.timeout_seconds = timeout_seconds
        self._token = None
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def __call__(self) -> str:
        with self._lock:
            if self._token and self._expires_at > time.time() + 60:
                return self._token
            request = Request(
                "https://identitytoolkit.googleapis.com/v1/"
                f"accounts:signInWithPassword?key={self.api_key}",
                data=json.dumps({
                    "email": self.email,
                    "password": self.password,
                    "returnSecureToken": True,
                }).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.load(response)
            self._token = payload["idToken"]
            self._expires_at = time.time() + int(payload.get("expiresIn", 3600))
            return self._token
