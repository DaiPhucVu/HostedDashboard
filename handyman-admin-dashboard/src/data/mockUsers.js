const mockUsers = [
  {
    id: "admin1",
    email: "admin@example.com",
    password: "admin123", // This is just mock! Do NOT store plain passwords in real apps
    status: "active",
    role: "Admin",
    roles: ["manage_users", "view_reports", "verify_handymen", "reply_support"],
    firstName: "Admin",
    lastName: "User"
  },
  {
    id: "staff1",
    email: "staff@example.com",
    password: "staff123",
    status: "active",
    role: "Staff",
    roles: ["verify_handymen", "reply_support"],
    firstName: "Staff",
    lastName: "Member"
  }
];

export default mockUsers;
