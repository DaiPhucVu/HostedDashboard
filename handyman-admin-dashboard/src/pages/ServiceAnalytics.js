import React, { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { database } from "../firebase";
import AnalyticsChart from "../components/AnalyticsChart";
import StickyHeader from "../components/StickyHeader";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/ServiceAnalytics.css";

const monthsOrder = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#4f46e5'];

const ServiceAnalytics = () => {
  const [chartData, setChartData] = useState([]);
  const [userStats, setUserStats] = useState({ handymen: 0, customers: 0 });
  const [jobStats, setJobStats] = useState({ completed: 0, inProgress: 0, cancelled: 0 });
  const [ratingDistribution, setRatingDistribution] = useState([]);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentUser"));
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch analytics data
      const analyticsSnapshot = await get(ref(database, "serviceAnalytics/2025"));
      // Fetch user data for pie chart
      const handymenSnapshot = await get(ref(database, "Handyman"));
      const customersSnapshot = await get(ref(database, "User"));
      // Fetch job data for status distribution
      const jobsSnapshot = await get(ref(database, "Job"));

      if (analyticsSnapshot.exists()) {
        const raw = analyticsSnapshot.val();
        const formatted = monthsOrder.map(month => {
          const entry = raw[month] || {};
          return {
            month,
            newHandymen: parseInt(entry.newHandymen) || 0,
            newCustomers: parseInt(entry.newCustomers) || 0,
            newUsers: parseInt(entry.newUsers) || 0,
            jobsCompleted: parseInt(entry.jobsCompleted) || 0,
            averageRating: parseFloat(entry.averageRating) || 0,
            totalLogins: parseInt(entry.totalLogins) || 0,
          };
        });
        setChartData(formatted);
      }

      // Calculate user statistics
      if (handymenSnapshot.exists() && customersSnapshot.exists()) {
        const handymenCount = Object.keys(handymenSnapshot.val()).length;
        const customersCount = Object.keys(customersSnapshot.val()).length;
        setUserStats({ handymen: handymenCount, customers: customersCount });
      }

      // Calculate job status distribution
      if (jobsSnapshot.exists()) {
        const jobs = jobsSnapshot.val();
        let completed = 0, inProgress = 0, cancelled = 0;
        
        Object.values(jobs).forEach(job => {
          if (job.jobStatus === "Done") completed++;
          else if (job.jobStatus === "In Progress") inProgress++;
          else if (job.jobStatus === "Cancelled") cancelled++;
        });
        
        setJobStats({ completed, inProgress, cancelled });
      }

      // Create rating distribution data (mock data since we don't have individual ratings yet)
      setRatingDistribution([
        { name: '5 Stars', value: 45 },
        { name: '4 Stars', value: 30 },
        { name: '3 Stars', value: 15 },
        { name: '2 Stars', value: 7 },
        { name: '1 Star', value: 3 }
      ]);
    };

    fetchData();
  }, []);

  // Data for pie chart
  const userRatioData = [
    { name: 'Handymen', value: userStats.handymen },
    { name: 'Customers', value: userStats.customers }
  ];

  // Data for job status bar chart
  const jobStatusData = [
    { name: 'Completed', value: jobStats.completed },
    { name: 'In Progress', value: jobStats.inProgress },
    { name: 'Cancelled', value: jobStats.cancelled }
  ];

  return (
    <>
      <StickyHeader currentUser={currentUser} className="mb-4" pageTitle="Service Analytics - 2025" />
      
      <div className="dashboard-container">
        <div className="main-content">
          {/* New Visualizations Section */}
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="chart-card">
                <h4 className="text-center mb-3">User Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userRatioData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {userRatioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="chart-card">
                <h4 className="text-center mb-3">Job Status Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={jobStatusData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#4f46e5" name="Jobs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="row mb-4">
            <div className="col-md-6">
              <div className="chart-card">
                <h4 className="text-center mb-3">Rating Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={ratingDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {ratingDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="chart-card">
                <h4 className="text-center mb-3">User Growth</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="newUsers" fill="#00C49F" name="New Users" />
                    <Bar dataKey="newHandymen" fill="#FFBB28" name="New Handymen" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Original Charts Grid */}
          <div className="charts-grid">
            <div className="chart-card">
              <AnalyticsChart
                data={chartData}
                dataKey="newHandymen"
                stroke="#00C49F"
                label="New Handymen"
              />
            </div>
            <div className="chart-card">
              <AnalyticsChart
                data={chartData}
                dataKey="newCustomers"
                stroke="#8884d8"
                label="New Customers"
              />
            </div>
            <div className="chart-card">
              <AnalyticsChart
                data={chartData}
                dataKey="newUsers"
                stroke="#4f46e5"
                label="Total New Users"
              />
            </div>
            <div className="chart-card">
              <AnalyticsChart
                data={chartData}
                dataKey="jobsCompleted"
                stroke="#FFBB28"
                label="Jobs Completed"
              />
            </div>
            <div className="chart-card">
              <AnalyticsChart
                data={chartData}
                dataKey="averageRating"
                stroke="#FF4444"
                label="Average Rating"
              />
            </div>
            <div className="chart-card">
              <AnalyticsChart
                data={chartData}
                dataKey="totalLogins"
                stroke="#17a2b8"
                label="Total Logins"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ServiceAnalytics;