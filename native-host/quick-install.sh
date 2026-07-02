#!/bin/bash
# Git Magager - Quick Install Script
# Automatically installs the native messaging host

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_DIR="$SCRIPT_DIR/../chrome-extension"

echo "🚀 Git Magager - Quick Installation"
echo "===================================="
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo ""
    echo "Please install Node.js first:"
    echo "  brew install node"
    echo ""
    echo "Or download from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js: $(node --version)"

if ! command -v git &> /dev/null; then
    echo "⚠️  Git is not installed. Please install Git to use this extension."
    exit 1
fi

echo "✅ Git: $(git --version | head -n 1)"

# Check if Chrome is running
if pgrep -x "Google Chrome" > /dev/null; then
    echo "✅ Chrome is running"
else
    echo "⚠️  Chrome is not running. Please start Chrome first."
    echo ""
    read -p "Press Enter once Chrome is started, or Ctrl+C to cancel..."
fi

echo ""
echo "📋 Extension Setup Instructions:"
echo "--------------------------------"
echo ""
echo "1. Open Chrome and navigate to: chrome://extensions"
echo "2. Enable 'Developer mode' (toggle in top right corner)"
echo "3. Click 'Load unpacked' button"
echo "4. Select this folder: $EXTENSION_DIR"
echo "5. Copy the Extension ID (32 character string)"
echo ""
echo "The Extension ID looks like: abcdefghijklmnopqrstuvwxyz123456"
echo ""
read -p "Paste your Extension ID here: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo "❌ Extension ID cannot be empty"
    exit 1
fi

# Validate extension ID format (should be 32 characters)
if [ ${#EXTENSION_ID} -ne 32 ]; then
    echo "⚠️  Warning: Extension ID should be 32 characters long"
    echo "   You entered: ${#EXTENSION_ID} characters"
    read -p "Continue anyway? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        exit 1
    fi
fi

echo ""
echo "🔧 Installing Native Messaging Host..."

# Create native host manifest
MANIFEST_FILE="$SCRIPT_DIR/com.git-magager.host.json"
HOST_SCRIPT="$SCRIPT_DIR/native-host.sh"
NATIVE_SERVER="$SCRIPT_DIR/native-server.js"

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

echo "✅ Native host registered with Chrome"

# Create default config
CONFIG_FILE="$HOME/.git-magager.json"
if [ ! -f "$CONFIG_FILE" ]; then
    mkdir -p "$HOME/Projects"
    cat > "$CONFIG_FILE" << EOF
{
  "cloneDirectory": "$HOME/Projects",
  "openInTerminal": true,
  "terminalApp": "Terminal"
}
EOF
    echo "✅ Default configuration created"
else
    echo "✅ Configuration already exists"
fi

echo ""
echo "🎉 Installation Complete!"
echo "========================="
echo ""
echo "What's next?"
echo "------------"
echo "1. Go back to chrome://extensions"
echo "2. Find 'Git Magager' and click the Reload button ↻"
echo "3. Visit any GitHub or GitLab repository"
echo "4. Click the Clone button and enjoy! 🚀"
echo ""
echo "💡 Tips:"
echo "- The native host starts automatically when needed"
echo "- No manual server startup required!"
echo "- Configuration: ~/.git-magager.json"
echo ""
echo "Need help? Check the README.md file."
