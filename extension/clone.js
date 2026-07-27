document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('clone-url');
  const cloneButton = document.getElementById('clone-btn');
  const status = document.getElementById('status');
  const originalButtonHtml = cloneButton.innerHTML;

  const initialUrl = new URLSearchParams(location.search).get('url');
  if (initialUrl) urlInput.value = initialUrl;

  function setStatus(message, type = 'active') {
    status.className = `status ${type}`;
    status.textContent = message;
  }

  function setButtonLabel(message) {
    cloneButton.querySelector('span').textContent = message;
  }

  cloneButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      urlInput.focus();
      setStatus('Enter a repository URL first.', 'error');
      return;
    }

    cloneButton.disabled = true;
    urlInput.disabled = true;
    cloneButton.querySelector('svg').classList.add('spin');
    setButtonLabel('Choose folder...');
    setStatus('Waiting for folder selection...');

    try {
      const result = await globalThis.GitMagagerBrowser.cloneRepository(url, {
        onStatus(message) {
          setButtonLabel(message);
          setStatus(message);
        }
      });

      cloneButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg><span>Cloned</span>';
      setStatus(`Repository cloned to ${result.destinationName}.`, 'success');
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
