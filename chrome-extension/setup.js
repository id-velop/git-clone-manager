const command = document.getElementById('install-command');
const copyButton = document.getElementById('copy-command');
const copyStatus = document.getElementById('copy-status');
const setupNote = document.getElementById('setup-note');
const setupInstruction = document.getElementById('setup-instruction');
const setupStepOpen = document.getElementById('setup-step-open');
const setupStepRun = document.getElementById('setup-step-run');
const extensionId = globalThis.chrome?.runtime?.id;
if (/^[a-p]{32}$/.test(extensionId || '')) {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  if (/win/i.test(platform)) {
    command.textContent = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/id-velop/quick-clone/main/scripts/install-companion.ps1'))) -ExtensionId '${extensionId}'"`;
    if (setupInstruction) setupInstruction.textContent = 'Run this in PowerShell, then reconnect.';
    if (setupStepOpen) setupStepOpen.textContent = 'Open Command Prompt.';
    if (setupStepRun) setupStepRun.textContent = 'Copy the command below, paste it into Command Prompt, then press Enter.';
    if (setupNote) setupNote.textContent = 'Installs Node.js and Git if needed. No manual configuration required.';
  } else {
    command.textContent = `curl -fsSL https://raw.githubusercontent.com/id-velop/quick-clone/main/scripts/install-companion.sh | bash -s -- ${extensionId}`;
  }
  copyButton.disabled = false;
} else {
  command.textContent = 'Open the installed extension to get your command.';
}
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(command.textContent);
    copyStatus.textContent = /win/i.test(navigator.userAgentData?.platform || navigator.platform || '')
      ? 'Copied. Paste into Command Prompt.' : 'Copied. Paste into Terminal.';
  } catch (_) {
    copyStatus.textContent = 'Select the command above and copy it manually.';
  }
});
