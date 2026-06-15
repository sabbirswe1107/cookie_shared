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
  const [launching, setLaunching] = useState(false);
  const [launchMsg, setLaunchMsg] = useState("");
  
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
      api("/api/v1/user/services")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServices(data);
          } else {
            console.error("Failed to load services:", data);
            setServices([]);
          }
        })
        .catch(err => {
          console.error(err);
          setServices([]);
        });

      // Check extension repeatedly for a few seconds just in case it loads late
      let checks = 0;
      const checkExt = setInterval(() => {
        if (document.documentElement.hasAttribute("data-cookie-extension")) {
          setExtStatus(true);
          clearInterval(checkExt);
        }
        window.postMessage({ type: "PING" }, "*");
        if (++checks > 10) clearInterval(checkExt); // Stop after 5 seconds
      }, 500);
      return () => clearInterval(checkExt);
    }
  }, [user]);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === "INJECT_PROGRESS") {
        if (e.data.status === "error") {
          setLaunchMsg(`Error: ${e.data.message || "Injection failed"}`);
          setLaunching(false);
        } else if (e.data.status === "done") {
          setLaunchMsg("Injection complete! Opening tab...");
          setLaunching(false);
        } else {
          setLaunchMsg(`Status: ${e.data.status}...`);
        }
      }
      if (e.data?.type === "INJECT_RESPONSE") {
        if (!e.data.success) {
          setLaunchMsg(`Error: ${e.data.error || "Injection failed"}`);
          setLaunching(false);
        }
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

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
          <a href="/user-extension.zip" download className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>
            Install Extension
          </a>
        </div>
      )}

      <main className="main-content">
        <h2 className="page-title">Your Services</h2>
        <p className="page-sub">Click Access to choose a server and launch a premium session.</p>
        <div className="services-grid">
          {Array.isArray(services) && services.map((svc: any) => (
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
              {launchMsg && <div className={`banner ${launchMsg.includes('Error') ? 'banner-error' : 'banner-success'}`} style={{ marginBottom: 16 }}>{launchMsg}</div>}
              {(!selectedService?.servers || selectedService.servers.length === 0) ? (
                <p>No active servers for this service.</p>
              ) : (
                <div className="server-list">
                  {selectedService.servers.map((srv: any) => (
                    <div key={srv.id} className="server-item" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0' }}>{srv.label}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          Status: {srv.has_active_session ? <span style={{color: '#10b981'}}>Available</span> : <span style={{color: '#f59e0b'}}>Offline</span>}
                        </p>
                      </div>
                      <button 
                        className="btn btn-primary btn-sm" 
                        disabled={!srv.has_active_session || launching}
                        onClick={async () => {
                          setLaunching(true);
                          setLaunchMsg("");
                          try {
                            const token = localStorage.getItem("portal_access_token") || "";
                            
                            window.postMessage({
                              type: "INJECT_SESSION",
                              serviceId: selectedService.id,
                              serverId: srv.id,
                              accessToken: token,
                              backendUrl: "http://localhost:8000",
                              targetUrl: selectedService.target_url
                            }, "*");
                            
                            // Do not show "Session injection initiated", just wait for response
                            // Add a timeout fallback in case the extension context is invalidated
                            setTimeout(() => {
                              setLaunching(current => {
                                if (current) {
                                  setLaunchMsg("Error: Extension did not respond. Try refreshing the page.");
                                  return false;
                                }
                                return current;
                              });
                            }, 4000);
                          } catch (e: any) {
                            setLaunchMsg(`Error: ${e.message}`);
                            setLaunching(false);
                          }
                        }}
                      >
                        {launching ? "Launching..." : "Launch"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
