import { parseJobDate, validateJobRanges } from "./jobValidation";

describe("job validation", () => {
  test("accepts app and ISO date formats", () => {
    expect(parseJobDate("16/10/2026")).not.toBeNull();
    expect(parseJobDate("2026-10-16")).not.toBeNull();
  });

  test("rejects invalid calendar dates", () => {
    expect(parseJobDate("31/02/2026")).toBeNull();
  });

  test("rejects reversed dates", () => {
    expect(validateJobRanges({
      jobDateFrom: "08/10/2026",
      jobDateTo: "06/10/2026",
    }).jobDateTo).toBeTruthy();
  });

  test("rejects reversed same-day times and budgets", () => {
    const errors = validateJobRanges({
      jobDateFrom: "2026-10-16",
      jobDateTo: "2026-10-16",
      jobTimeFrom: "17:00",
      jobTimeTo: "10:00",
      jobSalaryFrom: 500,
      jobSalaryTo: 300,
    });
    expect(errors.jobTimeTo).toBeTruthy();
    expect(errors.jobSalaryTo).toBeTruthy();
  });
});
