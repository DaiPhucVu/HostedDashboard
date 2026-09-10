import React, { useEffect, useState } from "react";
import { Alert, Button, ProgressBar, Spinner } from "react-bootstrap";

const MATCHING_STAGES = [
  {
    title: "Understanding the request",
    detail: "Reading the selected service category and customer description.",
    startsAt: 0,
  },
  {
    title: "Retrieving service guidance",
    detail: "Finding relevant internal examples and service rules.",
    startsAt: 4,
  },
  {
    title: "Checking provider eligibility",
    detail: "Applying verification, availability, capacity and distance rules.",
    startsAt: 9,
  },
  {
    title: "Ranking the best matches",
    detail: "Comparing skills, performance, response time and workload.",
    startsAt: 15,
  },
];

const FACTOR_LABELS = {
  skillMatch: "Skills",
  distance: "Distance",
  availability: "Availability",
  bayesianRating: "Rating",
  reliability: "Reliability",
  responseFairness: "Response & workload",
};

const tagPalette = {
  blue: { background: "#dceff7", border: "#a9d2e2", color: "#245f76" },
  green: { background: "#d8f2e8", border: "#9fd9c6", color: "#176d57" },
  yellow: { background: "#fff0bf", border: "#e5ca6d", color: "#76570b" },
  red: { background: "#ffd9d2", border: "#e8a79b", color: "#8d372b" },
};

const humanize = (value) => String(value || "").replaceAll("_", " ").toLowerCase();
const urgencyTone = (urgency) => urgency === "CRITICAL" ? "red" : urgency === "HIGH" ? "yellow" : "green";
const confidenceTone = (value) => value >= 0.8 ? "green" : value >= 0.6 ? "yellow" : "red";
const progressVariant = (value) => value >= 0.8 ? "primary" : value >= 0.6 ? "warning" : "danger";
const jobStatusTone = (status) => {
  const normalized = String(status || "OPEN").trim().toUpperCase();
  if (["DONE", "COMPLETED"].includes(normalized)) return "green";
  if (["CANCELLED", "INACTIVE"].includes(normalized)) return "red";
  if (["OFFERED", "ACCEPTED", "IN PROGRESS", "IN-PROGRESS"].includes(normalized)) return "blue";
  return "yellow";
};

function Tag({ tone = "blue", children }) {
  const colors = tagPalette[tone];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "7px 11px",
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.background,
      color: colors.color,
      fontSize: ".78rem",
      fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function MatchPill({ value, alternative = false }) {
  const tone = value >= 0.8 ? "#157963" : value >= 0.6 ? "#8a6816" : "#9c4035";
  return (
    <span className="bg-white rounded-pill fw-semibold" style={{
      border: "1px solid #d7e2de",
      boxShadow: "0 2px 8px rgba(35,65,57,.1)",
      color: tone,
      padding: "7px 12px",
      whiteSpace: "nowrap",
    }}>
      {Math.round(value * 100)}% {alternative ? "relative fit" : "match"}
    </span>
  );
}

const rankCardStyle = (rank, selected) => {
  const palette = ["#ccecdf", "#daf2e8", "#e5f6ef", "#eef9f5", "#f5fcf9"];
  return {
    backgroundColor: palette[Math.min(4, Math.max(0, rank - 1))],
    borderColor: selected ? "#168873" : "#b8ded2",
    boxShadow: selected ? "0 0 0 2px rgba(22,136,115,.18)" : "0 2px 7px rgba(35,65,57,.05)",
    cursor: "pointer",
  };
};

function AiMatchingLoader() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeStage = MATCHING_STAGES.reduce(
    (latest, stage, index) => elapsedSeconds >= stage.startsAt ? index : latest,
    0
  );
  const progress = Math.min(92, 16 + elapsedSeconds * 4);

  return (
    <section
      aria-label="AI matching progress"
      aria-live="polite"
      className="border rounded-3 p-3 mb-3"
      style={{ backgroundColor: "#f5fcf9", borderColor: "#b8ded2" }}
    >
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="d-flex align-items-center gap-2 fw-semibold" style={{ color: "#176d57" }}>
            <Spinner animation="border" size="sm" />
            Smart matching in progress
          </div>
          <div className="small text-muted mt-1">
            AI is analysing the request and comparing eligible providers.
          </div>
        </div>
        <span className="small fw-semibold text-nowrap" style={{ color: "#4c7468" }}>
          {elapsedSeconds}s
        </span>
      </div>

      <ProgressBar
        animated
        now={progress}
        aria-label="Smart matching progress"
        style={{ height: 7, backgroundColor: "#e2efeb" }}
        className="mb-3"
      />

      <div className="d-grid gap-2">
        {MATCHING_STAGES.map((stage, index) => {
          const completed = index < activeStage;
          const active = index === activeStage;
          return (
            <div
              key={stage.title}
              className="d-flex align-items-start gap-2 rounded-3 px-2 py-1"
              style={{
                backgroundColor: active ? "#e1f4ed" : "transparent",
                color: index <= activeStage ? "#245f50" : "#8a9692",
              }}
            >
              <span
                className="d-inline-flex justify-content-center align-items-center flex-shrink-0 rounded-circle"
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: completed ? "#69bfa5" : active ? "#fff" : "#edf2f0",
                  border: `1px solid ${active ? "#69bfa5" : "#d4e0dc"}`,
                  color: completed ? "#fff" : "#28735f",
                  fontSize: ".72rem",
                  fontWeight: 700,
                }}
              >
                {completed ? "✓" : active ? <Spinner animation="grow" size="sm" /> : index + 1}
              </span>
              <div>
                <div className="small fw-semibold">{stage.title}</div>
                {active && <div className="small text-muted">{stage.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="small text-muted mt-3">
        Local models may take a little longer. You can keep this window open while matching completes.
      </div>
    </section>
  );
}

export default function AiAssignmentReview({
  review,
  loading,
  error,
  providers,
  selectedProviderId,
  jobStatus,
  onSelectProvider,
  onViewProvider,
  onRetry,
}) {
  if (loading) {
    return <AiMatchingLoader />;
  }
  if (error) {
    return <Alert variant="warning">{error} <Button size="sm" variant="outline-warning" className="ms-2" onClick={onRetry}>Retry</Button></Alert>;
  }
  if (!review) return null;

  const { triage, ranking } = review;
  const providerMap = Object.fromEntries(providers.map((provider) => [provider.handymanId || provider.id, provider]));
  const assignable = triage.triageStatus === "READY_FOR_ASSIGNMENT";
  const provisional = triage.triageStatus === "NEEDS_INFO";
  const alternatives = ranking.alternatives || [];
  const showingAlternatives = ranking.candidates.length === 0 && alternatives.length > 0;
  const displayedCandidates = showingAlternatives ? alternatives : ranking.candidates;
  const candidateSelectable = assignable && !showingAlternatives;

  return (
    <section aria-label="AI assignment review">
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Tag tone={jobStatusTone(jobStatus)}>Job status: {jobStatus || "Open"}</Tag>
        <Tag>Category: {triage.categoryId || "Unclear"}</Tag>
        <Tag tone={urgencyTone(triage.urgency)}>Urgency: {humanize(triage.urgency)}</Tag>
        <Tag tone={confidenceTone(triage.confidence)}>Confidence: {Math.round(triage.confidence * 100)}%</Tag>
        <Tag tone={assignable ? "green" : "yellow"}>Status: {humanize(triage.triageStatus)}</Tag>
      </div>

      <div className="bg-white border rounded-3 px-3 py-2 mb-3">
        <div className="fw-semibold">AI interpretation</div>
        <div>{triage.issueSummary || "No summary returned."}</div>
        <div className="small text-muted mt-1">Confidence means how certain AI is about the category, not the provider match.</div>
      </div>

      {triage.missingFields?.length > 0 && (
        <Alert variant="warning" className="py-2">
          Limited job details: {triage.missingFields.map(humanize).join(", ")}.
          {assignable && " Broad-category providers are still recommended; confirm the exact work with the customer."}
        </Alert>
      )}

      <div className="d-flex justify-content-between gap-3 mb-2">
        <strong>
          {showingAlternatives
            ? `Alternative Top ${Math.min(5, displayedCandidates.length)} providers`
            : `${provisional ? "Provisional " : ""}Top ${Math.min(5, displayedCandidates.length)} providers`}
        </strong>
        <span className="small text-muted">
          {candidateSelectable ? "Select a card to assign" : "Preview only"}
        </span>
      </div>

      {showingAlternatives && (
        <Alert variant="warning" className="py-2">
          These providers pass verification, availability, capacity, and required-skill checks. Distance could not be confirmed or is outside their recorded service radius, so they cannot be assigned from this recommendation.
        </Alert>
      )}

      {displayedCandidates.length === 0 ? (
        <Alert variant="light" className="border">
          {provisional
            ? "No provider meets the hard eligibility rules for the information currently available."
            : "No provider meets the hard eligibility rules for this job."}
        </Alert>
      ) : displayedCandidates.slice(0, 5).map((candidate) => {
        const provider = providerMap[candidate.providerId];
        const selected = selectedProviderId === candidate.providerId;
        const providerName = provider
          ? `${provider.firstName || ""} ${provider.lastName || ""}`.trim() || provider.email
          : candidate.providerId;
        return (
          <div
            key={candidate.providerId}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            className="border rounded-3 p-3 mb-2"
            style={{
              ...rankCardStyle(candidate.rank, selected),
              cursor: candidateSelectable ? "pointer" : "default",
            }}
            onClick={() => candidateSelectable && provider && onSelectProvider(provider)}
            onKeyDown={(event) => {
              if (candidateSelectable && provider && ["Enter", " "].includes(event.key)) {
                event.preventDefault();
                onSelectProvider(provider);
              }
            }}
          >
            <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
              <div>
                <div className="fw-semibold">#{candidate.rank} {providerName}</div>
                <div className="small text-muted">{candidate.reasonCodes.map(humanize).join(" · ")}</div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <MatchPill value={candidate.totalScore} alternative={showingAlternatives} />
                {onViewProvider && (
                  <Button
                    size="sm"
                    style={{
                      minWidth: 76,
                      borderRadius: 999,
                      borderColor: "#9ecbdc",
                      backgroundColor: "#eef7fb",
                      color: "#1f6178",
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (provider) onViewProvider(provider);
                    }}
                    disabled={!provider}
                  >
                    Profile
                  </Button>
                )}
                <Button
                  size="sm"
                  style={{
                    minWidth: 82,
                    borderRadius: 999,
                    borderColor: "#168873",
                    backgroundColor: selected ? "#168873" : "#fff",
                    color: selected ? "#fff" : "#168873",
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (candidateSelectable && provider) onSelectProvider(provider);
                  }}
                  disabled={!candidateSelectable}
                >
                  {!candidateSelectable ? "Preview" : selected ? "Selected" : "Select"}
                </Button>
              </div>
            </div>
            <div className="row g-2">
              {Object.entries(candidate.scoreBreakdown).map(([name, value]) => (
                <div className="col-md-6" key={name}>
                  <div className="d-flex justify-content-between small"><span>{FACTOR_LABELS[name] || humanize(name)}</span><span>{Math.round(value * 100)}%</span></div>
                  <ProgressBar variant={progressVariant(value)} now={value * 100} style={{ height: 6 }} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
