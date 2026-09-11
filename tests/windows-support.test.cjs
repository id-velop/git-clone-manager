const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('setup shows a self-contained Windows PowerShell command', () => {
  const elements = new Map(['install-command', 'copy-command', 'copy-status', 'setup-note', 'setup-instruction']
    .map(id => [id, { textContent: '', disabled: true, addEventListener() {} }]));
  const context = {
    document: { getElementById: id => elements.get(id) },
    navigator: { platform: 'Win32', clipboard: { async writeText() {} } },
    chrome: { runtime: { id: 'aamnpggmnckbdjbhecooigjddpnjffjl' } }
  };
  vm.runInNewContext(fs.readFileSync('chrome-extension/setup.js', 'utf8'), context);
  const command = elements.get('install-command').textContent;
  assert.match(command, /^powershell\.exe /);
  assert.match(command, /install-companion\.ps1/);
  assert.match(command, /aamnpggmnckbdjbhecooigjddpnjffjl/);
  assert.equal(elements.get('copy-command').disabled, false);
  assert.match(elements.get('setup-note').textContent, /No manual configuration required/);
});

test('Windows installer covers prerequisites, native host registration, and a fixed Git path', () => {
  const script = fs.readFileSync('scripts/install-companion.ps1', 'utf8');
  for (const expected of ['OpenJS.NodeJS.LTS', 'Git.Git', 'NativeMessagingHosts',
    'QuickCloneHost.exe', 'allowed_origins', '$gitPath']) {
    assert.ok(script.includes(expected), `missing ${expected}`);
  }
});
