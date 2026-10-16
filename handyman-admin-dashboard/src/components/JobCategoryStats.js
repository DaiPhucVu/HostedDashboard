import React, { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { normalizeJobStatus } from "../utils/jobStatus";

const JobCategoryStats = () => {
  const [jobStats, setJobStats] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const jobRef = ref(db, "Job");

    const unsubscribe = onValue(jobRef, (snapshot) => {
      const data = snapshot.val() || {};
      const categoryMap = {};

      for (const jobId in data) {
        const job = data[jobId];
        const cat = job.jobCat || "Uncategorized";
        const status = normalizeJobStatus(job.jobStatus);

        if (!categoryMap[cat]) {
          categoryMap[cat] = { active: 0, quoted: 0 };
        }

        if (!["Done", "Cancelled", "Inactive"].includes(status)) {
          categoryMap[cat].active += 1;
        }

        const quotes = job.quotedHandymen || [];
        const quoteCount = Array.isArray(quotes)
          ? quotes.length
          : Object.keys(quotes).length;

        if (quoteCount > 0) {
          categoryMap[cat].quoted += quoteCount;
        }
      }

      const sortedStats = Object.entries(categoryMap)
        .map(([category, stats]) => ({
          category,
          active: stats.active,
          quoted: stats.quoted,
          total: stats.active + stats.quoted,
        }))
        .sort((a, b) => b.total - a.total);

      setJobStats(sortedStats);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Job Postings Overview by Category</h2>
      <ul>
        {jobStats.map((job, index) => (
          <li
            key={job.category}
            className="flex justify-between items-center py-2 border-b"
          >
            <div>
              <span className="text-red-500">↓</span>{" "}
              <span className="font-medium">{job.category}</span>
              <span className="ml-2 bg-gray-200 text-sm px-2 py-1 rounded">
                #{index + 1}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {job.active} Active, {job.quoted} Being Quoted
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default JobCategoryStats;
