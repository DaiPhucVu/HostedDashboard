import argparse
import os
import time
from pathlib import Path

from app.repositories.firebase_auth import FirebaseEmailPasswordTokenProvider
from app.repositories.firebase_rest import FirebaseRestClient
from app.services.assignment_review import AssignmentReviewService
from app.services.firebase_auto_assignment import FirebaseAutoAssignmentRunner
from app.services.firebase_data_adapter import FirebaseDataAdapter


ROOT = Path(__file__).resolve().parents[2]


def build_runner() -> FirebaseAutoAssignmentRunner:
    database_url = os.environ.get("HANDYMAN_FIREBASE_DATABASE_URL")
    if not database_url:
        raise RuntimeError("HANDYMAN_FIREBASE_DATABASE_URL is required")
    auth_token_provider = None
    auth_email = os.environ.get("HANDYMAN_FIREBASE_AUTH_EMAIL")
    auth_password = os.environ.get("HANDYMAN_FIREBASE_AUTH_PASSWORD")
    api_key = os.environ.get("HANDYMAN_FIREBASE_API_KEY")
    if auth_email and auth_password and api_key:
        auth_token_provider = FirebaseEmailPasswordTokenProvider(
            api_key,
            auth_email,
            auth_password,
        )
    client = FirebaseRestClient(
        database_url,
        os.environ.get(
            "HANDYMAN_FIREBASE_DATABASE_NAMESPACE",
            "handymanapplicationcos40006-default-rtdb",
        ),
        os.environ.get("HANDYMAN_FIREBASE_AUTH_TOKEN"),
        timeout_seconds=int(
            os.environ.get("HANDYMAN_FIREBASE_TIMEOUT_SECONDS", "60")
        ),
        auth_token_provider=auth_token_provider,
    )
    adapter = FirebaseDataAdapter(ROOT / "taxonomy" / "service_taxonomy.json")
    return FirebaseAutoAssignmentRunner(
        client,
        AssignmentReviewService(ROOT),
        adapter,
        claim_timeout_seconds=int(
            os.environ.get("HANDYMAN_AUTO_ASSIGNMENT_CLAIM_TIMEOUT", "900")
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Firebase automatic assignment")
    parser.add_argument("--once", action="store_true")
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=float(os.environ.get("HANDYMAN_AUTO_ASSIGNMENT_POLL_SECONDS", "3")),
    )
    args = parser.parse_args()
    runner = build_runner()

    if args.once:
        try:
            result = runner.process_next()
            print(result)
            raise SystemExit(1 if result == "ERROR" else 0)
        finally:
            runner.release_lease()

    print("Firebase automatic assignment worker started")
    try:
        while True:
            try:
                result = runner.process_next()
                if result not in {"IDLE", "MANUAL_MODE", "LEASE_HELD"}:
                    print(result, flush=True)
            except Exception as error:
                print(f"RETRY: {type(error).__name__}: {error}", flush=True)
            time.sleep(max(0.5, args.poll_seconds))
    except KeyboardInterrupt:
        pass
    finally:
        runner.release_lease()


if __name__ == "__main__":
    main()
