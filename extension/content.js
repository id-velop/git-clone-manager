// Clone Manager - Content Script
// Detects clone URLs on GitHub and GitLab pages and injects Clone button

(function () {
  'use strict';

  // Prevent double injection
  if (window.__cloneManagerInjected) return;
  window.__cloneManagerInjected = true;

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

  // ─── Clone Execution ──────────────────────────────────────

  function brandIconMarkup() {
    const iconUrl = chrome.runtime.getURL('icons/clone-manager.svg');
    return `<img class="gm-brand-icon" src="${iconUrl}" alt="">`;
  }

  function setBusyLabel(btn, label) {
    btn.innerHTML = '<svg class="gm-spin" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg><span></span>';
    btn.querySelector('span').textContent = label;
  }

  async function doClone(url, triggerButton) {
    const btn = triggerButton || document.getElementById('clone-manager-clone-btn') || document.getElementById('clone-manager-page-btn');
    if (!btn) return;
    const originalHTML = btn.innerHTML;

    let claim;
    try {
      claim = await chrome.runtime.sendMessage({ type: 'CLAIM_CLONE_USE' });
      if (claim?.error) throw new Error(claim.error);
    } catch (error) {
      showNotification(`Could not check access: ${error.message}`, 'error');
      return;
    }

    if (!claim?.allowed) {
      showUpgradeNotification();
      return;
    }

    setBusyLabel(btn, 'Choose folder...');
    btn.disabled = true;
    btn.classList.add('gm-cloning');

    try {
      const result = await globalThis.CloneManagerBrowser.cloneRepository(url, {
        onStatus(label) {
          setBusyLabel(btn, label);
        }
      });

      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> Cloned!';
      btn.classList.remove('gm-cloning');
      btn.classList.add('gm-success');
      const trialMessage = claim.paid
        ? ''
        : ` · ${claim.remainingUses} free clone${claim.remainingUses === 1 ? '' : 's'} left`;
      showNotification(`Cloned to ${result.destinationName}${trialMessage}`, 'success');
    } catch (err) {
      console.error('Clone Manager clone error:', err);
      if (err.name === 'AbortError') {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('gm-cloning');
        return;
      }

      btn.classList.remove('gm-cloning');
      btn.classList.add('gm-error');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg> Failed';
      showNotification(`Clone failed: ${err.message}`, 'error');
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

  function showUpgradeNotification() {
    const notification = document.createElement('div');
    notification.className = 'gm-notification gm-notification-paywall';

    const message = document.createElement('span');
    message.textContent = 'Free trial ended after 5 clones.';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Get Pro · $4.99 once';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Opening checkout...';
      try {
        const result = await chrome.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
        if (!result?.success) throw new Error(result?.error || 'Could not open checkout');
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Checkout unavailable · Try again';
      }
    });

    notification.append(message, button);
    document.body.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add('gm-notification-show'));

    setTimeout(() => {
      notification.classList.remove('gm-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 10000);
  }

  // ─── Button Injection ─────────────────────────────────────

  function injectCloneButton() {
    if (!isRepoPage()) return;
    if (document.getElementById('clone-manager-clone-btn')) return;

    const urls = getCloneUrls();
    if (!urls.https && !urls.ssh) return;

    // Create the floating clone button
    const btn = document.createElement('button');
    btn.id = 'clone-manager-clone-btn';
    btn.className = 'gm-clone-btn';
    btn.title = `Clone with Clone Manager\nHTTPS: ${urls.https || 'N/A'}`;
    btn.innerHTML = `
      ${brandIconMarkup()}
      <span>Clone</span>
    `;

    // Create the HTTPS clone action.
    const dropdown = document.createElement('div');
    dropdown.className = 'gm-dropdown';
    dropdown.id = 'clone-manager-dropdown';

    if (urls.https) {
      const httpsBtn = document.createElement('button');
      httpsBtn.className = 'gm-dropdown-item';
      httpsBtn.innerHTML = `
        ${brandIconMarkup()}
        HTTPS Clone
      `;
      httpsBtn.title = urls.https;
      httpsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('gm-dropdown-show');
        doClone(urls.https, btn);
      });
      dropdown.appendChild(httpsBtn);
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
    container.id = 'clone-manager-container';
    container.appendChild(btn);
    container.appendChild(dropdown);
    document.body.appendChild(container);
  }

  // ─── GitHub-specific: Inject into page UI ─────────────────

  function injectGitHubPageButton() {
    if (detectPlatform() !== 'github') return;
    if (!isRepoPage()) return;
    if (document.getElementById('clone-manager-page-btn')) return;

    const urls = getCloneUrls();
    if (!urls.https && !urls.ssh) return;

    // Try to find the "Code" button area and add our button next to it
    const actionBar = document.querySelector('.file-navigation .d-flex, .react-directory-header-name-and-utils, [data-testid="repo-header-actions"]');
    
    if (actionBar) {
      const btn = document.createElement('button');
      btn.id = 'clone-manager-page-btn';
      btn.className = 'gm-page-btn';
      btn.innerHTML = `
        ${brandIconMarkup()}
        Instant Clone
      `;

      btn.addEventListener('click', () => {
        // Default to HTTPS, or SSH if that's what's available
        const url = urls.https || urls.ssh;
        if (url) doClone(url, btn);
      });

      actionBar.appendChild(btn);
    }
  }

  // ─── Init ─────────────────────────────────────────────────

  function init() {
    console.log('[Clone Manager] Initializing...');
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
