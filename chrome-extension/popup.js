// Git Magager - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const cloneSection = document.getElementById('clone-section');
  const noServer = document.getElementById('no-server');
  const cloneUrlInput = document.getElementById('clone-url');
  const cloneBtn = document.getElementById('clone-btn');
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
        const cleanPath = url.pathname.replace(/\/(tree|blob|raw|blame|commits|pipelines).*$/, '');
        cloneUrlInput.value = `${url.origin}${cleanPath}.git`;
      }
    }
  } catch (e) {
    // Ignore
  }

  // Check server health
  try {
    const connected = await chrome.runtime.sendMessage({ type: 'CHECK_SERVER' });
    if (connected) {
      statusDot.classList.add('connected');
      statusText.textContent = 'Server connected';
      cloneSection.style.display = 'block';
      noServer.style.display = 'none';

      // Load config
      const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      if (config && !config.error) {
        openTerminalToggle.checked = config.openInTerminal !== false;
      }
    } else {
      throw new Error('Not connected');
    }
  } catch (e) {
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Server not running';
    cloneSection.style.display = 'none';
    noServer.style.display = 'block';
  }

  // Handle HTTPS/SSH toggle
  document.querySelectorAll('input[name="clone-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const currentUrl = cloneUrlInput.value;
      if (radio.value === 'ssh') {
        // Convert HTTPS to SSH
        const githubMatch = currentUrl.match(/https:\/\/github\.com\/(.+)\.git/);
        if (githubMatch) {
          cloneUrlInput.value = `git@github.com:${githubMatch[1]}.git`;
          return;
        }
        const gitlabMatch = currentUrl.match(/https:\/\/([^/]+)\/(.+)\.git/);
        if (gitlabMatch) {
          cloneUrlInput.value = `git@${gitlabMatch[1]}:${gitlabMatch[2]}.git`;
          return;
        }
      } else {
        // Convert SSH to HTTPS
        const githubMatch = currentUrl.match(/git@github\.com:(.+)\.git/);
        if (githubMatch) {
          cloneUrlInput.value = `https://github.com/${githubMatch[1]}.git`;
          return;
        }
        const gitlabMatch = currentUrl.match(/git@([^:]+):(.+)\.git/);
        if (gitlabMatch) {
          cloneUrlInput.value = `https://${gitlabMatch[1]}/${gitlabMatch[2]}.git`;
          return;
        }
      }
    });
  });

  // Handle clone button
  cloneBtn.addEventListener('click', async () => {
    const url = cloneUrlInput.value.trim();
    if (!url) {
      cloneUrlInput.style.borderColor = '#ef4444';
      setTimeout(() => { cloneUrlInput.style.borderColor = ''; }, 2000);
      return;
    }

    const openTerminal = openTerminalToggle.checked;
    cloneBtn.disabled = true;
    cloneBtn.innerHTML = `
      <svg class="spin" viewBox="0 0 24 24" width="18" height="18">
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
        cloneBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          Cloned!
        `;
      } else {
        throw new Error(result?.error || 'Clone failed');
      }
    } catch (err) {
      cloneBtn.classList.add('error');
      cloneBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
        </svg>
        Failed: ${err.message}
      `;
    }

    setTimeout(() => {
      cloneBtn.disabled = false;
      cloneBtn.classList.remove('success', 'error');
      cloneBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z"/>
        </svg>
        Clone Now
      `;
    }, 3000);
  });

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
