// Clone to Folder - Background Service Worker
// Communicates with the local companion server (native-host/server.js)

const SERVER_URL = 'http://127.0.0.1:9456';

async function readServerResponse(response) {
  if (response.status === 403) {
    throw new Error('The local companion does not allow this extension. Register the companion with this extension ID and restart it.');
  }
  const body = await response.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch (_) {
    throw new Error(`The local companion returned an invalid response (HTTP ${response.status}). Restart the companion and retry.`);
  }
  if (!response.ok) throw new Error(data.error || `Local companion request failed (HTTP ${response.status}).`);
  return data;
}

// Check server health on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Clone to Folder] Extension installed');
  checkServerHealth();
});

async function checkServerHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await readServerResponse(response);
    console.log('[Clone to Folder] Server connected:', data);
    return data.status === 'ok';
  } catch (e) {
    console.warn('[Clone to Folder] Server not running:', e.message);
    return false;
  }
}

// Helper: fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use async wrapper so we can await fetch
  (async () => {
    try {
      if (message.type === 'CHECK_SERVER') {
        const ok = await checkServerHealth();
        sendResponse(ok);
        return;
      }

      if (message.type === 'LAUNCH_SERVER') {
        try {
          // Chrome's Native Messaging auto-launches the native host executable
          const port = chrome.runtime.connectNative('com.git_magager.host');
          let resolved = false;

          port.onMessage.addListener((msg) => {
            if (!resolved) {
              resolved = true;
              if (msg.type === 'health' && msg.serverRunning) {
                sendResponse({ success: true, alreadyRunning: false });
              } else {
                sendResponse({ success: false, error: 'Local server failed to start. Run the Native Host installer again.' });
              }
              port.disconnect();
            }
          });

          port.onDisconnect.addListener(() => {
            if (!resolved) {
              resolved = true;
              const lastError = chrome.runtime.lastError;
              console.error('[Clone to Folder] Native host disconnected:', lastError?.message || 'unknown');
              // Give it a moment for the HTTP server to start, then check
              setTimeout(async () => {
                const ok = await checkServerHealth();
                sendResponse({ success: ok, error: ok ? null : (lastError?.message || 'Server failed to start') });
              }, 2000);
            }
          });

          // Send a health check to the native host
          port.postMessage({ type: 'health' });
        } catch (err) {
          console.error('[Clone to Folder] Failed to launch native host:', err.message);
          sendResponse({ success: false, error: err.message });
        }
        return;
      }

      if (message.type === 'GET_CONFIG') {
        const response = await fetchWithTimeout(`${SERVER_URL}/config`);
        const data = await readServerResponse(response);
        // Return config directly (server returns the config object)
        sendResponse(data);
        return;
      }

      if (message.type === 'SET_CONFIG') {
        const response = await fetchWithTimeout(`${SERVER_URL}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.config)
        });
        const data = await readServerResponse(response);
        sendResponse(data);
        return;
      }

      if (message.type === 'CHOOSE_FOLDER') {
        const response = await fetchWithTimeout(`${SERVER_URL}/choose-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultPath: message.defaultPath })
        }, 0);
        const data = await readServerResponse(response);
        sendResponse(data);
        return;
      }

      if (message.type === 'START_CLONE' || message.type === 'CLONE_STATUS') {
        const starting = message.type === 'START_CLONE';
        const response = await fetchWithTimeout(
          `${SERVER_URL}/clone-jobs${starting ? '' : '/' + encodeURIComponent(message.id)}`,
          starting ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: message.url, directory: message.directory })
          } : {}
        );
        const data = await readServerResponse(response);
        sendResponse({ ...data, success: response.ok });
        return;
      }

      if (message.type === 'CLONE') {
        const response = await fetchWithTimeout(`${SERVER_URL}/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: message.url,
            openTerminal: message.openTerminal,
            directory: message.directory
          })
        });
        const data = await readServerResponse(response);
        sendResponse(data);
        return;
      }

      // Unknown message type
      sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
    } catch (err) {
      console.error('[Clone to Folder] Error handling message:', message.type, err.message);
      if (message.type === 'CHECK_SERVER') {
        sendResponse(false);
      } else {
        sendResponse({ success: false, error: err.message });
      }
    }
  })();

  // Return true to indicate async sendResponse
  return true;
});
