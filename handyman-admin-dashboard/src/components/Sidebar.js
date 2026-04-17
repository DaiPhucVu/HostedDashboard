import React from "react";
import { NavLink } from "react-router-dom";
import HandymanLogo from "../assets/handyman_fakeLogo.png";
import {
  FaHome,
  FaUserCheck,
  FaUsers,
  FaToolbox,
  FaChartBar,
  FaCogs,
  FaQuestionCircle,
} from "react-icons/fa";
import "../styles/Sidebar.css";
import AdminProfileHeader from "../components/AdminProfileHeader";
//import state management
import { useUser } from "../context/UserContext"; // Assuming you have a UserContext to manage user state

const Sidebar = () => {
  const { currentUser, logout } = useUser();
  // Check if the user is logged in
  if (!currentUser) {
    return null; // or redirect to login page
  }
  // Check if the user is an admin
  return (
    <div className="sidebar bg-white p-3 vh-100 shadow-sm">
      <div className="text-center mb-4">
        <img src={HandymanLogo} alt="Handyman Logo" width="100" />
      </div>

      <nav className="nav flex-column">
        <NavLink to="/dashboard" className="nav-link">
          <FaHome className="me-2" /> Home
        </NavLink>
        <NavLink to="/handyman-verification" className="nav-link">
          <FaUserCheck className="me-2" /> Handyman Verification
        </NavLink>
        <NavLink to="/user-verification" className="nav-link">
          <FaUsers className="me-2" /> Users Verification
        </NavLink>
        <NavLink to="/user-management" className="nav-link">
          <FaUsers className="me-2" /> User Management
        </NavLink>
        <NavLink to="/job-management" className="nav-link">
          <FaToolbox className="me-2" /> Job Management
        </NavLink>

        <hr />

        <NavLink to="/service-analytics" className="nav-link">
          <FaChartBar className="me-2" /> Service Analytics
        </NavLink>
        <NavLink to="/user-engagement" className="nav-link">
          <FaChartBar className="me-2" /> User Engagement
        </NavLink>

        <hr />

        <NavLink to="/admin-settings" className="nav-link">
          <FaCogs className="me-2" /> Admin Settings
        </NavLink>
        <NavLink to="/support-feedback" className="nav-link">
          <FaQuestionCircle className="me-2" /> Support & Feedback
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <AdminProfileHeader user={currentUser} />
        <button
          className="btn btn-outline-danger btn-sm w-100 mt-2"
          onClick={logout}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
