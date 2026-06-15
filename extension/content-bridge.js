// Content script bridge: relays postMessage from User Portal to background service worker

const PORTAL_ORIGINS = [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "https://localhost:8000",
  "http://localhost:5173",
  "http://localhost:3000"
];

function isAllowedOrigin(origin) {
  if (PORTAL_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".yourplatform.com")) return true;
  try {
    const url = new URL(origin);
    // Allow local network IP ranges
    if (url.hostname.startsWith("192.168.") || 
        url.hostname.startsWith("10.") || 
        url.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return true;
    }
  } catch (e) {}
  return false;
}

window.addEventListener("message", (event) => {
  if (!isAllowedOrigin(event.origin)) return;
  if (!event.data || typeof event.data.type !== "string") return;

  const { type } = event.data;

  if (type === "PING") {
    chrome.runtime.sendMessage({ type: "PING" }, (response) => {
      window.postMessage(
        { type: "PING_RESPONSE", ...(response || { installed: false }) },
        event.origin
      );
    });
    return;
  }

  if (type === "INJECT_SESSION") {
    chrome.runtime.sendMessage(event.data, (response) => {
      window.postMessage(
        { type: "INJECT_RESPONSE", ...(response || {}) },
        event.origin
      );
    });
    return;
  }
});

// Relay progress updates from background to portal
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "INJECT_PROGRESS") {
    window.postMessage({ ...message }, window.location.origin);
  }
});

// Mark extension as installed for DOM detection
document.documentElement.setAttribute("data-cookie-extension", "installed");
