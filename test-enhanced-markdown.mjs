#!/usr/bin/env node

/**
 * Enhanced test script for markdown summarization and tagging
 */

import fs from 'fs/promises';
import path from 'path';
import { LMStudioClient } from './dist/lm-studio-client.js';
import { tools } from './dist/tools.js';

async function testEnhancedMarkdown() {
  console.log('🧪 Testing Enhanced Markdown Features (Summarization & Tagging)\n');
  
  const client = new LMStudioClient('http://localhost:1234');
  
  // Check if LMStudio is running
  const isHealthy = await client.checkHealth();
  if (!isHealthy) {
    console.error('❌ LMStudio is not running on port 1234');
    console.log('Please start LMStudio and load a model, then try again.');
    process.exit(1);
  }
  
  console.log('✅ LMStudio is healthy\n');
  
  // Find the new tools
  const summarizeMarkdownTool = tools.find(t => t.name === 'summarize_markdown');
  const tagMarkdownTool = tools.find(t => t.name === 'tag_markdown');
  
  if (!summarizeMarkdownTool || !tagMarkdownTool) {
    console.error('❌ New markdown tools not found');
    process.exit(1);
  }
  
  // Sample markdown content
  const sampleContent = `# Cyber Code Core Services

## Overview
Cyber Code features a **modular core services architecture** with swappable providers for essential functionality. This design allows users to switch between different implementations of terminal, editor, and file system providers based on their needs.

## Architecture
Built on four main service interfaces:
- **IFileSystemProvider** - File operations and watching
- **ITerminalProvider** - Terminal sessions with zsh/bash support
- **IEditorProvider** - Code editing with Monaco features
- **IPerformanceMonitor** - System and application metrics

## Key Features

### Terminal Features
- Default Shell: zsh (falls back to bash)
- Claude Code Support: Run claude commands directly
- Vox Support: Voice interaction commands
- Koshi-Vox Integration: Button-triggered activation
- WebSocket Integration: Real-time streaming

### Editor Features
- Multi-file Support: Open multiple files simultaneously
- Syntax Highlighting: 30+ languages
- Themes: 11 built-in themes including Cyberpunk
- File Operations: Open, save, close with dirty state tracking

### File System Features
- Secure Access: Sandboxed to project directory
- File Watching: Real-time change notifications
- Directory Operations: Create, read, delete
- Tree View: Recursive directory listing

## Technologies Used
- TypeScript for type safety
- Express.js for REST APIs
- WebSocket for real-time communication
- Chokidar for file watching
- Node-pty for terminal emulation
- Monaco Editor for code editing

## Performance
- Real-time metrics streaming via SSE
- Prometheus export format support
- Configurable performance thresholds
- Request tracking middleware`;
  
  // Test 1: Summarize with key findings
  console.log('📝 Test 1: Extract key findings...\n');
  try {
    const result1 = await summarizeMarkdownTool.handler({
      content: sampleContent,
      style: 'key-findings',
      maxPoints: 5,
      maxWords: 200
    }, client);
    
    console.log('Key Findings:');
    console.log('---');
    console.log(result1);
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 1:', error.message);
  }
  
  // Test 2: Create TL;DR summary
  console.log('📊 Test 2: Create TL;DR summary...\n');
  try {
    const result2 = await summarizeMarkdownTool.handler({
      content: sampleContent,
      style: 'tldr',
      maxWords: 100
    }, client);
    
    console.log('TL;DR:');
    console.log('---');
    console.log(result2);
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 2:', error.message);
  }
  
  // Test 3: Extract actionable items
  console.log('🎯 Test 3: Extract actionable items...\n');
  try {
    const result3 = await summarizeMarkdownTool.handler({
      content: sampleContent,
      style: 'actionable',
      maxWords: 150
    }, client);
    
    console.log('Actionable Items:');
    console.log('---');
    console.log(result3);
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 3:', error.message);
  }
  
  // Test 4: Extract tags without metadata
  console.log('🏷️ Test 4: Extract simple tags...\n');
  try {
    const result4 = await tagMarkdownTool.handler({
      content: sampleContent,
      maxTags: 10,
      categories: ['technology', 'framework', 'feature'],
      includeMetadata: false
    }, client);
    
    console.log('Tags:');
    console.log('---');
    console.log(result4);
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 4:', error.message);
  }
  
  // Test 5: Extract tags with metadata
  console.log('🏷️ Test 5: Extract tags with metadata...\n');
  try {
    const result5 = await tagMarkdownTool.handler({
      content: sampleContent,
      maxTags: 8,
      categories: ['technology', 'framework', 'pattern', 'tool'],
      includeMetadata: true
    }, client);
    
    console.log('Tags with Metadata:');
    console.log('---');
    console.log(result5);
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 5:', error.message);
  }
  
  // Test 6: Test with actual cyber-code file
  console.log('📄 Test 6: Process actual cyber-code documentation...\n');
  try {
    const cyberCodePath = '/Users/radek/Documents/GIthub/ClaudeCodeSetup/cyber-code/README-CORE-SERVICES.md';
    
    try {
      await fs.access(cyberCodePath);
      
      const result6a = await summarizeMarkdownTool.handler({
        filePath: cyberCodePath,
        style: 'technical-summary',
        maxWords: 250
      }, client);
      
      console.log('Technical Summary of Cyber-Code Docs:');
      console.log('---');
      console.log(result6a.substring(0, 500) + '...');
      console.log('---\n');
      
      const result6b = await tagMarkdownTool.handler({
        filePath: cyberCodePath,
        maxTags: 15,
        categories: ['technology', 'framework', 'feature', 'tool'],
        includeMetadata: false
      }, client);
      
      console.log('Tags from Cyber-Code Docs:');
      console.log('---');
      console.log(result6b);
      console.log('---\n');
    } catch (accessError) {
      console.log('⚠️  Cyber-code file not found, skipping this test');
    }
  } catch (error) {
    console.error('Error in test 6:', error.message);
  }
  
  console.log('✅ All tests completed!');
}

// Run tests
testEnhancedMarkdown().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

