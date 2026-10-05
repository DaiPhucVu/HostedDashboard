import { buildProviderProfile } from "./providerProfile";

test("builds a manager-facing profile only from Firebase provider and job fields", () => {
  const profile = buildProviderProfile({
    handymanId: "provider-1",
    firstName: "Ayesha",
    lastName: "Rahman",
    verificationStatus: "approved",
    available: true,
    skills: ["Electrical", "Appliance Repair"],
    experienceYears: "6",
    bio: "Residential repair specialist",
    certificateType1: "Electrical licence",
    certificateApprovedStatus: "approved",
    averageRating: 4.7,
    reviewCount: 22,
    area: "Gulshan",
    city: "Dhaka",
    maxConcurrentJobs: 3,
  }, [
    { jobId: "active", assignedTo: "provider-1", jobStatus: "Offered" },
    { jobId: "done", assignedTo: "provider-1", jobStatus: "Done" },
    { jobId: "other", assignedTo: "provider-2", jobStatus: "Offered" },
  ], [
    { jobId: "done", handymanId: "provider-1", reviewerType: "customer", rating: 4.5 },
  ]);

  expect(profile).toMatchObject({
    providerId: "provider-1",
    name: "Ayesha Rahman",
    verified: true,
    skills: ["Electrical", "Appliance Repair"],
    certificateTypes: ["Electrical licence"],
    activeJobs: 1,
    completedJobs: 1,
    averageRating: 4.5,
    reviewCount: 1,
    location: "Gulshan, Dhaka",
  });
});

test("does not expose certificate URLs as profile text", () => {
  const profile = buildProviderProfile({
    handymanId: "provider-1",
    certificates: ["https://storage.example/cert-1", "https://storage.example/cert-2"],
  });

  expect(profile.certificateTypes).toEqual(["2 uploaded documents"]);
  expect(profile.serviceRadiusKm).toBeNull();
  expect(profile.maxConcurrentJobs).toBe(3);
  expect(profile.availabilityStatus).toBe("Not recorded");
});

test("shows legacy trade and specialty fields in the manager profile", () => {
  const profile = buildProviderProfile({
    handymanId: "beauty-provider",
    primaryTrade: "Beauty and Wellness",
    specialties: ["Facial", "Spa"],
  });

  expect(profile.skills).toEqual(["Beauty and Wellness", "Facial", "Spa"]);
});

test("does not treat customer cancellation or profile aggregates as provider performance", () => {
  const profile = buildProviderProfile({
    handymanId: "provider-1",
    averageRating: 5,
    reviewCount: 99,
  }, [
    { jobId: "provider-cancel", assignedTo: "provider-1", jobStatus: "Cancelled", cancelledByType: "provider" },
    { jobId: "customer-cancel", assignedTo: "provider-1", jobStatus: "Cancelled", cancelledByType: "customer" },
  ]);

  expect(profile.reviewCount).toBe(0);
  expect(profile.providerCancelledJobs).toBe(1);
  expect(profile.unattributedCancelledJobs).toBe(1);
});
