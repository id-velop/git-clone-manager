#!/bin/bash
# Native Messaging Host wrapper script
# This script is called by Chrome when the extension sends a message

exec node git-clone-manager/native-host/native-server.js
