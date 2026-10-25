class AssignmentError(RuntimeError):
    code = "ASSIGNMENT_ERROR"


class AssignmentConflict(AssignmentError):
    code = "ASSIGNMENT_CONFLICT"


class AssignmentEligibilityError(AssignmentError):
    code = "PROVIDER_INELIGIBLE"


class AssignmentNotFound(AssignmentError):
    code = "ASSIGNMENT_TARGET_NOT_FOUND"


class AssignmentValidationError(AssignmentError):
    code = "ASSIGNMENT_INVALID"
