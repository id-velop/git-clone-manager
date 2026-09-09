#!/bin/bash
# Standalone companion bootstrap. Run with the Chrome extension ID as argument 1.
install_companion() (
  set -euo pipefail
  local extension_id="${1:-}"
  if [[ ! "$extension_id" =~ ^[a-p]{32}$ ]]; then
    echo 'A valid Chrome extension ID is required. Copy the command from the extension setup guide.' >&2
    exit 1
  fi
  if [[ "$(uname -s)" != Darwin ]]; then
    echo 'The companion currently supports macOS only.' >&2
    exit 1
  fi
  if ! command -v node >/dev/null; then
    echo 'Node.js is required. Install the macOS LTS package from https://nodejs.org/en/download, reopen Terminal, and run this command again.' >&2
    exit 1
  fi
  if ! git --version >/dev/null 2>&1; then
    echo 'Git is required. Run xcode-select --install, finish the macOS installer, then run this command again.' >&2
    exit 1
  fi
  local staging_dir
  staging_dir="$(mktemp -d)"
  trap 'rm -rf "$staging_dir"' EXIT
  local base_url='https://raw.githubusercontent.com/id-velop/git-clone-manager/main/native-host'
  local file
  echo 'Downloading Clone to Folder companion…'
  for file in install-native-host.sh launcher.js server.js; do
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      --connect-timeout 15 --max-time 120 "$base_url/$file" -o "$staging_dir/$file"
  done
  bash "$staging_dir/install-native-host.sh" "$extension_id"
  echo 'Setup complete. Open Clone to Folder and click Reconnect.'
)

install_companion "$@"
