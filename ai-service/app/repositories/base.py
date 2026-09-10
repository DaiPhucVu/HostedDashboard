from abc import ABC, abstractmethod
from typing import Iterable, Optional

from app.domain.models import (
    AssignmentCancellationCommand,
    AssignmentCommand,
    AssignmentRecord,
    JobInput,
    KnowledgeDocument,
    ProviderProfile,
)


class JobRepository(ABC):
    @abstractmethod
    def list_jobs(self) -> Iterable[JobInput]:
        raise NotImplementedError


class ProviderRepository(ABC):
    @abstractmethod
    def list_providers(self) -> Iterable[ProviderProfile]:
        raise NotImplementedError


class KnowledgeRepository(ABC):
    @abstractmethod
    def list_documents(self) -> Iterable[KnowledgeDocument]:
        raise NotImplementedError


class AssignmentRepository(ABC):
    """Atomic assignment boundary implemented by PostgreSQL when deployed."""

    @abstractmethod
    def assign(self, command: AssignmentCommand) -> AssignmentRecord:
        """Assign once or raise a conflict when the job version/state changed."""
        raise NotImplementedError

    @abstractmethod
    def cancel(self, command: AssignmentCancellationCommand) -> AssignmentRecord:
        """Cancel an offered assignment and release the provider capacity."""
        raise NotImplementedError

    @abstractmethod
    def find_by_idempotency_key(self, idempotency_key: str) -> Optional[AssignmentRecord]:
        raise NotImplementedError
