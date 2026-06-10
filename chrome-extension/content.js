// Git Magager - Content Script
// Detects clone URLs on GitHub and GitLab pages and injects Clone button

(function () {
  'use strict';

  const SERVER_URL = 'http://127.0.0.1:9456';

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

  // ─── Server API helpers (direct fetch, no background proxy) ───

  async function serverGet(path) {
    const res = await fetch(`${SERVER_URL}${path}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
  }

  async function serverPost(path, body) {
    const res = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
  }

  async function checkServer() {
    try {
      const data = await serverGet('/health');
      return data.status === 'ok';
    } catch (e) {
      return false;
    }
  }

  // ─── Clone Execution ──────────────────────────────────────

  async function doClone(url) {
    const btn = document.getElementById('git-magager-clone-btn') || document.getElementById('git-magager-page-btn');
    if (!btn) return;
    const originalHTML = btn.innerHTML;

    // Step 0: Check server is running
    btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Connecting...';
    btn.disabled = true;
    btn.classList.add('gm-cloning');

    try {
      const serverOk = await checkServer();
      if (!serverOk) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('gm-cloning');
        showNotification('Server not running. Start it: cd native-host && node server.js', 'error');
        return;
      }

      // Step 1: Show folder picker
      btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Choose folder...';

      const folderResult = await serverPost('/choose-folder', {});

      if (!folderResult || !folderResult.success || folderResult.cancelled) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('gm-cloning');
        if (folderResult && !folderResult.cancelled) {
          showNotification('Folder selection failed: ' + (folderResult.error || 'Unknown error'), 'error');
        }
        return;
      }

      const selectedFolder = folderResult.path;

      // Step 2: Clone to the selected folder
      btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Cloning to ' + selectedFolder.split('/').pop() + '...';

      const result = await serverPost('/clone', { url, openTerminal: true, directory: selectedFolder });

      if (result && result.success) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Cloned!';
        btn.classList.remove('gm-cloning');
        btn.classList.add('gm-success');
        showNotification(`Cloned to ${selectedFolder}`, 'success');
      } else {
        throw new Error((result && result.error) || 'Clone failed');
      }
    } catch (err) {
      console.error('Git Magager clone error:', err);
      btn.classList.remove('gm-cloning');
      btn.classList.add('gm-error');
      if (err.message === 'Failed to fetch') {
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg> No Server';
        showNotification('Server not running! Run: cd native-host && node server.js', 'error');
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

  // ─── Button Injection ─────────────────────────────────────

  function injectCloneButton() {
    if (!isRepoPage()) return;
    if (document.getElementById('git-magager-clone-btn')) return;

    const urls = getCloneUrls();
    if (!urls.https && !urls.ssh) return;

    // Create the floating clone button
    const btn = document.createElement('button');
    btn.id = 'git-magager-clone-btn';
    btn.className = 'gm-clone-btn';
    btn.title = `Clone with Git Magager\nHTTPS: ${urls.https || 'N/A'}\nSSH: ${urls.ssh || 'N/A'}`;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 12 7.4l3.38 4.6L17 10.83 14.92 8H20v6z"/>
      </svg>
      <span>Clone</span>
    `;

    // Create dropdown for HTTPS/SSH selection
    const dropdown = document.createElement('div');
    dropdown.className = 'gm-dropdown';
    dropdown.id = 'git-magager-dropdown';

    if (urls.https) {
      const httpsBtn = document.createElement('button');
      httpsBtn.className = 'gm-dropdown-item';
      httpsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12 1C5.93 1 1 5.93 1 12s4.93 11 11 11 11-4.93 11-11S18.07 1 12 1zm0 20c-4.96 0-9-4.04-9-9s4.04-9 9-9 9 4.04 9 9-4.04 9-9 9zm4.5-12.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5S14.17 7 15 7s1.5.67 1.5 1.5zM9 9.5C9 10.33 8.33 11 7.5 11S6 10.33 6 9.5 6.67 8 7.5 8 9 8.67 9 9.5zm6.5 4.5c-.73 0-1.41-.2-2-.55v.05c0 1.94-1.57 3.5-3.5 3.5S6.5 15.44 6.5 13.5v-.05c.59.35 1.27.55 2 .55h7z"/></svg>
        HTTPS Clone
      `;
      httpsBtn.title = urls.https;
      httpsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('gm-dropdown-show');
        doClone(urls.https);
      });
      dropdown.appendChild(httpsBtn);
    }

    if (urls.ssh) {
      const sshBtn = document.createElement('button');
      sshBtn.className = 'gm-dropdown-item';
      sshBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>
        SSH Clone
      `;
      sshBtn.title = urls.ssh;
      sshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('gm-dropdown-show');
        doClone(urls.ssh);
      });
      dropdown.appendChild(sshBtn);
    }

    // Toggle dropdown on click
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('gm-dropdown-show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dropdown.classList.remove('gm-dropdown-show');
    });

    // Insert button into the page
    const container = document.createElement('div');
    container.id = 'git-magager-container';
    container.appendChild(btn);
    container.appendChild(dropdown);
    document.body.appendChild(container);
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
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/>
        </svg>
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
    injectCloneButton();
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
      injectCloneButton();
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
