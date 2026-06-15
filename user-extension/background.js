importScripts("crypto.js", "cookie-engine.js");

const EXTENSION_VERSION = "2.0.0-user";

function sendProgress(tabId, status, detail = {}) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, {
    type: "INJECT_PROGRESS",
    status,
    ...detail,
  }).catch(() => {});
}

async function handleInjectSession(payload, senderTabId) {
  const {
    serviceId,
    serverId,
    accessToken,
    backendUrl,
    targetUrl,
  } = payload;

  if (!backendUrl) {
    sendProgress(senderTabId, "error", { message: "Backend URL not provided" });
    return { success: false, error: "Backend URL not provided by portal." };
  }

  const apiBase = backendUrl.replace(/\/$/, "");

  try {
    sendProgress(senderTabId, "clearing");

    const fetchRes = await fetch(`${apiBase}/api/v1/user/session/${serviceId}/${serverId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!fetchRes.ok) {
      const err = await fetchRes.json().catch(() => ({}));
      throw new Error(err.detail || `Server returned ${fetchRes.status}`);
    }

    sendProgress(senderTabId, "fetching");
    const session = await fetchRes.json();

    if (session.cookie_domains?.length) {
      await CookieEngine.clearDomainCookies(session.cookie_domains);
    }

    sendProgress(senderTabId, "decrypting");
    const passphrase = session.encryption_key;
    if (!passphrase) {
      throw new Error("No encryption key configured for this service");
    }

    const packageJson = await CryptoUtil.decryptData(
      session.ciphertext,
      session.salt,
      session.iv,
      passphrase
    );

    const { cookies, localStorage: localStore, sessionStorage: sessionStore } =
      CookieEngine.parseDecryptedPackage(packageJson);

    sendProgress(senderTabId, "injecting");
    const count = await CookieEngine.injectCookies(cookies);

    const tab = await chrome.tabs.create({ url: targetUrl || session.target_url, active: true });

    if (tab?.id) {
      await new Promise((r) => setTimeout(r, 1500));
      await CookieEngine.injectStorageIntoTab(tab.id, localStore, sessionStore);
      try {
        await chrome.tabs.reload(tab.id);
      } catch (e) {
        console.warn("Tab reload failed:", e);
      }
    }

    await chrome.storage.session.set({
      activeSession: {
        serviceId,
        serverId,
        tabId: tab?.id,
        injectedAt: Date.now(),
        cookieCount: count,
      },
    });

    sendProgress(senderTabId, "done", { cookieCount: count, tabId: tab?.id });
    return { success: true, cookieCount: count, tabId: tab?.id };
  } catch (error) {
    console.error("Inject session failed:", error);
    sendProgress(senderTabId, "error", { message: error.message });
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ installed: true, version: EXTENSION_VERSION });
    return false;
  }

  if (message.type === "INJECT_SESSION") {
    const tabId = sender.tab?.id;
    handleInjectSession(message, tabId).then(sendResponse);
    return true;
  }

  if (message.type === "GET_ACTIVE_SESSION") {
    chrome.storage.session.get(["activeSession"]).then((res) => {
      sendResponse(res.activeSession || null);
    });
    return true;
  }

  if (message.type === "RELEASE_SESSION") {
    chrome.storage.session.remove(["activeSession"]).then(() => {
      sendResponse({ released: true });
    });
    return true;
  }

  return false;
});

// External messages from portal (externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ installed: true, version: EXTENSION_VERSION });
    return false;
  }
  if (message.type === "INJECT_SESSION") {
    handleInjectSession(message, null).then(sendResponse);
    return true;
  }
  return false;
});
