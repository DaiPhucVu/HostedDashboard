import { buildProviderHistory } from "./providerHistory";
import { PROVIDER_WORKLOAD_LIMIT, hasWorkloadCapacity } from "./workloadPolicy";

export const TRIAGE_STATUSES = Object.freeze([
  "NEEDS_INFO",
  "MANUAL_REVIEW",
  "READY_FOR_ASSIGNMENT",
]);

const AREA_COORDINATES = Object.freeze({
  banani: { latitude: 23.7937, longitude: 90.4066 },
  dhanmondi: { latitude: 23.7461, longitude: 90.3742 },
  gulshan: { latitude: 23.7925, longitude: 90.4078 },
  uttara: { latitude: 23.8759, longitude: 90.3795 },
  mirpur: { latitude: 23.8223, longitude: 90.3654 },
  mohammadpur: { latitude: 23.7588, longitude: 90.363 },
  badda: { latitude: 23.7806, longitude: 90.4267 },
  tejgaon: { latitude: 23.763, longitude: 90.401 },
  dhaka: { latitude: 23.8103, longitude: 90.4125 },
});

const FALLBACK_COORDINATES = { latitude: 23.8103, longitude: 90.4125 };

export const SUPPORTED_AI_CATEGORIES = Object.freeze([
  "plumbing",
  "electrical",
  "cleaning",
  "appliance_repair",
  "painting",
  "ac_repair",
  "beauty_wellness",
  "shifting",
  "mens_care_salon",
  "health_care",
  "electronics_repair",
  "pest_control",
  "driver_service",
  "car_care",
  "trips_travel",
  "car_rental",
  "emergency_service",
]);

const CATEGORY_ALIASES = Object.freeze({
  plumbing: "plumbing",
  electrical: "electrical",
  electric: "electrical",
  cleaning: "cleaning",
  "cleaning solution": "cleaning",
  "appliance repair": "appliance_repair",
  appliance_repair: "appliance_repair",
  "a/c repair services": "ac_repair",
  "a/c repair": "ac_repair",
  "ac repair services": "ac_repair",
  "ac repair": "ac_repair",
  painting: "painting",
  "painting & renovation": "painting",
  "painting and renovation": "painting",
  "beauty & wellness": "beauty_wellness",
  "beauty and wellness": "beauty_wellness",
  shifting: "shifting",
  "men's care & salon": "mens_care_salon",
  "men's care and salon": "mens_care_salon",
  "mens care & salon": "mens_care_salon",
  "mens care and salon": "mens_care_salon",
  "health & care": "health_care",
  "health and care": "health_care",
  "electronics & gadgets repair": "electronics_repair",
  "electronics and gadgets repair": "electronics_repair",
  "electronics and gadget repair": "electronics_repair",
  "pest control": "pest_control",
  "driver service": "driver_service",
  "car care services": "car_care",
  "trips & travels": "trips_travel",
  "trips and travels": "trips_travel",
  "trips and travel": "trips_travel",
  "car rental": "car_rental",
  "emergency services": "emergency_service",
  "emergency service": "emergency_service",
});

export const SERVICE_FAMILY_ALIASES = Object.freeze({
  plumbing: [
    "plumbing", "plumber", "pipe fitting", "pipe repair", "faucet repair",
    "tap repair", "drain repair", "drain cleaning", "toilet repair", "sink repair",
    "leak repair", "bathroom plumbing", "water line repair",
  ],
  electrical: [
    "electrical", "electric", "electrician", "wiring", "socket repair",
    "outlet repair", "switch repair", "lighting", "light installation",
    "circuit breaker", "fan installation", "electrical installation", "power fault",
  ],
  cleaning: [
    "cleaning", "cleaner", "cleaning solution", "deep cleaning", "house cleaning",
    "home cleaning", "office cleaning", "kitchen cleaning", "bathroom cleaning",
    "carpet cleaning", "window cleaning", "move out cleaning",
  ],
  appliance_repair: [
    "appliance repair", "fridge repair", "refrigerator repair", "washing machine repair",
    "oven repair", "microwave repair", "dishwasher repair", "dryer repair",
    "freezer repair", "cooker repair", "water heater repair",
  ],
  painting: [
    "painting", "painter", "painting and renovation", "painting & renovation",
    "wall painting", "house painting", "interior painting", "exterior painting",
    "renovation", "home renovation", "wallpaper", "plastering",
  ],
  ac_repair: [
    "a/c repair services", "a/c repair", "ac repair services", "ac repair", "hvac",
    "air conditioning", "air conditioner repair", "ac installation", "ac servicing",
    "ac cleaning", "ac gas refill",
  ],
  beauty_wellness: [
    "beauty and wellness", "beauty & wellness", "beautician", "makeup", "makeup artist",
    "facial", "spa", "skincare", "massage", "wellness", "manicure", "pedicure",
    "waxing", "beauty treatment", "hair styling",
  ],
  shifting: [
    "shifting", "house moving", "home moving", "moving", "packing", "mover",
    "furniture moving", "office relocation", "loading", "unloading",
  ],
  mens_care_salon: [
    "men's care and salon", "men's care & salon", "mens care and salon",
    "mens care & salon", "barber", "men's haircut", "mens haircut", "haircut",
    "shaving", "grooming", "beard trim", "men's grooming", "mens grooming",
    "men's hair styling", "mens hair styling", "salon service",
  ],
  health_care: [
    "health and care", "health & care", "caregiver", "home care", "patient care",
    "elderly care", "nursing", "home nursing", "physiotherapy", "disability care",
  ],
  electronics_repair: [
    "electronics and gadget repair", "electronics and gadgets repair",
    "electronics & gadgets repair", "electronics repair", "gadget repair", "phone repair",
    "mobile repair", "laptop repair", "computer repair", "tablet repair", "tv repair",
    "screen replacement", "device repair",
  ],
  pest_control: [
    "pest control", "cockroach control", "termite control", "rodent control",
    "rat control", "bed bug control", "mosquito control", "fumigation",
  ],
  driver_service: [
    "driver service", "driver", "personal driver", "chauffeur", "driving service",
    "designated driver",
  ],
  car_care: [
    "car care services", "car care", "car wash", "car mechanic", "vehicle service",
    "vehicle repair", "car repair", "oil change", "tyre service", "tire service",
    "battery service", "car detailing",
  ],
  trips_travel: [
    "trips and travel", "trips and travels", "trips & travels", "travel planning",
    "tour guide", "travel agent", "trip booking", "tour package", "ticket booking",
    "hotel booking",
  ],
  car_rental: [
    "car rental", "vehicle rental", "rent a car", "hire a car", "car hire",
    "self drive rental",
  ],
  emergency_service: [
    "emergency service", "emergency services", "emergency response", "urgent assistance",
    "immediate help", "roadside assistance",
  ],
});

const normaliseSkillAlias = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const familyAliasEntries = Object.entries(SERVICE_FAMILY_ALIASES).flatMap(([family, aliases]) =>
  aliases.flatMap((alias) => {
    const token = normaliseSkillAlias(alias);
    const isFamilyLabel = CATEGORY_ALIASES[alias.toLowerCase()] === family;
    const mapped = isFamilyLabel ? [family] : [...new Set([family, token])];
    return [[alias.toLowerCase(), mapped], [token, mapped]];
  })
);

const SKILL_ALIASES = Object.freeze({
  ...Object.fromEntries(familyAliasEntries),
  "electric & plumbing": ["electrical", "plumbing"],
  "electric and plumbing": ["electrical", "plumbing"],
  electric_and_plumbing: ["electrical", "plumbing"],
});

const asNumber = (value, fallback) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asUniqueList = (value) => {
  const values = Array.isArray(value)
    ? value.flatMap((item) => Array.isArray(item) ? item : String(item || "").split(","))
    : String(value || "").split(",");
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
};

const canonicalSkills = (value, description = "") => {
  const skills = asUniqueList(value).flatMap((skill) => SKILL_ALIASES[skill] || [skill.replaceAll(" ", "_")]);
  const text = ` ${String(description || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  Object.entries(SKILL_ALIASES).forEach(([alias, mapped]) => {
    const normalisedAlias = alias.replace(/[^a-z0-9]+/g, " ").trim();
    if (normalisedAlias && text.includes(` ${normalisedAlias} `)) skills.push(...mapped);
  });
  return [...new Set(skills)];
};

export const canonicalCategory = (value) => CATEGORY_ALIASES[String(value || "").trim().toLowerCase()] || null;

export const canonicalJobCategory = (job) => {
  const rawCategory = String(job?.jobCat || job?.category || "").trim().toLowerCase();
  if (["electric & plumbing", "electric and plumbing", "electric & plumbing services"].includes(rawCategory)) {
    const description = String(job?.jobDesc || job?.description || "").toLowerCase();
    if (/\b(pipe|tap|faucet|leak|drain|toilet|plumb)/.test(description)) return "plumbing";
    if (/\b(power|socket|outlet|wire|spark|electric|light|switch)/.test(description)) return "electrical";
    return null;
  }
  return canonicalCategory(rawCategory);
};

const coordinatesFor = (record, fallback = FALLBACK_COORDINATES) => {
  const latitude = asNumber(record.latitude, NaN);
  const longitude = asNumber(record.longitude, NaN);
  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  ) {
    return { latitude, longitude, source: "RECORDED_COORDINATES" };
  }
  const area = String(record.area || record.city || record.thana || "").trim().toLowerCase();
  if (AREA_COORDINATES[area]) return { ...AREA_COORDINATES[area], source: "AREA_CENTROID" };
  const areaMatch = Object.keys(AREA_COORDINATES).find((knownArea) => area.includes(knownArea));
  if (areaMatch) return { ...AREA_COORDINATES[areaMatch], source: "AREA_CENTROID" };
  return {
    ...fallback,
    source: fallback.latitude === null ? "MISSING" : "POLICY_DEFAULT_COORDINATES",
  };
};

const isVerified = (provider) => {
  const status = String(provider.verificationStatus || "").trim().toLowerCase();
  if (["declined", "rejected", "pending", "suspended", "inactive"].includes(status)) return false;
  if (["approved", "verified", "active"].includes(status)) return true;
  return provider.verified === true || provider.verified === "true";
};

export function toTriageJob(job) {
  const locationText = job.jobLocation || job.location || null;
  const coordinates = coordinatesFor(
    { ...job, area: locationText },
    { latitude: null, longitude: null }
  );
  return {
    jobId: job.jobId,
    description: job.jobDesc || job.description || "",
    categoryHint: canonicalJobCategory(job),
    languageHint: null,
    locationText,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    startAt: job.jobDateFrom || null,
    endAt: job.jobDateTo || null,
    budgetMin: job.jobSalaryFrom ? asNumber(job.jobSalaryFrom, null) : null,
    budgetMax: job.jobSalaryTo ? asNumber(job.jobSalaryTo, null) : null,
  };
}

export function toProviderProfile(provider, history = buildProviderHistory("", [], [])) {
  const coordinates = coordinatesFor(provider);
  const recordedExperience = asNumber(provider.experienceYears, null);
  const recordedServiceRadius = asNumber(provider.serviceRadiusKm, null);
  const availabilityStatus = String(provider.availabilityStatus || provider.status || "").trim();
  const unavailable = ["unavailable", "inactive", "suspended"].includes(
    availabilityStatus.toLowerCase()
  );
  const recordedSkills = [
    provider.skills,
    provider.primaryTrade,
    provider.trade,
    provider.serviceCategory,
    provider.category,
    provider.specialties,
    provider.specialisations,
  ];
  const skillDescription = [provider.bio, provider.skillDescription, provider.expertise]
    .filter(Boolean)
    .join(" ");
  return {
    providerId: provider.handymanId || provider.id,
    displayName: `${provider.firstName || ""} ${provider.lastName || ""}`.trim() ||
      provider.email || provider.handymanId || provider.id,
    verified: isVerified(provider),
    skills: canonicalSkills(recordedSkills, skillDescription),
    languages: asUniqueList(provider.languages || ["bn", "en"]),
    available: provider.available !== false && provider.available !== "false" && !unavailable,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    serviceRadiusKm: recordedServiceRadius > 0 ? recordedServiceRadius : 25,
    activeJobs: history.activeJobs,
    maxConcurrentJobs: PROVIDER_WORKLOAD_LIMIT,
    averageRating: history.averageRating,
    reviewCount: history.reviewCount,
    completionRate: history.completedJobs + history.providerCancelledJobs > 0
      ? history.completedJobs / (history.completedJobs + history.providerCancelledJobs)
      : 0,
    cancellationRate: history.completedJobs + history.providerCancelledJobs > 0
      ? history.providerCancelledJobs / (history.completedJobs + history.providerCancelledJobs)
      : 0,
    medianResponseMinutes: Math.max(0, asNumber(provider.medianResponseMinutes, 0)),
    yearsExperience: Math.max(0, recordedExperience || 0),
    yearsExperienceRecorded: recordedExperience !== null,
    completedJobs: history.completedJobs,
    completedJobsByCategory: history.completedJobsByCategory,
    providerCancelledJobs: history.providerCancelledJobs,
    locationSource: coordinates.source,
    serviceRadiusRecorded: recordedServiceRadius > 0,
    availabilityRecorded: true,
    capacityRecorded: true,
  };
}

export function toAssignmentReviewRequest(job, providers, jobs = [], reviews = []) {
  const historyJobs = jobs.map((item) => ({
    ...item,
    canonicalCategory: canonicalJobCategory(item),
  }));
  return {
    job: toTriageJob(job),
    providers: providers.map((provider) => {
      const providerId = provider.handymanId || provider.id;
      return toProviderProfile(
        provider,
        buildProviderHistory(providerId, historyJobs, reviews)
      );
    }),
  };
}

const distanceKm = (from, to) => {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export function getManualAssignmentOptions(job, providers, jobs = [], triage = null) {
  const request = toAssignmentReviewRequest(job, providers, jobs);
  const requiredSkills = new Set(triage?.requiredSkills || []);

  return request.providers.map((profile, index) => {
    const warnings = [];
    if ([...requiredSkills].some((skill) => (
      !profile.skills.includes(skill) &&
      Number(profile.completedJobsByCategory?.[skill] || 0) <= 0
    ))) {
      warnings.push("MISSING_REQUIRED_SKILL");
    }
    if (request.job.latitude === null || request.job.longitude === null) {
      warnings.push("JOB_LOCATION_MISSING");
    } else if (distanceKm(request.job, profile) > profile.serviceRadiusKm) {
      warnings.push("OUTSIDE_SERVICE_RADIUS");
    }
    return {
      provider: providers[index],
      providerId: profile.providerId,
      displayName: profile.displayName,
      skills: profile.skills,
      activeJobs: profile.activeJobs,
      warnings,
      eligible: profile.verified && profile.available && hasWorkloadCapacity(profile.activeJobs),
    };
  }).filter((option) => option.eligible)
    .sort((left, right) => left.warnings.length - right.warnings.length ||
      left.displayName.localeCompare(right.displayName));
}

export function assertAiReview(review, jobId) {
  if (!review?.triage || !review?.ranking) throw new Error("AI review response is incomplete");
  if (!TRIAGE_STATUSES.includes(review.triage.triageStatus)) {
    throw new Error("AI review returned an unknown triage status");
  }
  if (review.triage.jobId !== jobId || review.ranking.jobId !== jobId) {
    throw new Error("AI review does not match the selected job");
  }
  if (!Array.isArray(review.ranking.candidates)) {
    throw new Error("AI review is missing provider candidates");
  }
  if (review.autoAssignment) {
    if (!["AUTO_ASSIGN", "MANUAL_REVIEW"].includes(review.autoAssignment.decision)) {
      throw new Error("AI review returned an unknown automatic assignment decision");
    }
    if (!Array.isArray(review.autoAssignment.reasonCodes)) {
      throw new Error("AI review is missing automatic assignment reason codes");
    }
  }
  return review;
}
