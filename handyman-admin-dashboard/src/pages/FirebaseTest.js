import React, { useState, useEffect } from "react";
import { ref, set, push, onValue, get, update, remove } from "firebase/database";
import { database } from "../firebase";
import mockAdmins from "../data/mockUsers"; // Ensure this file contains only admin users

function FirebaseTest() {
  const [testData, setTestData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);

  // 🔹 Write dummy test data under /admin/test
  const handleWriteTestData = () => {
    set(ref(database, "admin/test"), {
      name: "Handyman Admin",
      timestamp: new Date().toISOString(),
    });
  };

  // 🔹 Add a new job under /Job
  const handleAddJob = () => {
    const jobRef = ref(database, "Job");

    const newJob = {
      title: "Fix kitchen sink",
      category: "Plumbing",
      location: "Dhaka",
      description: "The sink is leaking and needs repair.",
      postedAt: new Date().toISOString(),
      status: "Open",
      postedBy: "user_12345",
    };

    push(jobRef, newJob)
      .then(() => {
        alert("✅ Job posted successfully!");
      })
      .catch((error) => {
        console.error("❌ Failed to post job:", error);
      });
  };

  // 🔹 Upload mock admin users to /admin
  const handleUploadAdminUsers = async () => {
    try {
      for (const admin of mockAdmins) {
        await set(ref(database, `admin/${admin.id}`), admin);
      }
      alert("✅ Admin users uploaded successfully!");
    } catch (error) {
      console.error("❌ Failed to upload admin users:", error);
      alert("Upload failed.");
    }
  };

  // 🔹 Listen to /admin/test data
  useEffect(() => {
    const testRef = ref(database, "admin/test");
    onValue(testRef, (snapshot) => {
      setTestData(snapshot.val());
    });
  }, []);

  // 🔹 Listen to /Job
  useEffect(() => {
    const jobRef = ref(database, "Job");
    onValue(jobRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const jobsArray = Object.entries(data).map(([id, job]) => ({
          id,
          ...job,
        }));
        setJobs(jobsArray.reverse());
      } else {
        setJobs([]);
      }
    });
  }, []);

  // 🔹 Listen to all /admin users (excluding "test" node)
  useEffect(() => {
    const adminRef = ref(database, "admin");
    onValue(adminRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const admins = Object.entries(data)
          .filter(([key]) => key !== "test")
          .map(([id, admin]) => ({
            id,
            ...admin,
          }));
        setAdminUsers(admins);
      } else {
        setAdminUsers([]);
      }
    });
  }, []);

  return (
    <div className="p-4">
      <h4 className="mb-3">🔧 Firebase Realtime Database Test</h4>

      <div className="d-flex flex-column gap-3 mb-4">
        <button className="btn btn-primary" onClick={handleWriteTestData}>
          Write Test Admin Data
        </button>

        <button className="btn btn-success" onClick={handleAddJob}>
          Add New Job
        </button>

        <button className="btn btn-warning" onClick={handleUploadAdminUsers}>
          Upload Admin Users
        </button>
        <button className="btn btn-outline-primary" onClick={async () => {
          // Migrate any existing DummyJob entries into Job
          try {
            const snap = await get(ref(database, 'DummyJob'));
            if (!snap || !snap.exists()) {
              alert('No DummyJob data found.');
              return;
            }
            const data = snap.val();
            const jobs = Object.entries(data);
            for (const [id, job] of jobs) {
              await set(ref(database, `Job/${id}`), job);
            }
            alert('✅ Migration complete: DummyJob -> Job');
          } catch (e) {
            console.error('Migration failed:', e);
            alert('Migration failed. See console.');
          }
        }}>
          Migrate DummyJob → Job
        </button>
        <button className="btn btn-outline-danger" onClick={async () => {
          // Delete DummyJob node after careful confirmation
          if (!confirm('Delete entire DummyJob node? This cannot be undone.')) return;
          try {
            await remove(ref(database, 'DummyJob'));
            alert('✅ DummyJob node deleted');
          } catch (e) {
            console.error('Failed to delete DummyJob:', e);
            alert('Delete failed. See console.');
          }
        }}>
          Delete DummyJob Node
        </button>
      </div>

      <div className="mb-5">
        <h6>📦 Test Admin Data (from /admin/test):</h6>
        {testData ? (
          <div className="border p-3 rounded bg-light mt-2">
            <p><strong>Name:</strong> {testData.name}</p>
            <p><strong>Timestamp:</strong> {testData.timestamp}</p>
          </div>
        ) : (
          <p className="text-muted">No test data found.</p>
        )}
      </div>

      <div className="mb-5">
        <h5 className="mb-3">📋 All Jobs (from /Job):</h5>
        {jobs.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-bordered table-striped">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Posted At</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, index) => (
                  <tr key={job.id}>
                    <td>{index + 1}</td>
                    <td>{job.title}</td>
                    <td>{job.category}</td>
                    <td>{job.location}</td>
                    <td>{job.description}</td>
                    <td>{job.status}</td>
                    <td>{new Date(job.postedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">No jobs available.</p>
        )}
      </div>

      <div className="mb-5">
        <h5 className="mb-3">👤 All Admin Users (from /admin)</h5>
        {adminUsers.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-bordered table-striped">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((admin, index) => (
                  <tr key={admin.id}>
                    <td>{index + 1}</td>
                    <td>{admin.email}</td>
                    <td>{admin.name}</td>
                    <td>{admin.firstName}</td>
                    <td>{admin.lastName}</td>
                    <td>{admin.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">No admin users found.</p>
        )}
      </div>
    </div>
  );
}

export default FirebaseTest;
