#!/bin/bash
# Native Messaging Host wrapper script
# This script is called by Chrome when the extension sends a message

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

exec node "$SCRIPT_DIR/native-server.js"
