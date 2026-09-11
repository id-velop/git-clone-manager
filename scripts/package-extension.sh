#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="$PROJECT_DIR/chrome-extension"
VERSION="$(node -p "require('$SOURCE_DIR/manifest.json').version")"
OUTPUT="$PROJECT_DIR/quick-clone-v$VERSION.zip"
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

for file in manifest.json i18n.js background.js content.js content.css popup.html popup.js popup.css options.html options.js options.css setup.html setup.js setup.css; do
  cp "$SOURCE_DIR/$file" "$STAGING_DIR/$file"
done
mkdir -p "$STAGING_DIR/icons"
cp "$SOURCE_DIR/icons/icon.svg" "$SOURCE_DIR/icons/icon16.png" "$SOURCE_DIR/icons/icon48.png" "$SOURCE_DIR/icons/icon128.png" "$STAGING_DIR/icons/"
mkdir -p "$STAGING_DIR/images"
cp "$SOURCE_DIR/images/open-terminal-macos.png" "$SOURCE_DIR/images/open-command-windows.png" "$STAGING_DIR/images/"

rm -f "$OUTPUT"
(cd "$STAGING_DIR" && zip -qr "$OUTPUT" .)
echo "Created $OUTPUT"
