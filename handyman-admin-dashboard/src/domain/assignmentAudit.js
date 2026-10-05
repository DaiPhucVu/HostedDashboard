const copyCandidate = (candidate) => ({
  providerId: candidate.providerId,
  rank: candidate.rank,
  totalScore: candidate.totalScore,
  scoreBreakdown: { ...(candidate.scoreBreakdown || {}) },
  evidence: { ...(candidate.evidence || {}) },
  reasonCodes: [...(candidate.reasonCodes || [])],
});

export function buildAssignmentAudit(review, providerId, method, recordedAt) {
  const candidate = review?.ranking?.candidates?.find(
    (item) => item.providerId === providerId
  );
  const audit = {
    method,
    providerId,
    recordedAt,
    rankingVersion: review?.ranking?.rankingVersion || null,
    triage: review?.triage ? {
      categoryId: review.triage.categoryId || null,
      originalCategory: review.triage.originalCategory || null,
      semanticCategory: review.triage.semanticCategory || null,
      finalCategory: review.triage.finalCategory || review.triage.categoryId || null,
      categoryDecision: review.triage.categoryDecision || null,
      overrideReason: review.triage.overrideReason || null,
      urgency: review.triage.urgency || null,
      issueSummary: review.triage.issueSummary || "",
      modelVersion: review.triage.modelVersion || null,
    } : null,
  };

  if (candidate) audit.candidate = copyCandidate(candidate);
  if (review?.autoAssignment) {
    audit.autoAssignmentDecision = {
      ...review.autoAssignment,
      reasonCodes: [...(review.autoAssignment.reasonCodes || [])],
    };
  }
  return audit;
}
