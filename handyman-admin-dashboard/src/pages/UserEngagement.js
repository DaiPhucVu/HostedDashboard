import React, { useEffect, useState } from "react";
import { FaChartLine, FaUsers, FaUserPlus, FaHistory, FaClock, FaPercentage } from "react-icons/fa";
import { Tooltip } from "bootstrap";
import { getDatabase, ref, onValue } from "firebase/database";
import StickyHeader from "../components/StickyHeader";

const UserEngagement = () => {
  const [monthlyData, setMonthlyData] = useState({});
  const [currentMonth, setCurrentMonth] = useState("May"); // Default to current month

    const currentUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("currentUser"));
      } catch {
        return null;
      }
    })();

  useEffect(() => {
    const db = getDatabase();
    const refPath = ref(db, "userEngagement/2025");

    onValue(refPath, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const processed = {};
        Object.entries(data).forEach(([month, metrics]) => {
          const {
            DAU = 0,
            MAU = 0,
            newUsers = 0,
            totalSessionTime = 0,
            sessionCount = 1,
            bounceCount = 0
          } = metrics;

          processed[month] = {
            DAU,
            MAU,
            newUsers,
            returningUsers: MAU - newUsers,
            avgSessionTime: parseFloat(totalSessionTime / sessionCount).toFixed(2),
            bounceRate: parseFloat((bounceCount / sessionCount) * 100).toFixed(1),
          };
        });
        setMonthlyData(processed);
        
        // Set current month to the latest month with data
        const months = Object.keys(processed);
        if (months.length > 0) {
          const latestMonth = months.reduce((a, b) => 
            processed[a].DAU > processed[b].DAU ? a : b
          );
          setCurrentMonth(latestMonth);
        }
      }
    });
  }, []);

  // Tooltip activation
  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].forEach((el) => new Tooltip(el));
  }, [monthlyData]);

  const tooltips = {
    DAU: "Daily Active Users: Unique users active each day.",
    MAU: "Monthly Active Users: Unique users active this month.",
    New: "New Users: Users who registered this month.",
    Returning: "Returning Users: Previously registered users who returned.",
    "Session (min)": "Average session length in minutes.",
    "Bounce (%)": "Percentage of users who left quickly after viewing a single page."
  };

  const headers = [
    { label: "Month" },
    { label: "DAU", tooltip: tooltips.DAU },
    { label: "MAU", tooltip: tooltips.MAU },
    { label: "New", tooltip: tooltips.New },
    { label: "Returning", tooltip: tooltips.Returning },
    { label: "Session (min)", tooltip: tooltips["Session (min)"] },
    { label: "Bounce (%)", tooltip: tooltips["Bounce (%)"] }
  ];

  const current = monthlyData[currentMonth] || {
    DAU: 0,
    MAU: 0,
    newUsers: 0,
    returningUsers: 0,
    avgSessionTime: 0,
    bounceRate: 0
  };

  const stats = [
    { icon: <FaChartLine className="text-primary me-2" />, label: "DAU", value: current.DAU },
    { icon: <FaUsers className="text-info me-2" />, label: "MAU", value: current.MAU },
    { icon: <FaUserPlus className="text-success me-2" />, label: "New Users", value: current.newUsers },
    { icon: <FaHistory className="text-warning me-2" />, label: "Returning Users", value: current.returningUsers },
    { icon: <FaClock className="text-secondary me-2" />, label: "Avg. Session Time", value: `${current.avgSessionTime} mins` },
    { icon: <FaPercentage className="text-danger me-2" />, label: "Bounce Rate", value: `${current.bounceRate}%` }
  ];

  return (
    <div className="container mt-4" style={{ maxWidth: "1000px" }}>
      <StickyHeader currentUser={currentUser} className="mb-4" pageTitle="User Engagement - 2025" />
      
      {/* Metrics Cards */}
      <div className="row mb-4">
        {stats.map((stat, i) => (
          <div className="col-md-4 mb-3" key={i}>
            <div className="border rounded p-3 shadow-sm h-100 bg-white d-flex align-items-start">
              <div className="fs-4">{stat.icon}</div>
              <div>
                <div className="text-muted">{stat.label}</div>
                <div className="fw-semibold fs-5">{stat.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Table */}
      <div className="card shadow-sm mb-5">
        <div className="card-body">
          <h5 className="card-title mb-3">Monthly Engagement Overview</h5>
          <div className="table-responsive">
            <table className="table table-bordered table-hover text-center align-middle">
              <thead className="table-light">
                <tr>
                  {headers.map((header) => (
                    <th key={header.label} className="text-nowrap align-middle">
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        <span className="fw-semibold">{header.label}</span>
                        {header.tooltip && (
                          <span
                            className="text-primary"
                            data-bs-toggle="tooltip"
                            data-bs-placement="right"
                            title={header.tooltip}
                            style={{
                              cursor: "help",
                              fontSize: "0.85rem"
                            }}
                          >
                            ⓘ
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(monthlyData).map(([month, stats]) => (
                  <tr key={month} className={month === currentMonth ? "table-active" : ""}>
                    <td>{month}</td>
                    <td>{stats.DAU}</td>
                    <td>{stats.MAU}</td>
                    <td>{stats.newUsers}</td>
                    <td>{stats.returningUsers}</td>
                    <td>{stats.avgSessionTime}</td>
                    <td>{stats.bounceRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserEngagement;