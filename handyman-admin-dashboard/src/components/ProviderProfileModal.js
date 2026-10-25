import React from "react";
import { Badge, Col, Modal, Row } from "react-bootstrap";
import { buildProviderProfile } from "../domain/providerProfile";

const valueOrMissing = (value, suffix = "") => value !== "" && value !== null && value !== undefined
  ? `${value}${suffix}`
  : "Not provided";

function Detail({ label, children }) {
  return (
    <div className="mb-3">
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold">{children}</div>
    </div>
  );
}

function SkillTags({ values, emptyText = "Not provided" }) {
  if (!values.length) return <span className="text-muted">{emptyText}</span>;
  return (
    <div className="d-flex flex-wrap gap-2 mt-1">
      {values.map((value) => (
        <Badge key={value} bg="light" text="dark" className="border rounded-pill px-3 py-2">
          {value}
        </Badge>
      ))}
    </div>
  );
}

export default function ProviderProfileModal({ show, onHide, provider, jobs = [], reviews = [] }) {
  if (!provider) return null;
  const profile = buildProviderProfile(provider, jobs, reviews);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <div>
          <Modal.Title>{profile.name}</Modal.Title>
          <div className="small text-muted">Provider profile · Firebase record</div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-wrap gap-2 mb-4">
          <Badge bg={profile.verified ? "success" : "warning"} className="rounded-pill px-3 py-2">
            {profile.verificationStatus}
          </Badge>
          <Badge bg={profile.available === true ? "success" : "secondary"} className="rounded-pill px-3 py-2">
            {profile.availabilityStatus}
          </Badge>
          <Badge bg="light" text="dark" className="border rounded-pill px-3 py-2">
            {profile.activeJobs}/{profile.maxConcurrentJobs} active jobs
          </Badge>
          <Badge bg="light" text="dark" className="border rounded-pill px-3 py-2">
            {profile.reviewCount > 0 && Number.isFinite(profile.averageRating)
              ? `${profile.averageRating.toFixed(1)} rating · ${profile.reviewCount} reviews`
              : "No recorded ratings"}
          </Badge>
        </div>

        <Row className="g-4">
          <Col md={6}>
            <div className="border rounded-3 p-3 h-100">
              <h6>Skills & background</h6>
              <Detail label="Skills"><SkillTags values={profile.skills} /></Detail>
              <Detail label="Experience">{valueOrMissing(profile.experienceYears, " years")}</Detail>
              <Detail label="Bio"><span className="fw-normal">{valueOrMissing(profile.bio)}</span></Detail>
            </div>
          </Col>
          <Col md={6}>
            <div className="border rounded-3 p-3 h-100">
              <h6>Verification & certificates</h6>
              <Detail label="Provider verification">{profile.verificationStatus}</Detail>
              <Detail label="Certificate status">{valueOrMissing(profile.certificateStatus)}</Detail>
              <Detail label="Certificate types"><SkillTags values={profile.certificateTypes} /></Detail>
            </div>
          </Col>
          <Col md={6}>
            <div className="border rounded-3 p-3 h-100">
              <h6>Service coverage</h6>
              <Detail label="Location">{valueOrMissing(profile.location)}</Detail>
              <Detail label="Recorded service radius">{valueOrMissing(profile.serviceRadiusKm, " km")}</Detail>
              <Detail label="Current workload">
                {profile.activeJobs} active of {profile.maxConcurrentJobs} maximum
              </Detail>
            </div>
          </Col>
          <Col md={6}>
            <div className="border rounded-3 p-3 h-100">
              <h6>Firebase job history</h6>
              <Detail label="Completed jobs">{profile.completedJobs}</Detail>
              <Detail label="Provider-cancelled jobs">{profile.providerCancelledJobs}</Detail>
              <Detail label="Other or unattributed cancellations">{profile.unattributedCancelledJobs}</Detail>
              <Detail label="Valid customer ratings">
                {profile.reviewCount > 0 && Number.isFinite(profile.averageRating)
                  ? `${profile.averageRating.toFixed(1)} from ${profile.reviewCount} reviews`
                  : "No recorded ratings"}
              </Detail>
            </div>
          </Col>
        </Row>

        <div className="small text-muted mt-3">
          Profile details come from Firebase Handyman records. Work history and ratings are derived from linked Firebase history and customer Review records; missing values are not inferred.
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-secondary" onClick={onHide}>Close</button>
      </Modal.Footer>
    </Modal>
  );
}
