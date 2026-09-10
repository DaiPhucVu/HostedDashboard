import {
  getAiServiceUrl,
  requestAiReview,
} from "./aiReviewClient";

const validReview = {
  source: "LOCAL_SERVICE",
  triage: {
    jobId: "job-1",
    categoryId: "plumbing",
    urgency: "NORMAL",
    triageStatus: "READY_FOR_ASSIGNMENT",
    confidence: 0.9,
    requiredSkills: ["plumbing"],
    missingFields: [],
    issueSummary: "Leaking pipe",
    extractedIssues: ["leak"],
    detectedLanguage: "en",
    safetyFlags: [],
    evidenceDocIds: ["policy-plumbing"],
    reasonCodes: ["SEMANTIC_RAG"],
    modelVersion: "semantic-rag-v2-test",
  },
  ranking: {
    jobId: "job-1",
    candidates: [],
    alternatives: [],
    rankingVersion: "weighted-v1",
  },
};

const requestData = {
  jobId: "job-1",
  jobCat: "Plumbing",
  jobDesc: "A pipe is leaking under the sink",
  jobLocation: "Gulshan",
  jobDateFrom: "2026-09-09",
};

describe("local AI review client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => validReview,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test("keeps the legacy URL as the local development fallback", () => {
    delete process.env.REACT_APP_LOCAL_AI_SERVICE_URL;
    process.env.REACT_APP_AI_SERVICE_URL = "http://127.0.0.1:8082";

    expect(getAiServiceUrl()).toBe("http://127.0.0.1:8082");
  });

  test("sends reviews to the configured local service", async () => {
    process.env.REACT_APP_LOCAL_AI_SERVICE_URL = "http://127.0.0.1:8080/";

    await requestAiReview(requestData, [], []);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/v1/assignment-reviews",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("fails clearly when the local service URL is missing", async () => {
    delete process.env.REACT_APP_LOCAL_AI_SERVICE_URL;
    delete process.env.REACT_APP_AI_SERVICE_URL;

    await expect(requestAiReview(requestData, [], [])).rejects.toThrow(
      "Local AI service URL is not configured"
    );
  });
});
