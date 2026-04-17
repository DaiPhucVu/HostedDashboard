// TOFIX: Modal Chanes, And send a modal  notification
import React, { useState, useEffect } from "react";
import {
  Table,
  Form,
  Button,
  Badge,
  Modal,
  Alert,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import emailjs from "@emailjs/browser";
import PaginationControls from "../components/PaginationControls";
import StickyHeader from "../components/StickyHeader";
import { ref, onValue, get, set } from "firebase/database";
import { database as db } from "../firebase";
import ExportReportButton from "../components/ExportReportButton";

function SupportFeedback() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [modalNotification, setModalNotification] = useState({
    show: false,
    message: "",
    variant: "",
  });
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    variant: "",
  });
  const [isSending, setIsSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [newTicketData, setNewTicketData] = useState({
    user: "",
    email: "",
    subject: "",
    message: "",
    category: "",
  });

  const entriesPerPage = 10;
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser"));
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const ticketsRef = ref(db, "support_requests");
    onValue(ticketsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ticketArray = Object.entries(data).map(([id, ticket]) => ({
          id,
          ...ticket,
          status: ticket.status || "Open",
          createdAt: ticket.createdAt || "N/A",
          lastUpdatedAt: ticket.lastUpdatedAt || "N/A",
          replies: ticket.replies || [],
        }));
        setTickets(ticketArray);
      }
    });
  }, []);

  const filteredAllTickets = tickets.filter((ticket) => {
    const lowerSearch = searchTerm.toLowerCase();
    const userName = (ticket.user || "").toLowerCase();
    const ticketId = (ticket.id || "").toLowerCase();

    return (
      (ticketId.includes(lowerSearch) || userName.includes(lowerSearch)) &&
      (filterStatus === "" || ticket.status === filterStatus) &&
      (filterCategory === "" || ticket.category === filterCategory)
    );
  });

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentTickets = filteredAllTickets.slice(
    indexOfFirstEntry,
    indexOfLastEntry
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case "Open":
        return <Badge bg="primary">Open</Badge>;
      case "In Progress":
        return (
          <Badge bg="warning" text="dark">
            In Progress
          </Badge>
        );
      case "Resolved":
        return <Badge bg="success">Resolved</Badge>;
      case "Closed":
        return <Badge bg="secondary">Closed</Badge>;
      default:
        return <Badge bg="light">Unknown</Badge>;
    }
  };

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage("");
    setModalNotification({ show: false, message: "", variant: "" });
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedTicket(null);
    setReplyMessage("");
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (selectedTicket && replyMessage.trim() !== "" && !isSending) {
      setIsSending(true);
      const timestamp = new Date().toISOString();
      const responseEntry = {
        message: replyMessage,
        time: timestamp,
        repliedBy: currentUser?.firstName || "Admin",
      };

      const templateParams = {
        user: selectedTicket.user,
        user_email: selectedTicket.email,
        subject: selectedTicket.subject,
        message: selectedTicket.message,
        category: selectedTicket.category,
        date: selectedTicket.createdAt,
        response: replyMessage,
        time: new Date().toLocaleString(),
      };

      emailjs
        .send(
          "service_atdlzb4",
          "template_p9jpaw9",
          templateParams,
          "I6CD2UFXfVfbcm238"
        )
        .then(async () => {
          const ticketRef = ref(db, `support_requests/${selectedTicket.id}`);
          const snapshot = await get(ticketRef);
          const currentData = snapshot.val() || {};
          const updatedReplies = [
            ...(currentData.replies || []),
            responseEntry,
          ];

          const updatedTicket = {
            ...currentData,
            status: "In Progress",
            lastUpdatedAt: timestamp,
            replies: updatedReplies,
          };

          await set(ticketRef, updatedTicket);
          setSelectedTicket({ id: selectedTicket.id, ...updatedTicket });

          setModalNotification({
            show: true,
            message: `✅ Reply to #${selectedTicket.id} successfully sent!`,
            variant: "success",
          });
          setReplyMessage("");
        })
        .catch((error) => {
          console.error("❗ Failed to send email:", error);
          setModalNotification({
            show: true,
            message: `❗ Failed to send reply.`,
            variant: "danger",
          });
        })
        .finally(() => {
          setIsSending(false);
          setTimeout(() => {
            setModalNotification({ show: false, message: "", variant: "" });
          }, 8000);
        });
    }
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (selectedTicket) {
      const updatedTicket = {
        ...selectedTicket,
        status: newStatus,
        lastUpdatedAt: new Date().toISOString(),
      };
      const ticketRef = ref(db, `support_requests/${selectedTicket.id}`);
      set(ticketRef, updatedTicket);
    }
  };

  const handleNewTicketChange = (e) => {
    const { name, value } = e.target;
    setNewTicketData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateTicket = (e) => {
    e.preventDefault();
    const { user, email, subject, message, category } = newTicketData;
    if (user && email && subject && message && category) {
      const id = `T${Date.now()}`;
      const ticket = {
        ...newTicketData,
        status: "Open",
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        replies: [],
      };
      const ticketRef = ref(db, `support_requests/${id}`);
      set(ticketRef, ticket).then(() => {
        setNotification({
          show: true,
          message: "✅ New ticket successfully created.",
          variant: "success",
        });
        setNewTicketData({
          user: "",
          email: "",
          subject: "",
          message: "",
          category: "",
        });
      });
    }
  };

  return (
    <div className="p-4">
      <StickyHeader
        currentUser={currentUser}
        pageTitle="Support Feedback"
        className="mb-4"
      />

      {notification.show && (
        <Alert
          variant={notification.variant}
          onClose={() =>
            setNotification({ show: false, message: "", variant: "" })
          }
          dismissible
        >
          {notification.message}
        </Alert>
      )}

      {/* Search ,Filters, Export Report Button */}
      <Form className="d-flex align-items-center flex-wrap mb-4 gap-3 mt-4">
        <div className="d-flex flex-wrap align-items-center gap-3 mb-4 w-100">
          {/* Search Field */}
          <Form.Group className="flex-grow-1 me-3">
            <Form.Label>
              <strong>Search:</strong>
            </Form.Label>
            <div className="d-flex gap-1">
              <Form.Control
                type="text"
                placeholder="Search by ID or User..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
            </div>
          </Form.Group>

          {/* Status Filter */}
          <Form.Group className="flex-grow-1 me-3">
            <Form.Label>
              <strong>Status:</strong>
            </Form.Label>
            <div className="d-flex gap-1">
              <Form.Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </Form.Select>
              {filterStatus && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setFilterStatus("")}
                >
                  <i className="bi bi-x"></i>
                </Button>
              )}
            </div>
          </Form.Group>

          {/* Category Filter */}
          <Form.Group className="flex-grow-1 me-3">
            <Form.Label>
              <strong>Category:</strong>
            </Form.Label>
            <div className="d-flex gap-1">
              <Form.Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All</option>
                <option value="Technical Issue">Technical Issue</option>
                <option value="Billing & Payments">Billing & Payments</option>
                <option value="Account Management">Account Management</option>
                <option value="Feature Request">Feature Request</option>
                <option value="General Inquiry">General Inquiry</option>
              </Form.Select>
              {filterCategory && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setFilterCategory("")}
                >
                  <i className="bi bi-x"></i>
                </Button>
              )}
            </div>
          </Form.Group>

          {/* Export Report Button */}
          <div >
              <ExportReportButton
                data={filteredAllTickets}
                columns={[
                  { header: "ID", accessor: "id" },
                  { header: "User", accessor: "user" },
                  { header: "Email", accessor: "email" },
                  { header: "Subject", accessor: "subject" },
                  { header: "Category", accessor: "category" },
                  { header: "Status", accessor: (row) => row.status },
                  { header: "Created Date", accessor: (row) => row.createdAt },
                ]}
                fileName="SupportFeedbackReport"
              />
          </div>
        </div>
      </Form>

      {/* Table */}
      <Table hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Subject</th>
            <th>Category</th>
            <th>Status</th>
            <th>Created Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {currentTickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.id}</td>
              <td>{ticket.user}</td>
              <td>{ticket.subject}</td>
              <td>{ticket.category}</td>
              <td>{getStatusBadge(ticket.status)}</td>
              <td>{ticket.createdAt}</td>
              <td>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleView(ticket)}
                >
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <PaginationControls
        totalItems={filteredAllTickets.length}
        entriesPerPage={entriesPerPage}
        setEntriesPerPage={null}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        startIndex={indexOfFirstEntry}
      />

      {/* Modal */}
      <Modal show={showModal} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>View #{selectedTicket?.id} Enquiry Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTicket && (
            <>
              <p>
                <strong>User:</strong> {selectedTicket.user}
              </p>
              <p>
                <strong>Email:</strong> {selectedTicket.email}
              </p>
              <p>
                <strong>Subject:</strong> {selectedTicket.subject}
              </p>
              <p>
                <strong>Category:</strong> {selectedTicket.category}
              </p>
              <p>
                <strong>Status:</strong> {getStatusBadge(selectedTicket.status)}
              </p>
              <p>
                <strong>Message:</strong>
              </p>
              <div className="mb-3 p-2 bg-light border rounded">
                {selectedTicket.message}
              </div>
              <p>
                <strong>Date Created:</strong> {selectedTicket.createdAt}
              </p>
              <p>
                <strong>Last Updated:</strong> {selectedTicket.lastUpdatedAt}
              </p>
              {selectedTicket?.replies?.length > 0 && (
                <div className="mt-4">
                  <h5>Reply History</h5>
                  <Row xs={1} className="g-2">
                    {selectedTicket.replies.map((reply, idx) => (
                      <Col key={idx}>
                        <Card className="p-2 ms-2">
                          <Card.Body className="p-2">
                            <Card.Text>
                              <strong>{reply.repliedBy}</strong> at{" "}
                              <span className="text-muted">
                                {new Date(reply.time).toLocaleString()}
                              </span>
                            </Card.Text>
                            <div className="border-start ps-3 fst-italic">
                              {reply.message}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              <hr />

              <Form onSubmit={handleReply}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>Change Status:</strong>
                  </Form.Label>
                  <Form.Select
                    value={selectedTicket.status}
                    onChange={handleStatusChange}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>Write a Reply:</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    required
                  />
                </Form.Group>
                {modalNotification.show && (
                  <Alert
                    variant={modalNotification.variant}
                    onClose={() =>
                      setModalNotification({
                        show: false,
                        message: "",
                        variant: "",
                      })
                    }
                    dismissible
                    className="mt-3"
                  >
                    {modalNotification.message}
                  </Alert>
                )}

                <Button
                  variant="primary"
                  type="submit"
                  className="w-100"
                  disabled={isSending}
                >
                  {isSending ? "Sending..." : "Send Reply"}
                </Button>
              </Form>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default SupportFeedback;
