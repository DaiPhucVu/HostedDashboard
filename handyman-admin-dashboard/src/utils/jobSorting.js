const creationTime = (job) => {
  const value = job?.createdAt ?? job?.postedAt ?? job?.created_at;
  if (typeof value === "number") return value;
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const newestJobsFirst = (jobs) => [...jobs].sort((left, right) => {
  const timeDifference = creationTime(right) - creationTime(left);
  if (timeDifference !== 0) return timeDifference;
  return String(right.jobId || "").localeCompare(String(left.jobId || ""));
});
