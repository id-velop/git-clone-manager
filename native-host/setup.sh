#!/bin/bash
# Git Magager - Setup Script
# This script sets up the local companion server

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.git-magager.host"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "🚀 Git Magager Setup"
echo "===================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

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

# Install as launchd service (auto-start)
echo ""
echo "🔧 Setting up launchd service for auto-start..."

NODE_PATH="$(which node)"
SERVER_PATH="$SCRIPT_DIR/server.js"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$SERVER_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/.git-magager.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.git-magager-error.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✅ Service installed and started!"
echo ""
echo "📋 Commands:"
echo "   Start:   launchctl load $PLIST_PATH"
echo "   Stop:    launchctl unload $PLIST_PATH"
echo "   Logs:    tail -f ~/.git-magager.log"
echo "   Errors:  tail -f ~/.git-magager-error.log"
echo ""

# Test server
echo "🧪 Testing server..."
sleep 1
if curl -s http://127.0.0.1:9456/health | grep -q "ok"; then
    echo "✅ Server is running!"
else
    echo "⚠️  Server may still be starting. Try: curl http://127.0.0.1:9456/health"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open Chrome → chrome://extensions"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the chrome-extension folder"
echo "5. Visit any GitHub/GitLab repo and click the Clone button!"
