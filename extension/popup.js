// Git Clone Manager - Popup Script

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
  const paymentMessage = document.getElementById('payment-message');
  let accessState = null;

  statusDot.classList.add('connected');
  statusText.textContent = 'Ready — no local server required';

  function showPaymentMessage(message, type = '') {
    paymentMessage.textContent = message;
    paymentMessage.className = `payment-message ${type}`.trim();
  }

  function renderAccess(state) {
    accessState = state;
    paymentStatus.classList.toggle('paid', Boolean(state.paid));
    paymentStatus.classList.toggle('locked', !state.allowed);

    if (state.paid) {
      paymentStatus.classList.add('paid');
      paymentIcon.textContent = '✅';
      paymentText.textContent = 'Pro — unlimited cloning';
      paymentBtn.textContent = 'Manage';
      paymentBtn.classList.add('manage');
      cloneBtn.disabled = false;
      showPaymentMessage('');
      return;
    }

    paymentBtn.classList.remove('manage');
    paymentBtn.textContent = 'Get Pro';
    paymentIcon.textContent = state.allowed ? '🎁' : '🔒';
    paymentText.textContent = state.allowed
      ? `${state.remainingUses} of ${state.freeUseLimit} free clones left`
      : 'Free trial ended';
    cloneBtn.classList.toggle('locked', !state.allowed);
    cloneBtn.setAttribute('aria-disabled', String(!state.allowed));
    cloneBtn.querySelector('span').textContent = state.allowed
      ? 'Open Clone Page'
      : 'Unlock Unlimited Cloning';
    showPaymentMessage(
      state.allowed
        ? 'Early Access: $4.99 one-time purchase. The regular price will be $9.99.'
        : 'You have used all 5 free clones. Upgrade once to keep cloning.',
      state.allowed ? '' : 'locked'
    );
  }

  try {
    const state = await chrome.runtime.sendMessage({ type: 'GET_ACCESS_STATUS' });
    if (state && !state.error) renderAccess(state);
    else throw new Error(state?.error || 'Could not check access');
  } catch (error) {
    console.warn('[Git Clone Manager] Access check error:', error);
    showPaymentMessage('Could not check access. Reopen the extension to try again.', 'error');
    cloneBtn.classList.add('locked');
    cloneBtn.setAttribute('aria-disabled', 'true');
  }

  paymentBtn.addEventListener('click', async () => {
    showPaymentMessage('Opening secure checkout...');
    try {
      const result = await chrome.runtime.sendMessage({
        type: accessState?.paid ? 'OPEN_LOGIN_PAGE' : 'OPEN_PAYMENT_PAGE'
      });
      if (!result?.success) throw new Error(result?.error || 'Could not open payment page');
      showPaymentMessage(
        accessState?.paid
          ? 'Sign in to view or restore your purchase.'
          : 'Complete your one-time purchase in the new tab.'
      );
    } catch (error) {
      console.error('[Git Clone Manager] Payment error:', error);
      showPaymentMessage(`Payment page error: ${error.message}`, 'error');
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
    console.warn('[Git Clone Manager] Could not detect repository URL:', error);
  }

  cloneBtn.addEventListener('click', async () => {
    if (!accessState?.allowed) {
      paymentBtn.click();
      return;
    }

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
