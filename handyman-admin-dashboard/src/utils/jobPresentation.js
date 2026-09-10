export const JOB_FIELD_LABELS = Object.freeze({
  jobCat: "Job category",
  jobDesc: "Description",
  jobStatus: "Job status",
  jobStatusHandyman: "Provider status",
  jobStatusCustomer: "Customer status",
  createdBy: "Created by",
  assignedTo: "Assigned provider",
  jobLocation: "Service location",
  jobDateFrom: "Start date",
  jobDateTo: "End date",
  jobTimeFrom: "Start time",
  jobTimeTo: "End time",
  jobPaymentOption: "Payment method",
  jobSalaryFrom: "Minimum budget",
  jobSalaryTo: "Maximum budget",
  jobId: "Job reference",
  customerId: "Customer reference",
  createdAt: "Created",
  lastUpdated: "Last updated",
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  const dayFirst = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirst) return `${Number(dayFirst[1])} ${MONTHS[Number(dayFirst[2]) - 1]} ${dayFirst[3]}`;
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${Number(isoDate[3])} ${MONTHS[Number(isoDate[2]) - 1]} ${isoDate[1]}`;
  const timestamp = /^\d{10,13}$/.test(text)
    ? new Date(Number(text) * (text.length === 10 ? 1000 : 1))
    : new Date(text);
  if (!Number.isNaN(timestamp.getTime())) {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(timestamp);
  }
  return text;
}

export function formatTime(value) {
  if (!value) return "—";
  const text = String(value);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const text = String(value);
  const date = /^\d{10,13}$/.test(text)
    ? new Date(Number(text) * (text.length === 10 ? 1000 : 1))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatBudget(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `BDT ${amount.toLocaleString("en-AU")}` : String(value);
}

export function formatReference(value) {
  if (!value) return "—";
  const text = String(value);
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-4)}` : text;
}

export function formatJobField(key, value) {
  if (["jobDateFrom", "jobDateTo"].includes(key)) return formatDate(value);
  if (["jobTimeFrom", "jobTimeTo"].includes(key)) return formatTime(value);
  if (["createdAt", "lastUpdated"].includes(key)) return formatDateTime(value);
  if (["jobSalaryFrom", "jobSalaryTo"].includes(key)) return formatBudget(value);
  if (["jobId", "customerId"].includes(key)) return formatReference(value);
  if (Array.isArray(value)) return value.length ? `${value.length} provider${value.length === 1 ? "" : "s"}` : "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value || "—";
}
