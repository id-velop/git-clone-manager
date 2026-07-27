// Git Magager - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const cloneUrlInput = document.getElementById('clone-url');
  const cloneBtn = document.getElementById('clone-btn');
  const optionsLink = document.getElementById('options-link');

  const paymentStatus = document.getElementById('payment-status');
  const paymentIcon = document.getElementById('payment-icon');
  const paymentText = document.getElementById('payment-text');
  const paymentBtn = document.getElementById('payment-btn');

  statusDot.classList.add('connected');
  statusText.textContent = 'Ready — no local server required';

  try {
    const user = await chrome.runtime.sendMessage({ type: 'GET_USER' });
    if (user && !user.error && user.paid) {
      paymentStatus.classList.add('paid');
      paymentIcon.textContent = '✅';
      paymentText.textContent = 'Pro';
      paymentBtn.textContent = 'Manage';
      paymentBtn.classList.add('manage');
    }
  } catch (error) {
    console.warn('[Git Magager] ExtPay getUser error:', error);
  }

  paymentBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
    } catch (error) {
      console.error('[Git Magager] Payment error:', error);
    }
  });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);

      if (url.hostname === 'github.com' || url.hostname.endsWith('.github.com')) {
        const match = url.pathname.match(/^\/([^/]+)\/([^/]+)/);
        if (match && !['features', 'marketplace', 'explore', 'settings'].includes(match[1])) {
          cloneUrlInput.value = `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}.git`;
        }
      }

      if (url.hostname.includes('gitlab') || url.hostname.includes('git.')) {
        const cleanPath = url.pathname.replace(/\/(-|tree|blob|raw|blame|commits|pipelines).*$/, '');
        cloneUrlInput.value = `${url.origin}${cleanPath}.git`;
      }
    }
  } catch (error) {
    console.warn('[Git Magager] Could not detect repository URL:', error);
  }

  cloneBtn.addEventListener('click', async () => {
    const url = cloneUrlInput.value.trim();
    if (!url) {
      cloneUrlInput.style.borderColor = '#ef4444';
      setTimeout(() => { cloneUrlInput.style.borderColor = ''; }, 2000);
      return;
    }

    const clonePage = new URL(chrome.runtime.getURL('clone.html'));
    clonePage.searchParams.set('url', url);
    await chrome.tabs.create({ url: clonePage.toString() });
    window.close();
  });

  optionsLink.addEventListener('click', event => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
