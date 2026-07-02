#!/bin/bash
# Git Magager - Install Native Messaging Host
# This script registers the native messaging host with Chrome

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_DIR="$SCRIPT_DIR/../chrome-extension"

echo "🚀 Git Magager - Native Host Installation"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Get Chrome extension ID
echo ""
echo "📋 Getting Chrome Extension ID..."
echo ""
echo "Please follow these steps:"
echo "1. Open Chrome and go to chrome://extensions"
echo "2. Enable 'Developer mode' (top right toggle)"
echo "3. Click 'Load unpacked' and select: $EXTENSION_DIR"
echo "4. Copy the Extension ID (looks like: abcdefghijklmnopqrstuvwxyz123456)"
echo ""
read -p "Enter your Extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo "❌ Extension ID cannot be empty"
    exit 1
fi

echo ""
echo "🔧 Configuring Native Messaging Host..."

# Update the allowed_origins in the manifest file
MANIFEST_FILE="$SCRIPT_DIR/com.git-magager.host.json"
HOST_SCRIPT="$SCRIPT_DIR/native-host.sh"
NATIVE_SERVER="$SCRIPT_DIR/native-server.js"

# Create the manifest with the correct extension ID
cat > "$MANIFEST_FILE" << EOF
{
  "name": "com.git-magager.host",
  "description": "Git Magager Native Host",
  "path": "$HOST_SCRIPT",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

# Make scripts executable
chmod +x "$HOST_SCRIPT"
chmod +x "$NATIVE_SERVER"

# Install to Chrome's native messaging hosts directory
NATIVE_HOSTS_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$NATIVE_HOSTS_DIR"

cp "$MANIFEST_FILE" "$NATIVE_HOSTS_DIR/com.git-magager.host.json"

echo "✅ Native host manifest installed to: $NATIVE_HOSTS_DIR"

# Create default config if not exists
CONFIG_FILE="$HOME/.git-magager.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo ""
    echo "📝 Creating default config at $CONFIG_FILE"
    mkdir -p "$HOME/Projects"
    cat > "$CONFIG_FILE" << EOF
{
  "cloneDirectory": "$HOME/Projects",
  "openInTerminal": true,
  "terminalApp": "Terminal"
}
EOF
    echo "   Default clone directory: $HOME/Projects"
else
    echo "✅ Config already exists at $CONFIG_FILE"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Reload the extension in Chrome (chrome://extensions → Reload button)"
echo "2. Visit any GitHub/GitLab repository"
echo "3. Click the Clone button!"
echo ""
echo "The native host will automatically start when needed."
echo "No manual server startup required! 🚀"
