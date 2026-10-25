import { PROVIDER_WORKLOAD_LIMIT } from "./workloadPolicy";

export const FACTOR_LABELS = Object.freeze({
  relevantExperience: "Relevant experience",
  rating: "Customer rating",
  reliability: "Reliability",
  availability: "Workload availability",
  distance: "Distance",
});

export const FACTOR_KEYS = Object.freeze(Object.keys(FACTOR_LABELS));

export const humanize = (value) => String(value || "")
  .replaceAll("_", " ")
  .toLowerCase();

const formatNumber = (value, digits = 1) => Number(value || 0).toFixed(digits);

export const factorEvidence = (name, evidence = {}) => {
  if (name === "relevantExperience") {
    const profile = evidence.profileExperience || {};
    const category = evidence.categoryExperience || {};
    const categoryName = humanize(category.categoryId || "related service");
    const completed = `${category.completedJobs || 0} completed ${categoryName} jobs`;
    if (profile.recorded && profile.valid === false) {
      return `Experience value needs review · ${completed}`;
    }
    return profile.recorded
      ? `${formatNumber(profile.yearsExperience)} years · ${completed}`
      : completed;
  }
  if (name === "rating") {
    const rating = evidence.rating || {};
    return rating.usedNeutralPrior
      ? "No customer reviews yet"
      : `${formatNumber(rating.averageRating)}/5 from ${rating.reviewCount || 0} customer reviews`;
  }
  if (name === "reliability") {
    const reliability = evidence.reliability || {};
    return reliability.usedNeutralPrior
      ? "No completed platform jobs yet"
      : `${reliability.completedJobs || 0} completed · ${reliability.providerCancelledJobs || 0} provider-cancelled`;
  }
  if (name === "availability") {
    const availability = evidence.availability || {};
    return `${availability.activeJobs || 0} of ${PROVIDER_WORKLOAD_LIMIT} job slots in use`;
  }
  const distance = evidence.distance || {};
  if (distance.distanceKm === null || distance.distanceKm === undefined) {
    return "Job distance unavailable";
  }
  if (distance.providerLocationSource === "POLICY_DEFAULT_COORDINATES") {
    return "Provider location not recorded";
  }
  if (distance.providerLocationSource === "AREA_CENTROID") {
    return `Approx. ${formatNumber(distance.distanceKm)} km away`;
  }
  return distance.serviceRadiusRecorded
    ? `${formatNumber(distance.distanceKm)} km away · ${formatNumber(distance.serviceRadiusKm, 0)} km service radius`
    : `${formatNumber(distance.distanceKm)} km away`;
};

export const progressVariant = (value) => value >= 0.8
  ? "primary"
  : value >= 0.6
    ? "warning"
    : "danger";
