import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import AssignedProviderSummary from "./AssignedProviderSummary";

test("shows the assigned provider profile action and stored ranking explanation", () => {
  const provider = {
    handymanId: "provider-1",
    firstName: "Rafi",
    lastName: "Khan",
    verificationStatus: "approved",
  };
  const onViewProvider = jest.fn();
  render(
    <AssignedProviderSummary
      job={{
        assignedTo: "provider-1",
        assignedAt: "2026-10-03T10:00:00.000Z",
        assignmentMethod: "AUTO_AI_RECOMMENDED",
        assignmentAudit: {
          rankingVersion: "weighted-v9-history-cap20",
          triage: { issueSummary: "Leaking kitchen pipe" },
          candidate: {
            providerId: "provider-1",
            rank: 1,
            totalScore: 0.84,
            scoreBreakdown: { relevantExperience: 0.9 },
            evidence: {
              profileExperience: { recorded: true, valid: true, yearsExperience: 10 },
              categoryExperience: { categoryId: "plumbing", completedJobs: 12 },
            },
          },
        },
      }}
      provider={provider}
      onViewProvider={onViewProvider}
    />
  );

  expect(screen.getByText("Automatically assigned")).toBeTruthy();
  expect(screen.getByText(/Rafi Khan/)).toBeTruthy();
  expect(screen.getByText("84% match")).toBeTruthy();
  expect(screen.getByText("10.0 years · 12 completed plumbing jobs")).toBeTruthy();
  expect(screen.queryByText(/Ranking weighted/)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(onViewProvider).toHaveBeenCalledWith(provider);
});
