// Git Magager - Options Script

document.addEventListener('DOMContentLoaded', async () => {
  const cloneDirInput = document.getElementById('clone-dir');
  const terminalAppSelect = document.getElementById('terminal-app');
  const openTerminalToggle = document.getElementById('open-terminal');
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');

  // Load current config
  try {
    const config = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (config && !config.error) {
      cloneDirInput.value = config.cloneDirectory || '';
      terminalAppSelect.value = config.terminalApp || 'Terminal';
      openTerminalToggle.checked = config.openInTerminal !== false;
    }
  } catch (e) {
    // Use defaults
  }

  // Save config
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    statusDiv.className = 'status';

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
        statusDiv.textContent = 'Settings saved successfully!';
      } else {
        throw new Error(result?.error || 'Failed to save');
      }
    } catch (e) {
      statusDiv.className = 'status error';
      statusDiv.textContent = `Failed to save: ${e.message}`;
    }

    saveBtn.disabled = false;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  });
});
