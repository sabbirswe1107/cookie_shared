// Cookie capture, clear, and injection engine

async function captureCookiesForDomain(domain) {
  const cookies = await chrome.cookies.getAll({ domain });
  return cookies || [];
}

async function captureStorageFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
      }),
    });
    if (results?.[0]?.result) {
      return {
        localStorage: results[0].result.localStorage || {},
        sessionStorage: results[0].result.sessionStorage || {},
      };
    }
  } catch (e) {
    console.warn("Storage capture failed:", e);
  }
  return { localStorage: {}, sessionStorage: {} };
}

async function clearDomainCookies(domains) {
  let removed = 0;
  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    for (const cookie of cookies) {
      const protocol = cookie.secure ? "https://" : "http://";
      let host = cookie.domain.startsWith(".") ? cookie.domain.substring(1) : cookie.domain;
      const url = `${protocol}${host}${cookie.path}`;
      try {
        await chrome.cookies.remove({ url, name: cookie.name });
        removed++;
      } catch (e) {
        console.warn("Failed to remove cookie:", cookie.name, e);
      }
    }
  }
  return removed;
}

async function injectCookies(cookies) {
  let successCount = 0;
  for (const cookie of cookies) {
    const protocol = cookie.secure ? "https://" : "http://";
    let domainForUrl = cookie.domain.startsWith(".") ? cookie.domain.substring(1) : cookie.domain;
    const cookieUrl = `${protocol}${domainForUrl}${cookie.path}`;

    const details = {
      url: cookieUrl,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
    };

    if (cookie.name.startsWith("__Host-")) {
      details.secure = true;
      details.path = "/";
    } else {
      details.domain = cookie.domain;
    }

    if (cookie.name.startsWith("__Secure-")) {
      details.secure = true;
    }

    if (cookie.sameSite && cookie.sameSite !== "unspecified") {
      details.sameSite = cookie.sameSite;
    }

    if (cookie.expirationDate !== undefined) {
      details.expirationDate = cookie.expirationDate;
    }

    try {
      await chrome.cookies.set(details);
      successCount++;
    } catch (err) {
      console.warn(`Failed to set cookie: ${cookie.name}`, err);
    }
  }
  return successCount;
}

async function injectStorageIntoTab(tabId, localStore, sessionStore) {
  if (!tabId) return;
  if (Object.keys(localStore).length === 0 && Object.keys(sessionStore).length === 0) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (data) => {
        if (data.localStorage) {
          localStorage.clear();
          for (const [key, val] of Object.entries(data.localStorage)) {
            localStorage.setItem(key, val);
          }
        }
        if (data.sessionStorage) {
          sessionStorage.clear();
          for (const [key, val] of Object.entries(data.sessionStorage)) {
            sessionStorage.setItem(key, val);
          }
        }
      },
      args: [{ localStorage: localStore, sessionStorage: sessionStore }],
    });
  } catch (e) {
    console.warn("Storage injection failed:", e);
  }
}

function parseDecryptedPackage(packageJson) {
  let data;
  try {
    data = JSON.parse(packageJson);
  } catch {
    return { cookies: [], localStorage: {}, sessionStorage: {} };
  }

  if (Array.isArray(data)) {
    return { cookies: data, localStorage: {}, sessionStorage: {} };
  }

  return {
    cookies: data.cookies || [],
    localStorage: data.localStorage || {},
    sessionStorage: data.sessionStorage || {},
  };
}

if (typeof self !== "undefined") {
  self.CookieEngine = {
    captureCookiesForDomain,
    captureStorageFromTab,
    clearDomainCookies,
    injectCookies,
    injectStorageIntoTab,
    parseDecryptedPackage,
  };
}
