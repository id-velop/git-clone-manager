// Quick Clone - Options Script

document.addEventListener('DOMContentLoaded', async () => {
  const cloneDirInput = document.getElementById('clone-dir');
  const terminalAppSelect = document.getElementById('terminal-app');
  const openTerminalToggle = document.getElementById('open-terminal');
  const settingsForm = document.getElementById('settings-form');
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');

  try {
    const platform = await chrome.runtime.getPlatformInfo();
    if (platform.os === 'win') {
      terminalAppSelect.replaceChildren(new Option('Windows Terminal', 'WindowsTerminal'));
    }
  } catch (_) {
    // Keep macOS terminal choices when platform information is unavailable.
  }

  // Load current config
  try {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (config && !config.error) {
      cloneDirInput.value = config.cloneDirectory || '';
      terminalAppSelect.value = config.terminalApp || terminalAppSelect.options[0]?.value || 'Terminal';
      openTerminalToggle.checked = config.openInTerminal === true;
    }
  } catch (e) {
    // Use defaults
  }

  // Save config
  settingsForm.addEventListener('submit', async event => {
    event.preventDefault();
    saveBtn.disabled = true;
    statusDiv.className = 'status';
    statusDiv.textContent = 'Saving…';

    const config = {
      cloneDirectory: cloneDirInput.value.trim(),
      terminalApp: terminalAppSelect.value,
      openInTerminal: openTerminalToggle.checked
    };

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'SET_CONFIG',
        config
      });

      if (result && result.success) {
        statusDiv.className = 'status success';
        statusDiv.textContent = 'Preferences saved.';
      } else {
        throw new Error(result?.error || 'Failed to save');
      }
    } catch (e) {
      statusDiv.className = 'status error';
      statusDiv.textContent = `Could not save: ${e.message}`;
    }

    saveBtn.disabled = false;
    setTimeout(() => {
      statusDiv.className = 'status';
      statusDiv.textContent = '';
    }, 3000);
  });
});
