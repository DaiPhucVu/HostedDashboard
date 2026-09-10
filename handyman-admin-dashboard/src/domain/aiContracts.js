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

const SKILL_ALIASES = Object.freeze({
  plumber: ["plumbing", "plumber"],
  plumbing: ["plumbing"],
  electrician: ["electrical", "electrician"],
  electric: ["electrical"],
  electrical: ["electrical"],
  "electric & plumbing": ["electrical", "plumbing"],
  "electric and plumbing": ["electrical", "plumbing"],
  "appliance repair": ["appliance_repair"],
  appliance_repair: ["appliance_repair"],
  "a/c repair services": ["ac_repair"],
  "a/c repair": ["ac_repair"],
  "ac repair services": ["ac_repair"],
  "ac repair": ["ac_repair"],
  cleaning: ["cleaning"],
  "cleaning solution": ["cleaning"],
  painting: ["painting"],
  "painting & renovation": ["painting"],
  "painting and renovation": ["painting"],
  "beauty & wellness": ["beauty_wellness"],
  "beauty and wellness": ["beauty_wellness"],
  shifting: ["shifting"],
  "men's care & salon": ["mens_care_salon"],
  "men's care and salon": ["mens_care_salon"],
  "mens care & salon": ["mens_care_salon"],
  "mens care and salon": ["mens_care_salon"],
  "health & care": ["health_care"],
  "health and care": ["health_care"],
  "electronics & gadgets repair": ["electronics_repair"],
  "electronics and gadgets repair": ["electronics_repair"],
  "electronics and gadget repair": ["electronics_repair"],
  "pest control": ["pest_control"],
  "driver service": ["driver_service"],
  "car care services": ["car_care"],
  "trips & travels": ["trips_travel"],
  "trips and travels": ["trips_travel"],
  "trips and travel": ["trips_travel"],
  "car rental": ["car_rental"],
  "emergency services": ["emergency_service"],
  "emergency service": ["emergency_service"],
  "pipe fitting": ["plumbing", "pipe_fitting"],
  wiring: ["electrical", "wiring"],
  cleaner: ["cleaning", "cleaner"],
  "deep cleaning": ["cleaning", "deep_cleaning"],
  "fridge repair": ["appliance_repair", "fridge_repair"],
  "washing machine repair": ["appliance_repair", "washing_machine_repair"],
  "oven repair": ["appliance_repair", "oven_repair"],
  painter: ["painting", "painter"],
  renovation: ["painting", "renovation"],
  hvac: ["ac_repair", "hvac"],
  "air conditioning": ["ac_repair", "air_conditioning"],
  beautician: ["beauty_wellness", "beautician"],
  makeup: ["beauty_wellness", "makeup"],
  "makeup artist": ["beauty_wellness", "makeup_artist"],
  facial: ["beauty_wellness", "facial"],
  spa: ["beauty_wellness", "spa"],
  skincare: ["beauty_wellness", "skincare"],
  massage: ["beauty_wellness", "massage"],
  wellness: ["beauty_wellness", "wellness"],
  "house moving": ["shifting", "house_moving"],
  packing: ["shifting", "packing"],
  barber: ["mens_care_salon", "barber"],
  haircut: ["mens_care_salon", "haircut"],
  shaving: ["mens_care_salon", "shaving"],
  grooming: ["mens_care_salon", "grooming"],
  caregiver: ["health_care", "caregiver"],
  nursing: ["health_care", "nursing"],
  "elderly care": ["health_care", "elderly_care"],
  "phone repair": ["electronics_repair", "phone_repair"],
  "mobile repair": ["electronics_repair", "mobile_repair"],
  "laptop repair": ["electronics_repair", "laptop_repair"],
  "termite control": ["pest_control", "termite_control"],
  "rodent control": ["pest_control", "rodent_control"],
  driver: ["driver_service", "driver"],
  chauffeur: ["driver_service", "chauffeur"],
  "car wash": ["car_care", "car_wash"],
  "car mechanic": ["car_care", "car_mechanic"],
  "tour guide": ["trips_travel", "tour_guide"],
  "travel agent": ["trips_travel", "travel_agent"],
  "vehicle rental": ["car_rental", "vehicle_rental"],
  "emergency response": ["emergency_service", "emergency_response"],
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
    return { latitude, longitude };
  }
  const area = String(record.area || record.city || record.thana || "").trim().toLowerCase();
  if (AREA_COORDINATES[area]) return AREA_COORDINATES[area];
  const areaMatch = Object.keys(AREA_COORDINATES).find((knownArea) => area.includes(knownArea));
  return areaMatch ? AREA_COORDINATES[areaMatch] : fallback;
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

export function toProviderProfile(provider, activeJobs = 0) {
  const coordinates = coordinatesFor(provider);
  const unavailable = ["unavailable", "inactive", "suspended"].includes(
    String(provider.availabilityStatus || provider.status || "").trim().toLowerCase()
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
    serviceRadiusKm: asNumber(provider.serviceRadiusKm, 25),
    activeJobs: Math.max(0, asNumber(provider.activeJobs, activeJobs)),
    maxConcurrentJobs: Math.max(1, asNumber(provider.maxConcurrentJobs, 3)),
    averageRating: Math.min(5, Math.max(0, asNumber(provider.averageRating ?? provider.rating, 4))),
    reviewCount: Math.max(0, asNumber(provider.reviewCount, 0)),
    completionRate: Math.min(1, Math.max(0, asNumber(provider.completionRate, 0.9))),
    cancellationRate: Math.min(1, Math.max(0, asNumber(provider.cancellationRate, 0.05))),
    medianResponseMinutes: Math.max(0, asNumber(provider.medianResponseMinutes, 30)),
  };
}

export function toAssignmentReviewRequest(job, providers, jobs = []) {
  const activeJobCounts = jobs.reduce((counts, item) => {
    if (item.assignedTo && !["done", "completed", "cancelled"].includes(
      String(item.jobStatus || "").trim().toLowerCase()
    )) {
      counts[item.assignedTo] = (counts[item.assignedTo] || 0) + 1;
    }
    return counts;
  }, {});
  return {
    job: toTriageJob(job),
    providers: providers.map((provider) => toProviderProfile(
      provider,
      activeJobCounts[provider.handymanId || provider.id] || 0
    )),
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
    if ([...requiredSkills].some((skill) => !profile.skills.includes(skill))) {
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
      maxConcurrentJobs: profile.maxConcurrentJobs,
      warnings,
      eligible: profile.verified && profile.available && profile.activeJobs < profile.maxConcurrentJobs,
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
  return review;
}
