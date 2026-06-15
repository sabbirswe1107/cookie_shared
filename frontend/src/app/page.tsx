"use client";

import React, { useState } from "react";
import Link from "next/link";
import { API_BASE } from "../lib/auth";

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const handleLookup = async () => {
    const id = sessionId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/cookies/metadata/${id}`);
      if (!res.ok) throw new Error("Session not found or has expired.");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!result?.id) return;
    try {
      await fetch(`${API_BASE}/api/v1/cookies/revoke/${result.id}`, { method: "DELETE" });
      setRevokeDialogOpen(false);
      setResult(null);
      setSessionId("");
      alert("Session successfully revoked.");
    } catch (err: any) {
      alert("Failed to revoke session: " + err.message);
    }
  };

  return (
    <>
      <div className="bg-blobs" aria-hidden="true">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <nav className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Secure Cookie Share
          </Link>
          <div className="nav-links">
            <Link href="/portal" className="nav-link">User Portal</Link>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#pricing" className="nav-link">Pricing</a>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero" id="hero">
          <div className="hero-inner">
            <div className="hero-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Zero-Knowledge Encryption — Your data never touches our servers in plaintext
            </div>

            <h1 className="hero-title">
              Share Browser Sessions<br />
              <span className="gradient-text">Securely &amp; Instantly</span>
            </h1>

            <p className="hero-sub">
              Export your browser cookies as an AES-GCM-256 encrypted payload.
              Share the link and a passphrase with anyone. They decrypt it locally —
              the server sees only encrypted blobs that auto-expire.
            </p>

            <div className="hero-actions">
              <a href="#pricing" className="btn-primary">View Pricing</a>
              <a href="#how-it-works" className="btn-ghost">How It Works</a>
            </div>

            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-value">AES-256</span>
                <span className="stat-label">Encryption Standard</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-value">Client-Side</span>
                <span className="stat-label">Key Derivation (PBKDF2)</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-value">Auto-Expiry</span>
                <span className="stat-label">Up to 60 Minutes</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="section-inner">
            <div className="section-label">Process</div>
            <h2 className="section-title">How It Works</h2>
            <p className="section-sub">End-to-end encrypted cookie sharing in three simple steps.</p>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-num">01</div>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h3>Install &amp; Export</h3>
                <p>Install the Chrome Extension. Open any website you're logged into, enter a secret passphrase, and click <strong>Export Cookies</strong>.</p>
              </div>

              <div className="step-card">
                <div className="step-num">02</div>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </div>
                <h3>Share the ID</h3>
                <p>Copy the generated sharing ID. Send the ID and your secret passphrase to a trusted party. The ID by itself is useless.</p>
              </div>

              <div className="step-card">
                <div className="step-num">03</div>
                <div className="step-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </div>
                <h3>Decrypt &amp; Import</h3>
                <p>In the recipient's browser, the extension retrieves the encrypted blob, decrypts it locally, and imports all cookies.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section pricing-section" id="pricing">
          <div className="section-inner">
            <div className="section-label">Pricing</div>
            <h2 className="section-title">Simple, transparent pricing</h2>
            <p className="section-sub">Choose the perfect plan for your secure sharing needs.</p>

            <div className="pricing-grid">
              <div className="pricing-card">
                <h3>Basic</h3>
                <div className="price"><span>$</span>9<span>/mo</span></div>
                <p>Perfect for individuals needing secure sharing.</p>
                <ul className="pricing-features">
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 100 Sessions / month</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 24-hour expiry limit</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Community Support</li>
                </ul>
                <a href="/portal" className="btn-ghost btn-full">Get Started</a>
              </div>
              
              <div className="pricing-card popular">
                <div className="popular-badge">Most Popular</div>
                <h3>Pro</h3>
                <div className="price"><span>$</span>29<span>/mo</span></div>
                <p>For teams that need advanced control and limits.</p>
                <ul className="pricing-features">
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Unlimited Sessions</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Custom expiry (up to 7 days)</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Priority Email Support</li>
                </ul>
                <a href="/portal" className="btn-primary btn-full">Start Free Trial</a>
              </div>

              <div className="pricing-card">
                <h3>Enterprise</h3>
                <div className="price"><span>$</span>99<span>/mo</span></div>
                <p>Dedicated infrastructure and premium security.</p>
                <ul className="pricing-features">
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Dedicated Server Instances</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Unlimited Expiry Times</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 24/7 Phone Support</li>
                </ul>
                <a href="/portal" className="btn-ghost btn-full">Contact Sales</a>
              </div>
            </div>
          </div>
        </section>

        <section className="security-section">
          <div className="section-inner">
            <div className="section-label">Security</div>
            <h2 className="section-title">Built With Privacy First</h2>
            <div className="security-grid">
              <div className="security-card">
                <div className="security-icon green">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h4>AES-GCM-256 Encryption</h4>
                <p>Industry-standard authenticated encryption. Guarantees both confidentiality and integrity.</p>
              </div>
              <div className="security-card">
                <div className="security-icon purple">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                <h4>PBKDF2 Key Derivation</h4>
                <p>Keys are derived with 100,000 iterations of SHA-256. Brute-forcing a passphrase is computationally prohibitive.</p>
              </div>
              <div className="security-card">
                <div className="security-icon blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                </div>
                <h4>Auto-Expiry TTL</h4>
                <p>All sessions expire in 15–60 minutes. Expired records are purged automatically from the database.</p>
              </div>
              <div className="security-card">
                <div className="security-icon orange">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                </div>
                <h4>Server Never Sees Plaintext</h4>
                <p>The server only stores an opaque encrypted blob. Without your passphrase, it is useless.</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Secure Cookie Share
          </div>
          <p className="footer-note">Zero-knowledge architecture. Plaintext cookies never leave your browser.</p>
        </div>
      </footer>

      {revokeDialogOpen && (
        <div className="dialog-overlay" role="dialog">
          <div className="dialog-box">
            <div className="dialog-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <h3>Revoke this session?</h3>
            <p>This will permanently delete the sharing link. This action cannot be undone.</p>
            <div className="dialog-actions">
              <button onClick={() => setRevokeDialogOpen(false)} className="btn-ghost-sm">Cancel</button>
              <button onClick={handleRevoke} className="btn-danger">Yes, Revoke</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
