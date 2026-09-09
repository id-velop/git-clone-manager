// Clone to Folder - Content Script
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
      const cleanPath = path.split('/-/')[0].replace(/\/+$/, '').replace(/\.git$/, '');
      urls.https = `${window.location.origin}${cleanPath}.git`;
    }
    if (!urls.ssh) {
      const path = window.location.pathname;
      const cleanPath = path.split('/-/')[0].replace(/\/+$/, '').replace(/\.git$/, '');
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
      if (['users', 'groups', 'dashboard', 'explore', 'admin', '-', 'search', 'help', 'profile'].includes(parts[0])) return false;
      return parts.length >= 2 && Boolean(document.querySelector(
        '[data-project-id], [data-project-full-path], #project_clone_http, #js-repo-code-dropdown, .project-repo-buttons, .repository-content'
      ));
    }
    return false;
  }

  // ─── Server API helpers (via background script) ───

  function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(/context invalidated|Receiving end does not exist|message port closed/i.test(chrome.runtime.lastError.message)
            ? '扩展已更新，请刷新当前页面后重试。' : chrome.runtime.lastError.message));
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
      throw new Error('无法连接扩展，请刷新当前页面后重试。');
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

  function chooseCloneProtocol(urls) {
    return new Promise(resolve => {
      const anchor = document.getElementById('git-magager-page-btn');
      if (!anchor) return resolve(null);
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;z-index:2147483647;display:block;';
      const root = host.attachShadow({ mode: 'closed' });
      root.innerHTML = `
        <style>
          * { box-sizing: border-box; }
          .popup { width: min(300px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto; padding: 16px; border: 1px solid #e5e5e5; border-radius: 28px; background: #fff; color: #171717; font: 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif; box-shadow: none; }
          .eyebrow { margin: 0 0 3px; color: #333333; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
          h2 { margin: 0 0 14px; font-size: 15px; letter-spacing: -.01em; }
          p { margin: 0; color: #737373; }
          .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
          button { padding: 11px 12px; border: 1px solid #d4d4d4; border-radius: 20px; background: #f5f5f5; color: #171717; font: inherit; font-weight: 800; cursor: pointer; }
          button:hover:not(:disabled) { border-color: #171717; background: #dff7f3; color: #075c58; }
          button:active:not(:disabled) { background: #e5e5e5; }
          button:focus-visible { outline: 3px solid #737373; outline-offset: 3px; }
          button:disabled { opacity: .4; cursor: not-allowed; }
          label { display: flex; gap: 8px; align-items: center; font-size: 12px; font-weight: 650; }
          input { accent-color: #07BEB8; }
          .hint { margin-top: 7px; font-size: 11px; }
          @media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; } }
        </style>
        <div class="popup" role="dialog" aria-modal="false" aria-labelledby="title">
          <p class="eyebrow">Instant Clone</p>
          <h2 id="title">How should we connect?</h2>
          <div class="choices"><button type="button" data-protocol="https">HTTPS</button><button type="button" data-protocol="ssh">SSH</button></div>
          <label><input id="remember" type="checkbox"> Remember my choice</label>
          <p class="hint">Change this later from the extension popup.</p>
        </div>`;
      const previousFocus = document.activeElement;
      let finished = false;
      function finish(result, restoreFocus = true) {
        if (finished) return;
        finished = true;
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onKeydown, true);
        document.removeEventListener('focusin', onFocusOutside);
        window.removeEventListener('scroll', position, true);
        window.removeEventListener('resize', position);
        anchor.removeAttribute('aria-expanded');
        anchor.removeAttribute('aria-haspopup');
        host.remove();
        if (restoreFocus) previousFocus?.focus();
        resolve(result);
      }
      function onOutside(event) {
        if (!event.composedPath().includes(host) && !anchor.contains(event.target)) finish(null, false);
      }
      function onFocusOutside(event) {
        if (!event.composedPath().includes(host) && !anchor.contains(event.target)) finish(null, false);
      }
      function onKeydown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(null);
        }
      }
      function position() {
        if (!anchor.isConnected) return finish(null, false);
        const rect = anchor.getBoundingClientRect();
        const panel = root.querySelector('.popup').getBoundingClientRect();
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - panel.width - 12));
        const below = rect.bottom + 8;
        const top = below + panel.height <= window.innerHeight - 12
          ? below : Math.max(12, rect.top - panel.height - 8);
        host.style.left = `${left}px`;
        host.style.top = `${top}px`;
      }
      root.querySelectorAll('[data-protocol]').forEach(button => {
        button.disabled = !urls[button.dataset.protocol];
        button.addEventListener('click', () => finish({
          protocol: button.dataset.protocol,
          remember: root.querySelector('#remember').checked
        }));
      });
      document.body.appendChild(host);
      anchor.setAttribute('aria-haspopup', 'dialog');
      anchor.setAttribute('aria-expanded', 'true');
      position();
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('focusin', onFocusOutside);
      window.addEventListener('scroll', position, true);
      window.addEventListener('resize', position);
      root.querySelector('[data-protocol]:not(:disabled)')?.focus();
    });
  }

  let choosingProtocol = false;
  async function startCloneWithPreference() {
    if (choosingProtocol || document.getElementById('git-magager-page-btn')?.disabled) return;
    choosingProtocol = true;
    const pageUrl = window.location.href;
    try {
      if (!await checkServer()) {
        const opened = await sendMessageToBackground({ type: 'OPEN_SETUP' });
        if (!opened?.success) throw new Error('Click Clone to Folder in the Chrome toolbar to install the companion.');
        return;
      }
      const urls = getCloneUrls();
      const { cloneProtocol } = await chrome.storage.local.get('cloneProtocol');
      let protocol = cloneProtocol;
      if (!['https', 'ssh'].includes(protocol)) {
        const choice = await chooseCloneProtocol(urls);
        if (!choice || window.location.href !== pageUrl) return;
        protocol = choice.protocol;
        if (choice.remember) await chrome.storage.local.set({ cloneProtocol: protocol });
      }
      if (window.location.href !== pageUrl) return;
      if (!urls[protocol]) throw new Error(`No ${protocol.toUpperCase()} clone URL is available for this repository.`);
      await doClone(urls[protocol]);
    } catch (error) {
      showNotification(error.message || 'Could not select clone method. Please reload the extension.', 'error');
    } finally {
      choosingProtocol = false;
    }
  }

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
        const opened = await sendMessageToBackground({ type: 'OPEN_SETUP' });
        if (!opened?.success) showNotification('Click Clone to Folder in the Chrome toolbar to install the companion.', 'error');
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
      console.error('Clone to Folder clone error:', err);
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

  // ─── Inject into repository page UI ──────────────────────

  function injectPageButton() {
    if (!isRepoPage()) {
      document.getElementById('git-magager-page-btn')?.remove();
      return;
    }
    if (document.getElementById('git-magager-page-btn')) return;

    const urls = getCloneUrls();
    if (!urls.https && !urls.ssh) return;

    // Try to find the "Code" button area and add our button next to it
    const actionBar = detectPlatform() === 'github'
      ? document.querySelector('.file-navigation .d-flex, .react-directory-header-name-and-utils, [data-testid="repo-header-actions"]')
      : document.querySelector('.project-repo-buttons, .repo-buttons, .tree-controls, .project-header .project-actions')
        || document.querySelector('#js-repo-code-dropdown, [data-testid="code-dropdown"]')?.parentElement;
    
    if (actionBar) {
      const btn = document.createElement('button');
      btn.id = 'git-magager-page-btn';
      btn.type = 'button';
      btn.className = 'gm-page-btn';
      if (detectPlatform() === 'gitlab') {
        btn.className += ' gm-page-btn-gitlab';
        const reference = actionBar.querySelector('button.btn, a.btn, .gl-button, button');
        if (reference) {
          const metrics = window.getComputedStyle(reference);
          const height = reference.getBoundingClientRect().height;
          if (height > 0) btn.style.setProperty('--gm-button-height', `${height}px`);
          btn.style.setProperty('--gm-button-font-size', metrics.fontSize);
          btn.style.setProperty('--gm-button-font-weight', metrics.fontWeight);
          btn.style.setProperty('--gm-button-radius', metrics.borderRadius);
        }
      }
      btn.innerHTML = `
        <svg class="gm-clone-icon" viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><path d="M9 2v9m0 0 3.5-3.5M9 11 5.5 7.5M3.5 15h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Instant Clone
      `;

      btn.addEventListener('click', startCloneWithPreference);

      actionBar.appendChild(btn);
    }
  }

  // ─── Init ─────────────────────────────────────────────────

  function init() {
    console.log('[Clone to Folder] Initializing...');
    injectPageButton();
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
      injectPageButton();
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
