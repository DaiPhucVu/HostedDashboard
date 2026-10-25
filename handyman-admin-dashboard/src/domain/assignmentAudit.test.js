import { buildAssignmentAudit } from "./assignmentAudit";

test("stores the selected candidate ranking evidence as an immutable assignment snapshot", () => {
  const review = {
    triage: {
      categoryId: "plumbing",
      originalCategory: "electrical",
      semanticCategory: "plumbing",
      finalCategory: "plumbing",
      categoryDecision: "SEMANTIC_OVERRIDE",
      overrideReason: "PIPE_ENTITY",
      urgency: "HIGH",
      issueSummary: "Leaking kitchen pipe",
      modelVersion: "qwen3:8b",
    },
    ranking: {
      rankingVersion: "weighted-v9-history-cap20",
      candidates: [{
        providerId: "provider-1",
        rank: 1,
        totalScore: 0.84,
        scoreBreakdown: { relevantExperience: 0.9 },
        evidence: { categoryExperience: { completedJobs: 12 } },
        reasonCodes: ["CATEGORY_SKILL_MATCH"],
      }],
    },
    autoAssignment: {
      decision: "AUTO_ASSIGN",
      providerId: "provider-1",
      reasonCodes: ["ALL_AUTO_ASSIGN_GATES_PASSED"],
    },
  };

  const audit = buildAssignmentAudit(
    review,
    "provider-1",
    "AUTO_AI_RECOMMENDED",
    "2026-10-03T10:00:00.000Z"
  );

  expect(audit).toMatchObject({
    method: "AUTO_AI_RECOMMENDED",
    providerId: "provider-1",
    rankingVersion: "weighted-v9-history-cap20",
    candidate: {
      rank: 1,
      totalScore: 0.84,
      scoreBreakdown: { relevantExperience: 0.9 },
    },
    triage: {
      categoryId: "plumbing",
      originalCategory: "electrical",
      semanticCategory: "plumbing",
      finalCategory: "plumbing",
      categoryDecision: "SEMANTIC_OVERRIDE",
      overrideReason: "PIPE_ENTITY",
      urgency: "HIGH",
    },
    autoAssignmentDecision: { decision: "AUTO_ASSIGN" },
  });

  review.ranking.candidates[0].scoreBreakdown.relevantExperience = 0;
  expect(audit.candidate.scoreBreakdown.relevantExperience).toBe(0.9);
});

test("manual assignment keeps the triage record without inventing a match score", () => {
  const audit = buildAssignmentAudit(
    {
      triage: { categoryId: "cleaning", urgency: "NORMAL" },
      ranking: { rankingVersion: "v8", candidates: [] },
    },
    "manual-provider",
    "MANUAL_OVERRIDE",
    "2026-10-03T10:00:00.000Z"
  );

  expect(audit.providerId).toBe("manual-provider");
  expect(audit.candidate).toBeUndefined();
});
