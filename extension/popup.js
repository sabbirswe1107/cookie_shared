// Secure Cookie Share — Popup Controller v2

let BACKEND_URL = "http://localhost:8000";
let adminToken = null;
let servicesCache = [];
let activeDomain = "";

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupPasswordToggles();
  document.getElementById("btn-close-status").addEventListener("click", hideStatus);
  await loadSettings();
  await detectActiveTab();

  document.getElementById("btn-export-action").addEventListener("click", handleExport);
  document.getElementById("btn-import-action").addEventListener("click", handleImport);
  document.getElementById("btn-copy-id").addEventListener("click", copyShareId);
  document.getElementById("btn-save-settings").addEventListener("click", handleSaveSettings);
  document.getElementById("btn-admin-login").addEventListener("click", handleAdminLogin);
  document.getElementById("btn-platform-upload").addEventListener("click", handlePlatformUpload);
  document.getElementById("platform-service").addEventListener("change", onServiceChange);

  if (adminToken) await loadServices();
});

async function loadSettings() {
  const res = await chrome.storage.local.get(["backendUrl", "adminToken", "adminEmail"]);
  if (res.backendUrl) BACKEND_URL = res.backendUrl;
  if (res.adminToken) adminToken = res.adminToken;
  document.getElementById("settings-backend-url").value = BACKEND_URL;
  if (res.adminEmail) document.getElementById("settings-admin-email").value = res.adminEmail;
}

async function handleSaveSettings() {
  const url = document.getElementById("settings-backend-url").value.trim().replace(/\/$/, "");
  const email = document.getElementById("settings-admin-email").value.trim();
  if (!url) { showStatus("Backend URL cannot be empty."); return; }
  await chrome.storage.local.set({ backendUrl: url, adminEmail: email });
  BACKEND_URL = url;
  document.getElementById("settings-success").classList.remove("hidden");
  setTimeout(() => document.getElementById("settings-success").classList.add("hidden"), 3000);
}

async function handleAdminLogin() {
  const email = document.getElementById("settings-admin-email").value.trim();
  const password = document.getElementById("settings-admin-password").value;
  if (!email || !password) { showStatus("Enter admin email and password."); return; }

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    adminToken = data.access_token;
    await chrome.storage.local.set({ adminToken, adminEmail: email, adminUser: data.user });
    showStatus("Admin login successful!", false);
    await loadServices();
  } catch (e) {
    showStatus("Admin login failed. Check credentials.");
  }
}

async function loadServices() {
  if (!adminToken) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/admin/services`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) { adminToken = null; return; }
    servicesCache = await res.json();
    const sel = document.getElementById("platform-service");
    sel.innerHTML = '<option value="">Select service...</option>';
    servicesCache.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      opt.dataset.key = s.encryption_key || "";
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load services:", e);
  }
}

function onServiceChange() {
  const serviceId = document.getElementById("platform-service").value;
  const serverSel = document.getElementById("platform-server");
  serverSel.innerHTML = '<option value="">Select server...</option>';
  const svc = servicesCache.find((s) => s.id === serviceId);
  if (!svc) return;
  svc.servers.forEach((srv) => {
    const opt = document.createElement("option");
    opt.value = srv.id;
    opt.textContent = `${srv.label}${srv.has_active_session ? " (active)" : ""}`;
    serverSel.appendChild(opt);
  });
}

async function handlePlatformUpload() {
  hideStatus();
  document.getElementById("platform-result").classList.add("hidden");

  const serviceId = document.getElementById("platform-service").value;
  const serverId = document.getElementById("platform-server").value;
  const expiryHours = parseInt(document.getElementById("platform-expiry").value, 10);

  if (!adminToken) { showStatus("Login as admin first (Settings tab)."); return; }
  if (!serviceId || !serverId) { showStatus("Select a service and server."); return; }
  if (!activeDomain) { showStatus("No valid domain detected."); return; }

  const svc = servicesCache.find((s) => s.id === serviceId);
  const passphrase = svc?.encryption_key;
  if (!passphrase) { showStatus("Service has no encryption key configured."); return; }

  setLoading("btn-platform-upload", true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cookies = await CookieEngine.captureCookiesForDomain(activeDomain);
    if (!cookies.length) {
      showStatus(`No cookies found for ${activeDomain}.`);
      setLoading("btn-platform-upload", false);
      return;
    }

    const storage = tab ? await CookieEngine.captureStorageFromTab(tab.id) : { localStorage: {}, sessionStorage: {} };
    const packageJson = JSON.stringify({ cookies, ...storage });
    const encrypted = await CryptoUtil.encryptData(packageJson, passphrase);

    const res = await fetch(`${BACKEND_URL}/api/v1/admin/upload-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        service_id: serviceId,
        server_id: serverId,
        domain: activeDomain,
        salt: encrypted.salt,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        expiry_hours: expiryHours,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Upload failed (${res.status})`);
    }

    const result = await res.json();
    document.getElementById("platform-session-id").textContent = result.id;
    document.getElementById("platform-result").classList.remove("hidden");
  } catch (e) {
    showStatus(`Upload failed: ${e.message}`);
  } finally {
    setLoading("btn-platform-upload", false);
  }
}

// ── Legacy Export/Import (unchanged logic, uses shared modules) ──

async function handleExport() {
  hideStatus();
  document.getElementById("export-result").classList.add("hidden");
  const passphrase = document.getElementById("export-passphrase").value;
  const expiryMinutes = parseInt(document.getElementById("export-expiry").value, 10);
  if (!activeDomain) { showStatus("No valid domain."); return; }
  if (!passphrase) { showStatus("Enter a passphrase."); return; }

  setLoading("btn-export-action", true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cookies = await CookieEngine.captureCookiesForDomain(activeDomain);
    if (!cookies.length) { showStatus("No cookies found."); return; }
    const storage = tab ? await CookieEngine.captureStorageFromTab(tab.id) : { localStorage: {}, sessionStorage: {} };
    const encrypted = await CryptoUtil.encryptData(JSON.stringify({ cookies, ...storage }), passphrase);

    const res = await fetch(`${BACKEND_URL}/api/v1/cookies/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: activeDomain, ...encrypted, expiry_minutes: expiryMinutes }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const result = await res.json();
    document.getElementById("share-id").value = result.id;
    document.getElementById("export-result").classList.remove("hidden");
  } catch (e) {
    showStatus(`Export failed: ${e.message}`);
  } finally {
    setLoading("btn-export-action", false);
  }
}

async function handleImport() {
  hideStatus();
  document.getElementById("import-result").classList.add("hidden");
  const shareId = document.getElementById("import-id").value.trim();
  const passphrase = document.getElementById("import-passphrase").value;
  if (!shareId || !passphrase) { showStatus("Enter share ID and passphrase."); return; }

  setLoading("btn-import-action", true);
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/cookies/fetch/${shareId}`);
    if (res.status === 404) { showStatus("Session not found or expired."); return; }
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const payload = await res.json();

    let packageJson;
    try {
      packageJson = await CryptoUtil.decryptData(payload.ciphertext, payload.salt, payload.iv, passphrase);
    } catch {
      showStatus("Decryption failed. Wrong passphrase.");
      return;
    }

    const { cookies, localStorage: ls, sessionStorage: ss } = CookieEngine.parseDecryptedPackage(packageJson);
    const count = await CookieEngine.injectCookies(cookies);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await CookieEngine.injectStorageIntoTab(tab.id, ls, ss);
      try { await chrome.tabs.reload(tab.id); } catch {}
    }
    document.getElementById("imported-count").textContent = count;
    document.getElementById("import-result").classList.remove("hidden");
  } catch (e) {
    showStatus(`Import failed: ${e.message}`);
  } finally {
    setLoading("btn-import-action", false);
  }
}

// ── UI Helpers ────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
      hideStatus();
    });
  });
}

function setupPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = toggle.previousElementSibling;
      input.type = input.type === "password" ? "text" : "password";
    });
  });
}

async function detectActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const urlObj = new URL(tab.url);
    if (urlObj.protocol.startsWith("chrome") || urlObj.protocol.startsWith("about")) {
      activeDomain = "";
      document.getElementById("export-domain").value = "Unsupported page";
      document.getElementById("platform-domain").value = "Unsupported page";
      document.getElementById("domain-badge").textContent = "Unsupported";
      return;
    }
    activeDomain = urlObj.hostname;
    document.getElementById("export-domain").value = activeDomain;
    document.getElementById("platform-domain").value = activeDomain;
    document.getElementById("domain-badge").textContent = activeDomain;
  } catch (e) {
    showStatus("Tab detection failed.");
  }
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  const label = btn.querySelector("span");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  label.classList.toggle("hidden", loading);
  spinner.classList.toggle("hidden", !loading);
}

function showStatus(msg, isError = true) {
  const banner = document.getElementById("status-banner");
  document.getElementById("status-message").textContent = msg;
  banner.classList.toggle("hidden", false);
  if (!isError) banner.style.background = "#059669";
}

function hideStatus() {
  document.getElementById("status-banner").classList.add("hidden");
  document.getElementById("status-banner").style.background = "";
}

function copyShareId() {
  const input = document.getElementById("share-id");
  input.select();
  navigator.clipboard.writeText(input.value);
}
