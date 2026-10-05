import { buildProviderHistory } from "./providerHistory";

test("derives provider performance from Firebase jobs and valid customer reviews", () => {
  const jobs = [
    { jobId: "done-plumbing", assignedTo: "provider-1", jobStatus: "Done", canonicalCategory: "plumbing" },
    { jobId: "done-cleaning", assignedTo: "provider-1", jobStatus: "Completed", canonicalCategory: "cleaning" },
    { jobId: "provider-cancel", assignedTo: "provider-1", jobStatus: "Cancelled", cancelledByType: "provider", canonicalCategory: "plumbing" },
    { jobId: "customer-cancel", assignedTo: "provider-1", jobStatus: "Cancelled", cancelledByType: "customer", canonicalCategory: "plumbing" },
    { jobId: "active", assignedTo: "provider-1", jobStatus: "In Progress", canonicalCategory: "plumbing" },
    { jobId: "other", assignedTo: "provider-2", jobStatus: "Done", canonicalCategory: "plumbing" },
  ];
  const reviews = [
    { jobId: "done-plumbing", handymanId: "provider-1", reviewerType: "customer", rating: 5 },
    { jobId: "done-cleaning", handymanId: "provider-1", reviewerType: "handyman", rating: 1 },
    { jobId: "active", handymanId: "provider-1", reviewerType: "customer", rating: 4 },
  ];

  expect(buildProviderHistory("provider-1", jobs, reviews)).toEqual({
    totalAssignedJobs: 5,
    completedJobs: 2,
    completedJobsByCategory: { cleaning: 1, plumbing: 1 },
    providerCancelledJobs: 1,
    unattributedCancelledJobs: 1,
    activeJobs: 1,
    averageRating: 5,
    reviewCount: 1,
  });
});

test("returns an explicit zero-history record for a new provider", () => {
  expect(buildProviderHistory("new-provider", [], [])).toEqual({
    totalAssignedJobs: 0,
    completedJobs: 0,
    completedJobsByCategory: {},
    providerCancelledJobs: 0,
    unattributedCancelledJobs: 0,
    activeJobs: 0,
    averageRating: 0,
    reviewCount: 0,
  });
});
