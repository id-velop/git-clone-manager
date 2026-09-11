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
  local staging_dir
  staging_dir="$(mktemp -d)"
  trap 'rm -rf "$staging_dir"' EXIT
  # Discover existing Homebrew tools even when a fresh Terminal has not loaded shellenv.
  export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
  local need_node=false need_git=false
  node --version >/dev/null 2>&1 || need_node=true
  # Avoid invoking Apple's Git shim until Command Line Tools are available.
  if [[ "$(command -v git || true)" == /usr/bin/git ]] && ! xcode-select -p >/dev/null 2>&1; then
    need_git=true
  elif ! git --version >/dev/null 2>&1; then
    need_git=true
  fi
  if [[ "$need_node" == true || "$need_git" == true ]]; then
    echo 'Installing missing prerequisites. This may take several minutes.'
    local brew_bin
    brew_bin="$(command -v brew || true)"
    if [[ -z "$brew_bin" ]]; then
      if [[ ! -r /dev/tty ]]; then
        echo 'Homebrew setup needs an interactive Terminal. Run this command in Terminal on your Mac.' >&2
        exit 1
      fi
      echo 'Installing Homebrew. Follow its prompts; macOS may ask for your administrator password.'
      curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
        --connect-timeout 15 --max-time 120 \
        https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$staging_dir/homebrew.sh"
      # The outer script can be piped to Bash. Give the official installer its own TTY.
      /bin/bash "$staging_dir/homebrew.sh" </dev/tty
      hash -r
      brew_bin="$(command -v brew || true)"
      if [[ -z "$brew_bin" ]]; then
        echo 'Homebrew installation did not complete. Run the command again after resolving the error above.' >&2
        exit 1
      fi
    fi
    local packages=()
    [[ "$need_node" == false ]] || packages+=(node)
    [[ "$need_git" == false ]] || packages+=(git)
    "$brew_bin" install "${packages[@]}"
    export PATH="$("$brew_bin" --prefix)/bin:$PATH"
    hash -r
  fi
  if ! node --version || ! git --version; then
    echo 'Dependency installation did not finish successfully. Resolve the error above and run this command again.' >&2
    exit 1
  fi
  local base_url='https://raw.githubusercontent.com/id-velop/quick-clone/main/native-host'
  local file
  echo 'Downloading Quick Clone companion…'
  for file in install-native-host.sh launcher.js server.js; do
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      --connect-timeout 15 --max-time 120 "$base_url/$file" -o "$staging_dir/$file"
  done
  bash "$staging_dir/install-native-host.sh" "$extension_id"
  echo 'Setup complete. Open Quick Clone and click Reconnect.'
)

install_companion "$@"
