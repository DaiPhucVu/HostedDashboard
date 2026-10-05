const COMPLETED_STATUSES = new Set(["done", "completed", "complete"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);
const INACTIVE_STATUSES = new Set(["inactive"]);

const normalise = (value) => String(value || "").trim().toLowerCase();

const assignedProviderId = (job) => String(
  job?.assignedTo || job?.assignment?.providerId || job?.assignment?.assignedTo || ""
);

const cancellationActorType = (job) => normalise(
  job?.cancelledByType ||
  job?.canceledByType ||
  job?.cancellation?.actorType ||
  job?.assignment?.cancelledByType
);

export function buildProviderHistory(providerId, jobs = [], reviews = []) {
  const providerJobs = jobs.filter((job) => assignedProviderId(job) === providerId);
  const completedJobs = providerJobs.filter((job) => COMPLETED_STATUSES.has(
    normalise(job.jobStatus || job.status)
  ));
  const completedJobIds = new Set(completedJobs.map((job) => job.jobId).filter(Boolean));
  const completedJobsByCategory = completedJobs.reduce((counts, job) => {
    const category = String(job.canonicalCategory || "").trim();
    if (category) counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});

  let providerCancelledJobs = 0;
  let unattributedCancelledJobs = 0;
  providerJobs.forEach((job) => {
    if (!CANCELLED_STATUSES.has(normalise(job.jobStatus || job.status))) return;
    const actorType = cancellationActorType(job);
    if (["provider", "handyman", "worker"].includes(actorType)) {
      providerCancelledJobs += 1;
    } else {
      unattributedCancelledJobs += 1;
    }
  });

  const activeJobs = providerJobs.filter((job) => {
    const status = normalise(job.jobStatus || job.status);
    return !COMPLETED_STATUSES.has(status) &&
      !CANCELLED_STATUSES.has(status) &&
      !INACTIVE_STATUSES.has(status);
  }).length;

  const validRatings = reviews
    .filter((review) => String(review?.handymanId || "") === providerId)
    .filter((review) => normalise(review.reviewerType) === "customer")
    .filter((review) => completedJobIds.has(review.jobId))
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);

  return {
    totalAssignedJobs: providerJobs.length,
    completedJobs: completedJobs.length,
    completedJobsByCategory: Object.fromEntries(
      Object.entries(completedJobsByCategory).sort(([left], [right]) => left.localeCompare(right))
    ),
    providerCancelledJobs,
    unattributedCancelledJobs,
    activeJobs,
    averageRating: validRatings.length
      ? validRatings.reduce((total, rating) => total + rating, 0) / validRatings.length
      : 0,
    reviewCount: validRatings.length,
  };
}
