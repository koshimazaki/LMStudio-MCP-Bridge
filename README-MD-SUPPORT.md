# LMStudio MCP - Markdown Processing Support

## Overview

The LMStudio MCP bridge now includes comprehensive markdown file processing capabilities, allowing you to directly process, analyze, summarize, and tag markdown documentation through MCP to LMStudio.

## New Tools

### 1. `process_markdown`

Process and transform markdown documentation files with various output formats and actions.

#### Parameters

- **filePath** (string, optional): Path to markdown file to process
- **content** (string, optional): Direct markdown content (if no filePath)
- **action** (string): Processing action to perform
  - `streamline`: Make documentation more concise and clear
  - `technical`: Convert to detailed technical specification
  - `executive`: Create executive summary
  - `api`: Transform into API documentation
  - `tutorial`: Convert to step-by-step tutorial
- **format** (string): Output format
  - `markdown`: Clean, well-structured markdown
  - `html`: Semantic HTML
  - `plain`: Plain text with clear formatting
  - `structured`: JSON with sections as keys
- **sections** (array, optional): Specific sections to focus on
- **maxLength** (integer): Maximum output length in words (default: 2000)

#### Usage Examples

```javascript
// Streamline the cyber-code documentation
{
  "tool": "process_markdown",
  "arguments": {
    "filePath": "filepath/README.md",
    "action": "streamline",
    "format": "markdown",
    "maxLength": 1500
  }
}

// Create technical specification from markdown content
{
  "tool": "process_markdown",
  "arguments": {
    "content": "# My Project\n\n## Features\n...",
    "action": "technical",
    "format": "structured",
    "sections": ["Architecture", "API", "Performance"]
  }
}

// Generate executive summary
{
  "tool": "process_markdown",
  "arguments": {
    "filePath": "./docs/project-overview.md",
    "action": "executive",
    "format": "plain",
    "maxLength": 500
  }
}
```

### 2. `summarize_markdown`

Extract key findings and create concise summaries from markdown documentation.

#### Parameters

- **filePath** (string, optional): Path to markdown file to summarize
- **content** (string, optional): Direct markdown content (if no filePath)
- **style** (string): Summary style
  - `key-findings`: Extract most important findings or features
  - `tldr`: Create a brief TL;DR summary
  - `overview`: Provide high-level overview
  - `actionable`: Extract actionable items and next steps
  - `technical-summary`: Create technical summary with architecture details
- **maxPoints** (integer): Maximum number of key points (default: 5)
- **maxWords** (integer): Maximum words in summary (default: 300)

#### Usage Examples

```javascript
// Extract key findings
{
  "tool": "summarize_markdown",
  "arguments": {
    "filePath": "./README.md",
    "style": "key-findings",
    "maxPoints": 5,
    "maxWords": 200
  }
}

// Create TL;DR
{
  "tool": "summarize_markdown",
  "arguments": {
    "content": "# Long Documentation...",
    "style": "tldr",
    "maxWords": 100
  }
}

// Extract actionable items
{
  "tool": "summarize_markdown",
  "arguments": {
    "filePath": "./docs/setup.md",
    "style": "actionable",
    "maxWords": 150
  }
}
```

### 3. `tag_markdown`

Extract semantic tags and categories from markdown documentation.

#### Parameters

- **filePath** (string, optional): Path to markdown file to tag
- **content** (string, optional): Direct markdown content (if no filePath)
- **maxTags** (integer): Maximum number of tags to extract (default: 10)
- **categories** (array): Categories to focus on
  - `technology`: Technologies, platforms, and tech stacks
  - `framework`: Frameworks, libraries, and SDKs
  - `language`: Programming languages
  - `pattern`: Design patterns, architectural patterns
  - `domain`: Business domain, industry, use case
  - `feature`: Key features and capabilities
  - `tool`: Tools, utilities, and services
- **includeMetadata** (boolean): Include metadata about tags (category, relevance)

#### Usage Examples

```javascript
// Extract simple tags
{
  "tool": "tag_markdown",
  "arguments": {
    "filePath": "./README.md",
    "maxTags": 10,
    "categories": ["technology", "framework", "feature"],
    "includeMetadata": false
  }
}

// Extract tags with metadata
{
  "tool": "tag_markdown",
  "arguments": {
    "content": "# Project Documentation...",
    "maxTags": 15,
    "categories": ["technology", "framework", "pattern", "tool"],
    "includeMetadata": true
  }
}
```

### 4. `analyze_markdown`

Analyze markdown documentation for quality, completeness, and improvements.

#### Parameters

- **filePath** (string, optional): Path to markdown file to analyze
- **content** (string, optional): Direct markdown content (if no filePath)
- **checks** (array): Types of analysis to perform
  - `completeness`: Check for missing sections, incomplete explanations
  - `clarity`: Identify unclear language, jargon, ambiguous instructions
  - `structure`: Evaluate organization, formatting, navigation
  - `examples`: Assess code samples and use cases
  - `consistency`: Find conflicting information, style variations

#### Usage Examples

```javascript
// Analyze documentation quality
{
  "tool": "analyze_markdown",
  "arguments": {
    "filePath": "./README.md",
    "checks": ["completeness", "clarity", "structure"]
  }
}

// Full analysis of markdown content
{
  "tool": "analyze_markdown",
  "arguments": {
    "content": "# API Documentation\n...",
    "checks": ["completeness", "clarity", "structure", "examples", "consistency"]
  }
}
```

## Integration with Claude Code

You can now use these tools directly in Claude Code to process the cyber-code documentation:

```bash
# Process the core services documentation
mcp__LMStudio__process_markdown \
  --filePath "filepath/README.md" \
  --action "streamline" \
  --format "markdown" \
  --maxLength 2000

# Analyze documentation quality
mcp__LMStudio__analyze_markdown \
  --filePath "filepath/README.md" \
  --checks "completeness,clarity,structure"
```

## Troubleshooting

- Ensure LMStudio Local Server is running on `http://localhost:1234`
- Use absolute paths for reliability
- Verify action, format and size limits

## License

MIT

