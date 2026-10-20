#!/bin/bash
cd "$(dirname "$0")"

# Ensure common paths (node, npm, npx) are in PATH on macOS
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "=========================================================="
echo "          BEHEMOTH COMBAT SIMULATOR LAUNCHER              "
echo "=========================================================="
echo ""
echo "Starting local simulator server..."

# Check if node is installed
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js was not found on your system PATH."
  echo "Please install Node.js from https://nodejs.org or via Homebrew (brew install node)."
  read -p "Press Enter to exit..."
  exit 1
fi

# Check if port 5173 is already active
PORT_PID=$(lsof -ti:5173 2>/dev/null)
if [ -n "$PORT_PID" ]; then
  echo "Simulator server is already active on port 5173 (PID: $PORT_PID)."
  echo "Opening browser at http://localhost:5173..."
  open "http://localhost:5173"
  echo "Simulator is ready! You may close this window or keep it open."
  exit 0
fi

# Start Vite development server in the background
npm run dev &
DEV_PID=$!

# Wait briefly for server to spin up
echo "Waiting for server to spin up..."
for i in {1..20}; do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Open default browser
echo "Opening Behemoth Combat Simulator in your default browser..."
open "http://localhost:5173"

echo ""
echo "CombatSim is actively running at: http://localhost:5173"
echo "To stop the simulator server, close this Terminal window or press Ctrl+C."
echo "=========================================================="

# Trap exit signals to terminate Vite cleanly
trap "kill $DEV_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

wait $DEV_PID
