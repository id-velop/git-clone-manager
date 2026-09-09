const command = document.getElementById('install-command');
const copyButton = document.getElementById('copy-command');
const copyStatus = document.getElementById('copy-status');
const extensionId = globalThis.chrome?.runtime?.id;
if (/^[a-p]{32}$/.test(extensionId || '')) {
  command.textContent = `curl -fsSL https://raw.githubusercontent.com/id-velop/git-clone-manager/main/scripts/install-companion.sh | bash -s -- ${extensionId}`;
  copyButton.disabled = false;
} else {
  command.textContent = 'Open the installed extension to get your command.';
}
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(command.textContent);
    copyStatus.textContent = 'Copied. Paste into Terminal.';
  } catch (_) {
    copyStatus.textContent = 'Select the command above and copy it manually.';
  }
});
