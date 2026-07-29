// Clone Manager - Background Service Worker

importScripts('ExtPay.js');

const EXTPAY_EXTENSION_ID = 'hckpgnffhjfblnaehcnchfhaihebmkfo';
const FREE_USE_LIMIT = 5;
const USAGE_STORAGE_KEY = 'usage';

// ExtensionPay is keyed by the published Chrome extension ID. Renaming the
// product does not change this identifier.
var extpay = ExtPay(EXTPAY_EXTENSION_ID);
extpay.startBackground();

// React when a user pays or logs in with a paid account
extpay.onPaid.addListener(user => {
  console.log('[Clone Manager] User paid:', user);
  chrome.storage.local.set({
    [USAGE_STORAGE_KEY]: {
      paid: true,
      useCount: FREE_USE_LIMIT,
      updatedAt: Date.now()
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Clone Manager] Extension installed');
});

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isAllowedGitUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;

    const host = url.hostname.toLowerCase();
    return host === 'github.com' ||
      host === 'gitlab.com' ||
      host.endsWith('.gitlab.com') ||
      host.endsWith('.gitlab.org') ||
      host === 'git.example.com' ||
      host.endsWith('.example.com');
  } catch (error) {
    return false;
  }
}

function headersToObject(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) result[key] = value;
  return result;
}

// Proxy Git smart-HTTP requests through the extension service worker. Extension
// host permissions avoid the CORS proxy/local server required by page scripts.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'git-http') return;

  const abortController = new AbortController();
  let acknowledgeChunk = null;

  function safePost(message) {
    try {
      port.postMessage(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function sendChunk(bytes) {
    const maxChunkSize = 48 * 1024;
    for (let offset = 0; offset < bytes.length; offset += maxChunkSize) {
      const chunk = bytes.subarray(offset, offset + maxChunkSize);
      const acknowledged = new Promise(resolve => {
        acknowledgeChunk = resolve;
      });
      if (!safePost({ type: 'chunk', data: bytesToBase64(chunk) })) return false;
      await acknowledged;
      acknowledgeChunk = null;
    }
    return true;
  }

  async function startRequest(message) {
    if (!isAllowedGitUrl(message.url)) {
      safePost({ type: 'error', error: 'Repository host is not allowed by this extension' });
      return;
    }

    try {
      const response = await fetch(message.url, {
        method: message.method || 'GET',
        headers: message.headers || {},
        body: message.body ? base64ToBytes(message.body) : undefined,
        credentials: 'include',
        redirect: 'follow',
        signal: abortController.signal
      });

      if (!safePost({
        type: 'response',
        url: response.url,
        method: message.method || 'GET',
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: headersToObject(response.headers)
      })) return;

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!(await sendChunk(value))) return;
        }
      } else {
        await sendChunk(new Uint8Array(await response.arrayBuffer()));
      }

      safePost({ type: 'done' });
    } catch (error) {
      if (error.name !== 'AbortError') {
        safePost({ type: 'error', error: error.message || 'Git network request failed' });
      }
    }
  }

  port.onMessage.addListener(message => {
    if (message.type === 'start') startRequest(message);
    if (message.type === 'ack' && acknowledgeChunk) acknowledgeChunk();
    if (message.type === 'cancel') abortController.abort();
  });

  port.onDisconnect.addListener(() => {
    abortController.abort();
    if (acknowledgeChunk) acknowledgeChunk();
  });
});

async function getConfig() {
  const { config = {} } = await chrome.storage.local.get('config');
  return config;
}

async function setConfig(config) {
  await chrome.storage.local.set({ config });
  return { success: true };
}

async function getStoredUsage() {
  const stored = await chrome.storage.local.get(USAGE_STORAGE_KEY);
  const usage = stored[USAGE_STORAGE_KEY] || {};
  return {
    paid: usage.paid === true,
    useCount: Math.max(0, Number(usage.useCount) || 0),
    updatedAt: Number(usage.updatedAt) || 0
  };
}

async function getPaymentUser() {
  try {
    const user = await extpay.getUser();
    const usage = await getStoredUsage();
    await chrome.storage.local.set({
      [USAGE_STORAGE_KEY]: {
        ...usage,
        paid: Boolean(user && user.paid),
        updatedAt: Date.now()
      }
    });
    return { user, paid: Boolean(user && user.paid), paymentError: null };
  } catch (error) {
    const usage = await getStoredUsage();
    return {
      user: null,
      paid: usage.paid,
      paymentError: error.message || 'Could not verify payment status'
    };
  }
}

function toAccessState(usage, paid, paymentError = null) {
  const useCount = Math.min(usage.useCount, FREE_USE_LIMIT);
  return {
    paid,
    allowed: paid || useCount < FREE_USE_LIMIT,
    useCount,
    remainingUses: paid ? null : Math.max(0, FREE_USE_LIMIT - useCount),
    freeUseLimit: FREE_USE_LIMIT,
    paymentError
  };
}

async function getAccessState() {
  const payment = await getPaymentUser();
  const usage = await getStoredUsage();
  return toAccessState(usage, payment.paid, payment.paymentError);
}

// Serialize claims so simultaneous tabs cannot exceed the free-use allowance.
let claimQueue = Promise.resolve();

function claimCloneUse() {
  const claim = claimQueue.then(async () => {
    const payment = await getPaymentUser();
    const usage = await getStoredUsage();

    if (payment.paid) {
      return toAccessState(usage, true, payment.paymentError);
    }

    if (usage.useCount >= FREE_USE_LIMIT) {
      return toAccessState(usage, false, payment.paymentError);
    }

    const nextUsage = {
      ...usage,
      paid: false,
      useCount: usage.useCount + 1,
      updatedAt: Date.now()
    };
    await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: nextUsage });
    return {
      ...toAccessState(nextUsage, false, payment.paymentError),
      allowed: true,
      claimGranted: true
    };
  });

  claimQueue = claim.catch(() => {});
  return claim;
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    getConfig()
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'SET_CONFIG') {
    setConfig(message.config)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ─── ExtPay payment handlers ──────────────────────────────────
  if (message.type === 'GET_USER') {
    getPaymentUser()
      .then(result => sendResponse(result.user || {
        paid: result.paid,
        error: result.paymentError
      }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === 'GET_ACCESS_STATUS') {
    getAccessState()
      .then(sendResponse)
      .catch(err => sendResponse({ allowed: false, error: err.message }));
    return true;
  }

  if (message.type === 'CLAIM_CLONE_USE') {
    claimCloneUse()
      .then(sendResponse)
      .catch(err => sendResponse({ allowed: false, error: err.message }));
    return true;
  }

  if (message.type === 'OPEN_PAYMENT_PAGE') {
    extpay.openPaymentPage()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'OPEN_LOGIN_PAGE') {
    extpay.openLoginPage()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
