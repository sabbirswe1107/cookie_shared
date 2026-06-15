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
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      await login(email, password);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  useEffect(() => {
    if (user && activeTab === "dashboard") {
      api("/api/v1/admin/dashboard")
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(console.error);
    }
  }, [user, activeTab]);

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
              <h2>Services</h2>
            </div>
            <p className="page-sub">Service management would go here (React UI port in progress...)</p>
          </section>
        )}

        {activeTab === "sessions" && (
          <section className="page">
            <div className="section-header">
              <h2>Sessions</h2>
            </div>
            <p className="page-sub">Session table would go here (React UI port in progress...)</p>
          </section>
        )}

        {activeTab === "users" && (
          <section className="page">
            <div className="section-header">
              <h2>Users</h2>
            </div>
            <p className="page-sub">User table would go here (React UI port in progress...)</p>
          </section>
        )}
      </div>
    </div>
  );
}
