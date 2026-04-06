// Add Close button for all filter and search bar

import React, { useState, useEffect } from "react";
import { Button, Form, Badge, InputGroup, Dropdown, Modal } from "react-bootstrap";
import { database } from "../firebase";
import { ref, onValue, update } from "firebase/database";

import PaginationControls from "../components/PaginationControls";
import StickyHeader from "../components/StickyHeader";
import ConfirmModal from "../components/ConfirmModal";
import ExportReportButton from "../components/ExportReportButton";

function UserVerification() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(15);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  const [showIdModal, setShowIdModal] = useState(false);
  const [idImageUrl, setIdImageUrl] = useState("");
  const [modalUser, setModalUser] = useState(null);

  
  const handleViewIdCard = (user) => {
    setIdImageUrl(user.photoIdCard);
    setModalUser(user);
    setShowIdModal(true);
  };

  useEffect(() => {
    const usersRef = ref(database, "User");

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const value = snapshot.val();
        if (value) {
          const parsed = Object.entries(value).map(([id, val]) => ({
            userId: id,
            ...val,
          }));
          setData(parsed);
          setError(""); // clear error if previously set
        } else {
          setData([]);
          setError("No user data found.");
        }
        setLoading(false);
      },
      (err) => {
        setError("Cannot retrieve data from database.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const openConfirm = (title, message, onConfirm) => {
    setConfirmConfig({ title, message, onConfirm });
    setShowConfirm(true);
  };

  const handleSetStatus = (userId, newStatus, userName) => {
    openConfirm(
      newStatus === "Suspected"
        ? "Confirm Suspect Action"
        : "Unmark as Suspected",
      newStatus === "Suspected"
        ? `Are you sure you want to mark ${userName}'s account as suspected?`
        : `Are you sure you want to remove suspicion from ${userName}'s account?`,
      () => {
        const userRef = ref(database, `User/${userId}`);
        update(userRef, {
          status: newStatus,
          lastUpdatedBy: {
            adminEmail: currentUser.email,
            updatedAt: new Date().toISOString(),
            changeType: "status",
          },
        });
        setShowConfirm(false);
      }
    );
  };

  const handlePhoneVerificationUpdate = (user) => {
    const currentStatus = user.isPhoneVerified;

    if (currentStatus === true) {
      openConfirm("Already Verified", "This phone is already verified.", () =>
        setShowConfirm(false)
      );
      return;
    }

    openConfirm(
      "Confirm Phone Verification",
      `Are you sure you want to mark phone of ${user.firstName} as verified?`,
      () => {
        update(ref(database, `User/${user.userId}`), {
          isPhoneVerified: true,
          lastUpdatedBy: {
            adminEmail: currentUser.email,
            updatedAt: new Date().toISOString(),
            changeType: "phoneVerification",
          },
        });

        setShowConfirm(false);
      }
    );
  };

  const handlePhoneFail = (user) => {
    openConfirm(
      "Mark as Failed",
      `Mark ${user.firstName}'s phone verification as failed?`,
      () => {
        update(ref(database, `User/${user.userId}`), {
          isPhoneVerified: "fail",
        });
        setShowConfirm(false);
      }
    );
  };

  const getDerivedStatus = (item) => {
    if (item.status === "Suspected") return "Suspected";
    if (item.isPhoneVerified === "fail") return "Failed";
    if (item.isPhoneVerified === true) return "Verified";
    return "Pending";
  };

  const filteredData = data.filter((item) => {
    const matchSearch =
      (item.firstName &&
        item.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.lastName &&
        item.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.email &&
        item.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const itemDate = new Date(item.createdAt);
    const inDateRange =
      (!startDate || new Date(startDate) <= itemDate) &&
      (!endDate || itemDate <= new Date(endDate));

    const derivedStatus = getDerivedStatus(item);
    const matchStatus =
      statusFilter === "All" || derivedStatus === statusFilter;

    return matchSearch && inDateRange && matchStatus;
  });

  // --- NEW: Handler for changing status via dropdown ---
  const handleStatusDropdownChange = (user, newStatus) => {
    if (getDerivedStatus(user) === newStatus) return; // do nothing if already this status

    openConfirm(
      "Change User Status",
      `Are you sure you want to change ${user.firstName}'s status to "${newStatus}"?`,
      () => {
        const userRef = ref(database, `User/${user.userId}`);
        update(userRef, {
          status: newStatus,
          lastUpdatedBy: {
            adminEmail: currentUser.email,
            updatedAt: new Date().toISOString(),
            changeType: "status",
          },
        });
        setShowConfirm(false);
      }
    );
  };

  const startIndex = (currentPage - 1) * entriesPerPage;
  const currentData = filteredData.slice(
    startIndex,
    startIndex + entriesPerPage
  );

  return (
    <div className="p-4">
      <StickyHeader
        currentUser={currentUser}
        pageTitle="User Verification"
        className="mb-4"
      />

      {/* --- Filter UI --- */}
      <div className="d-flex align-items-center gap-2 mb-3 mt-4">
        <span className="fw-semibold">Status:</span>
        <Form.Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          style={{ width: "200px" }}
        >
          <option value="All">All Status</option>
          <option value="Verified">Verified</option>
          <option value="Pending">Pending</option>
          <option value="Suspected">Suspected</option>
        </Form.Select>
      </div>

      <div className="d-flex justify-content-around align-items-center mb-3 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-4 flex-grow-1">
          <InputGroup style={{ width: "40%" }}>
            <Form.Control
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
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
        </div>

        <div className="d-flex align-items-center">
          <ExportReportButton
            data={filteredData}
            columns={[
              { header: "#", accessor: (_, idx) => idx + 1 },
              {
                header: "Name",
                accessor: (row) =>
                  `${row.firstName || ""} ${row.lastName || ""}`,
              },
              { header: "Email", accessor: "email" },
              { header: "Phone", accessor: "phoneNumber" },
              {
                header: "Phone Verified",
                accessor: (row) =>
                  row.isPhoneVerified === true
                    ? "Verified"
                    : row.isPhoneVerified === "fail"
                    ? "Failed"
                    : "Not Verified",
              },
              { header: "ID Card", accessor: "photoIdCard" },
              {
                header: "Address",
                accessor: (row) =>
                  `${row.houseNumber || ""} ${row.street || ""}, ${
                    row.area || ""
                  }, ${row.thana || ""}, ${row.district || ""}, ${
                    row.division || ""
                  }, ${row.postcode || ""}, ${row.country || ""}`,
              },
              { header: "Notes", accessor: "notes" },
              {
                header: "Status",
                accessor: (row) => {
                  if (row.status === "Suspected") return "Suspected";
                  if (row.isPhoneVerified === "fail") return "Failed";
                  if (row.isPhoneVerified === true) return "Verified";
                  return "Pending";
                },
              },
              { header: "Created At", accessor: "createdAt" },
            ].map((col, idx) => ({
              ...col,
              accessor:
                col.accessor instanceof Function
                  ? (row, rowIdx) => col.accessor(row, rowIdx)
                  : col.accessor,
            }))}
            fileName="User_Verification_Report"
          />
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Phone Verified</th>
            <th>ID Card</th>
            <th>Address</th>
            <th>Notes</th>
            <th>Status</th>
            <th>Created At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.length > 0 ? (
            currentData.map((item, index) => {
              const derivedStatus = getDerivedStatus(item);

              return (
                <tr key={index}>
                  {/* index */}
                  <th>{startIndex + index + 1}</th>
                  {/* Name */}
                  <td>
                    {item.firstName} {item.lastName}
                  </td>
                  {/* Email */}
                  <td>{item.email}</td>
                  {/* Phone Number */}
                  <td>{item.phoneNumber}</td>
                  {/* Phone Verified */}
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle
                        variant={
                          item.isPhoneVerified === true
                            ? "success"
                            : "outline-secondary"
                        }
                        size="sm"
                      >
                        {item.isPhoneVerified === true
                          ? "Verified"
                          : "Not Verified"}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          className="text-success"
                          onClick={() => handlePhoneVerificationUpdate(item)}
                        >
                          Mark as Verified
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={() => handlePhoneFail(item)}
                        >
                          Mark as Not Verified
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                  {/* ID card */}
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleViewIdCard(item)}
                      disabled={!item.photoIdCard}
                    >
                      View ID
                    </Button>
                  </td>

                  {/* Address */}
                  <td>
                    {item.houseNumber} {item.street}, {item.area}, {item.thana},{" "}
                    {item.district}, {item.division}, {item.postcode},{" "}
                    {item.country}
                  </td>
                  {/* Notes */}
                  <td>{item.notes || "—"}</td>
                  {/* Status */}
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle
                        variant={
                          derivedStatus === "Verified"
                            ? "success"
                            : derivedStatus === "Pending"
                            ? "warning"
                            : derivedStatus === "Suspected"
                            ? "danger"
                            : derivedStatus === "Failed"
                            ? "secondary"
                            : "outline-secondary"
                        }
                        size="sm"
                      >
                        {derivedStatus}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {["Verified", "Pending", "Suspected", "Failed"].map(
                          (statusOption) => {
                            if (statusOption === derivedStatus) return null;
                            // Set color for each option
                            let textColorClass = "";
                            if (statusOption === "Verified")
                              textColorClass = "text-success";
                            if (statusOption === "Pending")
                              textColorClass = "text-warning";
                            if (statusOption === "Suspected")
                              textColorClass = "text-danger";
                            if (statusOption === "Failed")
                              textColorClass = "text-secondary";
                            return (
                              <Dropdown.Item
                                key={statusOption}
                                className={textColorClass}
                                onClick={() =>
                                  handleStatusDropdownChange(item, statusOption)
                                }
                              >
                                {statusOption}
                              </Dropdown.Item>
                            );
                          }
                        )}
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                  <td>{item.createdAt}</td>
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle variant="outline-secondary" size="sm">
                        •••
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item
                          className="text-danger"
                          onClick={() =>
                            handleSetStatus(
                              item.userId,
                              "Suspected",
                              item.firstName
                            )
                          }
                        >
                          Mark as Suspected
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() =>
                            handleSetStatus(item.userId, null, item.firstName)
                          }
                        >
                          Unmark Suspected
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                </tr>
              );
            })
          ) : (
            // {/* UI for loading and error states */}

            <tr>
              <td colSpan="11" className="text-center text-muted">
                {loading && (
                  <div className="text-center my-3">
                    <span className=" fw-semibold">
                      Loading data from database...
                    </span>
                  </div>
                )}

                {error && !loading && (
                  <div className="alert alert-danger text-center" role="alert">
                    {error}
                  </div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <PaginationControls
        totalItems={filteredData.length}
        entriesPerPage={entriesPerPage}
        setEntriesPerPage={setEntriesPerPage}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        startIndex={startIndex}
      />

      <ConfirmModal
        show={showConfirm}
        onHide={() => setShowConfirm(false)}
        title={confirmConfig.title}
        onConfirm={confirmConfig.onConfirm}
      >
        <p>{confirmConfig.message}</p>
      </ConfirmModal>

      {/* ID modal */}
      <Modal
        show={showIdModal}
        onHide={() => setShowIdModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {modalUser
              ? `ID Card for ${modalUser.firstName} ${modalUser.lastName || ""}`
              : "ID Card"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {idImageUrl ? (
            <img
              src={idImageUrl}
              alt="User ID Card"
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                borderRadius: "8px",
              }}
            />
          ) : (
            <div className="text-muted">No ID Card Uploaded</div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default UserVerification;
