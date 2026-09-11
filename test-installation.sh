#!/bin/bash
# Quick Clone - Test Installation
# Verify that everything is set up correctly

echo "🧪 Quick Clone - Installation Test"
echo "==================================="
echo ""

ERRORS=0

# Test 1: Node.js
echo "Test 1: Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js NOT installed"
    ERRORS=$((ERRORS + 1))
fi

# Test 2: Git
echo ""
echo "Test 2: Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | head -n 1)
    echo "✅ Git installed: $GIT_VERSION"
else
    echo "❌ Git NOT installed"
    ERRORS=$((ERRORS + 1))
fi

# Test 3: Chrome Native Messaging Host directory
echo ""
echo "Test 3: Checking Native Messaging Host registration..."
NATIVE_HOST_FILE="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.quick_clone.host.json"
if [ -f "$NATIVE_HOST_FILE" ]; then
    echo "✅ Native host manifest found"
    
    # Check if extension ID is configured
    if grep -q "chrome-extension://" "$NATIVE_HOST_FILE"; then
        EXT_ID=$(grep -o 'chrome-extension://[^/]*' "$NATIVE_HOST_FILE" | head -1)
        echo "   Extension ID: $EXT_ID"
    else
        echo "⚠️  Warning: No extension ID configured"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Native host manifest NOT found"
    echo "   Expected location: $NATIVE_HOST_FILE"
    echo "   Run: cd native-host && ./quick-install.sh"
    ERRORS=$((ERRORS + 1))
fi

# Test 4: Native server script
echo ""
echo "Test 4: Checking native server script..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NATIVE_SERVER="$SCRIPT_DIR/native-host/native-server.js"
if [ -f "$NATIVE_SERVER" ]; then
    echo "✅ Native server script exists"
    
    # Check if executable
    if [ -x "$SCRIPT_DIR/native-host/native-host.sh" ]; then
        echo "✅ Wrapper script is executable"
    else
        echo "⚠️  Warning: Wrapper script not executable"
        echo "   Run: chmod +x native-host/native-host.sh"
    fi
else
    echo "❌ Native server script NOT found"
    ERRORS=$((ERRORS + 1))
fi

# Test 5: Configuration file
echo ""
echo "Test 5: Checking configuration..."
CONFIG_FILE="$HOME/.quick-clone.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Configuration file exists"
    
    # Validate JSON
    if node -e "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf-8'))" 2>/dev/null; then
        echo "✅ Configuration is valid JSON"
        
        # Show config summary
        CLONE_DIR=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf-8')).cloneDirectory)")
        echo "   Clone directory: $CLONE_DIR"
    else
        echo "❌ Configuration file is invalid JSON"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "⚠️  Configuration file NOT found (will be created on first use)"
fi

# Test 6: Chrome extension files
echo ""
echo "Test 6: Checking Chrome extension files..."
EXTENSION_DIR="$SCRIPT_DIR/chrome-extension"
if [ -d "$EXTENSION_DIR" ]; then
    echo "✅ Extension directory exists"
    
    # Check required files
    REQUIRED_FILES=("manifest.json" "background.js" "content.js" "popup.html")
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$EXTENSION_DIR/$file" ]; then
            echo "   ✅ $file"
        else
            echo "   ❌ $file missing"
            ERRORS=$((ERRORS + 1))
        fi
    done
    
    # Check manifest for nativeMessaging permission
    if grep -q "nativeMessaging" "$EXTENSION_DIR/manifest.json"; then
        echo "✅ nativeMessaging permission enabled"
    else
        echo "❌ nativeMessaging permission NOT found in manifest"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Extension directory NOT found"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "🎉 All tests passed!"
    echo ""
    echo "Your Quick Clone installation looks good."
    echo ""
    echo "Next steps:"
    echo "1. Make sure Chrome is running"
    echo "2. Load the extension from: $EXTENSION_DIR"
    echo "3. Visit a GitHub/GitLab repository"
    echo "4. Click the Quick Clone button!"
else
    echo "⚠️  Found $ERRORS issue(s)"
    echo ""
    echo "Please fix the issues above and run this test again."
    echo ""
    echo "Quick fix:"
    echo "  cd native-host && ./quick-install.sh"
fi

echo ""
exit $ERRORS
