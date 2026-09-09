// Clone to Folder - Popup Script

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
  const protocolSelect = document.getElementById('default-clone-protocol');
  const protocolStatus = document.getElementById('protocol-save-status');
  const protocolTabs = [...document.querySelectorAll('[data-protocol-tab]')];
  const protocolPanels = [...document.querySelectorAll('[data-protocol-panel]')];

  function selectProtocolPanel(protocol, moveFocus = false) {
    for (const tab of protocolTabs) {
      const selected = tab.dataset.protocolTab === protocol;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    }
    for (const panel of protocolPanels) panel.hidden = panel.dataset.protocolPanel !== protocol;
  }

  protocolTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectProtocolPanel(tab.dataset.protocolTab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + protocolTabs.length) % protocolTabs.length;
      selectProtocolPanel(protocolTabs[nextIndex].dataset.protocolTab, true);
    });
  });

  // Prefill clone addresses from the active repository page.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      if (url.hostname === 'github.com' || url.hostname.endsWith('.github.com')) {
        const match = url.pathname.match(/^\/([^/]+)\/([^/]+)/);
        if (match && !['features', 'marketplace', 'explore', 'settings'].includes(match[1])) {
          cloneUrlInput.value = `https://github.com/${match[1]}/${match[2]}.git`;
        }
      }
      if (url.hostname.includes('gitlab') || url.hostname.includes('git.')) {
        const cleanPath = url.pathname.split('/-/')[0].replace(/\/+$/, '').replace(/\.git$/, '');
        const parts = cleanPath.split('/').filter(Boolean);
        if (parts.length >= 2 && !['users', 'groups', 'dashboard', 'explore', 'admin', '-', 'search', 'help', 'profile'].includes(parts[0])) {
          cloneUrlInput.value = `${url.origin}${cleanPath}.git`;
        }
      }
    }
  } catch (_) {
    // The popup remains usable with manually entered addresses.
  }

  const initialHttps = cloneUrlInput.value.match(/^https:\/\/([^/]+)\/(.+)$/);
  if (initialHttps) sshUrlInput.value = `git@${initialHttps[1]}:${initialHttps[2]}`;

  async function checkAndShowServerStatus() {
    try {
      const connected = await chrome.runtime.sendMessage({ type: 'CHECK_SERVER' });
      if (connected) {
        statusDot.classList.remove('disconnected');
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
        cloneSection.hidden = false;
        noServer.hidden = true;
        startingServer.hidden = true;
        const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
        if (config && !config.error) openTerminalToggle.checked = config.openInTerminal === true;
        return true;
      }
    } catch (_) {
      // Connection guidance is shown below.
    }
    return false;
  }

  function showDisconnected() {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Offline';
    cloneSection.hidden = true;
    noServer.hidden = false;
    startingServer.hidden = true;
  }

  const isConnected = await checkAndShowServerStatus();
  if (!isConnected) showDisconnected();

  const idleConnectHtml = startServerBtn.innerHTML;
  startServerBtn.addEventListener('click', async () => {
    startServerBtn.disabled = true;
    startServerBtn.setAttribute('aria-busy', 'true');
    startServerBtn.textContent = 'Connecting…';
    startError.hidden = true;
    noServer.hidden = true;
    startingServer.hidden = false;
    statusText.textContent = 'Starting';

    try {
      const result = await chrome.runtime.sendMessage({ type: 'LAUNCH_SERVER' });
      if (!result?.success) throw new Error(result?.error || 'Failed to launch server');

      let connected = false;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (await chrome.runtime.sendMessage({ type: 'CHECK_SERVER' })) {
          connected = true;
          break;
        }
      }
      if (!connected) throw new Error('The companion started but did not respond.');
      await checkAndShowServerStatus();
    } catch (error) {
      showDisconnected();
      startError.textContent = /native messaging host not found|access to the specified native messaging host/i.test(error.message || '')
        ? 'Install the Clone to Folder companion for this extension, then retry.'
        : (error.message || 'Failed to start the companion.');
      startError.hidden = false;
    } finally {
      startServerBtn.disabled = false;
      startServerBtn.removeAttribute('aria-busy');
      startServerBtn.innerHTML = idleConnectHtml;
    }
  });

  let connecting = false;
  async function autoConnect() {
    if (connecting || startServerBtn.disabled || !cloneSection.hidden) return;
    connecting = true;
    try {
      if (await checkAndShowServerStatus()) return;
      const result = await chrome.runtime.sendMessage({ type: 'LAUNCH_SERVER' });
      if (result?.success) await checkAndShowServerStatus();
    } catch (_) {
      // Keep the connection guidance visible.
    } finally {
      connecting = false;
    }
  }
  if (!isConnected) void autoConnect();
  const connectionTimer = setInterval(autoConnect, 5000);
  window.addEventListener('unload', () => clearInterval(connectionTimer));

  let savedProtocol = '';
  try {
    const stored = await chrome.storage.local.get('cloneProtocol');
    savedProtocol = ['https', 'ssh'].includes(stored.cloneProtocol) ? stored.cloneProtocol : '';
    protocolSelect.value = savedProtocol;
    selectProtocolPanel(savedProtocol || 'https');
  } catch (_) {
    protocolStatus.textContent = 'Could not read your preference. Reopen the extension to retry.';
  }

  protocolSelect.addEventListener('change', async () => {
    protocolSelect.disabled = true;
    try {
      const protocol = protocolSelect.value;
      await chrome.storage.local.set({ cloneProtocol: protocol });
      savedProtocol = protocol;
      if (protocol) selectProtocolPanel(protocol);
      protocolStatus.textContent = protocol ? `Saved. Instant Clone will use ${protocol.toUpperCase()}.` : 'Saved. Instant Clone will ask every time.';
    } catch (_) {
      protocolSelect.value = savedProtocol;
      protocolStatus.textContent = 'Could not save. Please try again.';
    } finally {
      protocolSelect.disabled = false;
    }
  });

  const cloneActions = [[cloneBtn, cloneUrlInput], [sshCloneBtn, sshUrlInput]];
  for (const [actionButton, addressInput] of cloneActions) {
    const idleHtml = actionButton.innerHTML;
    actionButton.addEventListener('click', async () => {
      if (cloneActions.some(([button]) => button.disabled)) return;
      const url = addressInput.value.trim();
      if (!url) {
        addressInput.classList.add('invalid');
        addressInput.focus();
        setTimeout(() => addressInput.classList.remove('invalid'), 2000);
        return;
      }

      cloneActions.forEach(([button]) => { button.disabled = true; });
      actionButton.setAttribute('aria-busy', 'true');
      actionButton.innerHTML = '<span class="spin" aria-hidden="true">↻</span><span>Cloning repository…</span>';

      try {
        const result = await chrome.runtime.sendMessage({ type: 'CLONE', url, openTerminal: openTerminalToggle.checked });
        if (!result?.success) throw new Error(result?.error || 'Clone failed');
        actionButton.classList.add('success');
        actionButton.textContent = 'Repository cloned';
      } catch (error) {
        actionButton.classList.add('error');
        actionButton.textContent = `Clone failed: ${error.message}`;
      }

      setTimeout(() => {
        cloneActions.forEach(([button]) => { button.disabled = false; });
        actionButton.classList.remove('success', 'error');
        actionButton.removeAttribute('aria-busy');
        actionButton.innerHTML = idleHtml;
      }, 3000);
    });
  }

  optionsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());
});
