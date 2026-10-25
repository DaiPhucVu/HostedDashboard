import React from "react";
import { Alert } from "react-bootstrap";

import { buildProviderProfile } from "../domain/providerProfile";
import { formatDateTime } from "../utils/jobPresentation";
import ProviderMatchCard from "./ProviderMatchCard";

const methodLabel = (method) => {
  if (method === "AUTO_AI_RECOMMENDED") return "Automatically assigned";
  if (method === "AI_RECOMMENDED") return "AI recommendation approved";
  if (method === "MANUAL_OVERRIDE") return "Manually assigned";
  return "Assigned";
};

export default function AssignedProviderSummary({
  job,
  provider,
  jobs = [],
  reviews = [],
  onViewProvider,
}) {
  if (!job?.assignedTo && !job?.assignment?.providerId && !job?.assignment?.assignedTo) {
    return null;
  }

  const audit = job.assignmentAudit || null;
  const candidate = audit?.candidate || null;
  const profile = provider ? buildProviderProfile(provider, jobs, reviews) : null;
  const providerName = profile?.name || audit?.providerName || "Assigned provider";
  return (
    <section className="mt-3">
      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <div className="small text-muted">{methodLabel(job.assignmentMethod || audit?.method)}</div>
          {!candidate && <h6 className="mb-1">{providerName}</h6>}
          <div className="small text-muted">
            Assigned {formatDateTime(job.assignedAt || audit?.recordedAt)}
          </div>
        </div>
      </div>

      {audit?.triage?.issueSummary && (
        <div className="mt-3">
          <div className="small text-muted">Job interpretation</div>
          <div>{audit.triage.issueSummary}</div>
        </div>
      )}

      {candidate ? (
        <>
          <div className="mt-3 mb-2">
            <div className="fw-semibold">Why this provider was selected</div>
          </div>
          <ProviderMatchCard
            candidate={candidate}
            provider={provider}
            providerName={providerName}
            selected
            showSelect={false}
            onViewProvider={onViewProvider}
          />
        </>
      ) : (
        <Alert variant="light" className="border mt-3 mb-0 py-2">
          This assignment has no saved ranking snapshot. The current Firebase provider profile is still available above.
        </Alert>
      )}
    </section>
  );
}
