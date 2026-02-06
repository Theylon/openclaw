#!/bin/bash
# Start the Activity Feed service
# 
# This script starts:
# 1. Log watcher (parses gateway logs and serves API on port 8742)
# 2. Web server for the UI (optional, port 8743)
#
# Usage:
#   ./start.sh           # Start log watcher only
#   ./start.sh --serve   # Start log watcher + web server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🦞 OpenClaw Activity Feed"
echo "─────────────────────────────────"

# Check if npx/tsx is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js."
    exit 1
fi

# Start log watcher with API server
echo "Starting log watcher on port 8742..."
npx tsx watch-logs.ts --serve 8742 &
WATCHER_PID=$!

# Optionally start web server
if [[ "$1" == "--serve" ]]; then
    echo "Starting web server on port 8743..."
    npx serve -l 8743 . &
    WEB_PID=$!
    echo ""
    echo "📊 Activity Feed UI: http://localhost:8743"
fi

echo "📡 Activity API: http://localhost:8742/api/activity"
echo ""
echo "Press Ctrl+C to stop"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $WATCHER_PID 2>/dev/null || true
    [[ -n "$WEB_PID" ]] && kill $WEB_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
