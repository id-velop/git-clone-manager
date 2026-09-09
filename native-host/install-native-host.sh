#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js is required." >&2
  exit 1
fi
if ! command -v git >/dev/null; then
  echo "Git is required." >&2
  exit 1
fi
EXTENSION_ID="${1:-}"
if [[ -z "$EXTENSION_ID" ]]; then
  read -r -p "Chrome extension ID: " EXTENSION_ID
fi
if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Invalid Chrome extension ID." >&2
  exit 1
fi
"$NODE_BIN" - "$SCRIPT_DIR" "$EXTENSION_ID" <<'NODE'
const fs = require('fs');
const path = require('path');
const os = require('os');
const [source, id] = process.argv.slice(2);
const installDir = path.join(os.homedir(), 'Library/Application Support/Git Magager');
const hostsDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
fs.mkdirSync(installDir, { recursive: true });
fs.mkdirSync(hostsDir, { recursive: true });
for (const file of ['launcher.js', 'server.js']) {
  fs.copyFileSync(path.join(source, file), path.join(installDir, file));
}
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const launcher = path.join(installDir, 'launcher.sh');
fs.writeFileSync(launcher, '#!/bin/bash\nexport GM_EXTENSION_ID=' + quote(id) + '\nexport PATH=' + quote(path.dirname(process.execPath) + ':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin') + '\nexec ' + quote(process.execPath) + ' ' + quote(path.join(installDir, 'launcher.js')) + '\n', { mode: 0o755 });
fs.chmodSync(launcher, 0o755);
const manifest = {
  name: 'com.git_magager.host',
  description: 'Clone to Folder Native Host',
  path: launcher,
  type: 'stdio',
  allowed_origins: ['chrome-extension://' + id + '/']
};
fs.writeFileSync(path.join(hostsDir, manifest.name + '.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Installed Native Host for extension ' + id);
console.log('Reload the extension, then click Start Server.');
NODE
