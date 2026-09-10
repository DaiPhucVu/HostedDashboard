const asList = (value) => {
  const values = Array.isArray(value)
    ? value.flatMap((item) => Array.isArray(item) ? item : String(item || "").split(","))
    : String(value || "").split(",");
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
};

const providerIdOf = (provider) => provider?.handymanId || provider?.id || "";
const assignedProviderId = (job) => job?.assignedTo || job?.assignment?.providerId || job?.assignment?.assignedTo || "";
const asRecordedNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const certificateSummary = (provider) => {
  const namedTypes = [provider?.certificateType1, provider?.certificateType2].filter(Boolean);
  if (namedTypes.length > 0) return namedTypes;
  const certificates = asList(provider?.certificates);
  if (certificates.some((certificate) => /^https?:\/\//i.test(certificate))) {
    return [`${certificates.length} uploaded document${certificates.length === 1 ? "" : "s"}`];
  }
  return certificates;
};

export function buildProviderProfile(provider, jobs = []) {
  const providerId = providerIdOf(provider);
  const providerJobs = jobs.filter((job) => assignedProviderId(job) === providerId);
  const statusOf = (job) => String(job?.jobStatus || "").trim().toLowerCase();
  const completedJobs = providerJobs.filter((job) => ["done", "completed", "complete"].includes(statusOf(job))).length;
  const cancelledJobs = providerJobs.filter((job) => ["cancelled", "canceled"].includes(statusOf(job))).length;
  const activeJobs = providerJobs.length - completedJobs - cancelledJobs;
  const recordedVerificationStatus = String(provider?.verificationStatus || "").trim();
  const approvedStatus = ["approved", "verified", "active"].includes(recordedVerificationStatus.toLowerCase());
  const rejectedStatus = ["declined", "rejected", "unverified", "suspended", "inactive"].includes(recordedVerificationStatus.toLowerCase());
  const verified = approvedStatus || provider?.verified === true || provider?.verified === "true"
    ? true
    : rejectedStatus || provider?.verified === false || provider?.verified === "false"
      ? false
      : null;
  const verificationStatus = recordedVerificationStatus ||
    (verified === true ? "Verified" : verified === false ? "Unverified" : "Not recorded");
  const recordedAvailabilityStatus = String(provider?.availabilityStatus || provider?.status || "").trim();
  const unavailable = ["unavailable", "inactive", "suspended"].includes(
    recordedAvailabilityStatus.toLowerCase()
  );
  const explicitlyAvailable = provider?.available === true || provider?.available === "true" ||
    ["available", "active"].includes(recordedAvailabilityStatus.toLowerCase());
  const explicitlyUnavailable = provider?.available === false || provider?.available === "false" || unavailable;
  const available = explicitlyAvailable ? true : explicitlyUnavailable ? false : null;
  const location = [...new Set([
    provider?.area,
    provider?.city,
    provider?.district,
    provider?.country,
  ].map((value) => String(value || "").trim()).filter(Boolean))].join(", ");

  return {
    providerId,
    name: `${provider?.firstName || provider?.first_name || ""} ${provider?.lastName || provider?.last_name || ""}`.trim() ||
      provider?.displayName || provider?.name || provider?.email || providerId,
    verificationStatus,
    verified,
    availabilityStatus: recordedAvailabilityStatus ||
      (available === true ? "Available" : available === false ? "Unavailable" : "Not recorded"),
    available,
    skills: asList([
      provider?.skills,
      provider?.primaryTrade,
      provider?.trade,
      provider?.serviceCategory,
      provider?.category,
      provider?.specialties,
      provider?.specialisations,
    ]),
    experienceYears: String(provider?.experienceYears ?? "").trim(),
    bio: String(provider?.bio || "").trim(),
    certificateTypes: certificateSummary(provider),
    certificateStatus: String(provider?.certificateApprovedStatus || "").trim(),
    averageRating: asRecordedNumber(provider?.averageRating ?? provider?.rating),
    reviewCount: asRecordedNumber(provider?.reviewCount),
    location,
    serviceRadiusKm: asRecordedNumber(provider?.serviceRadiusKm),
    activeJobs,
    completedJobs,
    cancelledJobs,
    maxConcurrentJobs: asRecordedNumber(provider?.maxConcurrentJobs),
  };
}
