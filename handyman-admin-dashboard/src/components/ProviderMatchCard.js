import React from "react";
import { Button, ProgressBar } from "react-bootstrap";

import {
  FACTOR_KEYS,
  FACTOR_LABELS,
  factorEvidence,
  progressVariant,
} from "../domain/assignmentPresentation";

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
  };
};

export default function ProviderMatchCard({
  candidate,
  provider,
  providerName,
  selected = false,
  selectable = false,
  alternative = false,
  showSelect = true,
  onSelectProvider,
  onViewProvider,
}) {
  const selectProvider = () => {
    if (selectable && provider && onSelectProvider) onSelectProvider(provider);
  };

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      className="border rounded-3 p-3 mb-2"
      style={{
        ...rankCardStyle(candidate.rank, selected),
        cursor: selectable ? "pointer" : "default",
      }}
      onClick={selectProvider}
      onKeyDown={(event) => {
        if (selectable && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
          selectProvider();
        }
      }}
    >
      <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
        <div className="fw-semibold">#{candidate.rank} {providerName}</div>
        <div className="d-flex align-items-center gap-2">
          <MatchPill value={candidate.totalScore} alternative={alternative} />
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
          {showSelect && (
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
                selectProvider();
              }}
              disabled={!selectable}
            >
              {!selectable ? "Preview" : selected ? "Selected" : "Select"}
            </Button>
          )}
        </div>
      </div>
      <div className="row g-2">
        {FACTOR_KEYS.filter((name) => candidate.scoreBreakdown?.[name] !== undefined).map((name) => (
          <div className="col-md-6" key={name}>
            <div className="d-flex justify-content-between small">
              <span>{FACTOR_LABELS[name]}</span>
              <span>{Math.round(candidate.scoreBreakdown[name] * 100)}%</span>
            </div>
            <ProgressBar
              variant={progressVariant(candidate.scoreBreakdown[name])}
              now={candidate.scoreBreakdown[name] * 100}
              style={{ height: 6 }}
            />
            <div className="small text-muted mt-1">
              {factorEvidence(name, candidate.evidence)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
