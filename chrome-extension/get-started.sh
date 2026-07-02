#!/bin/bash
# Git Magager - Get Started Script
# 一键检查和引导安装

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   Git Magager - Quick Start Guide       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
echo "🔍 Checking Node.js..."
if command -v node &> /dev/null; then
    echo "✅ Node.js installed: $(node --version)"
    NODE_INSTALLED=true
else
    echo "❌ Node.js NOT installed"
    NODE_INSTALLED=false
fi

# Check Git
echo ""
echo "🔍 Checking Git..."
if command -v git &> /dev/null; then
    echo "✅ Git installed: $(git --version | head -n 1)"
    GIT_INSTALLED=true
else
    echo "❌ Git NOT installed"
    GIT_INSTALLED=false
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Installation guide
if [ "$NODE_INSTALLED" = false ]; then
    echo "⚠️  Step 1: Install Node.js"
    echo ""
    echo "Choose one method:"
    echo ""
    echo "Method A - Homebrew (Recommended):"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  brew install node"
    echo ""
    echo "Method B - Download from website:"
    echo "  Visit: https://nodejs.org"
    echo "  Download and install the LTS version"
    echo ""
    echo "After installing Node.js, run this script again."
    echo ""
    exit 1
fi

if [ "$GIT_INSTALLED" = false ]; then
    echo "⚠️  Step 1: Install Git"
    echo ""
    echo "Run: git --version"
    echo "If not installed, macOS will prompt you to install Xcode Command Line Tools"
    echo ""
    echo "Or download from: https://git-scm.com/download/mac"
    echo ""
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Installation Steps:"
echo ""
echo "Step 1: Load Chrome Extension"
echo "─────────────────────────────"
echo "1. Open Chrome"
echo "2. Go to: chrome://extensions"
echo "3. Enable 'Developer mode' (top right)"
echo "4. Click 'Load unpacked'"
echo "5. Select: $(pwd)/chrome-extension"
echo "6. Copy the Extension ID (32 characters)"
echo ""
read -p "Press Enter when ready, or Ctrl+C to cancel..."

echo ""
echo "Step 2: Run Installation Script"
echo "────────────────────────────────"
echo ""
echo "Now run the quick install script:"
echo ""
echo "  cd native-host"
echo "  chmod +x quick-install.sh"
echo "  ./quick-install.sh"
echo ""
echo "When prompted, paste your Extension ID."
echo ""
read -p "Would you like to run it now? (y/n): " run_now

if [ "$run_now" = "y" ] || [ "$run_now" = "Y" ]; then
    echo ""
    cd "$(dirname "$0")/native-host"
    chmod +x quick-install.sh
    ./quick-install.sh
else
    echo ""
    echo "You can run it later with:"
    echo "  cd native-host && ./quick-install.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 You're all set!"
echo ""
echo "Next time you visit a GitHub/GitLab repo,"
echo "just click the Clone button! 🚀"
echo ""
echo "For more help, see:"
echo "  - README.md"
echo "  - INSTALL.md"
echo "  - MIGRATION.md"
