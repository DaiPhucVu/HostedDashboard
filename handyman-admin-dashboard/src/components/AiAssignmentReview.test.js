import React from "react";
import { act, render, screen } from "@testing-library/react";

import AiAssignmentReview from "./AiAssignmentReview";


describe("AI assignment loading state", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("shows staged matching progress while the AI request is running", () => {
    render(
      <AiAssignmentReview
        loading
        review={null}
        error=""
        providers={[]}
        selectedProviderId={null}
        jobStatus="Open"
      />
    );

    expect(screen.getByText("Smart matching in progress")).toBeTruthy();
    expect(screen.getByText("Understanding the request")).toBeTruthy();
    expect(screen.getByText("Reading the selected service category and customer description.")).toBeTruthy();

    act(() => jest.advanceTimersByTime(10000));

    expect(screen.getByText("Checking provider eligibility")).toBeTruthy();
    expect(screen.getByText("Applying verification, availability, capacity and distance rules.")).toBeTruthy();
    expect(screen.getByText("10s")).toBeTruthy();
  });
});

describe("provider ranking evidence", () => {
  const candidate = {
    providerId: "provider-1",
    rank: 1,
    totalScore: 0.82,
    scoreBreakdown: {
      skillMatch: 1,
      relevantExperience: 0.8,
      rating: 0.6,
      reliability: 0.7,
      availability: 1,
      distance: 0.9,
    },
    reasonCodes: ["CATEGORY_SKILL_MATCH"],
    evidence: {
      profileExperience: { yearsExperience: 8, recorded: true },
      categoryExperience: { categoryId: "plumbing", completedJobs: 0 },
      rating: { usedNeutralPrior: true, reviewCount: 0 },
      reliability: { usedNeutralPrior: true, completedJobs: 0, providerCancelledJobs: 0 },
      availability: {
        activeJobs: 0,
        maxConcurrentJobs: 3,
        availabilityRecorded: true,
        capacityRecorded: true,
      },
      distance: {
        distanceKm: 2.4,
        serviceRadiusKm: 20,
        providerLocationSource: "RECORDED_COORDINATES",
        serviceRadiusRecorded: true,
      },
    },
  };
  const review = {
    triage: {
      categoryId: "plumbing",
      urgency: "NORMAL",
      confidence: 0.9,
      triageStatus: "READY_FOR_ASSIGNMENT",
      issueSummary: "Leaking pipe",
      missingFields: [],
    },
    ranking: { candidates: [candidate], alternatives: [] },
  };

  test("shows traceable evidence for each weighted factor", () => {
    render(
      <AiAssignmentReview
        review={review}
        loading={false}
        error=""
        providers={[{ handymanId: "provider-1", firstName: "Rafi", lastName: "Khan" }]}
        selectedProviderId={null}
        jobStatus="Open"
        onSelectProvider={() => {}}
      />
    );

    expect(screen.getByText("Relevant experience")).toBeTruthy();
    expect(screen.getByText("8.0 years · 0 completed plumbing jobs")).toBeTruthy();
    expect(screen.getByText("No customer reviews yet")).toBeTruthy();
    expect(screen.getByText("No completed platform jobs yet")).toBeTruthy();
    expect(screen.getByText("Workload availability")).toBeTruthy();
    expect(screen.getByText("0 of 3 job slots in use")).toBeTruthy();
    expect(screen.getByText("2.4 km away · 20 km service radius")).toBeTruthy();
    expect(screen.queryByText("Skills")).toBeNull();
    expect(screen.queryByText(/category skill match/i)).toBeNull();
    expect(screen.queryByText(/neutral prior/i)).toBeNull();
    expect(screen.queryByText(/Confidence:/i)).toBeNull();
  });
});
