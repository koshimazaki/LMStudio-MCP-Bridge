#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
LIME='\x1b[38;5;154m'
CYAN='\x1b[38;5;51m'
ORANGE='\x1b[38;5;208m'
GRAY='\x1b[38;5;240m'
RESET='\x1b[0m'

ascii_banner() {
  echo -e "${LIME}╭────────────────────────────────────────────────────────────╮${RESET}"
  echo -e "${LIME}│${RESET}  👾  ${LIME}LMStudio MCP Bridge — Local Model Tools (stdio)${RESET}  ${LIME}│${RESET}"
  echo -e "${LIME}╰────────────────────────────────────────────────────────────╯${RESET}"
}

ascii_banner

# Ensure logs directory exists
mkdir -p logs

# Build if dist missing
DIST_FILE="dist/index.js"
if [ ! -f "$DIST_FILE" ]; then
  echo -e "${CYAN}🏗  Building…${RESET}"
  npm run --silent build
else
  # Rebuild if sources are newer than dist
  # macOS uses stat -f %m, Linux uses stat -c %Y
  if stat -f %m "$DIST_FILE" >/dev/null 2>&1; then
    DIST_MTIME=$(stat -f %m "$DIST_FILE")
    SRC_MTIME=$(find src -type f -name "*.ts" -exec stat -f %m {} \; | sort -nr | head -1 || echo 0)
  else
    DIST_MTIME=$(stat -c %Y "$DIST_FILE")
    SRC_MTIME=$(find src -type f -name "*.ts" -exec stat -c %Y {} \; | sort -nr | head -1 || echo 0)
  fi
  if [ "${SRC_MTIME:-0}" -gt "${DIST_MTIME:-0}" ]; then
    echo -e "${CYAN}🔄 Sources changed since last build — rebuilding…${RESET}"
    npm run --silent build
  fi
fi

echo -e "${CYAN}⚡ Starting LMStudio MCP (stdio)${RESET}"
echo -e "${GRAY}  LM_STUDIO_URL=${LM_STUDIO_URL:-http://localhost:1234}${RESET}"
echo -e "${GRAY}  LM_STUDIO_MODEL=${LM_STUDIO_MODEL:-local-model}${RESET}"

NODE_ENV=${NODE_ENV:-production} \
  node dist/index.js

