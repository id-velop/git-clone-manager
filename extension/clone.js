document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('clone-url');
  const cloneButton = document.getElementById('clone-btn');
  const status = document.getElementById('status');
  const paywall = document.getElementById('paywall');
  const upgradeButton = document.getElementById('upgrade-btn');
  const restoreButton = document.getElementById('restore-btn');
  const paymentFeedback = document.getElementById('payment-feedback');
  const originalButtonHtml = cloneButton.innerHTML;
  let accessState = null;

  const initialUrl = new URLSearchParams(location.search).get('url');
  if (initialUrl) urlInput.value = initialUrl;

  function setStatus(message, type = 'active') {
    status.className = `status ${type}`;
    status.textContent = message;
  }

  function setButtonLabel(message) {
    cloneButton.querySelector('span').textContent = message;
  }

  function renderAccess(state) {
    accessState = state;
    const locked = !state.paid && !state.allowed;
    paywall.hidden = !locked;
    cloneButton.hidden = locked;
    urlInput.disabled = locked;

    if (state.paid) {
      setStatus('Pro unlocked — unlimited cloning.', 'success');
    } else if (!locked) {
      setStatus(`${state.remainingUses} of ${state.freeUseLimit} free clones remaining.`, 'active');
    } else {
      setStatus('Your free trial has ended. Upgrade to continue cloning.', 'error');
    }
  }

  async function openPaymentPage(type) {
    paymentFeedback.textContent = type === 'OPEN_LOGIN_PAGE'
      ? 'Opening sign-in...'
      : 'Opening secure checkout...';
    try {
      const result = await chrome.runtime.sendMessage({ type });
      if (!result?.success) throw new Error(result?.error || 'Could not open payment page');
      paymentFeedback.textContent = type === 'OPEN_LOGIN_PAGE'
        ? 'Sign in in the new tab, then reopen this page.'
        : 'Complete your purchase in the new tab, then return here.';
    } catch (error) {
      paymentFeedback.textContent = `Payment page error: ${error.message}`;
      paymentFeedback.classList.add('error');
    }
  }

  upgradeButton.addEventListener('click', () => openPaymentPage('OPEN_PAYMENT_PAGE'));
  restoreButton.addEventListener('click', () => openPaymentPage('OPEN_LOGIN_PAGE'));

  try {
    const state = await chrome.runtime.sendMessage({ type: 'GET_ACCESS_STATUS' });
    if (state?.error) throw new Error(state.error);
    renderAccess(state);
  } catch (error) {
    cloneButton.disabled = true;
    setStatus(`Could not check access: ${error.message}`, 'error');
  }

  cloneButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      urlInput.focus();
      setStatus('Enter a repository URL first.', 'error');
      return;
    }

    setStatus('Checking access...');
    const claim = await chrome.runtime.sendMessage({ type: 'CLAIM_CLONE_USE' });
    if (!claim?.allowed) {
      renderAccess(claim || {
        paid: false,
        allowed: false,
        remainingUses: 0,
        freeUseLimit: 5
      });
      return;
    }

    accessState = claim;
    cloneButton.disabled = true;
    urlInput.disabled = true;
    cloneButton.querySelector('.brand-icon').classList.add('spin');
    setButtonLabel('Choose folder...');
    setStatus('Waiting for folder selection...');

    try {
      const result = await globalThis.CloneManagerBrowser.cloneRepository(url, {
        onStatus(message) {
          setButtonLabel(message);
          setStatus(message);
        }
      });

      cloneButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg><span>Cloned</span>';
      const trialMessage = claim.paid
        ? ''
        : ` ${claim.remainingUses} free clone${claim.remainingUses === 1 ? '' : 's'} remaining.`;
      setStatus(`Repository cloned to ${result.destinationName}.${trialMessage}`, 'success');
    } catch (error) {
      if (error.name === 'AbortError') {
        status.className = 'status';
      } else {
        setStatus(`Clone failed: ${error.message}`, 'error');
      }
      cloneButton.innerHTML = originalButtonHtml;
      cloneButton.disabled = false;
      urlInput.disabled = false;
    }
  });
});
