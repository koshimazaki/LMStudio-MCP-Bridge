#!/usr/bin/env bash
set -e

# Colors
LIME='\x1b[38;5;154m'
CYAN='\x1b[38;5;51m'
ORANGE='\x1b[38;5;208m'
GRAY='\x1b[38;5;240m'
RESET='\x1b[0m'

echo -e "${LIME}╭────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${LIME}│${RESET}  👾  ${LIME}LMStudio MCP Bridge — Production Setup${RESET}                ${LIME}│${RESET}"
echo -e "${LIME}╰────────────────────────────────────────────────────────────╯${RESET}"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20+ is required"
    echo "   Please install Node.js from https://nodejs.org"
    exit 1
fi
echo -e "${LIME}✓ Node.js version check passed (v$NODE_VERSION)${RESET}"

# Check if LM Studio is running
echo ""
echo -e "${CYAN}░░░█ Checking LM Studio connection...${RESET}"
if curl -s -f -m 5 http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo -e "${LIME}✓ LM Studio is running on localhost:1234${RESET}"
else
    echo -e "${ORANGE}⚠️  Warning: Cannot connect to LM Studio on localhost:1234${RESET}"
    echo "   Make sure LM Studio is running with:"
    echo "   1. A model loaded"
    echo "   2. Local server started (in Local Server tab)"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo -e "${CYAN}📝 Creating .env file...${RESET}"
    cp .env.example .env
    echo -e "${LIME}✓ .env file created (customize as needed)${RESET}"
else
    echo -e "${LIME}✓ .env file already exists${RESET}"
fi

# Install dependencies
echo ""
echo -e "${CYAN}📦 Installing dependencies...${RESET}"
npm install --quiet
if [ $? -eq 0 ]; then
    echo -e "${LIME}✓ Dependencies installed successfully${RESET}"
else
    echo -e "${ORANGE}❌ Failed to install dependencies${RESET}"
    exit 1
fi

# Build TypeScript
echo ""
echo -e "${CYAN}░░░█ Building TypeScript...${RESET}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${LIME}✓ Build completed successfully${RESET}"
else
    echo -e "${ORANGE}❌ Build failed${RESET}"
    exit 1
fi

# Create logs directory
mkdir -p logs
echo -e "${LIME}✓ Logs directory created${RESET}"

# Test the build
echo ""
echo -e "${CYAN}🧪 Running health check...${RESET}"
node dist/health-check.js
if [ $? -eq 0 ]; then
    echo -e "${LIME}✓ Health check passed${RESET}"
else
    echo -e "${ORANGE}⚠️  Health check failed (LM Studio may not be running)${RESET}"
fi

# Display Claude Desktop configuration
echo ""
echo -e "${LIME}╭────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${LIME}│${RESET}    🏁       ${LIME}Setup Complete! Next Steps${RESET}                     ${LIME}│${RESET}"
echo -e "${LIME}╰────────────────────────────────────────────────────────────╯${RESET}"
echo ""
echo "1. Add to Claude Desktop configuration:"
echo ""
echo "   Location (Mac): ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "   Location (Win): %APPDATA%/Claude/claude_desktop_config.json"
echo ""
echo -e "   ${CYAN}Add this to the mcpServers section:${RESET}"
echo ""
cat << 'EOF'
{
  "mcpServers": {
    "LMStudio": {
      "command": "bash",
      "args": ["-lc", "./LMStudio-MCP/start.sh"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
echo ""
echo "   Replace \$PWD with: $(pwd)"
echo ""
echo -e "2. Restart Claude Desktop / Reload your editor"
echo ""
echo "3. Test with prompts like:"
echo "   - 'Generate documentation for this function'"
echo "   - 'Analyze this code for security issues'"
echo "   - 'Create unit tests for this class'"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "${CYAN}📚 Available Tools:${RESET}"
echo "   • generate_docs - Generate code documentation"
echo "   • summarize - Summarize code or text"
echo "   • extract_tags - Extract semantic tags from code"
echo "   • analyze_code - Analyze code for issues"
echo "   • refactor_suggestions - Suggest refactoring improvements"
echo "   • generate_tests - Generate test cases"
echo ""
echo "👾 To start the server manually: npm start"
echo "📊 To check server health: npm run health"
echo "📝 To view logs: tail -f logs/combined.log"
echo ""