import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import "../styles/DashboardContent.css";
import userData from "../data/userData";

import JobCategoryStats from "../components/JobCategoryStats"; 
import StickyHeader from "../components/StickyHeader";

import {
  ArrowUpRight, ArrowDownRight, Check, Square, Circle, Diamond
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const iconMap = {
  UserGroupIcon: Square,
  ChartBarIcon: ArrowUpRight,
  UserAddIcon: ArrowDownRight,
  BriefcaseIcon: Diamond,
  DocumentTextIcon: Circle,
  CheckCircleIcon: Check,
};

const currentUser = (() => {
  try {
    return JSON.parse(localStorage.getItem("currentUser"));
  } catch {
    return null;
  }
})();
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    const dashboardRef = ref(database, "dashboard_content");
    onValue(dashboardRef, (snapshot) => {
      if (snapshot.exists()) {
        setDashboardData(snapshot.val());
      }
    });
  }, []);

  if (!dashboardData) return <div>Loading dashboard...</div>;

  // Process data for display
  const { stats = [], job_per_month = [], user_trend = [] } = dashboardData;

  // Process and sort hot categories by count
  const hotCategories = [...(dashboardData.hot_categories || [])]
    .sort((a, b) => b.count - a.count)
    .map((category, index) => ({
      ...category,
      rank: index + 1
    }));

  // Process and sort top locations by count
  const topLocations = [...(dashboardData.top_locations || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6); // Limit to top 6 locations

  // Process and sort top performers by jobs completed
  const topPerformers = [...(dashboardData.top_performers || [])]
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 6); // Limit to top 6 performers

  // Process job overview data
  const jobOverview = [...(dashboardData.job_overview || [])]
    .sort((a, b) => b.active - a.active)
    .map((job, index) => ({
      ...job,
      rank: index + 1,
      trend: index < 3 ? 'up' : 'down' // Top 3 are trending up
    }));

  return (
    <>
      <StickyHeader currentUser={currentUser} className="mb-4" pageTitle="Dashboard Overview" />




      <div className="dashboard-container">




        {/* Stat Cards */}
        <div className="stats-grid">
          {stats.map(stat => {
            const Icon = iconMap[stat.icon] || Square;
            return (
              <div className="stat-card" key={stat.id}>
                <div className="stat-title">{stat.title}</div>
                <div className="stat-value">
                  {stat.value}
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="text-green-500" size={20} />
                  ) : stat.trend === 'down' ? (
                    <ArrowDownRight className="text-red-500" size={20} />
                  ) : (
                    <Icon className={stat.color} size={20} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="main-content">
          {/* LEFT SIDE */}
          <div className="left-column">
            <div className="charts-grid">
              {/* Job per Month */}
              <div className="chart-card">
                <h2 className="chart-title">Jobs Per Month</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={job_per_month}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="jobs" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* User Trend */}
              <div className="chart-card">
                <h2 className="chart-title">User Registrations</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={user_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="users" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>


            

            {/* Job Overview Section */}
            <div className="chart-card">
              <h2 className="chart-title">Job Postings Overview by Category</h2>

                
              {jobOverview.map((job, i) => (
                <div className="job-category-item" key={i}>
                  <div className="category-info">
                    <span
                      className={`text-${job.trend === 'up' ? 'green' : 'red'}-500`}
                      title={job.trend === 'up' ? "Trending Up" : "Trending Down"}
                    >
                      {job.trend === 'up' ? '↑' : '↓'}
                    </span>
                    <div className="category-name">
                      {job.name}
                      <span className="category-rank">#{job.rank}</span>
                    </div>
                  </div>
                  <div className="category-stats">
                    {job.active} Active, {job.quoted} Being Quoted
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="right-column">
            {/* Top Locations Pie */}
            <div className="chart-card">
              <h2 className="chart-title">Top Locations</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topLocations}
                    dataKey="count"
                    nameKey="name"
                    outerRadius={100}
                    fill="#8884d8"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {topLocations.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [
                    value, 
                    props.payload.name
                  ]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Performers */}
            <div className="chart-card">
              <h2 className="chart-title">Top Performers</h2>
              {topPerformers.map((perf, i) => (
                <div className="performer-item" key={i}>
                  <div className="performer-info">
                    <span className="performer-rank">#{perf.rank}</span>
                    <span>{perf.name}</span>
                  </div>
                  <div className="performer-rating">
                    <Check className="text-green-500" size={16} /> {perf.rating} ⭐
                    <span className="ml-2 text-sm text-gray-500">({perf.jobs} jobs)</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hot Categories */}
            <div className="chart-card">
              <h2 className="chart-title">Hot Categories</h2>
              {hotCategories.map((category, i) => (
                <div className="job-category-item" key={i}>
                  <div className="category-info">
                    <span className="category-rank">#{category.rank}</span>
                    <div className="category-name">
                      {category.name}
                    </div>
                  </div>
                  <div className="category-stats">
                    <span className="category-count">{category.count}</span> jobs
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;