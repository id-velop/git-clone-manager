// Clone Manager - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const cloneSection = document.getElementById('clone-section');
  const noServer = document.getElementById('no-server');
  const startingServer = document.getElementById('starting-server');
  const startServerBtn = document.getElementById('start-server-btn');
  const startError = document.getElementById('start-error');
  const cloneUrlInput = document.getElementById('clone-url');
  const cloneBtn = document.getElementById('clone-btn');
  const sshUrlInput = document.getElementById('clone-ssh-url');
  const sshCloneBtn = document.getElementById('clone-ssh-btn');
  const openTerminalToggle = document.getElementById('open-terminal');
  const optionsLink = document.getElementById('options-link');
  // Try to get current tab's URL to pre-fill
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);

      // GitHub
      if (url.hostname === 'github.com' || url.hostname.endsWith('.github.com')) {
        const match = url.pathname.match(/^\/([^/]+)\/([^/]+)/);
        if (match && !['features', 'marketplace', 'explore', 'settings'].includes(match[1])) {
          cloneUrlInput.value = `https://github.com/${match[1]}/${match[2]}.git`;
        }
      }

      // GitLab (including enterprise instances)
      if (url.hostname.includes('gitlab') || url.hostname.includes('git.')) {
        const cleanPath = url.pathname.split('/-/')[0].replace(/\/+$/, '').replace(/\.git$/, '');
        const parts = cleanPath.split('/').filter(Boolean);
        if (parts.length >= 2 && !['users', 'groups', 'dashboard', 'explore', 'admin', '-', 'search', 'help', 'profile'].includes(parts[0])) {
          cloneUrlInput.value = `${url.origin}${cleanPath}.git`;
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // Check server health
  async function checkAndShowServerStatus() {
    try {
      const connected = await chrome.runtime.sendMessage({ type: 'CHECK_SERVER' });
      if (connected) {
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
        statusText.textContent = 'Server connected';
        cloneSection.style.display = 'block';
        noServer.style.display = 'none';
        startingServer.style.display = 'none';

        // Load config
        const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
        if (config && !config.error) {
          openTerminalToggle.checked = config.openInTerminal === true;
        }
        return true;
      }
    } catch (e) {
      // Server not reachable
    }
    return false;
  }

  const isConnected = await checkAndShowServerStatus();
  if (!isConnected) {
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Server not running';
    cloneSection.style.display = 'none';
    noServer.style.display = 'block';
    startingServer.style.display = 'none';
  }

  // Start Server button
  startServerBtn.addEventListener('click', async () => {
    startServerBtn.disabled = true;
    startServerBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" class="spin"/>
      </svg>
      Starting...
    `;
    startError.style.display = 'none';

    // Show loading UI
    noServer.style.display = 'none';
    startingServer.style.display = 'block';
    statusText.textContent = 'Launching...';

    try {
      const result = await chrome.runtime.sendMessage({ type: 'LAUNCH_SERVER' });

      if (result && result.success) {
        // Poll for HTTP server to be ready
        let connected = false;
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          const ok = await chrome.runtime.sendMessage({ type: 'CHECK_SERVER' });
          if (ok) {
            connected = true;
            break;
          }
        }

        if (connected) {
          await checkAndShowServerStatus();
        } else {
          throw new Error('Server started but not responding on HTTP. Please check manually.');
        }
      } else {
        throw new Error(result?.error || 'Failed to launch server');
      }
    } catch (err) {
      // Show error and revert to no-server view
      startingServer.style.display = 'none';
      noServer.style.display = 'block';
      startError.textContent = /native messaging host not found|access to the specified native messaging host/i.test(err.message || '')
        ? 'Install the Clone Manager companion for this extension, then retry.'
        : (err.message || 'Failed to start server');
      startError.style.display = 'block';
      statusText.textContent = 'Server not running';
    }

    // Reset button
    startServerBtn.disabled = false;
    startServerBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M8 5v14l11-7z"/>
      </svg>
        Connect / Retry
    `;
  });

  // The popup may close while the user runs the installer. Retry on every open
  // and poll while visible, so setup also completes without another button click.
  let connecting = false;
  async function autoConnect() {
    if (connecting || startServerBtn.disabled || cloneSection.style.display === 'block') return;
    connecting = true;
    try {
      if (await checkAndShowServerStatus()) return;
      const result = await chrome.runtime.sendMessage({ type: 'LAUNCH_SERVER' });
      if (result?.success) await checkAndShowServerStatus();
    } catch (_) {
      // Installation guidance remains visible until the service is available.
    } finally {
      connecting = false;
    }
  }
  if (!isConnected) void autoConnect();
  const connectionTimer = setInterval(autoConnect, 5000);
  window.addEventListener('unload', () => clearInterval(connectionTimer));

  // Show both clone URLs at once; manual edits remain independent.
  const initialHttps = cloneUrlInput.value.match(/^https:\/\/([^/]+)\/(.+)$/);
  if (initialHttps) sshUrlInput.value = `git@${initialHttps[1]}:${initialHttps[2]}`;

  // Persistent Instant Clone preference; independent of server availability.
  const protocolSelect = document.getElementById('default-clone-protocol');
  const protocolStatus = document.getElementById('protocol-save-status');
  let savedProtocol = '';
  try {
    const stored = await chrome.storage.local.get('cloneProtocol');
    savedProtocol = ['https', 'ssh'].includes(stored.cloneProtocol) ? stored.cloneProtocol : '';
    protocolSelect.value = savedProtocol;
  } catch (_) {
    protocolStatus.textContent = 'Could not read your preference. Reopen the extension to retry.';
  }
  protocolSelect.addEventListener('change', async () => {
    protocolSelect.disabled = true;
    try {
      const protocol = protocolSelect.value;
      await chrome.storage.local.set({ cloneProtocol: protocol });
      savedProtocol = protocol;
      protocolStatus.textContent = protocol ? `Saved. Instant Clone will use ${protocol.toUpperCase()}.` : 'Saved. Instant Clone will ask every time.';
    } catch (_) {
      protocolSelect.value = savedProtocol;
      protocolStatus.textContent = 'Could not save. Please try again.';
    } finally {
      protocolSelect.disabled = false;
    }
  });

  // Each action uses its own address, regardless of the Instant Clone default.
  const cloneActions = [[cloneBtn, cloneUrlInput], [sshCloneBtn, sshUrlInput]];
  for (const [cloneBtn, cloneUrlInput] of cloneActions) {
    const idleHTML = cloneBtn.innerHTML;
    cloneBtn.addEventListener('click', async () => {
      if (cloneActions.some(([button]) => button.disabled)) return;
      const url = cloneUrlInput.value.trim();
      if (!url) {
        cloneUrlInput.style.borderColor = '#ef4444';
        setTimeout(() => { cloneUrlInput.style.borderColor = ''; }, 2000);
        return;
      }

      const openTerminal = openTerminalToggle.checked;
      cloneActions.forEach(([button]) => { button.disabled = true; });
      cloneBtn.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/>
        </svg>
        Cloning...
      `;

      try {
        const result = await chrome.runtime.sendMessage({
          type: 'CLONE',
          url,
          openTerminal
        });

        if (result && result.success) {
          cloneBtn.classList.add('success');
          cloneBtn.innerHTML = idleHTML;
        } else {
          throw new Error(result?.error || 'Clone failed');
        }
      } catch (err) {
        cloneBtn.classList.add('error');
        cloneBtn.textContent = `Failed: ${err.message}`;
      }

      setTimeout(() => {
        cloneActions.forEach(([button]) => { button.disabled = false; });
        cloneBtn.classList.remove('success', 'error');
        cloneBtn.innerHTML = idleHTML;
      }, 3000);
    });
  }

  // Options link
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});

// Spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin { animation: spin 1s linear infinite; }
`;
document.head.appendChild(style);
