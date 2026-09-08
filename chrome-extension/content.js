// Git Magager - Content Script
// Detects clone URLs on GitHub and GitLab pages and injects Clone button

(function () {
  'use strict';

  // Prevent double injection
  if (window.__gitMagagerInjected) return;
  window.__gitMagagerInjected = true;

  // ─── URL Detection ────────────────────────────────────────

  function detectPlatform() {
    const host = window.location.hostname;
    if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
    if (host === 'gitlab.com' || host.includes('gitlab')) return 'gitlab';
    // Support enterprise GitLab instances (e.g., git.example.com)
    if (host.includes('git.') || host.includes('gitlab')) return 'gitlab';
    return null;
  }

  function getGitHubCloneUrls() {
    const urls = { https: null, ssh: null };

    // Method 1: From the clone buttons on the page
    const httpsInput = document.querySelector('#clone-https-input, input[aria-label*="HTTPS"], input[aria-label*="https"]');
    const sshInput = document.querySelector('#clone-ssh-input, input[aria-label*="SSH"]');

    if (httpsInput) urls.https = httpsInput.value;
    if (sshInput) urls.ssh = sshInput.value;

    // Method 2: From the page URL directly
    if (!urls.https) {
      const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
      if (match) {
        urls.https = `https://github.com/${match[1]}/${match[2]}.git`;
      }
    }
    if (!urls.ssh) {
      const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
      if (match) {
        urls.ssh = `git@github.com:${match[1]}/${match[2]}.git`;
      }
    }

    // Method 3: Try to get from the code button dropdown
    if (!urls.https || !urls.ssh) {
      const cloneUrlElements = document.querySelectorAll('[data-url], [data-clipboard-text]');
      cloneUrlElements.forEach(el => {
        const url = el.getAttribute('data-url') || el.getAttribute('data-clipboard-text');
        if (url) {
          if (url.startsWith('https://')) urls.https = url;
          else if (url.startsWith('git@')) urls.ssh = url;
        }
      });
    }

    return urls;
  }

  function getGitLabCloneUrls() {
    const urls = { https: null, ssh: null };

    // Method 1: From clone dropdown inputs
    const httpsInput = document.querySelector('#project_clone_http, input[name*="http"], .clone-address input[aria-label*="HTTP"]');
    const sshInput = document.querySelector('#project_clone_ssh, input[name*="ssh"], .clone-address input[aria-label*="SSH"]');

    if (httpsInput) urls.https = httpsInput.value;
    if (sshInput) urls.ssh = sshInput.value;

    // Method 2: From page URL
    if (!urls.https) {
      const path = window.location.pathname;
      // Remove trailing /- or /tree/... etc
      const cleanPath = path.replace(/\/(-|tree|blob|raw|blame|commits|pipelines).*$/, '');
      urls.https = `${window.location.origin}${cleanPath}.git`;
    }
    if (!urls.ssh) {
      const path = window.location.pathname;
      const cleanPath = path.replace(/\/(-|tree|blob|raw|blame|commits|pipelines).*$/, '');
      const namespace = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath;
      urls.ssh = `git@${window.location.hostname}:${namespace}.git`;
    }

    return urls;
  }

  function getCloneUrls() {
    const platform = detectPlatform();
    switch (platform) {
      case 'github': return getGitHubCloneUrls();
      case 'gitlab': return getGitLabCloneUrls();
      default: return { https: null, ssh: null };
    }
  }

  function isRepoPage() {
    const platform = detectPlatform();
    if (platform === 'github') {
      // GitHub repo pages match /owner/repo pattern (at least 2 path segments)
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts.length >= 2 && !['features', 'marketplace', 'explore', 'organizations', 'settings', 'notifications'].includes(parts[0]);
    }
    if (platform === 'gitlab') {
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts.length >= 2;
    }
    return false;
  }

  // ─── Server API helpers (via background script) ───

  function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async function checkServer() {
    try {
      const result = await sendMessageToBackground({ type: 'CHECK_SERVER' });
      return result === true;
    } catch (e) {
      return false;
    }
  }

  async function ensureServerRunning() {
    // First check if already running
    if (await checkServer()) return true;

    // Try to auto-launch via native messaging
    try {
      const launchResult = await sendMessageToBackground({ type: 'LAUNCH_SERVER' });
      if (launchResult && launchResult.success) {
        // Wait for HTTP server to be ready (poll)
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (await checkServer()) return true;
        }
      }
    } catch (e) {
      // Launch failed, will fall through to error
    }
    return false;
  }

  // ─── Clone Execution ──────────────────────────────────────

  async function doClone(url) {
    const btn = document.getElementById('git-magager-page-btn');
    if (!btn || btn.disabled) return;
    const originalHTML = btn.innerHTML;

    // Step 0: Check server is running
    btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Connecting...';
    btn.disabled = true;
    btn.classList.add('gm-cloning');
    btn.setAttribute('aria-busy', 'true');

    try {
      const serverOk = await ensureServerRunning();
      if (!serverOk) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('gm-cloning');
        btn.removeAttribute('aria-busy');
        showNotification('Server not running. Click the extension icon and press "Start Server".', 'error');
        return;
      }

      // Step 1: Show folder picker
      btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Choose folder...';

      const folderResult = await sendMessageToBackground({ type: 'CHOOSE_FOLDER' });

      if (!folderResult || !folderResult.success || folderResult.cancelled) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('gm-cloning');
        btn.removeAttribute('aria-busy');
        if (folderResult && !folderResult.cancelled) {
          showNotification('Folder selection failed: ' + (folderResult.error || 'Unknown error'), 'error');
        }
        return;
      }

      const selectedFolder = folderResult.path;

      // Keep the spinner active until Git exits, including for large repositories.
      btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="42 15"/></svg> Cloning…';
      let result = await sendMessageToBackground({
        type: 'START_CLONE', url, directory: selectedFolder
      });
      if (!result || !result.success) throw new Error(result?.error || 'Could not start clone');
      const jobId = result.id;
      while (result.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await sendMessageToBackground({ type: 'CLONE_STATUS', id: jobId });
        if (!result || !result.success) throw new Error(result?.error || 'Could not read clone status');
      }
      if (result.status !== 'complete') throw new Error(result.error || 'Clone failed');

      if (result && result.success) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Cloned!';
        btn.classList.remove('gm-cloning');
        btn.removeAttribute('aria-busy');
        btn.classList.add('gm-success');
        showNotification(`Cloned to ${selectedFolder}`, 'success');
      } else {
        throw new Error((result && result.error) || 'Clone failed');
      }
    } catch (err) {
      console.error('Git Magager clone error:', err);
      btn.classList.remove('gm-cloning');
      btn.removeAttribute('aria-busy');
      btn.classList.add('gm-error');
      if (err.message === 'Failed to fetch') {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg> No Server';
        showNotification('Server not running. Click the extension icon and press "Start Server".', 'error');
      } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg> Failed';
        showNotification(`Clone failed: ${err.message}`, 'error');
      }
    }

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.classList.remove('gm-cloning', 'gm-success', 'gm-error');
    }, 3000);
  }

  // ─── Notification ──────────────────────────────────────────

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gm-notification gm-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add('gm-notification-show');
    });

    setTimeout(() => {
      notification.classList.remove('gm-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ─── GitHub-specific: Inject into page UI ─────────────────

  function injectGitHubPageButton() {
    if (detectPlatform() !== 'github') return;
    if (!isRepoPage()) return;
    if (document.getElementById('git-magager-page-btn')) return;

    const urls = getCloneUrls();
    if (!urls.https && !urls.ssh) return;

    // Try to find the "Code" button area and add our button next to it
    const actionBar = document.querySelector('.file-navigation .d-flex, .react-directory-header-name-and-utils, [data-testid="repo-header-actions"]');
    
    if (actionBar) {
      const btn = document.createElement('button');
      btn.id = 'git-magager-page-btn';
      btn.className = 'gm-page-btn';
      btn.innerHTML = `
        <img class="gm-gift-icon" src="${chrome.runtime.getURL('icons/icon48.png')}" width="16" height="16" alt="" aria-hidden="true" />
        Instant Clone
      `;

      btn.addEventListener('click', () => {
        // Default to HTTPS, or SSH if that's what's available
        const url = urls.https || urls.ssh;
        if (url) doClone(url);
      });

      actionBar.appendChild(btn);
    }
  }

  // ─── Init ─────────────────────────────────────────────────

  function init() {
    console.log('[Git Magager] Initializing...');
    injectGitHubPageButton();
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-inject on DOM changes (GitHub uses SPA navigation)
  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      injectGitHubPageButton();
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Also re-inject on navigation events (for SPA)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(init, 800);
    }
  }, 1000);
})();
