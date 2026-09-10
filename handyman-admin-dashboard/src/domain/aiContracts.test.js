import {
  getManualAssignmentOptions,
  SUPPORTED_AI_CATEGORIES,
  toAssignmentReviewRequest,
} from "./aiContracts";

test("maps the current Firebase job and provider data into the AI contract", () => {
  const request = toAssignmentReviewRequest(
    {
      jobId: "job-1",
      jobDesc: "Sparks are coming from the kitchen wall outlet",
      jobCat: "Electrical",
      jobLocation: "Banani",
      jobDateFrom: "2026-09-05",
      jobSalaryFrom: "500",
      jobSalaryTo: "1000",
    },
    [{
      handymanId: "provider-1",
      firstName: "Ayesha",
      lastName: "Rahman",
      verified: true,
      skills: ["Electrical", "electrical"],
      area: "Gulshan",
    }],
    [{ jobId: "active-job", assignedTo: "provider-1", jobStatus: "Offered" }]
  );

  expect(request.job).toMatchObject({
    jobId: "job-1",
    categoryHint: "electrical",
    latitude: 23.7937,
    longitude: 90.4066,
  });
  expect(request.providers[0]).toMatchObject({
    providerId: "provider-1",
    verified: true,
    skills: ["electrical"],
    activeJobs: 1,
  });
});

test("normalises legacy Firebase category, skill, address, and verification fields", () => {
  const request = toAssignmentReviewRequest(
    {
      jobId: "legacy-job",
      jobDesc: "The kitchen wall socket is sparking",
      jobCat: "Electric",
      jobLocation: "PC49+55G, R M Paridas Rd, Dhaka 1100, Bangladesh",
      jobDateFrom: "07/09/2026",
    },
    [
      {
        handymanId: "combined-provider",
        verificationStatus: "approved",
        skills: ["Electric and Plumbing"],
      },
      {
        handymanId: "declined-provider",
        verified: true,
        verificationStatus: "declined",
        skills: ["Cleaning Solution"],
      },
    ]
  );

  expect(request.job).toMatchObject({
    categoryHint: "electrical",
    latitude: 23.8103,
    longitude: 90.4125,
  });
  expect(request.providers[0]).toMatchObject({
    verified: true,
    skills: ["electrical", "plumbing"],
  });
  expect(request.providers[1]).toMatchObject({
    verified: false,
    skills: ["cleaning"],
  });
});

test("phone verification alone is not treated as provider verification", () => {
  const request = toAssignmentReviewRequest(
    { jobId: "job-2", jobDesc: "Pipe leak" },
    [{ handymanId: "provider-2", isPhoneVerified: true, skills: ["plumbing"] }]
  );
  expect(request.providers[0].verified).toBe(false);
});

test("disambiguates the legacy combined electrical and plumbing job category", () => {
  const plumbing = toAssignmentReviewRequest({
    jobId: "combined-plumbing",
    jobCat: "Electric & Plumbing",
    jobDesc: "The bathroom pipe is leaking under the sink",
  }, []);
  const electrical = toAssignmentReviewRequest({
    jobId: "combined-electrical",
    jobCat: "Electric & Plumbing",
    jobDesc: "The wall socket sparks when the light is switched on",
  }, []);
  expect(plumbing.job.categoryHint).toBe("plumbing");
  expect(electrical.job.categoryHint).toBe("electrical");
});

test("treats the mobile placeholder coordinate zero-zero as missing", () => {
  const request = toAssignmentReviewRequest({
    jobId: "invalid-location",
    jobCat: "Appliance Repair",
    jobDesc: "g",
    jobLocation: "gf",
    latitude: 0,
    longitude: 0,
  }, []);
  expect(request.job.latitude).toBeNull();
  expect(request.job.longitude).toBeNull();
});

test("manual assignment keeps account and capacity guards but reports skill risk", () => {
  const providers = [
    { handymanId: "eligible", firstName: "Manual", verified: true, available: true, skills: ["cleaning"], area: "Gulshan" },
    { handymanId: "unverified", verified: false, available: true, skills: ["plumbing"], area: "Gulshan" },
    { handymanId: "full", verified: true, available: true, skills: ["plumbing"], area: "Gulshan", maxConcurrentJobs: 1 },
  ];
  const jobs = [{ jobId: "active", assignedTo: "full", jobStatus: "Offered" }];
  const options = getManualAssignmentOptions(
    { jobId: "job", jobCat: "Plumbing", jobDesc: "General plumbing work", jobLocation: "Gulshan" },
    providers,
    jobs,
    { requiredSkills: ["plumbing"] }
  );

  expect(options).toHaveLength(1);
  expect(options[0]).toMatchObject({
    providerId: "eligible",
    warnings: ["MISSING_REQUIRED_SKILL"],
  });
});

test("maps every Android service category to a supported AI skill", () => {
  const mobileCategories = [
    ["A/C Repair Services", "ac_repair", ["ac_repair"]],
    ["Appliance Repair", "appliance_repair", ["appliance_repair"]],
    ["Cleaning Solution", "cleaning", ["cleaning"]],
    ["Beauty and Wellness", "beauty_wellness", ["beauty_wellness"]],
    ["Shifting", "shifting", ["shifting"]],
    ["Men's Care and Salon", "mens_care_salon", ["mens_care_salon"]],
    ["Health and Care", "health_care", ["health_care"]],
    ["Electronics and Gadget Repair", "electronics_repair", ["electronics_repair"]],
    ["Electric and Plumbing", "plumbing", ["electrical", "plumbing"]],
    ["Pest Control", "pest_control", ["pest_control"]],
    ["Driver Service", "driver_service", ["driver_service"]],
    ["Car Care Services", "car_care", ["car_care"]],
    ["Trips and Travel", "trips_travel", ["trips_travel"]],
    ["Car Rental", "car_rental", ["car_rental"]],
    ["Painting and Renovation", "painting", ["painting"]],
    ["Emergency Service", "emergency_service", ["emergency_service"]],
  ];

  mobileCategories.forEach(([label, expectedCategory, expectedSkills]) => {
    const request = toAssignmentReviewRequest(
      {
        jobId: `job-${expectedCategory}`,
        jobCat: label,
        jobDesc: label === "Electric and Plumbing"
          ? "The bathroom pipe is leaking"
          : `Customer requests ${label}`,
      },
      [{ handymanId: `provider-${expectedCategory}`, skills: [label] }]
    );
    expect(request.job.categoryHint).toBe(expectedCategory);
    expect(request.providers[0].skills).toEqual(expectedSkills);
    expect(SUPPORTED_AI_CATEGORIES).toContain(expectedCategory);
  });
});

test("normalises legacy provider trade and specialty fields into a category family", () => {
  const request = toAssignmentReviewRequest(
    {
      jobId: "beauty-job",
      jobCat: "Beauty and Wellness",
      jobDesc: "I need a beauty service",
    },
    [{
      handymanId: "beauty-provider",
      primaryTrade: "Beauty and Wellness",
      specialties: ["Facial", "Spa"],
      verified: true,
    }]
  );

  expect(request.providers[0].skills).toEqual([
    "beauty_wellness",
    "facial",
    "spa",
  ]);
});

test("a specialty provider is not marked as a skill risk for its service family", () => {
  const options = getManualAssignmentOptions(
    {
      jobId: "beauty-job",
      jobCat: "Beauty and Wellness",
      jobDesc: "I need a wellness service",
      jobLocation: "Gulshan",
    },
    [{
      handymanId: "facial-provider",
      firstName: "Nusrat",
      specialties: ["Facial"],
      verified: true,
      available: true,
      area: "Gulshan",
    }],
    [],
    { requiredSkills: ["beauty_wellness"] }
  );

  expect(options).toHaveLength(1);
  expect(options[0].warnings).toEqual([]);
});
