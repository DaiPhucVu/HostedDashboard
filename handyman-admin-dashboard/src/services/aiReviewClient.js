import { assertAiReview, toAssignmentReviewRequest } from "../domain/aiContracts";

export function getAiServiceUrl() {
  return process.env.REACT_APP_LOCAL_AI_SERVICE_URL ||
    process.env.REACT_APP_AI_SERVICE_URL || "";
}

export async function requestAiReview(job, providers, jobs, reviews = []) {
  const serviceUrl = getAiServiceUrl();
  if (!serviceUrl) {
    throw new Error("Local AI service URL is not configured");
  }

  const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/v1/assignment-reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toAssignmentReviewRequest(job, providers, jobs, reviews)),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `AI review failed (${response.status})`);
  }
  return assertAiReview(payload, job.jobId);
}
