export const PROVIDER_WORKLOAD_LIMIT = 3;

export const hasWorkloadCapacity = (activeJobs) => (
  Number(activeJobs || 0) < PROVIDER_WORKLOAD_LIMIT
);
