import React, { useState, useEffect } from "react";
import {
  Button,
  Form,
  Badge,
  InputGroup,
  Dropdown,
  Spinner,
  Modal,
  Row,
  Col,
} from "react-bootstrap";
import { getDatabase, ref, onValue, update, set } from "firebase/database";
import PaginationControls from "../components/PaginationControls";
import StickyHeader from "../components/StickyHeader";
import ConfirmModal from "../components/ConfirmModal";
import VerificationModal from "../components/VerificationModal";
import ExportReportButton from "../components/ExportReportButton";

function HandymanVerification() {
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(15);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser"));
    } catch {
      return null;
    }
  })();
  const [error, setError] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedHandyman, setSelectedHandyman] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editedUser, setEditedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [comments, setComments] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [verificationType, setVerificationType] = useState("");
  const [verificationLinks, setVerificationLinks] = useState([]);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    variant: "",
  });

  // Status dropdown/modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState({
    handymanId: null,
    newStatus: null,
    warning: "",
  });

  // Helper to approve/decline document and auto-update status if no manual override
  const handleDocumentApproval = async (handyman, type, status) => {
    const db = getDatabase();
    const idField = "idApprovedStatus";
    const certField = "certificateApprovedStatus";
  try {
      // Normalize status (store lowercase consistently)
      const normalized = (status || "").toLowerCase();

      // Update the document status
      const updatePayload = { [type === "identity" ? idField : certField]: normalized };
      await update(ref(db, `Handyman/${handyman.handymanId}`), updatePayload);

      // Get latest values
      const currentHandyman =
        data.find((x) => x.handymanId === handyman.handymanId) || {};

      // Work with updated statuses
      const idStatus =
        type === "identity" ? normalized : currentHandyman[idField] || "pending";
      const certStatus =
        type === "certificates"
          ? normalized
          : currentHandyman[certField] || "pending";
      const manual = currentHandyman.verificationStatusManual;

      // Only auto-update if manual override is false/not set
        if (!manual) {
        let newVerificationStatus = "pending";
        if (idStatus === "approved" && certStatus === "approved") {
          newVerificationStatus = "approved";
        } else if (idStatus === "declined" || certStatus === "declined") {
          newVerificationStatus = "declined";
        }
        const payload2 = { verificationStatus: newVerificationStatus };
        await update(ref(db, `Handyman/${handyman.handymanId}`), payload2);
      }

      setNotification({
        show: true,
        message: `Document ${
          type === "identity" ? "ID Card" : "Certificate"
        } ${normalized}.`,
        variant: normalized === "approved" ? "success" : "danger",
      });
      setTimeout(() => setNotification({ show: false }), 2500);
    } catch (err) {
      console.error("Error updating document approval:", err);
      // error logged to console and shown in UI
      setNotification({
        show: true,
        message: `Failed to update document: ${err?.message || err}`,
        variant: "danger",
      });
      setTimeout(() => setNotification({ show: false }), 4000);
    }
  };

  // Optional: When creating a new handyman, use this function!
  const addNewHandyman = (handymanObj, newId) => {
    const db = getDatabase();
    const newHandymanRef = ref(db, `Handyman/${newId}`);
    set(newHandymanRef, {
      ...handymanObj,
      idApprovedStatus: "pending",
      certificateApprovedStatus: "pending",
    });
  };

  const handleOpenVerificationModal = (handyman, type) => {
    const link =
      type === "identity" ? handyman.photoIdCard : handyman.certificates;
    const formattedLinks = Array.isArray(link) ? link : link ? [link] : [];
    setVerificationLinks(formattedLinks);
    setVerificationType(type);
    setComments("");
    setIsApproved(false);
    setSelectedHandyman(handyman);
    setShowVerificationModal(true);
  };

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    handymanId: null,
    newStatus: null,
  });

  const fieldSections = {
    "Personal Info": ["firstName", "lastName", "email", "phoneNumber"],
    Address: [
      "houseNumber",
      "street",
      "area",
      "thana",
      "district",
      "division",
      "postcode",
    ],
    Documents: ["photoIdCard", "certificates"],
    "Account Info": [
      "verificationStatus",
      "isPhoneVerified",
      "createdAt",
      "approvedBy",
    ],
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setEditedUser(null);
    setFormErrors({});
    setIsEditing(false);
  };

  const handleInputChange = (key, value) => {
    setEditedUser((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const db = getDatabase();
    const handymanRef = ref(db, "Handyman");
    const unsubscribe = onValue(
      handymanRef,
      (snapshot) => {
        const dbData = snapshot.val();
        if (dbData) {
          const parsed = Object.keys(dbData).map((key) => ({
            handymanId: key,
            ...dbData[key],
          }));
          setData(parsed);
        } else {
          setData([]);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError("Failed to load data from the database.");
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleConfirmPhoneStatus = () => {
    const { handymanId, newStatus } = confirmModal;
    const db = getDatabase();
    const handymanRef = ref(db, `Handyman/${handymanId}`);
    update(handymanRef, { isPhoneVerified: newStatus })
      .then(() => {
        setConfirmModal({ show: false, handymanId: null, newStatus: null });
      })
      .catch((err) => {
        console.error("Error updating phone status:", err);
        setConfirmModal({ show: false, handymanId: null, newStatus: null });
      });
  };

  const handleFileUpload = (fieldKey, file) => {
    setEditedUser((prev) => ({
      ...prev,
      [fieldKey]: file,
    }));
  };

  const getShortFileName = (input) => {
    if (!input) return "No File";
    try {
      if (input.startsWith("http")) {
        const decoded = decodeURIComponent(input);
        const parts = decoded.split("/");
        const filePart = parts[parts.length - 1];
        return filePart.split("?")[0]; // Remove query params
      }
      return input;
    } catch (err) {
      return "File";
    }
  };

  const filteredData = data.filter((item) => {
    const status = item.verificationStatus || "Pending";
    const statusMatch = filterStatus === "All" || status === filterStatus;
    const searchMatch =
      item.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const itemDate = new Date(item.createdAt || item.date);
    const inDateRange =
      (!startDate || new Date(startDate) <= itemDate) &&
      (!endDate || itemDate <= new Date(endDate));
    return statusMatch && searchMatch && inDateRange;
  });

  const totalPages = Math.ceil(filteredData.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const currentData = filteredData.slice(
    startIndex,
    startIndex + entriesPerPage
  );

  const handleViewDetails = (user) => {
    setSelectedUser(user);
    setEditedUser({ ...user });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleOpenMessageModal = (handyman) => {
    setSelectedHandyman(handyman);
    setShowMessageModal(true);
  };
  const handleUpdate = async () => {
    if (!editedUser || !editedUser.handymanId) return;

    try {
      const db = getDatabase();
      const handymanRef = ref(db, `Handyman/${editedUser.handymanId}`);
      await update(handymanRef, {
        firstName: editedUser.firstName,
        lastName: editedUser.lastName,
        email: editedUser.email,
        phoneNumber: editedUser.phoneNumber,
        // ...add other fields as required
      });

      setNotification({
        show: true,
        message: "User details updated successfully.",
        variant: "info",
      });
      setShowModal(false);
    } catch (err) {
      setNotification({
        show: true,
        message: "Failed to update user.",
        variant: "danger",
      });
    }
  };

  const statusStyles = {
    approved: {
      color: "#15af52",
      icon: "bi bi-check2-circle",
      label: "Approved",
    },
    pending: {
      color: "#ffc107",
      icon: "bi bi-hourglass-split",
      label: "Pending",
    },
    declined: { color: "#e74c3c", icon: "bi bi-x-circle", label: "Declined" },
  };

  const verificationStatusOptions = [
    { value: "pending", label: "Pending", color: "#ffc107" },
    { value: "approved", label: "Approved", color: "#15af52" },
    { value: "declined", label: "Declined", color: "#e74c3c" },
    { value: "suspected", label: "Suspected", color: "#6c757d" },
  ];

  const DocStatusText = ({ status = "Pending" }) => {
    const { color, icon, label } =
      statusStyles[status] || statusStyles["Pending"];
    return (
      <span
        style={{
          color,
          fontWeight: 600,
          fontSize: "0.98em",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          marginLeft: "0.5rem",
        }}
      >
        <i className={icon} style={{ fontSize: "1.1em" }}></i>
      </span>
    );
  };

  // Handle dropdown click (shows confirm modal, checks warning)
  const handleStatusDropdownChange = (item, newStatus) => {
    let warning = "";
    // Normalize and compare in lowercase to match stored values
    const normalized = (newStatus || "").toString().toLowerCase();
    if (
      normalized === "approved" &&
      (String(item.idApprovedStatus || "").toLowerCase() !== "approved" ||
        String(item.certificateApprovedStatus || "").toLowerCase() !== "approved")
    ) {
      warning =
        "You are setting this handyman to 'Approved' but not all required documents are approved. Are you sure you want to continue?";
    }
    setPendingStatusChange({
      handymanId: item.handymanId,
      newStatus: normalized,
      warning,
    });
    setShowConfirmModal(true);
  };

  // Save status change if confirmed
  const handleConfirmStatusChange = async () => {
    const { handymanId, newStatus } = pendingStatusChange;
    const db = getDatabase();
    const normalized = (newStatus || "").toString().toLowerCase();
    try {
      const payload = { verificationStatus: normalized, verificationStatusManual: true };
      await update(ref(db, `Handyman/${handymanId}`), payload);
      // success - no on-page DB log (removed)
      setShowConfirmModal(false);
      setNotification({
        show: true,
        message: `Verification status updated to ${capitalize(normalized)}.`,
        variant: "success",
      });
      setTimeout(() => setNotification({ show: false }), 3000);
    } catch (err) {
      console.error("Error updating verification status:", err);
      // error logged to console and shown in UI
      setShowConfirmModal(false);
      setNotification({
        show: true,
        message: `Failed to update verification status: ${err?.message || err}`,
        variant: "danger",
      });
      setTimeout(() => setNotification({ show: false }), 4000);
    }
  };

  const capitalize = (str) =>
    str?.charAt(0).toUpperCase() + str?.slice(1).toLowerCase();

  return (
    <div className="p-4">
      <StickyHeader
        currentUser={currentUser}
        pageTitle="Handyman Verification"
      />
      
      {notification.show && (
        <div
          className={`alert alert-${notification.variant} text-center`}
          role="alert"
        >
          {notification.message}
        </div>
      )}

      {/* Confirmation modal for status change */}
      <Modal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Status Change</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingStatusChange.warning && (
            <div className="alert alert-warning">
              {pendingStatusChange.warning}
            </div>
          )}
          Are you sure you want to change the verification status to{" "}
          <b>{capitalize(pendingStatusChange.newStatus)}</b>?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirmStatusChange}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={confirmModal.show}
        title="Confirm Phone Status Change"
        message={`Are you sure you want to mark this number as ${
          confirmModal.newStatus ? "Verified" : "Not Verified"
        }?`}
        onHide={() =>
          setConfirmModal({ show: false, handymanId: null, newStatus: null })
        }
        onConfirm={handleConfirmPhoneStatus}
      />

      {/* STATUS Filter */}
      <div className="mb-3 d-flex align-items-center gap-2 mt-4">
        <span>Status:</span>
        <Form.Select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
          style={{ width: "200px" }}
        >
          {["All", "Pending", "Approved", "Declined", "Suspected"].map(
            (status) => (
              <option value={status.toLowerCase()} key={status}>
                {status}
              </option>
            )
          )}
        </Form.Select>

        {filterStatus !== "All" && (
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => setFilterStatus("All")}
          >
            <i className="bi bi-x"></i>
          </Button>
        )}
      </div>

      {/* SEARCH + ENTRIES + DATES */}
      <div className="d-flex justify-content-around align-items-center mb-3 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3 flex-grow-1">
          <InputGroup style={{ width: "30%" }}>
            <Form.Control
              placeholder="Search by handyman name, id"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setSearchTerm("")}
              >
                <i className="bi bi-x"></i>
              </Button>
            )}
          </InputGroup>

          <div className="d-flex align-items-center gap-1">
            <Form.Label className="mb-0">Show</Form.Label>
            <Form.Control
              type="number"
              min="1"
              max="100"
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ width: "80px" }}
            />
            <span className="ms-1">entries per page</span>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">From</span>
          <Form.Control
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setEndDate("");
              setCurrentPage(1);
            }}
            style={{ minWidth: "150px" }}
          />

          <span className="fw-semibold">to</span>
          <Form.Control
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{ minWidth: "150px" }}
            disabled={!startDate}
          />

          <Button
            variant="outline-secondary"
            onClick={() => setCurrentPage(1)}
            disabled={!startDate || !endDate}
          >
            Filter
          </Button>

          {(startDate || endDate) && (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              <i className="bi bi-x"></i>
            </Button>
          )}
        </div>

        <ExportReportButton
          data={filteredData}
          columns={[
            { header: "#", accessor: (_, idx) => idx + 1 },
            {
              header: "Name",
              accessor: (row) => `${row.firstName || ""} ${row.lastName || ""}`,
            },
            { header: "Phone", accessor: "phoneNumber" },
            {
              header: "Address",
              accessor: (row) =>
                `${row.houseNumber || ""}, ${row.street || ""}, ${
                  row.area || ""
                }, ${row.thana || ""}, ${row.district || ""}, ${
                  row.division || ""
                }, ${row.postcode || ""}`,
            },
            { header: "ID Card", accessor: "photoIdCard" },
            { header: "Certificates", accessor: "certificates" },
            {
              header: "Status",
              accessor: (row) =>
                capitalize(row.verificationStatus || "pending"),
            },
            {
              header: "Submission Date",
              accessor: (row) =>
                row.createdAt
                  ? new Date(row.createdAt).toLocaleDateString()
                  : "",
            },
          ]}
          fileName="Handyman_Verification_Report"
        />
      </div>

      {loading ? (
        <div className="text-center mt-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading Handyman Data...</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Handyman Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Identity Card</th>
              <th>Certificates</th>
              <th>Status</th>
              <th>Submission Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading || error ? (
              <tr>
                <td colSpan="8" className="text-center text-muted">
                  {loading && (
                    <div className="my-3">
                      <span className="fw-semibold">
                        Loading data from database...
                      </span>
                    </div>
                  )}
                  {error && !loading && (
                    <div
                      className="alert alert-danger text-center my-3"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}
                </td>
              </tr>
            ) : filteredData.length > 0 ? (
              currentData.map((item, index) => (
                <tr key={item.handymanId}>
                  <th>{startIndex + index + 1}</th>
                  <td>
                    {item.firstName} {item.lastName}
                  </td>
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle
                        variant={
                          item.isPhoneVerified ? "success" : "outline-secondary"
                        }
                        size="sm"
                      >
                        {item.isPhoneVerified ? "Verified" : "Not Verified"}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          className="text-success"
                          onClick={() =>
                            setConfirmModal({
                              show: true,
                              handymanId: item.handymanId,
                              newStatus: true,
                            })
                          }
                        >
                          Mark as Verified
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={() =>
                            setConfirmModal({
                              show: true,
                              handymanId: item.handymanId,
                              newStatus: false,
                            })
                          }
                        >
                          Mark as Not Verified
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                  <td>
                    {`${item.houseNumber}, ${item.street}, ${item.area}, ${item.thana}, ${item.district}, ${item.division}, ${item.postcode}`}
                  </td>
                  <td>
                    <div className="d-flex align-items-center">
                      <DocStatusText
                        status={item.idApprovedStatus || "pending"}
                      />
                      <Button
                        variant="link"
                        className="p-0 text-decoration-none"
                        onClick={() =>
                          handleOpenVerificationModal(item, "identity")
                        }
                        style={{
                          cursor: "pointer",
                          color:
                            statusStyles[item.idApprovedStatus || "pending"]
                              .color,
                          fontWeight: 600,
                          marginLeft: "0.5rem",
                        }}
                      >
                        {getShortFileName(item.photoIdCard)}
                      </Button>
                    </div>
                  </td>

                  <td>
                    <div className="d-flex align-items-center">
                      <DocStatusText
                        status={item.certificateApprovedStatus || "pending"}
                      />
                      <Button
                        variant="link"
                        className="p-0 text-decoration-none"
                        onClick={() =>
                          handleOpenVerificationModal(item, "certificates")
                        }
                        style={{
                          cursor: "pointer",
                          color:
                            statusStyles[
                              item.certificateApprovedStatus || "pending"
                            ].color,
                          fontWeight: 600,
                          marginLeft: "0.5rem",
                        }}
                      >
                        {item.certificates?.startsWith("http")
                          ? "View Certificate"
                          : item.certificates || "No Certificate"}
                      </Button>
                    </div>
                  </td>
                  {/* STATUS DROPDOWN */}
                  <td>
                    <Form.Select
                      size="sm"
                      value={item.verificationStatus || "pending"}
                      style={{
                        width: 120,
                        fontWeight: "bold",
                        color:
                          verificationStatusOptions.find(
                            (opt) =>
                              opt.value ===
                              (item.verificationStatus || "pending")
                          )?.color || "#212529",
                        background:
                          item.verificationStatus === "approved"
                            ? "#eafaf1"
                            : item.verificationStatus === "declined"
                            ? "#faeaea"
                            : "#fffbe8",
                        borderColor: "#d5d5d5",
                      }}
                      onChange={(e) =>
                        handleStatusDropdownChange(item, e.target.value)
                      }
                    >
                      {verificationStatusOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          style={{
                            color: option.color,
                          }}
                        >
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </td>
                  <td>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString()
                      : ""}
                  </td>
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-2"
                      onClick={() => handleViewDetails(item)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline-info"
                      size="sm"
                      onClick={() => handleOpenMessageModal(item)}
                    >
                      Message
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <PaginationControls
        totalItems={filteredData.length}
        entriesPerPage={entriesPerPage}
        setEntriesPerPage={setEntriesPerPage}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        startIndex={startIndex}
      />

      <Modal
        show={showMessageModal}
        onHide={() => setShowMessageModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Send Message</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Enter your message below:</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Type your message here..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={() => setShowMessageModal(false)}>
            Cancel
          </Button>
          <Button variant="info">Send</Button>
        </Modal.Footer>
      </Modal>

      {selectedUser && editedUser && (
        <Modal show={showModal} onHide={handleCloseModal} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editedUser.firstName} {editedUser.lastName}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {Object.entries(fieldSections).map(([sectionTitle, keys]) => {
                  if (sectionTitle === "Documents") {
                    return (
                      <div key={sectionTitle} className="mb-4">
                        <h6 className="border-bottom pb-1 mb-3">
                          {sectionTitle}
                        </h6>
                        <Row className="mb-3">
                          {keys.map((fieldKey, idx) => {
                            const val = editedUser[fieldKey];
                            return (
                              <Col key={fieldKey} md={6}>
                                <Form.Label className="fw-bold text-capitalize">
                                  {fieldKey.replace(/([A-Z])/g, " $1")}
                                </Form.Label>
                                {val && typeof val === "string" ? (
                                  val.startsWith("http") ? (
                                    <div className="d-flex flex-column gap-1 mb-2">
                                      <a
                                        href={val}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        View Document
                                      </a>
                                      {/* Show status badge */}
                                      {fieldKey === "photoIdCard" && (
                                        <>
                                          {editedUser.idApprovedStatus ===
                                            "approved" && (
                                            <Badge
                                              bg="success"
                                              className="ms-2"
                                            >
                                              ✓ Approved
                                            </Badge>
                                          )}
                                          {editedUser.idApprovedStatus ===
                                            "declined" && (
                                            <Badge bg="danger" className="ms-2">
                                              ✗ Declined
                                            </Badge>
                                          )}
                                          {(!editedUser.idApprovedStatus ||
                                            editedUser.idApprovedStatus ===
                                              "pending") && (
                                            <Badge
                                              bg="warning"
                                              text="dark"
                                              className="ms-2"
                                            >
                                              Pending
                                            </Badge>
                                          )}
                                        </>
                                      )}
                                      {fieldKey === "certificates" && (
                                        <>
                                          {editedUser.certificateApprovedStatus ===
                                            "approved" && (
                                            <Badge
                                              bg="success"
                                              className="ms-2"
                                            >
                                              ✓ Approved
                                            </Badge>
                                          )}
                                          {editedUser.certificateApprovedStatus ===
                                            "declined" && (
                                            <Badge bg="danger" className="ms-2">
                                              ✗ Declined
                                            </Badge>
                                          )}
                                          {(!editedUser.certificateApprovedStatus ||
                                            editedUser.certificateApprovedStatus ===
                                              "pending") && (
                                            <Badge
                                              bg="warning"
                                              text="dark"
                                              className="ms-2"
                                            >
                                              Pending
                                            </Badge>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-muted mb-2">
                                      Uploaded:{" "}
                                      <span className="fw-medium">{val}</span>
                                    </div>
                                  )
                                ) : (
                                  <div className="text-muted mb-2">
                                    No document uploaded
                                  </div>
                                )}

                                {isEditing && (
                                  <Form.Control
                                    type="file"
                                    size="sm"
                                    accept="image/*,.pdf"
                                    onChange={(e) => {
                                      if (e.target.files.length > 0) {
                                        handleFileUpload(
                                          fieldKey,
                                          e.target.files[0]
                                        );
                                      }
                                    }}
                                  />
                                )}
                              </Col>
                            );
                          })}
                        </Row>
                      </div>
                    );
                  }
                  // Default rendering for other sections
                  return (
                    <div key={sectionTitle} className="mb-4">
                      <h6 className="border-bottom pb-1 mb-3">
                        {sectionTitle}
                      </h6>
                      {keys.reduce((rows, key, index) => {
                        if (index % 2 === 0) {
                          const nextKey = keys[index + 1];
                          rows.push(
                            <Row className="mb-3" key={index}>
                              {[key, nextKey].map((fieldKey, colIdx) => {
                                if (!fieldKey || !(fieldKey in editedUser))
                                  return <Col key={colIdx} />;
                                const val = editedUser[fieldKey];
                                return (
                                  <Col key={colIdx} className="ms-3">
                                    <Form.Label className="fw-bold text-capitalize">
                                      {fieldKey.replace(/([A-Z])/g, " $1")}
                                    </Form.Label>
                                    {isEditing &&
                                    !["id", "createdAt", "approvedBy"].includes(
                                      fieldKey
                                    ) ? (
                                      <>
                                        <Form.Control
                                          size="sm"
                                          value={val || ""}
                                          onChange={(e) =>
                                            handleInputChange(
                                              fieldKey,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {formErrors[fieldKey] && (
                                          <div className="text-danger small mt-1">
                                            {formErrors[fieldKey]}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <Form.Control
                                        size="sm"
                                        plaintext
                                        readOnly
                                        defaultValue={val?.toString()}
                                      />
                                    )}
                                  </Col>
                                );
                              })}
                            </Row>
                          );
                        }
                        return rows;
                      }, [])}
                    </div>
                  );
                })}
              </div>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            {!isEditing ? (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <Button variant="success" onClick={handleUpdate}>
                Save Changes
              </Button>
            )}
            <Button variant="outline-secondary" onClick={handleCloseModal}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      <VerificationModal
        show={showVerificationModal}
        onHide={() => setShowVerificationModal(false)}
        title={
          verificationType === "identity" ? "Identity Card" : "Certificates"
        }
        documentType={verificationType}
        documentLinks={verificationLinks}
        comments={comments}
        setComments={setComments}
        isApproved={isApproved}
        setIsApproved={setIsApproved}
        onApprove={async () => {
          await handleDocumentApproval(
            selectedHandyman,
            verificationType,
            "approved"
          );
          setShowVerificationModal(false);
        }}
        onDecline={async () => {
          await handleDocumentApproval(
            selectedHandyman,
            verificationType,
            "declined"
          );
          setShowVerificationModal(false);
        }}
      />
    </div>
  );
}

export default HandymanVerification;
