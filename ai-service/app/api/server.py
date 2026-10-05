import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional, Type

from app.domain.contracts import ContractError, load_schema, validate
from app.domain.models import AssignmentCancellationCommand, AssignmentCommand
from app.repositories.assignment_errors import (
    AssignmentConflict,
    AssignmentEligibilityError,
    AssignmentNotFound,
    AssignmentValidationError,
)
from app.repositories.base import AssignmentRepository
from app.repositories.local_assignment import LocalAssignmentRepository
from app.repositories.postgres_assignment import PostgresAssignmentRepository
from app.services.assignment_review import AssignmentReviewService


MAX_REQUEST_BYTES = 64 * 1024


def make_handler(
    service: AssignmentReviewService,
    cors_origin: str,
    assignment_repository: Optional[AssignmentRepository] = None,
) -> Type[BaseHTTPRequestHandler]:
    allowed_origins = {
        origin.strip()
        for origin in cors_origin.split(",")
        if origin.strip()
    }
    assignments = assignment_repository or LocalAssignmentRepository(service.providers)
    assignment_command_schema = load_schema(
        service.root / "contracts" / "assignment-command.schema.json"
    )
    assignment_result_schema = load_schema(
        service.root / "contracts" / "assignment-result.schema.json"
    )
    assignment_cancellation_schema = load_schema(
        service.root / "contracts" / "assignment-cancellation-command.schema.json"
    )

    class ApiHandler(BaseHTTPRequestHandler):
        server_version = "HandymanAI/0.1"

        def _cors_origin(self) -> Optional[str]:
            request_origin = self.headers.get("Origin")
            if request_origin in allowed_origins:
                return request_origin
            if request_origin is None and allowed_origins:
                return sorted(allowed_origins)[0]
            return None

        def _write_cors_headers(self) -> None:
            origin = self._cors_origin()
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

        def _write_json(self, status: int, payload: Dict[str, Any]) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self._write_cors_headers()
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self._write_cors_headers()
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.end_headers()

        def do_GET(self) -> None:
            if self.path == "/health":
                self._write_json(200, {
                    "status": "ok",
                    "service": "handyman-ai",
                    "semanticProvider": service.semantic_provider,
                    "semanticModel": service.semantic_model,
                })
                return
            self._write_json(404, {"error": "NOT_FOUND"})

        def do_POST(self) -> None:
            if self.path not in {
                "/v1/assignment-reviews",
                "/v1/assignments",
                "/v1/assignment-cancellations",
            }:
                self._write_json(404, {"error": "NOT_FOUND"})
                return
            if self.headers.get_content_type() != "application/json":
                self._write_json(415, {"error": "CONTENT_TYPE_REQUIRED"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self._write_json(400, {"error": "INVALID_CONTENT_LENGTH"})
                return
            if length <= 0 or length > MAX_REQUEST_BYTES:
                self._write_json(413, {"error": "REQUEST_SIZE_INVALID"})
                return
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ContractError("$ must be an object")
                if self.path == "/v1/assignment-reviews":
                    job_payload = payload.get("job", payload)
                    provider_payloads = payload.get("providers") if "job" in payload else None
                    if not isinstance(job_payload, dict):
                        raise ContractError("$.job must be an object")
                    if provider_payloads is not None and not isinstance(provider_payloads, list):
                        raise ContractError("$.providers must be an array")
                    review = service.review(job_payload, provider_payloads)
                    register_review = getattr(assignments, "register_review", None)
                    if register_review:
                        register_review(job_payload, review)
                    self._write_json(200, review)
                    return

                if self.path == "/v1/assignment-cancellations":
                    validate(payload, assignment_cancellation_schema)
                    result = assignments.cancel(AssignmentCancellationCommand(
                        job_id=payload["jobId"],
                        assignment_id=payload["assignmentId"],
                        actor_id=payload["actorId"],
                        expected_job_version=int(payload["expectedJobVersion"]),
                        reason=payload.get("reason"),
                    )).to_contract_dict()
                    validate(result, assignment_result_schema)
                    self._write_json(200, result)
                    return

                validate(payload, assignment_command_schema)
                command = AssignmentCommand(
                    job_id=payload["jobId"],
                    provider_id=payload["providerId"],
                    actor_id=payload["actorId"],
                    expected_job_version=int(payload["expectedJobVersion"]),
                    idempotency_key=payload["idempotencyKey"],
                    ranking_version=payload.get("rankingVersion"),
                    selected_rank=payload.get("selectedRank"),
                    override_reason=payload.get("overrideReason"),
                )
                result = assignments.assign(command).to_contract_dict()
                validate(result, assignment_result_schema)
                self._write_json(200, result)
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._write_json(400, {"error": "INVALID_JSON"})
            except AssignmentNotFound as error:
                self._write_json(404, {"error": error.code, "detail": str(error)})
            except (AssignmentConflict, AssignmentEligibilityError) as error:
                self._write_json(409, {"error": error.code, "detail": str(error)})
            except AssignmentValidationError as error:
                self._write_json(422, {"error": error.code, "detail": str(error)})
            except (ContractError, KeyError, TypeError, ValueError) as error:
                self._write_json(422, {"error": "CONTRACT_INVALID", "detail": str(error)})

        def log_message(self, format: str, *args: Any) -> None:
            return

    return ApiHandler


def build_assignment_repository(service: AssignmentReviewService) -> AssignmentRepository:
    dsn = os.environ.get("HANDYMAN_DATABASE_URL")
    if not dsn:
        return LocalAssignmentRepository(service.providers)
    try:
        import psycopg
    except ImportError as error:
        raise RuntimeError(
            "HANDYMAN_DATABASE_URL requires the optional psycopg driver"
        ) from error
    return PostgresAssignmentRepository(lambda: psycopg.connect(dsn))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local Handyman AI API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    parser.add_argument(
        "--cors-origin",
        default=os.environ.get("HANDYMAN_CORS_ORIGIN", "http://127.0.0.1:3000"),
    )
    args = parser.parse_args()

    service = AssignmentReviewService()
    assignments = build_assignment_repository(service)
    server = ThreadingHTTPServer(
        (args.host, args.port),
        make_handler(service, args.cors_origin, assignments),
    )
    print("Handyman AI API listening on http://{}:{}".format(args.host, args.port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
