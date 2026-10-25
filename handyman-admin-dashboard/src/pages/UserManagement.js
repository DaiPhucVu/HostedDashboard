import React, { useEffect, useState } from "react";
import {
  Button,
  Form,
  Modal,
  Table,
  Badge,
  Alert,
  Row,
  Col,
  InputGroup,
} from "react-bootstrap";

import StickyHeader from "../components/StickyHeader";
import ConfirmModal from "../components/ConfirmModal";
import { getDatabase, ref, onValue, update, remove } from "firebase/database";
import ExportReportButton from "../components/ExportReportButton";

function UserManagement() {
  const [userType, setUserType] = useState("User");
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    variant: "success",
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(() => {});
  const [isProcessing, setIsProcessing] = useState(false);
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser"));
    } catch {
      return null;
    }
  })();

  const fieldSections = {
    "Personal Info": ["firstName", "lastName", "gender", "birthdate"],
    "Contact Info": [
      "phoneNumber",
      "email",
      "houseNumber",
      "street",
      "city",
      "postcode",
    ],
    Verification: ["verified", "isPhoneVerified", "approvedBy"],
    Metadata: ["createdAt", "id"],
  };

  useEffect(() => {
    const db = getDatabase();
    const dataRef = ref(db, userType);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const dbData = snapshot.val();
      if (dbData) {
        const list = Object.keys(dbData).map((key) => ({
          id: key,
          ...dbData[key],
        }));
        setData(list);
      } else {
        setData([]);
      }
    });
    return () => unsubscribe();
  }, [userType]);

  const showAlert = (message, variant = "success") => {
    setNotification({ show: true, message, variant });
    setTimeout(
      () => setNotification({ show: false, message: "", variant: "success" }),
      3000
    );
  };

  const handleShowModal = (user) => {
    setSelectedUser(user);
    setEditedUser({ ...user });
    setFormErrors({});
    setIsEditing(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setEditedUser(null);
    setFormErrors({});
    setIsEditing(false);
  };

  const handleInputChange = (field, value) => {
    setEditedUser((prev) => ({ ...prev, [field]: value }));
  };

  const validateInput = () => {
    const errors = {};
    if (!editedUser.firstName) errors.firstName = "First name is required.";
    if (!editedUser.lastName) errors.lastName = "Last name is required.";
    if (
      editedUser.phoneNumber &&
      !/^(\+8801|01)[0-9]{9}$/.test(editedUser.phoneNumber)
    ) {
      errors.phoneNumber = "Invalid Bangladeshi phone number format.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveConfirm = () => {
    setIsProcessing(true);
    const db = getDatabase();
    const path = `${userType}/${editedUser.id}`;
    update(ref(db, path), editedUser)
      .then(() => {
        showAlert("✅ Changes saved successfully!");
        setShowModal(false);
        setShowConfirmModal(false);
      })
      .catch(() => showAlert("❌ Failed to save changes", "danger"))
      .finally(() => setIsProcessing(false));
  };

  const handleUpdate = () => {
    if (!validateInput()) return;
    setConfirmMessage("Are you sure you want to save these changes?");
    setConfirmAction(() => handleSaveConfirm);
    setShowConfirmModal(true);
  };

  const handleDelete = (user) => {
    setConfirmMessage(
      `Are you sure you want to delete ${user.firstName} ${user.lastName}?`
    );
    setConfirmAction(() => () => {
      setIsProcessing(true);
      const db = getDatabase();
      const path = `${userType}/${user.id}`;
      remove(ref(db, path))
        .then(() => showAlert("🗑️ User deleted."))
        .catch(() => showAlert("❌ Failed to delete user", "danger"))
        .finally(() => {
          setIsProcessing(false);
          setShowConfirmModal(false);
        });
    });
    setShowConfirmModal(true);
  };

  const filteredUsers = data.filter((user) => {
    const matchesStatus =
      filterStatus === "All" || user.verified === (filterStatus === "Verified");
    const matchesSearch =
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-4">
      <StickyHeader
        currentUser={currentUser}
        pageTitle="User Management"
        className="mb-4"
      />

      {notification.show && (
        <Alert variant={notification.variant} className="mb-3">
          {notification.message}
        </Alert>
      )}

      <div className="mb-3 d-flex align-items-center gap-3 mt-4">
        <strong>Select View:</strong>
        <Form.Select
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          style={{ width: "200px" }}
        >
          <option value="User">User</option>
          <option value="Handyman">Handyman</option>
        </Form.Select>
      </div>

      {/* Filter, Search, Export */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3 mt-4">
        <div className="d-flex align-items-center gap-4 flex-grow-1">
          {/* 🔍 Search Bar + Reset */}
          <InputGroup style={{ width: "50%" }}>
            <Form.Control
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm !== "" && (
              <Button
                variant="outline-danger"
                onClick={() => setSearchTerm("")}
              >
                <i className="bi bi-x" style={{ fontSize: "18px" }}></i>
              </Button>
            )}
          </InputGroup>

          {/* ✅ Status Filter + Reset */}
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0">Status:</Form.Label>
            <Form.Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "150px" }}
            >
              <option value="All">All</option>
              <option value="Verified">Verified</option>
              <option value="Unverified">Unverified</option>
            </Form.Select>
            {filterStatus !== "All" && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setFilterStatus("All")}
              >
                <i className="bi bi-x" style={{ fontSize: "18px" }}></i>
              </Button>
            )}
          </div>
        </div>

        {/*  Export Report button */}
        <ExportReportButton
          data={filteredUsers}
          columns={[
            { header: "ID", accessor: "id" },
            {
              header: "Name",
              accessor: (row) => `${row.firstName || ""} ${row.lastName || ""}`,
            },
            { header: "Gender", accessor: "gender" },
            { header: "Phone", accessor: "phoneNumber" },
            { header: "Email", accessor: "email" },
            {
              header: "Status",
              accessor: (row) => (row.verified ? "Verified" : "Unverified"),
            },
            {
              header: "Created",
              accessor: (row) =>
                row.createdAt
                  ? new Date(row.createdAt).toLocaleString().replace(",", "") ||
                    row.createdAt
                  : "",
            },
          ]}
          fileName="User_Management_Summary_Report"
        />
      </div>

      <Table hover>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map((user, index) => (
            <tr key={index}>
              <td>{user.id}</td>
              <td>
                {user.firstName} {user.lastName}
              </td>
              <td>{user.phoneNumber}</td>
              <td>
                <Badge bg={user.verified ? "success" : "warning"}>
                  {user.verified ? "Verified" : "Unverified"}
                </Badge>
              </td>
              <td>{user.createdAt}</td>
              <td>
                <Button
                  size="sm"
                  variant="info"
                  className="me-1"
                  onClick={() => handleShowModal(user)}
                >
                  View
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(user)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Edit Modal */}
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
                {Object.entries(fieldSections).map(([sectionTitle, keys]) => (
                  <div key={sectionTitle} className="mb-4">
                    <h6 className="border-bottom pb-1 mb-3">{sectionTitle}</h6>
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
                                  !["id", "createdAt", "ApprovedBy"].includes(
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
                ))}
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

      <ConfirmModal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        onConfirm={confirmAction}
        body={confirmMessage}
        loading={isProcessing}
      />
    </div>
  );
}

export default UserManagement;
