```bash
██╗     ███╗   ███╗███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗     ███╗   ███╗ ██████╗██████╗ 
██║     ████╗ ████║██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗    ████╗ ████║██╔════╝██╔══██╗
██║     ██╔████╔██║███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║    ██╔████╔██║██║     ██████╔╝
██║     ██║╚██╔╝██║╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║    ██║╚██╔╝██║██║     ██╔═══╝ 
███████╗██║ ╚═╝ ██║███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝    ██║ ╚═╝ ██║╚██████╗██║     
╚══════╝╚═╝     ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝     ╚═╝     ╚═╝ ╚═════╝╚═╝     
░░░█ LM Studio MCP Bridge for Claude Code █░░░
```

# LMStudio MCP Bridge

A robust, MCP (Model Context Protocol) bridge for LMStudio that enables Claude Code and Desktop to leverage local LLMs for code assistance tasks. Made specifically to use `gpt-oss-20b` model locally and offset token usage for Claude Code.

## Features

### Core Capabilities
- **6 Specialized Tools** for code assistance
- **Request validation** with Zod schemas and security checks
- **Intelligent caching** to reduce redundant LLM calls
- **Rate limiting** to prevent overload
- **Graceful shutdown** handling
- **Structured logging** with Winston
- **TypeScript** for type safety

### Available Tools

1. **generate_docs** - Generate comprehensive documentation with multiple styles (technical/user/API)
2. **summarize** - Create concise summaries with configurable length and format
3. **extract_tags** - Extract semantic tags and keywords from code
4. **analyze_code** - Perform security, performance, style, and bug analysis
5. **refactor_suggestions** - Suggest code improvements for readability/performance/maintainability
6. **generate_tests** - Generate comprehensive test cases with coverage targets


## Installation

### Prerequisites
- Node.js 20+ 
- LM Studio running with a model loaded
- LM Studio API server enabled (localhost:1234)

### Quick Setup

```bash
# Run the automated setup
chmod +x setup.sh
./setup.sh
```

This will:
1. Check prerequisites
2. Install dependencies
3. Build TypeScript
4. Create configuration files
5. Run health checks
6. Display Claude Desktop integration instructions

### Manual Setup

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Build TypeScript
npm run build

# Test connection to LM Studio
npm run health

# Start the server
npm start
```

## Configuration

### Environment Variables (.env)

```bash
# LM Studio Settings
LM_STUDIO_URL=http://localhost:1234  # LM Studio API endpoint
LM_STUDIO_TIMEOUT=30000               # Request timeout (ms)
LM_STUDIO_MAX_RETRIES=3               # Retry attempts on failure
LM_STUDIO_MODEL=openai/gpt-oss-20b    # Model to use
LMSERVER_NAME=LMStudio                 # MCP Server Name

# Server Settings
LOG_LEVEL=info                        # error|warn|info|debug
GRACEFUL_SHUTDOWN_TIMEOUT=5000        # Shutdown grace period (ms)

# Performance Tuning
RATE_LIMIT_MAX_REQUESTS=60            # Max requests per minute
RATE_LIMIT_MAX_CONCURRENT=10          # Max concurrent requests
CACHE_TTL=300                          # Cache duration (seconds)
```

### Claude Code / Desktop integration

You can enable the MCP server either per‑project or user‑wide. After editing config, restart Claude Code/Claude Desktop.

1) Project‑scoped (recommended)

- Option A: `.claude/settings.local.json` in your project

```json
{
  "mcpServers": {
    "LMStudio": {
      "type": "stdio",
      "command": "bash",
      "args": ["-lc", "./LMStudio-MCP/start.sh"],
      "env": {
        "NODE_ENV": "production",
        "LM_STUDIO_URL": "http://localhost:1234",
        "LM_STUDIO_MODEL": "openai/gpt-oss-20b"
      }
    }
  }
}
```

- Option B: `.mcp.json` at the project root

```json
{
  "mcpServers": {
    "LMStudio": {
      "type": "stdio",
      "command": "bash",
      "args": ["-lc", "./LMStudio-MCP/start.sh"]
    }
  }
}
```

2) User‑scoped (global)

Add to `~/.claude.json` top‑level `mcpServers`:

```json
{
  "mcpServers": {
    "LMStudio": {
      "type": "stdio",
      "command": "bash",
      "args": ["-lc", "/Users/you/path/to/ClaudeCodeSetup/LMStudio-MCP/start.sh"],
      "env": {
        "NODE_ENV": "production",
        "LM_STUDIO_URL": "http://localhost:1234",
        "LM_STUDIO_MODEL": "openai/gpt-oss-20b"
      }
    }
  }
}
```

Note: Restart Claude Code/Claude Desktop after changes so the MCP list refreshes.

### Direct Testing

```bash
# Check server health
curl http://localhost:9090/health

# View logs
tail -f logs/combined.log

# Monitor errors only
tail -f logs/error.log
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Claude Code                     │
│         (MCP Client)                    │
└────────────┬────────────────────────────┘
             │ MCP Protocol (stdio)
             ▼
┌─────────────────────────────────────────┐
│      LM Studio MCP Bridge               │
│   ┌──────────────────────────────┐      │
│   │  Request Validation Layer    │      │
│   ├──────────────────────────────┤      │
│   │  Rate Limiter & Cache        │      │
│   ├──────────────────────────────┤      │
│   │  Tool Execution Engine       │      │
│   ├──────────────────────────────┤      │
│   │  Error Handler & Retry       │      │
│   └──────────────────────────────┘      │
└────────────┬────────────────────────────┘
             │ OpenAI-compatible API
             ▼
┌─────────────────────────────────────────┐
│         LM Studio                       │
│     (Local LLM - GPT/Llama/etc)         │
└─────────────────────────────────────────┘
```

### Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name lmstudio-mcp \
  --max-memory-restart 500M \
  --error logs/pm2-error.log \
  --out logs/pm2-out.log

# Monitor
pm2 monit lmstudio-mcp
```


## License

MIT
