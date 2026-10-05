import json
from typing import Any, Callable, Dict, Optional, Tuple
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class FirebaseConflict(RuntimeError):
    pass


class FirebaseRestClient:
    def __init__(
        self,
        base_url: str,
        namespace: str,
        auth_token: Optional[str] = None,
        timeout_seconds: int = 20,
        auth_token_provider: Optional[Callable[[], str]] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.namespace = namespace
        self.auth_token = auth_token
        self.timeout_seconds = timeout_seconds
        self.auth_token_provider = auth_token_provider

    def _url(self, path: str) -> str:
        encoded_path = "/".join(
            quote(part, safe="") for part in path.strip("/").split("/") if part
        )
        suffix = f"/{encoded_path}.json" if encoded_path else "/.json"
        query = {"ns": self.namespace}
        auth_token = (
            self.auth_token_provider()
            if self.auth_token_provider
            else self.auth_token
        )
        if auth_token:
            query["auth"] = auth_token
        return f"{self.base_url}{suffix}?{urlencode(query)}"

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        headers.update(extra or {})
        return headers

    def _request(
        self,
        path: str,
        method: str,
        payload: Any = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Tuple[Any, Dict[str, str]]:
        body = (
            None
            if payload is None and method in {"GET", "DELETE"}
            else json.dumps(payload).encode("utf-8")
        )
        request = Request(
            self._url(path),
            data=body,
            method=method,
            headers=self._headers(headers),
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                content = response.read().decode("utf-8")
                response_headers = dict(response.headers.items())
                return (json.loads(content) if content else None), response_headers
        except HTTPError as error:
            if error.code == 412:
                raise FirebaseConflict("Firebase value changed during transaction") from error
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Firebase request failed ({error.code} {method} {path}): {detail}"
            ) from error

    def get(self, path: str = "") -> Any:
        value, _ = self._request(path, "GET")
        return value

    def get_with_etag(self, path: str) -> Tuple[Any, str]:
        value, headers = self._request(
            path,
            "GET",
            headers={"X-Firebase-ETag": "true"},
        )
        etag = headers.get("ETag") or headers.get("Etag")
        if not etag:
            raise RuntimeError("Firebase did not return an ETag")
        return value, etag

    def put_if_unchanged(self, path: str, value: Any, etag: str) -> bool:
        try:
            self._request(path, "PUT", value, headers={"if-match": etag})
            return True
        except FirebaseConflict:
            return False

    def patch(self, path: str, values: Dict[str, Any]) -> None:
        self._request(path, "PATCH", values)
