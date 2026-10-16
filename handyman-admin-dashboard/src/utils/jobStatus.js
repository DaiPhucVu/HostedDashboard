export const JOB_STATUS_OPTIONS = Object.freeze([
  { value: "Open", label: "Open" },
  { value: "Offered", label: "Offered" },
  { value: "Accepted", label: "Accepted" },
  { value: "In-progress", label: "In Progress" },
  { value: "Done", label: "Done" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Inactive", label: "Inactive" },
]);

const STATUS_ALIASES = Object.freeze({
  open: "Open",
  offered: "Offered",
  pending: "Pending",
  accepted: "Accepted",
  "in progress": "In-progress",
  "in-progress": "In-progress",
  in_progress: "In-progress",
  done: "Done",
  completed: "Done",
  complete: "Done",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  inactive: "Inactive",
});

export function normalizeJobStatus(value, fallback = "") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return STATUS_ALIASES[text.toLowerCase()] || text;
}

export function jobStatusLabel(value, fallback = "Open") {
  const status = normalizeJobStatus(value, fallback);
  return status === "In-progress" ? "In Progress" : status;
}

export function isAssignmentOpen(job) {
  if (!job) return false;
  return normalizeJobStatus(job?.jobStatus, "Open") === "Open";
}

export function canArchiveJob(job) {
  if (!job) return false;
  const providerId = job?.assignedTo || job?.assignment?.providerId || job?.assignment?.assignedTo;
  return isAssignmentOpen(job) && !providerId;
}
