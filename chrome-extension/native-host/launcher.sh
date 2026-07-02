#!/bin/bash
# Git Magager - Native Host Launcher
# Chrome auto-launches this script via Native Messaging.
# It starts the HTTP server (server.js) and keeps the connection alive.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

exec node "$SCRIPT_DIR/launcher.js"
