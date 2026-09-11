const command = document.getElementById('install-command');
const copyButton = document.getElementById('copy-command');
const copyStatus = document.getElementById('copy-status');
const setupNote = document.getElementById('setup-note');
const setupInstruction = document.getElementById('setup-instruction');
const extensionId = globalThis.chrome?.runtime?.id;
if (/^[a-p]{32}$/.test(extensionId || '')) {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  if (/win/i.test(platform)) {
    command.textContent = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/id-velop/git-clone-manager/main/scripts/install-companion.ps1'))) -ExtensionId '${extensionId}'"`;
    if (setupInstruction) setupInstruction.textContent = 'Run this in PowerShell, then reconnect.';
    if (setupNote) setupNote.textContent = 'Windows · Installs Node.js and Git if needed. No manual configuration required.';
  } else {
    command.textContent = `curl -fsSL https://raw.githubusercontent.com/id-velop/git-clone-manager/main/scripts/install-companion.sh | bash -s -- ${extensionId}`;
  }
  copyButton.disabled = false;
} else {
  command.textContent = 'Open the installed extension to get your command.';
}
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(command.textContent);
    copyStatus.textContent = /win/i.test(navigator.userAgentData?.platform || navigator.platform || '')
      ? 'Copied. Paste into PowerShell.' : 'Copied. Paste into Terminal.';
  } catch (_) {
    copyStatus.textContent = 'Select the command above and copy it manually.';
  }
});
