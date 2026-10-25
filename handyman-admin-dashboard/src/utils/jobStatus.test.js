import {
  canArchiveJob,
  isAssignmentOpen,
  jobStatusLabel,
  normalizeJobStatus,
} from "./jobStatus";

describe("job status", () => {
  test.each(["In Progress", "In-progress", "in_progress"])(
    "normalizes %s",
    (status) => expect(normalizeJobStatus(status)).toBe("In-progress")
  );

  test("uses a friendly display label", () => {
    expect(jobStatusLabel("In-progress")).toBe("In Progress");
  });

  test("only archives unassigned open jobs", () => {
    expect(canArchiveJob()).toBe(false);
    expect(isAssignmentOpen({ jobStatus: "open" })).toBe(true);
    expect(canArchiveJob({ jobStatus: "Open" })).toBe(true);
    expect(canArchiveJob({ jobStatus: "Open", assignedTo: "provider-1" })).toBe(false);
    expect(canArchiveJob({ jobStatus: "Offered" })).toBe(false);
  });
});
