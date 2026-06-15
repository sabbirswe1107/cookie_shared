"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

export default function AdminPage() {
  const { user, loading, login, logout, api } = useAuth();
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Admin State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState<any>(null);
  
  // Data States
  const [services, setServices] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  
  // Create User State
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [userMsg, setUserMsg] = useState("");
  
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceSlug, setNewServiceSlug] = useState("");
  const [newServiceTargetUrl, setNewServiceTargetUrl] = useState("");
  const [newServiceKey, setNewServiceKey] = useState("");
  const [serviceMsg, setServiceMsg] = useState("");
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const fetchUsers = () => {
    api("/api/v1/admin/users").then(r => r.json()).then(setUsersList).catch(console.error);
  };

  useEffect(() => {
    if (!user) return;
    if (activeTab === "dashboard") {
      api("/api/v1/admin/dashboard").then(r => r.json()).then(setStats).catch(console.error);
    } else if (activeTab === "services") {
      api("/api/v1/admin/services").then(r => r.json()).then(setServices).catch(console.error);
    } else if (activeTab === "sessions") {
      api("/api/v1/admin/sessions").then(r => r.json()).then(setSessions).catch(console.error);
    } else if (activeTab === "users") {
      fetchUsers();
    }
  }, [user, activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg("");
    try {
      const res = await api("/api/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create user");
      }
      setUserMsg("Success! User securely stored in DB and Auth.");
      setNewEmail("");
      setNewPassword("");
      fetchUsers();
      setTimeout(() => setUserMsg(""), 3000);
    } catch (e: any) {
      setUserMsg(`Error: ${e.message}`);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceMsg("");
    try {
      const res = await api("/api/v1/admin/services", {
        method: "POST",
        body: JSON.stringify({ 
          name: newServiceName, 
          slug: newServiceSlug, 
          target_url: newServiceTargetUrl,
          encryption_key: newServiceKey ? newServiceKey : undefined
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create service");
      }
      setServiceMsg("Success! Service created.");
      setNewServiceName("");
      setNewServiceSlug("");
      setNewServiceTargetUrl("");
      setNewServiceKey("");
      api("/api/v1/admin/services").then(r => r.json()).then(setServices).catch(console.error);
      setTimeout(() => setServiceMsg(""), 3000);
    } catch (e: any) {
      setServiceMsg(`Error: ${e.message}`);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      const res = await api(`/api/v1/admin/services/${serviceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete service");
      api("/api/v1/admin/services").then(r => r.json()).then(setServices).catch(console.error);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleAddServer = async (serviceId: string, serviceName: string) => {
    const label = prompt(`Enter server label (e.g. Server-1) for ${serviceName}:`);
    if (!label) return;
    try {
      const res = await api(`/api/v1/admin/services/${serviceId}/servers`, {
        method: "POST",
        body: JSON.stringify({ label, max_concurrent_users: 10 })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to add server");
      }
      alert("Server added successfully!");
      api("/api/v1/admin/services").then(r => r.json()).then(setServices).catch(console.error);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleChangePassword = async (userId: string, email: string) => {
    const newPass = prompt(`Enter new password for ${email}:\n(Note: This updates the local DB. Supabase Auth must be updated separately if used)`);
    if (!newPass) return;
    if (newPass.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    try {
      const res = await api(`/api/v1/admin/users/${userId}/password`, {
        method: "PUT",
        body: JSON.stringify({ new_password: newPass })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update password");
      }
      alert("Password updated successfully!");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading Admin...</div>;
  }

  if (!user) {
    return (
      <div id="login-view">
        <div className="auth-card">
          <div className="auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h1>Admin Panel</h1>
          </div>
          <p className="auth-sub">Manage services, sessions, and users</p>
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full">Sign In</button>
          </form>
          {loginError && <p className="error-msg">{loginError}</p>}
          <p className="auth-hint">Use credentials from <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code></p>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-view" className="sidebar-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Admin
        </div>
        <nav className="sidebar-nav">
          <a href="#" className={activeTab === "dashboard" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("dashboard"); }}>Dashboard</a>
          <a href="#" className={activeTab === "services" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("services"); }}>Services</a>
          <a href="#" className={activeTab === "sessions" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("sessions"); }}>Sessions</a>
          <a href="#" className={activeTab === "users" ? "active" : ""} onClick={(e) => { e.preventDefault(); setActiveTab("users"); }}>Users</a>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a>
        </nav>
      </aside>

      <div className="admin-main">
        {activeTab === "dashboard" && (
          <section className="page">
            <h2 className="page-title">Dashboard</h2>
            <p className="page-sub">Platform overview</p>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats?.total_users || 0}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.total_services || 0}</div>
                <div className="stat-label">Active Services</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.total_sessions || 0}</div>
                <div className="stat-label">Total Sessions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.active_servers || 0}</div>
                <div className="stat-label">Active Servers</div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "services" && (
          <section className="page">
            <div className="section-header">
              <h2>Services Management</h2>
            </div>
            
            <div className="admin-grid">
              <div className="admin-card">
                <h3>Create New Service</h3>
                <form onSubmit={handleCreateService} className="admin-form">
                  <div className="field">
                    <label>Service Name</label>
                    <input type="text" value={newServiceName} onChange={e => setNewServiceName(e.target.value)} required placeholder="e.g. Netflix Premium" />
                  </div>
                  <div className="field">
                    <label>Slug (Unique ID)</label>
                    <input type="text" value={newServiceSlug} onChange={e => setNewServiceSlug(e.target.value)} required placeholder="e.g. netflix" />
                  </div>
                  <div className="field">
                    <label>Target URL</label>
                    <input type="url" value={newServiceTargetUrl} onChange={e => setNewServiceTargetUrl(e.target.value)} required placeholder="https://netflix.com" />
                  </div>
                  <div className="field">
                    <label>Encryption Key (Optional)</label>
                    <input type="text" value={newServiceKey} onChange={e => setNewServiceKey(e.target.value)} placeholder="Leave blank to auto-generate" />
                  </div>
                  <button type="submit" className="btn btn-primary">Create Service</button>
                  {serviceMsg && <div className={`form-msg ${serviceMsg.includes('Error') ? 'error' : 'success'}`}>{serviceMsg}</div>}
                </form>
              </div>

              <div className="admin-card">
                <h3>Active Services</h3>
                <div className="table-container mt-4">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Encryption Key</th>
                    <th>Servers</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <React.Fragment key={s.id}>
                      <tr>
                        <td><strong>{s.name}</strong></td>
                        <td><code>{s.slug}</code></td>
                        <td><code style={{fontSize: '11px', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px'}}>{s.encryption_key || "None"}</code></td>
                        <td><span className="badge badge-success">{s.servers?.length || 0} active</span></td>
                        <td style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleAddServer(s.id, s.name)} className="btn btn-sm btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }}>
                            Add Server
                          </button>
                          <button onClick={() => handleDeleteService(s.id)} className="btn btn-sm btn-danger" style={{ fontSize: '12px', padding: '4px 8px' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                      {s.servers && s.servers.length > 0 && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={5} style={{ padding: '12px 24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Servers for {s.name}:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {s.servers.map((srv: any) => (
                                <div key={srv.id} style={{ border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '6px', background: '#fff' }}>
                                  <strong>{srv.label}</strong> <br/>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {srv.id}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {services.length === 0 && <tr><td colSpan={5} className="text-center">No services found.</td></tr>}
                </tbody>
              </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "sessions" && (
          <section className="page">
            <div className="section-header">
              <h2>Active Sessions</h2>
            </div>
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Expires At</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td><strong className="text-primary">{s.domain}</strong></td>
                      <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-error'}`}>{s.status}</span></td>
                      <td>
                        <div className="health-bar-container">
                          <div className="health-bar" style={{ width: `${s.health_score}%`, background: s.health_score > 80 ? '#10b981' : '#f59e0b' }}></div>
                        </div>
                        <span className="text-sm">{s.health_score}%</span>
                      </td>
                      <td>{new Date(s.expires_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={4} className="text-center">No active sessions.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "users" && (
          <section className="page">
            <div className="section-header">
              <h2>Users Management</h2>
            </div>
            
            <div className="admin-grid">
              <div className="admin-card">
                <h3>Create New User</h3>
                <p className="text-sm text-muted mb-4">Users will be securely stored in the PostgreSQL database and Supabase Auth.</p>
                <form onSubmit={handleCreateUser} className="admin-form">
                  <div className="field">
                    <label>Email Address</label>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="user@domain.com" />
                  </div>
                  <div className="field">
                    <label>Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                  </div>
                  <div className="field">
                    <label>Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary">Create User</button>
                  {userMsg && <div className={`form-msg ${userMsg.includes('Error') ? 'error' : 'success'}`}>{userMsg}</div>}
                </form>
              </div>

              <div className="admin-card">
                <h3>Registered Users</h3>
                <div className="table-container mt-4">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map(u => (
                        <tr key={u.id}>
                          <td><strong>{u.email}</strong></td>
                          <td><span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{u.role}</span></td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>
                            <button onClick={() => handleChangePassword(u.id, u.email)} className="btn btn-sm btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }}>
                              Change Pass
                            </button>
                          </td>
                        </tr>
                      ))}
                      {usersList.length === 0 && <tr><td colSpan={4} className="text-center">No users found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
