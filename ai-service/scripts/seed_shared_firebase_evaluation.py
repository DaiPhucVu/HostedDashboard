import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.repositories.firebase_auth import FirebaseEmailPasswordTokenProvider
from app.repositories.firebase_rest import FirebaseRestClient


DEFAULT_FIXTURE = ROOT / "fixtures" / "firebase_shared_eval_v2" / "firebase-export.json"
DEFAULT_DATABASE_URL = "https://handymanapplicationcos40006-default-rtdb.firebaseio.com"
DEFAULT_NAMESPACE = "handymanapplicationcos40006-default-rtdb"


def load_fixture(path):
    return json.loads(path.read_text(encoding="utf-8"))


def dataset_version(data):
    datasets = data.get("TestDatasets") or {}
    if len(datasets) != 1:
        raise RuntimeError("Fixture must contain exactly one TestDatasets entry")
    return next(iter(datasets))


def build_client():
    api_key = os.environ.get("HANDYMAN_FIREBASE_API_KEY")
    email = os.environ.get("HANDYMAN_FIREBASE_AUTH_EMAIL")
    password = os.environ.get("HANDYMAN_FIREBASE_AUTH_PASSWORD")
    if not all((api_key, email, password)):
        raise RuntimeError(
            "HANDYMAN_FIREBASE_API_KEY, HANDYMAN_FIREBASE_AUTH_EMAIL, and "
            "HANDYMAN_FIREBASE_AUTH_PASSWORD are required"
        )
    token_provider = FirebaseEmailPasswordTokenProvider(api_key, email, password)
    return FirebaseRestClient(
        os.environ.get("HANDYMAN_FIREBASE_DATABASE_URL", DEFAULT_DATABASE_URL),
        os.environ.get("HANDYMAN_FIREBASE_DATABASE_NAMESPACE", DEFAULT_NAMESPACE),
        timeout_seconds=int(os.environ.get("HANDYMAN_FIREBASE_TIMEOUT_SECONDS", "90")),
        auth_token_provider=token_provider,
    )


def tagged_with(record, version):
    return isinstance(record, dict) and record.get("datasetVersion") == version


def collision_check(current, fixture, version):
    collisions = []
    for node in ("Handyman", "EvaluationJobHistory", "Reviews"):
        existing_records = current.get(node) or {}
        for record_id in (fixture.get(node) or {}):
            actual = existing_records.get(record_id)
            if actual is None:
                continue
            if not tagged_with(actual, version):
                collisions.append(f"{node}/{record_id}")
    return collisions


def seed(client, fixture, apply_changes=False):
    version = dataset_version(fixture)
    nodes = ("Handyman", "EvaluationJobHistory", "Reviews", "TestDatasets")
    current = {node: client.get(node) or {} for node in nodes}
    collisions = collision_check(current, fixture, version)
    if collisions:
        raise RuntimeError(
            "Refusing to overwrite non-dataset records: " + ", ".join(collisions[:10])
        )
    updates = {}
    for node in nodes:
        for record_id, value in (fixture.get(node) or {}).items():
            if (current.get(node) or {}).get(record_id) is None:
                updates[f"{node}/{record_id}"] = value
    if apply_changes and updates:
        client.patch("", updates)
    return version, len(updates)


def remove(client, fixture, apply_changes=False):
    version = dataset_version(fixture)
    updates = {}
    for node in ("Handyman", "EvaluationJobHistory", "Reviews"):
        current = client.get(node) or {}
        for record_id in (fixture.get(node) or {}):
            actual = current.get(record_id)
            if tagged_with(actual, version):
                updates[f"{node}/{record_id}"] = None
    if client.get(f"TestDatasets/{version}") is not None:
        updates[f"TestDatasets/{version}"] = None
    if apply_changes and updates:
        client.patch("", updates)
    return version, len(updates)


def main():
    parser = argparse.ArgumentParser(
        description="Safely seed or remove the versioned shared Firebase evaluation dataset"
    )
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--apply", action="store_true", help="Write changes; default is dry-run")
    parser.add_argument("--remove", action="store_true", help="Remove only matching version-tagged records")
    args = parser.parse_args()
    fixture = load_fixture(args.fixture)
    client = build_client()
    operation = remove if args.remove else seed
    version, count = operation(client, fixture, args.apply)
    mode = "applied" if args.apply else "dry-run"
    verb = "remove" if args.remove else "write"
    print(f"{mode}: {verb} {count} records for {version}")


if __name__ == "__main__":
    main()
