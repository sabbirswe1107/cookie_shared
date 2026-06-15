"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

export default function PortalPage() {
  const { user, loading, login, logout, api } = useAuth();
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Portal State
  const [services, setServices] = useState<any[]>([]);
  const [extStatus, setExtStatus] = useState(false); // mock extension status
  
  // Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

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
    if (user) {
      // Mock loading services
      api("/api/v1/services")
        .then(res => res.json())
        .then(data => setServices(data))
        .catch(console.error);

      // Check extension
      const checkExt = setTimeout(() => {
        setExtStatus(document.documentElement.hasAttribute("data-scs-ext-version"));
      }, 500);
      return () => clearTimeout(checkExt);
    }
  }, [user]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading Portal...</div>;
  }

  if (!user) {
    return (
      <div id="login-view" className="view">
        <div className="auth-card">
          <div className="auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h1>User Portal</h1>
          </div>
          <p className="auth-sub">Sign in to access premium services</p>
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
        </div>
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="view">
      <nav className="topbar">
        <div className="topbar-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          User Portal
        </div>
        <div className="topbar-actions">
          {extStatus ? (
            <span className="ext-badge ext-active">Extension Active</span>
          ) : (
            <span className="ext-badge ext-missing">Extension not detected</span>
          )}
          <span className="user-label">{user.email}</span>
          <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
      </nav>

      {!extStatus && (
        <div className="banner banner-warning">
          <span>Install the Secure Cookie Share Chrome Extension to access services.</span>
          <button className="btn btn-sm btn-primary" onClick={() => alert("Load the extension from the /extension folder in Chrome Developer Mode.")}>
            Install Extension
          </button>
        </div>
      )}

      <main className="main-content">
        <h2 className="page-title">Your Services</h2>
        <p className="page-sub">Click Access to choose a server and launch a premium session.</p>
        <div className="services-grid">
          {services.map((svc: any) => (
            <div key={svc.id} className="service-card">
              <h3>{svc.name}</h3>
              <p>{svc.target_url}</p>
              <button className="btn btn-primary btn-sm" onClick={() => { setSelectedService(svc); setDrawerOpen(true); }}>
                Access
              </button>
            </div>
          ))}
          {services.length === 0 && (
            <div className="no-services" style={{ padding: 20 }}>
              No services available yet.
            </div>
          )}
        </div>
      </main>

      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Select Server for {selectedService?.name}</h3>
              <button onClick={() => setDrawerOpen(false)} className="btn-icon">&times;</button>
            </div>
            <div className="drawer-body">
              <p>Server list would appear here (React UI port in progress...)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
