//TODO: align the datafield like job ststus, job category, job description, job location, job date, job time, job salary, created by, finished by with @Jenny
import React, { useState, useEffect } from "react";
import {
  Table,
  Form,
  Button,
  InputGroup,
  Badge,
  Modal,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import PaginationControls from "../components/PaginationControls";
import StickyHeader from "../components/StickyHeader";
import { database } from "../firebase";
import { ref, get, onValue, update, remove, push } from "firebase/database";
import ConfirmModal from "../components/ConfirmModal";
import ExportReportButton from "../components/ExportReportButton";
import JOB_CATEGORIES from "../constants/jobCategories";
import handymanMocks from "../data/handymanData";
import userMocks from "../data/userData";

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
  const [assignSelected, setAssignSelected] = useState(null);
  const [assignNotes, setAssignNotes] = useState("");
  const [assignPrice, setAssignPrice] = useState("");
  const [assigningJob, setAssigningJob] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const [filterCategory, setFilterCategory] = useState("All");
  // maps for id -> display name to show friendly names in tables
  const [handymanMap, setHandymanMap] = useState({});
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    // Use the canonical 'Job' node only (remove legacy DummyJob usage)
    const jobRef = ref(database, "Job");
    const unsubscribe = onValue(jobRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const jobsArray = Object.entries(data).map(([jobId, job]) => ({
          jobId,
          ...job,
        }));
        setJobData(jobsArray);
      } else {
        setJobData([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load handyman and user maps for display names. Try DB first, fall back to mocks.
  useEffect(() => {
    const loadHandymen = async () => {
      try {
        const snap = await get(ref(database, "Handyman"));
        if (snap && snap.exists()) {
          const data = snap.val();
          const map = {};
          Object.entries(data).forEach(([id, h]) => {
            const name = `${h.firstName || h.first_name || h.name || ""} ${h.lastName || h.last_name || ""}`.trim();
            map[id] = name || h.displayName || h.email || id;
          });
          setHandymanMap(map);
          return;
        }
      } catch (e) {
        console.error("Error loading handymen for name map:", e);
      }
      // fallback to local mocks
      const fallback = {};
      handymanMocks.forEach((h) => {
        fallback[h.handymanId] = `${h.firstName || ""} ${h.lastName || ""}`.trim();
      });
      setHandymanMap(fallback);
    };

    const loadUsers = async () => {
      try {
        // try several likely paths for users in the realtime DB
        const paths = ["User", "Users", "user", "users"];
        for (const p of paths) {
          try {
            const snap = await get(ref(database, p));
            if (snap && snap.exists()) {
              const data = snap.val();
              const map = {};
              Object.entries(data).forEach(([id, u]) => {
                const name = `${u.firstName || u.first_name || u.name || ""} ${u.lastName || u.last_name || ""}`.trim();
                map[id] = name || u.displayName || u.email || id;
              });
              setUserMap(map);
              return;
            }
          } catch (e) {
            // try next path
          }
        }
      } catch (e) {
        console.error("Error loading users for name map:", e);
      }
      // fallback to local mocks
      const fallback = {};
      userMocks.forEach((u) => {
        fallback[u.userId] = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      });
      setUserMap(fallback);
    };

    loadHandymen();
    loadUsers();
  }, []);

  const getHandymanName = (id) => {
    if (!id) return null;
    return handymanMap[id] || id;
  };

  const getUserName = (id) => {
    if (!id) return null;
    // if createdBy is already a friendly string, prefer it
    return userMap[id] || id;
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

  const totalPages = Math.ceil(filteredJobs.length / entriesPerPage);
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

  const handleDeleteClick = (job) => {
    setJobToDelete(job);
    setShowDeleteConfirm(true);
  };

  const handleAssignClick = (job) => {
    setAssigningJob(job);
    setAssignNotes("");
    setAssignPrice("");
    setAssignSelected(null);
    setShowAssignModal(true);

    // Attempt to read handymen from DB; fallback to local mock data
    const handymanRef = ref(database, "Handyman");
    get(handymanRef)
      .then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.keys(data).map((id) => ({ handymanId: id, ...data[id] }));
          setAssignCandidates(list);
        } else {
          setAssignCandidates(handymanMocks);
        }
      })
      .catch((err) => {
        console.error("Error loading handymen:", err);
        setAssignCandidates(handymanMocks);
      });
  };

  const handleConfirmAssign = async () => {
    if (!assigningJob || !assignSelected) return;
    const jobId = assigningJob.jobId;
    const assignmentObj = {
      assignedTo: assignSelected.handymanId,
      assignedBy: currentUser?.email || currentUser?.id || "admin",
      assignedAt: new Date().toISOString(),
      assignmentNotes: assignNotes || "",
      assignmentPrice: assignPrice || null,
    };
    const payload = {
      assignment: assignmentObj,
      // convenience top-level fields so UIs that read older paths can show status
      assignedTo: assignmentObj.assignedTo,
      assignedBy: assignmentObj.assignedBy,
      assignedAt: assignmentObj.assignedAt,
    };

    try {
      // Update only the canonical Job node
      const jobRef = ref(database, `Job/${jobId}`);
      await update(jobRef, payload);

      // push history entry to Job/assignmentHistory
      const historyRefJob = ref(database, `Job/${jobId}/assignmentHistory`);
      const historyEntry = {
        actorId: currentUser?.id || currentUser?.email || "admin",
        action: "assign",
        to: assignSelected.handymanId,
        price: assignPrice || null,
        notes: assignNotes || "",
        ts: new Date().toISOString(),
      };
      await push(historyRefJob, historyEntry);

      setShowAssignModal(false);
      setAssigningJob(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } catch (err) {
      console.error("Error assigning job:", err);
      setShowAssignModal(false);
      setAssigningJob(null);
    }
  };

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
    General: [
      "jobCat",
      "jobDesc",
      "jobStatus",
      "jobStatusHandyman",
      "jobStatusCustomer",
      "createdBy",
      "assignedTo",
    ],
    Location: ["jobLocation"],
    DateTime: ["jobDateFrom", "jobDateTo", "jobTimeFrom", "jobTimeTo"],
    Payment: ["jobPaymentOption", "jobSalaryFrom", "jobSalaryTo"],
    Meta: ["jobId", "customerId", "quotedHandymen", "createdAt", "lastUpdated"],
  };

  const getInputType = (key) => {
    if (key.toLowerCase().includes("date")) return "date";
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
                <Form.Label className="fw-semibold">{key}</Form.Label>
                {isEditMode &&
                ![
                  "createdBy",
                  "createdAt",
                  "lastUpdated",
                  "jobId",
                  "customerId",
                  "quotedHandymen",
                ].includes(key) ? (
                  key === "jobStatus" ||
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
                      <option value="Done">Done</option>
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
                      typeof editedJob[key] === "object"
                        ? JSON.stringify(editedJob[key])
                        : editedJob[key]
                    }
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

      {/* Filter, Search Bar , Export Report Button*/}
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
        {/* Export Report button */}
        <div className="d-flex align-items-center h-100 mb-0 mt-0">
          <ExportReportButton
            data={currentJobs}
            columns={[
              { header: "Job ID", accessor: "jobId" },
              { header: "Job Category", accessor: "jobCat" },
              { header: "Description", accessor: "jobDesc" },
              { header: "Created By", accessor: "createdBy" },
              { header: "Location", accessor: "jobLocation" },
              { header: "Date", accessor: "jobDateFrom" },
              { header: "Time", accessor: "jobTimeFrom" },
              { header: "Salary", accessor: "jobSalaryFrom" },
              { header: "Status", accessor: "jobStatus" },
            ]}
            fileName="Job_Report"
          />
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
                  <Badge bg={job.assignedTo || job.assignment?.assignedTo ? 'success' : 'secondary'}>
                    {job.assignedTo || job.assignment?.assignedTo ? 'Yes' : 'No'}
                  </Badge>
                </td>
                <td>{getHandymanName(job.assignedTo || job.assignment?.assignedTo) || '—'}</td>
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
                  {job.jobDateFrom} - {job.jobDateTo}
                </td>
                <td>
                  {job.jobTimeFrom} - {job.jobTimeTo}
                </td>
                <td>
                  {job.jobSalaryFrom} - {job.jobSalaryTo}
                </td>
                <td>
                  <Badge
                    bg={
                      job.jobStatus === "Done"
                        ? "success"
                        : job.jobStatus === "Cancelled"
                        ? "danger"
                        : job.jobStatus === "In Progress"
                        ? "primary"
                        : "warning"
                    }
                  >
                    {job.jobStatus || "Open"}
                  </Badge>
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
                    <Button size="sm" variant="info" onClick={() => handleViewClick(job)}>
                      View
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleAssignClick(job)}>
                      Assign
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteClick(job)}>
                      Delete
                    </Button>
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
          <Modal.Title>{isEditMode ? "Edit Job" : "Job Details"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editedJob && (
            <Form>
              {renderGroupedFields()}
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

      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Assign Job</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2">
            <strong>Job:</strong> {assigningJob?.jobId} — {assigningJob?.jobDesc}
          </div>
          <Form.Group className="mb-2">
            <Form.Label>Search / Filter</Form.Label>
            <Form.Control
              type="text"
              placeholder="Filter candidates (skill, name, area)"
              onChange={(e) => {
                const q = e.target.value.trim().toLowerCase();
                if (!q) {
                  // reload from DB fallback (one-time)
                  const handymanRef = ref(database, "Handyman");
                  get(handymanRef)
                    .then((snapshot) => {
                      const data = snapshot.val();
                      if (data) setAssignCandidates(Object.keys(data).map((id) => ({ handymanId: id, ...data[id] })));
                      else setAssignCandidates(handymanMocks);
                    })
                    .catch(() => setAssignCandidates(handymanMocks));
                } else {
                  setAssignCandidates((prev) => prev.filter((h) => {
                    const name = `${h.firstName || ""} ${h.lastName || ""}`.toLowerCase();
                    const skills = (h.skills || []).join(" ").toLowerCase();
                    const area = (h.area || h.city || "").toLowerCase();
                    return name.includes(q) || skills.includes(q) || area.includes(q);
                  }));
                }
              }}
            />
          </Form.Group>

          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {assignCandidates.map((h) => (
              <div key={h.handymanId} className={`p-2 border rounded mb-2 ${assignSelected?.handymanId === h.handymanId ? 'bg-light' : ''}`} onClick={() => setAssignSelected(h)} style={{ cursor: 'pointer' }}>
                <div className="d-flex justify-content-between">
                  <div>
                    <strong>{h.firstName} {h.lastName}</strong>
                    <div className="text-muted small">{h.city || h.area || ''}</div>
                    <div className="text-muted small">Skills: {(h.skills || []).join(', ')}</div>
                  </div>
                  <div>
                    {assignSelected?.handymanId === h.handymanId && <Badge bg="primary">Selected</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Form.Group className="mt-3 mb-2">
            <Form.Label>Assignment Price (optional)</Form.Label>
            <Form.Control type="number" value={assignPrice} onChange={(e) => setAssignPrice(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Notes (optional)</Form.Label>
            <Form.Control as="textarea" rows={3} value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirmAssign} disabled={!assignSelected}>Assign</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default JobManagement;
