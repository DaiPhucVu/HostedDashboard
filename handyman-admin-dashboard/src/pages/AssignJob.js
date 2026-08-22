import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Spinner, Table } from "react-bootstrap";
import { database } from "../firebase";
import { onValue, ref, update } from "firebase/database";
import StickyHeader from "../components/StickyHeader";

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "") || "";

const normalizeJob = (jobId, job = {}) => ({
  ...job,
  jobId: firstDefined(job.jobId, job.id, jobId),
  jobCat: firstDefined(job.jobCat, job.category, job.jobCategory),
  jobDesc: firstDefined(job.jobDesc, job.description, job.jobDescription),
  jobLocation: firstDefined(job.jobLocation, job.location, job.address),
  jobDateFrom: firstDefined(job.jobDateFrom, job.dateFrom, job.startDate, job.date),
  jobDateTo: firstDefined(job.jobDateTo, job.dateTo, job.endDate, job.date),
  jobTimeFrom: firstDefined(job.jobTimeFrom, job.timeFrom, job.startTime),
  jobTimeTo: firstDefined(job.jobTimeTo, job.timeTo, job.endTime),
  jobSalaryFrom: firstDefined(
    job.jobSalaryFrom,
    job.salaryFrom,
    job.budgetFrom,
    job.budget,
    job.price
  ),
  jobSalaryTo: firstDefined(job.jobSalaryTo, job.salaryTo, job.budgetTo, job.budget, job.price),
  jobStatus: firstDefined(job.jobStatus, job.status),
});

function AssignJob() {
  const [jobs, setJobs] = useState([]);
  const [handymen, setHandymen] = useState([]);
  const [selectedHandymen, setSelectedHandymen] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [savingJobId, setSavingJobId] = useState(null);
  const [notice, setNotice] = useState({
    show: false,
    message: "",
    variant: "success",
  });

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser"));
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const jobRef = ref(database, "Job");
    const unsubscribe = onValue(jobRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setJobs([]);
        return;
      }

      const jobsArray = Object.entries(data).map(([jobId, job]) =>
        normalizeJob(jobId, job)
      );

      const isAvailableJob = (job) => {
        const status = String(job?.jobStatus || "").trim().toLowerCase();

        const hasAssignee = Boolean(job?.assignedTo);
        const isDoneOrCancelled = ["done", "cancelled"].includes(status);
        const isOpenLike = ["", "open", "available", "pending", "new"].includes(status);

        return !hasAssignee && !isDoneOrCancelled && (isOpenLike || !status);
      };

      setJobs(jobsArray.filter(isAvailableJob));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handymanRef = ref(database, "Handyman");
    const unsubscribe = onValue(handymanRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setHandymen([]);
        return;
      }

      const list = Object.entries(data).map(([id, handyman]) => ({
        id,
        ...(handyman || {}),
        handymanId: handyman?.handymanId || id,
      }));

      const isEligibleHandyman = (handyman) => {
        const verificationStatus = String(handyman?.verificationStatus || "")
          .trim()
          .toLowerCase();
        const isVerified =
          handyman?.verified === true || handyman?.verified === "true";
        const isPhoneVerified =
          handyman?.isPhoneVerified === true ||
          handyman?.isPhoneVerified === "true";

        return (
          isVerified ||
          isPhoneVerified ||
          verificationStatus === "approved" ||
          verificationStatus === "verified" ||
          verificationStatus === "active"
        );
      };

      setHandymen(list.filter(isEligibleHandyman));
    });

    return () => unsubscribe();
  }, []);

  const getHandymanName = (handymanId) => {
    if (!handymanId) return "Unassigned";

    const handyman = handymen.find(
      (person) => (person.handymanId || person.id) === handymanId
    );

    if (!handyman) return handymanId;

    const fullName = `${handyman.firstName || ""} ${handyman.lastName || ""}`.trim();
    return fullName || handyman.email || handymanId;
  };

  const getAvailableHandymen = (jobId, assignedTo) => {
    const assignedIds = new Set(
      jobs
        .filter(
          (job) =>
            job.jobId !== jobId &&
            ["Open", "In Progress"].includes(job.jobStatus) &&
            job.assignedTo
        )
        .map((job) => job.assignedTo)
    );

    const options = handymen.filter(
      (handyman) => !assignedIds.has(handyman.handymanId || handyman.id)
    );

    if (assignedTo) {
      const current = handymen.find(
        (handyman) => (handyman.handymanId || handyman.id) === assignedTo
      );
      if (current && !options.some((h) => (h.handymanId || h.id) === assignedTo)) {
        options.unshift(current);
      }
    }

    return options;
  };

  const filteredJobs = jobs.filter((job) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;

    return (
      job.jobId?.toLowerCase().includes(q) ||
      job.jobCat?.toLowerCase().includes(q) ||
      job.jobDesc?.toLowerCase().includes(q) ||
      job.jobLocation?.toLowerCase().includes(q)
    );
  });

  const handleAssign = async (job) => {
    const selectedHandymanId = selectedHandymen[job.jobId] || job.assignedTo;

    if (!selectedHandymanId) {
      setNotice({
        show: true,
        message: `Please select a handyman for ${job.jobCat || "this job"}.`,
        variant: "warning",
      });
      return;
    }

    setSavingJobId(job.jobId);

    try {
      const updatedJob = {
        ...job,
        assignedTo: selectedHandymanId,
        assignedBy: currentUser?.email || currentUser?.id || "admin",
        assignedAt: new Date().toISOString(),
        jobStatus: "In Progress",
        lastUpdated: new Date().toISOString(),
      };

      await update(ref(database, `Job/${job.jobId}`), updatedJob);

      setNotice({
        show: true,
        message: `Job assigned to ${getHandymanName(selectedHandymanId)} successfully.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error assigning job:", error);
      setNotice({
        show: true,
        message: "Failed to assign the job. Please try again.",
        variant: "danger",
      });
    } finally {
      setSavingJobId(null);
    }
  };

  return (
    <div className="p-4">
      <StickyHeader currentUser={currentUser} pageTitle="Assign Job" className="mb-4" />

      {notice.show && (
        <Alert
          variant={notice.variant}
          dismissible
          onClose={() => setNotice({ ...notice, show: false })}
          className="mb-3"
        >
          {notice.message}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3 flex-grow-1">
          <Form.Control
            placeholder="Search by job ID, category, description, or location"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: 500 }}
          />
        </div>
        <Badge bg="warning" text="dark">
          Open jobs: {jobs.length}
        </Badge>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Category</th>
            <th>Description</th>
            <th>Location</th>
            <th>Date</th>
            <th>Salary</th>
            <th>Assign To</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredJobs.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center text-muted py-4">
                No open jobs found.
              </td>
            </tr>
          ) : (
            filteredJobs.map((job) => {
              const options = getAvailableHandymen(job.jobId, job.assignedTo);
              const selected = selectedHandymen[job.jobId] || job.assignedTo || "";

              return (
                <tr key={job.jobId}>
                  <td>{job.jobId.slice(0, 8)}...</td>
                  <td>{job.jobCat}</td>
                  <td>{job.jobDesc}</td>
                  <td>{job.jobLocation}</td>
                  <td>
                    {job.jobDateFrom} - {job.jobDateTo}
                  </td>
                  <td>
                    {job.jobSalaryFrom} - {job.jobSalaryTo}
                  </td>
                  <td>
                    <Form.Select
                      value={selected}
                      onChange={(e) =>
                        setSelectedHandymen((prev) => ({
                          ...prev,
                          [job.jobId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select handyman</option>
                      {options.map((handyman) => {
                        const handymanId = handyman.handymanId || handyman.id;
                        const fullName = `${handyman.firstName || ""} ${handyman.lastName || ""}`.trim();
                        return (
                          <option key={handymanId} value={handymanId}>
                            {fullName || handyman.email || handymanId}
                          </option>
                        );
                      })}
                    </Form.Select>
                  </td>
                  <td>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleAssign(job)}
                      disabled={savingJobId === job.jobId}
                    >
                      {savingJobId === job.jobId ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          Assigning
                        </>
                      ) : (
                        "Assign"
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </div>
  );
}

export default AssignJob;
