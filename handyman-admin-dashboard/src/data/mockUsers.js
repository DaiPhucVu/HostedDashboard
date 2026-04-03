const mockUsers = [
  {
    id: "admin1",
    email: "admin@example.com",
    password: "admin123", // This is just mock! Do NOT store plain passwords in real apps
    status: "active",
    role: "admin",
    roles: ["manage_users", "view_reports", "verify_handymen", "reply_support"],
    firstName: "Admin",
    lastName: "User"
  },
  {
    id: "staff1",
    email: "staff@example.com",
    password: "staff123",
    status: "active",
    role: "staff",
    roles: ["verify_handymen", "reply_support"],
    firstName: "Staff",
    lastName: "Member"
  },
  {
    id: "master1",
    email: "master@example.com",
    password: "master123",
    status: "active",
    role: "master_admin",
    roles: ["manage_users", "edit_admins", "all_access"],
    firstName: "Master",
    lastName: "Admin"
  }
];

export default mockUsers;
