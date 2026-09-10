import { newestJobsFirst } from "./jobSorting";

test("sorts jobs by creation time with the newest request first", () => {
  const jobs = [
    { jobId: "old", createdAt: "2026-09-01T10:00:00" },
    { jobId: "new", createdAt: "2026-09-08T10:00:00" },
    { jobId: "middle", postedAt: "2026-09-04T10:00:00" },
  ];

  expect(newestJobsFirst(jobs).map((job) => job.jobId)).toEqual(["new", "middle", "old"]);
  expect(jobs.map((job) => job.jobId)).toEqual(["old", "new", "middle"]);
});

test("supports Firebase timestamp objects and puts undated legacy jobs last", () => {
  const jobs = [
    { jobId: "undated" },
    { jobId: "firebase", createdAt: { seconds: 1788840000 } },
    { jobId: "iso", created_at: "2026-09-07T10:00:00Z" },
  ];

  expect(newestJobsFirst(jobs).map((job) => job.jobId)).toEqual(["firebase", "iso", "undated"]);
});
