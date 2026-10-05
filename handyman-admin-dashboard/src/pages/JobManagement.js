import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Table,
  Form,
  Button,
  InputGroup,
  Modal,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import PaginationControls from "../components/PaginationControls";
import StickyHeader from "../components/StickyHeader";
import { database } from "../firebase";
import {
  equalTo,
  get,
  onValue,
  orderByValue,
  query,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";
import ConfirmModal from "../components/ConfirmModal";
import JOB_CATEGORIES from "../constants/jobCategories";
import handymanMocks from "../data/handymanData";
import userMocks from "../data/userData";
import jobMocks from "../data/jobData";
import AiAssignmentReview from "../components/AiAssignmentReview";
import AssignedProviderSummary from "../components/AssignedProviderSummary";
import ProviderProfileModal from "../components/ProviderProfileModal";
import { requestAiReview } from "../services/aiReviewClient";
import { buildAssignmentAudit } from "../domain/assignmentAudit";
import {
  canonicalJobCategory,
  getManualAssignmentOptions,
  SUPPORTED_AI_CATEGORIES,
} from "../domain/aiContracts";
import { PROVIDER_WORKLOAD_LIMIT } from "../domain/workloadPolicy";
import {
  JOB_FIELD_LABELS,
  formatBudget,
  formatDate,
  formatJobField,
  formatTime,
} from "../utils/jobPresentation";
import { newestJobsFirst } from "../utils/jobSorting";

const USE_LOCAL_FIXTURES = process.env.REACT_APP_USE_LOCAL_FIXTURES === "true";
const AI_REVIEW_CATEGORIES = JOB_CATEGORIES;
const LOCAL_JOB_STATE_KEY = "handyman-local-job-state-v1";
const LOCAL_ASSIGNMENT_MODE_KEY = "handyman-assignment-mode-v1";
const SOFT_TONES = Object.freeze({
  blue: { backgroundColor: "#eef7fb", borderColor: "#cfe7f1", color: "#276f87" },
  mint: { backgroundColor: "#e9f8f2", borderColor: "#c7eadc", color: "#23765f" },
  amber: { backgroundColor: "#fff7e8", borderColor: "#f1deaa", color: "#8a6416" },
  red: { backgroundColor: "#fff0ec", borderColor: "#f0cec5", color: "#a14838" },
  grey: { backgroundColor: "#f4f6f5", borderColor: "#dfe5e2", color: "#66716d" },
});
const ACTION_TONES = Object.freeze({
  blue: { backgroundColor: "#dceff6", borderColor: "#9ecbdc", color: "#1f6178" },
  mint: { backgroundColor: "#d5f1e7", borderColor: "#97d2bd", color: "#1b684f" },
  amber: { backgroundColor: "#fcebc5", borderColor: "#e3bf67", color: "#76510d" },
  red: { backgroundColor: "#f8ddd6", borderColor: "#dda493", color: "#893729" },
});

const isAssignmentOpen = (job) => {
  const status = String(job?.jobStatus || "Open").trim().toLowerCase();
  return !status || status === "open";
};

const isAiCategorySupported = (job) => {
  const rawCategory = String(job?.jobCat || job?.category || "").trim().toLowerCase();
  if (!rawCategory) return true;
  if (SUPPORTED_AI_CATEGORIES.includes(canonicalJobCategory(job))) return true;
  return ["electric & plumbing", "electric and plumbing", "electric & plumbing services"]
    .includes(rawCategory);
};

const canCancelAssignment = (job) => {
  const providerId = job?.assignedTo || job?.assignment?.providerId || job?.assignment?.assignedTo || "";
  const status = String(job?.jobStatus || "").trim().toLowerCase();
  return Boolean(providerId) && ["", "open", "offered"].includes(status);
};

const MANUAL_WARNING_LABELS = Object.freeze({
  MISSING_REQUIRED_SKILL: "Required skill not confirmed",
  JOB_LOCATION_MISSING: "Job location missing",
  OUTSIDE_SERVICE_RADIUS: "Outside recorded service radius",
});

const jobStatusTone = (status) => {
  const normalized = String(status || "Open").toUpperCase();
  if (["DONE", "COMPLETED"].includes(normalized)) return "mint";
  if (normalized === "CANCELLED") return "red";
  if (["OFFERED", "IN PROGRESS", "IN_PROGRESS"].includes(normalized)) return "blue";
  return "amber";
};

function SoftTag({ tone = "grey", children }) {
  const colours = SOFT_TONES[tone];
  return (
    <span
      className="d-inline-flex align-items-center fw-semibold"
      style={{
        ...colours,
        border: `1px solid ${colours.borderColor}`,
        borderRadius: "12px",
        fontSize: "0.78rem",
        lineHeight: 1,
        padding: "7px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function SoftActionButton({ tone = "grey", children, ...props }) {
  const colours = ACTION_TONES[tone] || SOFT_TONES.grey;
  return (
    <Button
      {...props}
      size="sm"
      variant="light"
      className="fw-semibold"
      style={{
        ...colours,
        border: `1px solid ${colours.borderColor}`,
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(35, 65, 57, 0.06)",
        height: "34px",
        padding: "0 12px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Button>
  );
}

function JobManagement() {
  const [jobData, setJobData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editedJob, setEditedJob] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCandidates, setAssignCandidates] = useState([]);
  const [reviewData, setReviewData] = useState([]);
  const [assignSelected, setAssignSelected] = useState(null);
  const [assigningJob, setAssigningJob] = useState(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [showCancelAssignConfirm, setShowCancelAssignConfirm] = useState(false);
  const [jobToUnassign, setJobToUnassign] = useState(null);
  const [cancelAssignSaving, setCancelAssignSaving] = useState(false);
  const [cancelAssignError, setCancelAssignError] = useState("");
  const [aiReview, setAiReview] = useState(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState("");
  const aiReviewRequestId = useRef(0);
  const [manualAssignMode, setManualAssignMode] = useState(false);
  const [profileProvider, setProfileProvider] = useState(null);
  const [assignmentMode, setAssignmentMode] = useState({ mode: "MANUAL", enabledAt: null });
  const [assignmentModeSaving, setAssignmentModeSaving] = useState(false);
  const [assignmentModeError, setAssignmentModeError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser"));
    } catch {
      return null;
    }
  })();
  const [filterCategory, setFilterCategory] = useState("All");
  // maps for id -> display name to show friendly names in tables
  const [handymanMap, setHandymanMap] = useState({});
  const [userMap, setUserMap] = useState({});

  const updateJobData = (updater) => {
    setJobData((currentJobs) => {
      const nextJobs = typeof updater === "function" ? updater(currentJobs) : updater;
      if (USE_LOCAL_FIXTURES) {
        localStorage.setItem(LOCAL_JOB_STATE_KEY, JSON.stringify(nextJobs));
      }
      return nextJobs;
    });
  };

  useEffect(() => {
    if (USE_LOCAL_FIXTURES) {
      try {
        const savedJobs = JSON.parse(localStorage.getItem(LOCAL_JOB_STATE_KEY));
        setJobData(newestJobsFirst(Array.isArray(savedJobs) ? savedJobs : jobMocks));
      } catch {
        setJobData(newestJobsFirst(jobMocks));
      }
      return undefined;
    }
    const jobRef = ref(database, "Job");
    const unsubscribe = onValue(jobRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const jobsArray = Object.entries(data).map(([jobId, job]) => ({
          jobId,
          ...job,
        }));
        setJobData(newestJobsFirst(jobsArray));
      } else {
        setJobData([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (USE_LOCAL_FIXTURES) {
      try {
        const savedMode = JSON.parse(localStorage.getItem(LOCAL_ASSIGNMENT_MODE_KEY));
        if (savedMode?.mode) setAssignmentMode(savedMode);
      } catch {
        setAssignmentMode({ mode: "MANUAL", enabledAt: null });
      }
      return undefined;
    }
    return onValue(ref(database, "Settings/jobAssignment"), (snapshot) => {
      const value = snapshot.val();
      setAssignmentMode(value?.mode
        ? value
        : { mode: "MANUAL", enabledAt: null });
    });
  }, []);

  // Load the same Firebase provider and customer records used by the mobile app.
  useEffect(() => {
    if (USE_LOCAL_FIXTURES) {
      setAssignCandidates(handymanMocks);
      setHandymanMap(Object.fromEntries(handymanMocks.map((handyman) => [
        handyman.handymanId,
        `${handyman.firstName || ""} ${handyman.lastName || ""}`.trim(),
      ])));
      setUserMap(Object.fromEntries(userMocks.map((user) => [
        user.userId,
        `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      ])));
      return;
    }
    const unsubscribeHandymen = onValue(ref(database, "Handyman"), (snapshot) => {
      const providers = Object.entries(snapshot.val() || {}).map(([id, provider]) => ({
        ...(provider || {}),
        handymanId: provider?.handymanId || id,
      }));
      setAssignCandidates(providers);
      setHandymanMap(Object.fromEntries(providers.map((provider) => [
        provider.handymanId,
        `${provider.firstName || provider.first_name || provider.name || ""} ${provider.lastName || provider.last_name || ""}`.trim()
          || provider.displayName || provider.email || provider.handymanId,
      ])));
    });
    const unsubscribeUsers = onValue(ref(database, "User"), (snapshot) => {
      setUserMap(Object.fromEntries(Object.entries(snapshot.val() || {}).map(([id, user]) => [
        id,
        `${user.firstName || user.first_name || user.name || ""} ${user.lastName || user.last_name || ""}`.trim()
          || user.displayName || user.email || id,
      ])));
    });
    const unsubscribeReviews = onValue(ref(database, "Reviews"), (snapshot) => {
      setReviewData(Object.entries(snapshot.val() || {}).map(([id, review]) => ({
        ...(review || {}),
        reviewId: review?.reviewId || id,
      })));
    });
    return () => {
      unsubscribeHandymen();
      unsubscribeUsers();
      unsubscribeReviews();
    };
  }, []);

  const getHandymanName = (id) => {
    if (!id) return null;
    return handymanMap[id] || `${String(id).slice(0, 8)}…`;
  };

  const getUserName = (id) => {
    if (!id) return null;
    // if createdBy is already a friendly string, prefer it
    return userMap[id] || null;
  };

  const indexRemovalUpdates = useCallback(async (path, jobId) => {
    const snapshot = await get(query(ref(database, path), orderByValue(), equalTo(jobId)));
    const removals = {};
    snapshot.forEach((child) => {
      removals[`${path}/${child.key}`] = null;
    });
    return removals;
  }, []);

  const syncAssignmentIndexes = useCallback(async (job, providerId) => {
    const customerId = job.customerId;
    const updates = {
      [`Handyman/${providerId}/allJobs/${job.jobId}`]: job.jobId,
    };
    Object.assign(updates, await indexRemovalUpdates(`Handyman/${providerId}/cancelledJobs`, job.jobId));
    if (customerId) {
      Object.assign(updates, await indexRemovalUpdates(`User/${customerId}/notAssignedJobs`, job.jobId));
      updates[`User/${customerId}/assignedJobs/${job.jobId}`] = job.jobId;
      updates[`User/${customerId}/allJobs/${job.jobId}`] = job.jobId;
    }
    await update(ref(database), updates);
  }, [indexRemovalUpdates]);

  const syncCancellationIndexes = useCallback(async (job, providerId) => {
    const updates = {};
    for (const listName of ["allJobs", "acceptedJobs", "inProgressJobs", "completedJobs"]) {
      Object.assign(
        updates,
        await indexRemovalUpdates(`Handyman/${providerId}/${listName}`, job.jobId)
      );
    }
    if (job.customerId) {
      Object.assign(updates, await indexRemovalUpdates(`User/${job.customerId}/assignedJobs`, job.jobId));
      updates[`User/${job.customerId}/notAssignedJobs/${job.jobId}`] = job.jobId;
      updates[`User/${job.customerId}/allJobs/${job.jobId}`] = job.jobId;
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
  }, [indexRemovalUpdates]);

  const handleAssignmentModeChange = async (automatic) => {
    const updatedAt = new Date().toISOString();
    const nextMode = {
      mode: automatic ? "AUTO" : "MANUAL",
      enabledAt: automatic ? updatedAt : null,
      updatedAt,
      updatedBy: currentUser?.email || currentUser?.id || "admin",
    };
    setAssignmentModeSaving(true);
    setAssignmentModeError("");
    try {
      if (USE_LOCAL_FIXTURES) {
        localStorage.setItem(LOCAL_ASSIGNMENT_MODE_KEY, JSON.stringify(nextMode));
        setAssignmentMode(nextMode);
      } else {
        await set(ref(database, "Settings/jobAssignment"), nextMode);
      }
    } catch (error) {
      setAssignmentModeError(error?.message || "Assignment mode could not be changed.");
    } finally {
      setAssignmentModeSaving(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!editedJob.jobCat) errors.jobCat = "Job category is required";
    if (!editedJob.jobDesc) errors.jobDesc = "Description is required";
    if (!editedJob.jobStatus) errors.jobStatus = "Status is required";
    if (!editedJob.jobDateFrom) errors.jobDateFrom = "Start date is required";
    if (!editedJob.jobDateTo) errors.jobDateTo = "End date is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const filteredJobs = jobData.filter((job) => {
    const matchesStatus =
      filterStatus === "All" ||
      job.jobStatus?.toLowerCase() === filterStatus.toLowerCase();
    const matchesCategory =
      filterCategory === "All" ||
      job.jobCat?.toLowerCase() === filterCategory.toLowerCase();
    const matchesSearch =
      job.jobCat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobLocation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobDesc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.jobId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const startIndex = (currentPage - 1) * entriesPerPage;
  const currentJobs = filteredJobs.slice(
    startIndex,
    startIndex + entriesPerPage
  );

  const handleSaveChanges = () => {
    if (!editedJob.jobId || !validateForm()) return;
    setIsSaving(true); // disable button

    const jobRef = ref(database, "Job/" + editedJob.jobId);
    const updatedJob = {
      ...editedJob,
      lastUpdated: new Date().toISOString(),
    };

    if (USE_LOCAL_FIXTURES) {
      updateJobData((jobs) => jobs.map((job) => job.jobId === updatedJob.jobId ? updatedJob : job));
      setSelectedJob(updatedJob);
      setEditedJob(updatedJob);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowConfirmModal(false);
        setShowModal(false);
        setIsEditMode(false);
        setIsSaving(false);
      }, 800);
      return;
    }

    update(jobRef, updatedJob)
      .then(() => {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setShowConfirmModal(false);
          setShowModal(false);
          setIsEditMode(false);
          setIsSaving(false); // re-enable button
        }, 1500);
      })
      .catch((err) => {
        console.error("❌ Error saving job:", err);
        setIsSaving(false);
      });
  };

  const handleViewClick = (job) => {
    setSelectedJob(job);
    setEditedJob({ ...job });
    setIsEditMode(false);
    setShowModal(true);
  };

  const loadAiReview = async (job) => {
    const requestId = ++aiReviewRequestId.current;
    setAiReview(null);
    setAiReviewError("");
    setAiReviewLoading(true);
    setManualAssignMode(false);
    setAssignSelected(null);
    try {
      const review = await requestAiReview(job, assignCandidates, jobData, reviewData);
      if (requestId === aiReviewRequestId.current) setAiReview(review);
    } catch (error) {
      console.error("Error loading AI assignment review:", error);
      if (requestId === aiReviewRequestId.current) {
        setAiReviewError(error?.message || "AI review is unavailable. Retry the request or review the job details.");
      }
    } finally {
      if (requestId === aiReviewRequestId.current) setAiReviewLoading(false);
    }
  };

  const handleDeleteClick = (job) => {
    setJobToDelete(job);
    setShowDeleteConfirm(true);
  };

  const handleAssignClick = (job) => {
    setAssigningJob(job);
    setAssignSelected(null);
    setAssignError("");
    setManualAssignMode(false);
    setShowAssignModal(true);
    loadAiReview(job);
  };

  const handleConfirmAssign = async () => {
    if (!assigningJob || !assignSelected) return;
    const jobId = assigningJob.jobId;
    const providerId = assignSelected.handymanId || assignSelected.id;
    const manualOption = manualAssignmentOptions.find((option) => option.providerId === providerId);
    const aiCandidate = aiReview?.ranking?.candidates?.some((candidate) => candidate.providerId === providerId);
    if (manualAssignMode ? !manualOption : aiReview?.triage?.triageStatus !== "READY_FOR_ASSIGNMENT" || !aiCandidate) {
      setAssignError("This provider is no longer eligible. Refresh the review and try again.");
      return;
    }
    setAssignSaving(true);
    setAssignError("");
    try {
      const assignedAt = new Date().toISOString();
      const assignmentMethod = manualAssignMode ? "MANUAL_OVERRIDE" : "AI_RECOMMENDED";
      const assignmentAudit = {
        ...buildAssignmentAudit(
          aiReview,
          providerId,
          assignmentMethod,
          assignedAt
        ),
        providerName: `${assignSelected.firstName || assignSelected.first_name || ""} ${assignSelected.lastName || assignSelected.last_name || ""}`.trim()
          || assignSelected.displayName
          || assignSelected.name
          || assignSelected.email
          || providerId,
      };
      const assignmentUpdate = {
        assignedTo: providerId,
        assignedBy: currentUser?.email || currentUser?.id || "admin",
        assignedAt,
        assignmentMethod,
        assignmentAudit,
        assignmentOverrideReasons: manualAssignMode && manualOption.warnings.length > 0
          ? manualOption.warnings
          : null,
        autoAssignmentDisabled: false,
        autoAssignmentStatus: manualAssignMode ? "MANUAL_ASSIGNED" : "MANUAL_CONFIRMED",
        autoAssignmentError: null,
        jobStatus: "Offered",
        jobStatusHandyman: "Pending",
        lastUpdated: assignedAt,
      };
      if (USE_LOCAL_FIXTURES) {
        updateJobData((jobs) => jobs.map((job) => job.jobId === jobId ? {
          ...job,
          ...assignmentUpdate,
          assignmentVersion: Number(job.assignmentVersion || 0) + 1,
        } : job));
      } else {
        const jobRef = ref(database, `Job/${jobId}`);
        const result = await runTransaction(jobRef, (currentJob) => {
          const legacyProviderId = currentJob?.assignment?.providerId ||
            currentJob?.assignment?.assignedTo || "";
          if (!currentJob || currentJob.assignedTo || legacyProviderId || !isAssignmentOpen(currentJob)) {
            return undefined;
          }
          return {
            ...currentJob,
            ...assignmentUpdate,
            assignmentVersion: Number(currentJob.assignmentVersion || 0) + 1,
          };
        }, { applyLocally: false });
        if (!result.committed) {
          throw new Error("This job is no longer open for assignment. Refresh and try again.");
        }
        try {
          await syncAssignmentIndexes(assigningJob, providerId);
        } catch (syncError) {
          await runTransaction(jobRef, (currentJob) => {
            if (
              currentJob?.assignedTo !== providerId ||
              String(currentJob.jobStatus || "").trim().toLowerCase() !== "offered"
            ) {
              return undefined;
            }
            return {
              ...currentJob,
              assignedTo: "",
              assignedBy: null,
              assignedAt: null,
              assignmentMethod: null,
              assignmentAudit: null,
              assignmentOverrideReasons: null,
              autoAssignmentStatus: "MANUAL_REVIEW",
              jobStatus: "Open",
              jobStatusHandyman: null,
              lastUpdated: new Date().toISOString(),
            };
          }, { applyLocally: false });
          throw new Error("Assignment could not be synced to the mobile app and was rolled back.");
        }
      }
      setShowAssignModal(false);
      setAssigningJob(null);
      setAssignSelected(null);
      setAiReview(null);
      setManualAssignMode(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (error) {
      console.error("Error assigning job:", error);
      setAssignError(error.message || "Assignment failed. Refresh the job and try again.");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleReviewJobDetails = () => {
    if (!assigningJob) return;
    setSelectedJob(assigningJob);
    setEditedJob({ ...assigningJob });
    setIsEditMode(true);
    setShowAssignModal(false);
    setShowModal(true);
  };

  const handleCancelAssignClick = (job) => {
    setJobToUnassign(job);
    setCancelAssignError("");
    setShowCancelAssignConfirm(true);
  };

  const handleConfirmCancelAssignment = async () => {
    if (!jobToUnassign) return;
    setCancelAssignSaving(true);
    setCancelAssignError("");
    try {
      const expectedProviderId = activeProviderId(jobToUnassign);
      const cancelledAt = new Date().toISOString();
      const cancellationUpdate = {
        assignedTo: "",
        assignedBy: null,
        assignedAt: null,
        assignment: null,
        assignmentMethod: null,
        assignmentAudit: null,
        assignmentOverrideReasons: null,
        autoAssignmentDisabled: true,
        autoAssignmentStatus: "MANUAL_REVIEW",
        autoAssignmentError: null,
        jobStatus: "Open",
        jobStatusHandyman: null,
        lastUpdated: cancelledAt,
      };
      if (USE_LOCAL_FIXTURES) {
        updateJobData((jobs) => jobs.map((job) => job.jobId === jobToUnassign.jobId ? {
          ...job,
          ...cancellationUpdate,
          lastAssignmentAudit: job.assignmentAudit ? {
            ...job.assignmentAudit,
            status: "CANCELLED",
            cancelledAt,
          } : job.lastAssignmentAudit || null,
          assignmentVersion: Number(job.assignmentVersion || 0) + 1,
        } : job));
      } else {
        const jobRef = ref(database, `Job/${jobToUnassign.jobId}`);
        const result = await runTransaction(jobRef, (currentJob) => {
          const currentProviderId = currentJob?.assignedTo ||
            currentJob?.assignment?.providerId ||
            currentJob?.assignment?.assignedTo || "";
          if (
            !currentJob ||
            !expectedProviderId ||
            currentProviderId !== expectedProviderId ||
            !["", "open", "offered"].includes(
              String(currentJob.jobStatus || "").trim().toLowerCase()
            )
          ) {
            return undefined;
          }
          return {
            ...currentJob,
            ...cancellationUpdate,
            lastAssignmentAudit: currentJob.assignmentAudit ? {
              ...currentJob.assignmentAudit,
              status: "CANCELLED",
              cancelledAt,
            } : currentJob.lastAssignmentAudit || null,
            assignmentVersion: Number(currentJob.assignmentVersion || 0) + 1,
          };
        }, { applyLocally: false });
        if (!result.committed) {
          throw new Error("This assignment changed before cancellation. Refresh and try again.");
        }
        try {
          await syncCancellationIndexes(jobToUnassign, expectedProviderId);
        } catch (syncError) {
          await runTransaction(jobRef, (currentJob) => {
            if (
              currentJob?.assignedTo ||
              String(currentJob.jobStatus || "").trim().toLowerCase() !== "open"
            ) {
              return undefined;
            }
            return {
              ...currentJob,
              assignedTo: expectedProviderId,
              assignedBy: jobToUnassign.assignedBy || null,
              assignedAt: jobToUnassign.assignedAt || null,
              assignment: jobToUnassign.assignment || null,
              assignmentMethod: jobToUnassign.assignmentMethod || null,
              assignmentAudit: jobToUnassign.assignmentAudit || null,
              lastAssignmentAudit: jobToUnassign.lastAssignmentAudit || null,
              assignmentOverrideReasons: jobToUnassign.assignmentOverrideReasons || null,
              autoAssignmentDisabled: jobToUnassign.autoAssignmentDisabled || false,
              autoAssignmentStatus: jobToUnassign.autoAssignmentStatus || null,
              jobStatus: jobToUnassign.jobStatus || "Offered",
              jobStatusHandyman: jobToUnassign.jobStatusHandyman || "Pending",
              lastUpdated: new Date().toISOString(),
            };
          }, { applyLocally: false });
          throw new Error("Cancellation could not be synced to the mobile app and was rolled back.");
        }
      }
      setShowCancelAssignConfirm(false);
      setJobToUnassign(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (error) {
      setCancelAssignError(error.message || "Cancellation failed. Refresh the job and try again.");
    } finally {
      setCancelAssignSaving(false);
    }
  };

  const aiHasNoEligibleProvider = Boolean(
    aiReview && aiReview.ranking.candidates.length === 0
  );
  const aiBlocksAssignment = Boolean(
    aiReview && (
      aiReview.triage.triageStatus !== "READY_FOR_ASSIGNMENT" ||
      aiHasNoEligibleProvider
    )
  );
  const manualAssignmentOptions = assigningJob && aiReview
    ? getManualAssignmentOptions(assigningJob, assignCandidates, jobData, aiReview.triage)
    : [];
  const selectedManualOption = manualAssignmentOptions.find((option) =>
    option.providerId === (assignSelected?.handymanId || assignSelected?.id)
  );
  const canConfirmAssignment = manualAssignMode
    ? Boolean(selectedManualOption)
    : Boolean(assignSelected && !aiBlocksAssignment);

  const activeProviderId = (job) => job.assignedTo ||
    job.assignment?.providerId ||
    job.assignment?.assignedTo || "";

  const viewedProviderId = activeProviderId(editedJob || {});
  const viewedAssignedProvider = assignCandidates.find((provider) =>
    (provider.handymanId || provider.id) === viewedProviderId
  ) || null;

  const handleConfirmDelete = () => {
    if (!jobToDelete) return;
    const jobId = jobToDelete.jobId;
    // Remove only from canonical Job node
    const jobRef = ref(database, `Job/${jobId}`);
    remove(jobRef)
      .then(() => {
        setShowDeleteConfirm(false);
        setJobToDelete(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);
      })
      .catch((err) => {
        console.error("Error deleting job:", err);
        setShowDeleteConfirm(false);
        setJobToDelete(null);
      });
  };

  const handleReset = () => {
    setEditedJob({ ...selectedJob });
    setFormErrors({});
  };

  const groupedFields = {
    "Job overview": [
      "jobCat",
      "jobDesc",
      "jobStatus",
      "jobStatusHandyman",
      "jobStatusCustomer",
      "createdBy",
      "assignedTo",
    ],
    Location: ["jobLocation"],
    Schedule: ["jobDateFrom", "jobDateTo", "jobTimeFrom", "jobTimeTo"],
    Payment: ["jobPaymentOption", "jobSalaryFrom", "jobSalaryTo"],
    Reference: ["jobId", "customerId", "createdAt", "lastUpdated"],
  };

  const getInputType = (key) => {
    if (key.toLowerCase().includes("date")) return "text";
    if (key.toLowerCase().includes("time")) return "time";
    if (key.toLowerCase().includes("salary")) return "number";
    return "text";
  };

  const renderGroupedFields = () =>
    Object.entries(groupedFields).map(([group, fields]) => (
      <div key={group} className="mb-3">
        <h6 className="text-primary">{group}</h6>
        <Row>
          {fields.map((key) =>
            editedJob[key] !== undefined ? (
              <Col md={6} className="mb-2" key={key}>
                <Form.Label className="fw-semibold">{JOB_FIELD_LABELS[key] || key}</Form.Label>
                {isEditMode &&
                ![
                  "createdBy",
                  "createdAt",
                  "lastUpdated",
                  "jobId",
                  "customerId",
                  "quotedHandymen",
                ].includes(key) ? (
                  key === "jobCat" ? (
                    <Form.Select
                      value={editedJob[key] || ""}
                      onChange={(e) => setEditedJob({ ...editedJob, [key]: e.target.value })}
                      isInvalid={!!formErrors[key]}
                    >
                      {!AI_REVIEW_CATEGORIES.includes(editedJob[key]) && editedJob[key] && (
                        <option value={editedJob[key]}>{editedJob[key]} (not in AI taxonomy)</option>
                      )}
                      {AI_REVIEW_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </Form.Select>
                  ) : key === "jobStatus" ||
                  key === "jobStatusCustomer" ||
                  key === "jobStatusHandyman" ? (
                    <Form.Select
                      value={editedJob[key] || ""}
                      onChange={(e) =>
                        setEditedJob({ ...editedJob, [key]: e.target.value })
                      }
                      isInvalid={!!formErrors[key]}
                    >
                      <option value="" disabled hidden>
                        Select Status
                      </option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                      <option value="Cancelled">Cancelled</option>
                    </Form.Select>
                  ) : (
                    <Form.Control
                      type={getInputType(key)}
                      value={editedJob[key]}
                      onChange={(e) =>
                        setEditedJob({ ...editedJob, [key]: e.target.value })
                      }
                      isInvalid={!!formErrors[key]}
                    />
                  )
                ) : (
                  <Form.Control
                    value={
                      key === "createdBy"
                        ? getUserName(editedJob.customerId) || editedJob.createdBy || "—"
                        : key === "assignedTo"
                        ? getHandymanName(editedJob.assignedTo) || "—"
                        : formatJobField(key, editedJob[key])
                    }
                    title={String(editedJob[key] || "")}
                    disabled
                  />
                )}
                {formErrors[key] && (
                  <Form.Control.Feedback type="invalid" className="d-block">
                    {formErrors[key]}
                  </Form.Control.Feedback>
                )}
              </Col>
            ) : null
          )}
        </Row>
      </div>
    ));

  return (
    <div className="p-4">
      <StickyHeader
        currentUser={currentUser}
        pageTitle="Job Management"
        className="mb-4"
      />

      {showSuccess && (
        <Alert variant="success" dismissible onClose={() => setShowSuccess(false)}>
          Changes saved successfully.
        </Alert>
      )}

      <div
        className="d-flex justify-content-between align-items-center gap-3 flex-wrap border rounded-3 p-3 mt-4"
        style={{ backgroundColor: "#f5fcf9", borderColor: "#b8ded2" }}
      >
        <div>
          <div className="fw-semibold">Automatic AI assignment</div>
          <div className="small text-muted">
            {assignmentMode.mode === "AUTO"
              ? "New jobs are assigned only when every automatic-assignment check passes."
              : "AI prepares the ranking; an admin confirms the provider."}
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <SoftTag tone={assignmentMode.mode === "AUTO" ? "mint" : "blue"}>
            {assignmentMode.mode === "AUTO" ? "Auto" : "Manual"}
          </SoftTag>
          <Form.Check
            type="switch"
            id="automatic-assignment-switch"
            aria-label="Automatic AI assignment"
            checked={assignmentMode.mode === "AUTO"}
            disabled={assignmentModeSaving}
            onChange={(event) => handleAssignmentModeChange(event.target.checked)}
          />
        </div>
      </div>
      {assignmentModeError && (
        <Alert variant="danger" className="py-2 mt-3 mb-0">
          {assignmentModeError}
        </Alert>
      )}

      {/* Filter and search controls */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3 mt-4">
        <div className="d-flex align-items-center gap-4 flex-grow-1">
          <InputGroup style={{ width: "50%" }}>
            <Form.Control
              placeholder="Search by job ID, category, location, or description"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </InputGroup>
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0">Show</Form.Label>
            <Form.Control
              type="number"
              min={1}
              max={100}
              value={entriesPerPage}
              onChange={(e) => {
                const v = Number(e.target.value) || 1;
                setEntriesPerPage(v);
                setCurrentPage(1);
              }}
              style={{ width: "90px" }}
            />
            <span className="ms-1">entries per page</span>
          </div>
          {/* Status Filter */}
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0">Status:</Form.Label>
            <Form.Select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: "150px" }}
            >
              <option value="All">All</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
              <option value="Cancelled">Cancelled</option>
            </Form.Select>
          </div>
          {/* Category Filter */}
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0">Category:</Form.Label>
            <Form.Select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: "200px" }}
            >
              <option value="All">All</option>
              {JOB_CATEGORIES.map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>
      </div>

      <Table hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Assigned</th>
            <th>Assigned To</th>
            <th>Job Category</th>
            <th>Description</th>
            <th>Created By</th>
            <th>Location</th>
            <th>Date</th>
            <th>Time</th>
            <th>Salary</th>
            <th>Status</th>
            <th>Quotes</th>
            <th>Finished By</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {currentJobs.length > 0 ? (
            currentJobs.map((job) => (
              <tr key={job.jobId}>
                <td>{job.jobId.slice(0, 8)}...</td>
                <td>
                  <SoftTag tone={activeProviderId(job) ? "mint" : "grey"}>
                    {activeProviderId(job) ? 'Yes' : 'No'}
                  </SoftTag>
                </td>
                <td>{getHandymanName(activeProviderId(job)) || '—'}</td>
                <td>{job.jobCat}</td>
                <td>{job.jobDesc}</td>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-person"></i>
                    <span>{getUserName(job.customerId) || job.createdBy || "N/A"}</span>
                  </div>
                </td>
                <td>{job.jobLocation}</td>
                <td>
                  {formatDate(job.jobDateFrom)} – {formatDate(job.jobDateTo)}
                </td>
                <td>
                  {formatTime(job.jobTimeFrom)} – {formatTime(job.jobTimeTo)}
                </td>
                <td>
                  {formatBudget(job.jobSalaryFrom)} – {formatBudget(job.jobSalaryTo)}
                </td>
                <td>
                  <SoftTag tone={jobStatusTone(job.jobStatus)}>
                    {job.jobStatus || "Open"}
                  </SoftTag>
                </td>
                <td>
                  {Array.isArray(job.quotedHandymen)
                    ? job.quotedHandymen.length
                    : 0}
                </td>
                <td>
                  {job.jobStatus === "Done"
                    ? job.finishedBy || "Handyman"
                    : "—"}
                </td>
                <td>
                  <div className="d-flex flex-wrap gap-2">
                    <SoftActionButton tone="blue" onClick={() => handleViewClick(job)}>
                      View
                    </SoftActionButton>
                    {canCancelAssignment(job) ? (
                      <SoftActionButton tone="amber" onClick={() => handleCancelAssignClick(job)}>
                        Cancel Assign
                      </SoftActionButton>
                    ) : (
                      <SoftActionButton
                        tone={activeProviderId(job) || !isAssignmentOpen(job) || !isAiCategorySupported(job) ? "grey" : "mint"}
                        disabled={Boolean(activeProviderId(job)) || !isAssignmentOpen(job) || !isAiCategorySupported(job)}
                        onClick={() => handleAssignClick(job)}
                        title={
                          activeProviderId(job)
                            ? "This job already has a provider"
                            : !isAssignmentOpen(job)
                              ? "Only open jobs can be assigned"
                              : !isAiCategorySupported(job)
                                ? "This job category is not supported"
                                : "Review AI triage and provider recommendations"
                        }
                      >
                        {activeProviderId(job)
                          ? "Assigned"
                          : !isAssignmentOpen(job)
                            ? "Closed"
                            : !isAiCategorySupported(job)
                              ? "Not supported"
                              : "Assign"}
                      </SoftActionButton>
                    )}
                    <SoftActionButton tone="red" onClick={() => handleDeleteClick(job)}>
                      Delete
                    </SoftActionButton>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="14" className="text-center text-muted">
                No jobs found.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <PaginationControls
        totalItems={filteredJobs.length}
        entriesPerPage={entriesPerPage}
        setEntriesPerPage={setEntriesPerPage}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        startIndex={startIndex}
      />

      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditMode ? "Edit job details" : `View job — ${editedJob?.jobCat || "Uncategorised"}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editedJob && (
            <Form>
              {renderGroupedFields()}
              {!isEditMode && (
                <AssignedProviderSummary
                  job={editedJob}
                  provider={viewedAssignedProvider}
                  jobs={jobData}
                  reviews={reviewData}
                  onViewProvider={setProfileProvider}
                />
              )}
              {showSuccess && (
                <Alert variant="success">Saved successfully!</Alert>
              )}
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          {isEditMode && (
            <Button variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button
            variant="outline-secondary"
            onClick={() => setShowModal(false)}
          >
            Close
          </Button>
          {!isEditMode ? (
            <Button variant="warning" onClick={() => setIsEditMode(true)}>
              Edit
            </Button>
          ) : (
            <Button variant="success" onClick={() => setShowConfirmModal(true)}>
              Save
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        onConfirm={handleSaveChanges}
        title="Confirm Save"
        body="Are you sure you want to save changes?"
        loading={isSaving}
        confirmText="Confirm"
        cancelText="Cancel"
      />
      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete"
        body={
          jobToDelete
            ? `Are you sure you want to delete job ${jobToDelete.jobId.slice(0, 8)}...? This action cannot be undone.`
            : "Are you sure you want to delete this job?"
        }
        loading={false}
        confirmText="Delete"
        cancelText="Cancel"
      />
      <ConfirmModal
        show={showCancelAssignConfirm}
        onHide={() => {
          if (!cancelAssignSaving) {
            setShowCancelAssignConfirm(false);
            setCancelAssignError("");
          }
        }}
        onConfirm={handleConfirmCancelAssignment}
        title="Cancel provider assignment"
        body={(
          <>
            <div>{jobToUnassign ? `Cancel the offer to ${getHandymanName(activeProviderId(jobToUnassign)) || "this provider"}? The job will return to Open and can be assigned again.` : "Cancel this assignment?"}</div>
            {cancelAssignError && <Alert variant="danger" className="py-2 mt-3 mb-0">{cancelAssignError}</Alert>}
          </>
        )}
        loading={cancelAssignSaving}
        confirmText="Cancel assignment"
        cancelText="Keep assignment"
      />

      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Review & Assign Job</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <div>
              <strong>{assigningJob?.jobCat || "Uncategorised"} job</strong>
              {assigningJob?.jobDesc ? ` — ${assigningJob.jobDesc}` : " — No description provided"}
            </div>
            <div className="text-muted small mt-1">
              {assigningJob?.jobLocation || "Location not provided"}
              {" · "}{formatDate(assigningJob?.jobDateFrom)} – {formatDate(assigningJob?.jobDateTo)}
              {" · "}{formatTime(assigningJob?.jobTimeFrom)} – {formatTime(assigningJob?.jobTimeTo)}
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center gap-3 border rounded-3 p-3 mb-3"
            style={{ backgroundColor: "#f7fbfa", borderColor: "#cfe5de" }}>
            <div>
              <div className="fw-semibold">Local AI matching</div>
              <div className="small text-muted">Qwen triage with service rules and provider ranking.</div>
            </div>
            <SoftTag tone="mint">Local Qwen</SoftTag>
          </div>
          <AiAssignmentReview
            review={aiReview}
            loading={aiReviewLoading}
            error={aiReviewError}
            providers={assignCandidates}
            selectedProviderId={manualAssignMode ? null : assignSelected?.handymanId}
            jobStatus={assigningJob?.jobStatus}
            onSelectProvider={(provider) => {
              setManualAssignMode(false);
              setAssignSelected(provider);
            }}
            onViewProvider={setProfileProvider}
            onRetry={() => assigningJob && loadAiReview(assigningJob)}
          />
          {aiBlocksAssignment && (
            <Alert variant="warning" className="py-2 d-flex justify-content-between align-items-center gap-3">
              <span>
                {aiReview?.triage?.triageStatus === "READY_FOR_ASSIGNMENT" && aiHasNoEligibleProvider
                  ? "No provider currently meets every assignment rule. Alternatives are view-only; manual assignment remains available below."
                  : "AI assignment is paused because information is incomplete. Review the job or use manual assignment below."}
              </span>
              <Button size="sm" variant="outline-dark" className="flex-shrink-0" onClick={handleReviewJobDetails}>
                Review Job Details
              </Button>
            </Alert>
          )}
          {aiReview && !aiReviewLoading && (
            <div className="border rounded-3 p-3 mb-3" style={{ backgroundColor: "#f5fcf9", borderColor: "#b8ded2" }}>
              <div className="fw-semibold mb-1">Manual assignment</div>
              <div className="small text-muted mb-3">
                Choose manually instead of the AI recommendation. Only verified, available providers with fewer than {PROVIDER_WORKLOAD_LIMIT} active jobs are listed.
              </div>
              {manualAssignmentOptions.length === 0 ? (
                <Alert variant="light" className="border mb-0">
                  No provider currently passes the verification, availability, and workload checks.
                </Alert>
              ) : (
                <>
                  <Form.Select
                    aria-label="Select provider manually"
                    value={manualAssignMode ? assignSelected?.handymanId || assignSelected?.id || "" : ""}
                    onChange={(event) => {
                      const option = manualAssignmentOptions.find((item) => item.providerId === event.target.value);
                      setManualAssignMode(Boolean(option));
                      setAssignSelected(option?.provider || null);
                      setAssignError("");
                    }}
                  >
                    <option value="">Choose a provider</option>
                    {manualAssignmentOptions.map((option) => (
                      <option key={option.providerId} value={option.providerId}>
                        {option.displayName} — {option.skills.join(", ") || "No recorded skills"} — {option.activeJobs} of {PROVIDER_WORKLOAD_LIMIT} active jobs
                      </option>
                    ))}
                  </Form.Select>
                  {selectedManualOption && (
                    <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                      <span className="small fw-semibold">Checks:</span>
                      <SoftTag tone="mint">Verified</SoftTag>
                      <SoftTag tone="mint">Available</SoftTag>
                      <SoftTag tone="mint">Workload available ({selectedManualOption.activeJobs}/{PROVIDER_WORKLOAD_LIMIT})</SoftTag>
                      {selectedManualOption.warnings.length === 0 ? (
                        <SoftTag tone="mint">No override warning</SoftTag>
                      ) : selectedManualOption.warnings.map((warning) => (
                        <SoftTag tone="amber" key={warning}>{MANUAL_WARNING_LABELS[warning] || warning}</SoftTag>
                      ))}
                      <Button
                        size="sm"
                        variant="outline-info"
                        className="rounded-pill ms-auto"
                        onClick={() => setProfileProvider(selectedManualOption.provider)}
                      >
                        View Profile
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {assignError && <Alert variant="danger" className="py-2">{assignError}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
          <Button
            style={ACTION_TONES.mint}
            onClick={handleConfirmAssign}
            disabled={assignSaving || !canConfirmAssignment}
          >
            {assignSaving ? "Assigning…" : manualAssignMode ? "Assign Manually" : "Assign"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ProviderProfileModal
        show={Boolean(profileProvider)}
        onHide={() => setProfileProvider(null)}
        provider={profileProvider}
        jobs={jobData}
        reviews={reviewData}
      />
    </div>
  );
}

export default JobManagement;
