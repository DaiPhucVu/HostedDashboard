import argparse
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATABASE_NAMESPACE = "handymanapplicationcos40006"
AUTH_PROJECT_ID = "demo-handyman"


def request_json(url, method, payload=None, headers=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        method=method,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urlopen(request, timeout=10) as response:
        content = response.read().decode("utf-8")
        return json.loads(content) if content else None


def seed(database_host, auth_host, fixture, database_namespace, auth_project_id):
    data = json.loads(fixture.read_text(encoding="utf-8"))
    database_url = f"http://{database_host}/.json?ns={database_namespace}"
    request_json(
        database_url,
        "PUT",
        data,
        {"Authorization": "Bearer owner"},
    )

    accounts_url = f"http://{auth_host}/emulator/v1/projects/{auth_project_id}/accounts"
    request_json(accounts_url, "DELETE")
    sign_up_url = (
        f"http://{auth_host}/identitytoolkit.googleapis.com/v1/accounts:signUp"
        "?key=emulator-key"
    )
    request_json(sign_up_url, "POST", {
        "email": "admin@example.com",
        "password": "admin123",
        "returnSecureToken": True,
    })


def main():
    parser = argparse.ArgumentParser(description="Seed the isolated Firebase emulators")
    parser.add_argument("--database-host", default="127.0.0.1:9000")
    parser.add_argument("--auth-host", default="127.0.0.1:9099")
    parser.add_argument("--database-namespace", default=DATABASE_NAMESPACE)
    parser.add_argument("--auth-project-id", default=AUTH_PROJECT_ID)
    parser.add_argument(
        "--fixture",
        type=Path,
        default=ROOT / "fixtures" / "emulator_v1" / "firebase-export.json",
    )
    args = parser.parse_args()
    try:
        seed(
            args.database_host,
            args.auth_host,
            args.fixture,
            args.database_namespace,
            args.auth_project_id,
        )
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Firebase emulator seed failed ({error.code}): {detail}")
    print("Firebase emulators seeded with evaluation data.")


if __name__ == "__main__":
    main()
