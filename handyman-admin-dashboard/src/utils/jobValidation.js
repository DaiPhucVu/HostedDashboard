const dateParts = (value) => {
  const text = String(value || "").trim();
  const dayFirst = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirst) return [Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1])];
  const yearFirst = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (yearFirst) return [Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3])];
  return null;
};

export function parseJobDate(value) {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date.getTime();
}

const timeMinutes = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
};

export function validateJobRanges(job) {
  const errors = {};
  const startDate = parseJobDate(job.jobDateFrom);
  const endDate = parseJobDate(job.jobDateTo);

  if (job.jobDateFrom && startDate === null) errors.jobDateFrom = "Enter a valid start date";
  if (job.jobDateTo && endDate === null) errors.jobDateTo = "Enter a valid end date";
  if (startDate !== null && endDate !== null && endDate < startDate) {
    errors.jobDateTo = "End date cannot be before the start date";
  }

  const startTime = timeMinutes(job.jobTimeFrom);
  const endTime = timeMinutes(job.jobTimeTo);
  if (
    startDate !== null &&
    startDate === endDate &&
    startTime !== null &&
    endTime !== null &&
    endTime <= startTime
  ) {
    errors.jobTimeTo = "End time must be after the start time";
  }

  const minimum = Number(job.jobSalaryFrom);
  const maximum = Number(job.jobSalaryTo);
  if (
    job.jobSalaryFrom !== "" &&
    job.jobSalaryFrom !== null &&
    job.jobSalaryFrom !== undefined &&
    job.jobSalaryTo !== "" &&
    job.jobSalaryTo !== null &&
    job.jobSalaryTo !== undefined &&
    Number.isFinite(minimum) &&
    Number.isFinite(maximum) &&
    maximum < minimum
  ) {
    errors.jobSalaryTo = "Maximum budget cannot be below the minimum";
  }
  return errors;
}
