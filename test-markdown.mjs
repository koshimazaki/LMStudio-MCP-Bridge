#!/usr/bin/env node

/**
 * Test script for markdown processing functionality
 */

import fs from 'fs';
import path from 'path';
import { LMStudioClient } from './dist/lm-studio-client.js';
import { tools } from './dist/tools.js';

async function testMarkdownProcessing() {
  console.log('🧪 Testing Markdown Processing Capabilities\n');
  
  const client = new LMStudioClient('http://localhost:1234');
  
  // Check if LMStudio is running
  const isHealthy = await client.checkHealth();
  if (!isHealthy) {
    console.error('❌ LMStudio is not running on port 1234');
    console.log('Please start LMStudio and load a model, then try again.');
    process.exit(1);
  }
  
  console.log('✅ LMStudio is healthy\n');
  
  // Find the process_markdown tool
  const processMarkdownTool = tools.find(t => t.name === 'process_markdown');
  const analyzeMarkdownTool = tools.find(t => t.name === 'analyze_markdown');
  
  if (!processMarkdownTool || !analyzeMarkdownTool) {
    console.error('❌ Markdown tools not found');
    process.exit(1);
  }
  
  // Test 1: Process cyber-code documentation
  console.log('📝 Test 1: Streamlining cyber-code documentation...\n');
  try {
    const result1 = await processMarkdownTool.handler({
      filePath: 'add filepath here',
      action: 'streamline',
      format: 'markdown',
      maxLength: 500
    }, client);
    
    console.log('Streamlined Documentation (first 500 chars):');
    console.log('---');
    console.log(result1.substring(0, 500) + '...');
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 1:', error.message);
  }
  
  // Test 2: Create executive summary
  console.log('📊 Test 2: Creating executive summary...\n');
  try {
    const result2 = await processMarkdownTool.handler({
      content: `# Cyber Code Core Services

## Overview
Cyber Code features a modular core services architecture with swappable providers for essential functionality.

## Key Features
- File System API with watching
- Terminal with Claude Code and Vox support
- Monaco Editor integration
- Performance monitoring

## Architecture
Built on TypeScript interfaces allowing runtime provider switching.`,
      action: 'executive',
      format: 'plain',
      maxLength: 200
    }, client);
    
    console.log('Executive Summary:');
    console.log('---');
    console.log(result2);
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 2:', error.message);
  }
  
  // Test 3: Analyze documentation quality
  console.log('🔍 Test 3: Analyzing documentation quality...\n');
  try {
    const result3 = await analyzeMarkdownTool.handler({
      content: `# Project Title

## Installation
npm install

## Usage
Run the app.

## License
MIT`,
      checks: ['completeness', 'clarity', 'examples']
    }, client);
    
    console.log('Documentation Analysis:');
    console.log('---');
    console.log(result3.substring(0, 500) + '...');
    console.log('---\n');
  } catch (error) {
    console.error('Error in test 3:', error.message);
  }
  
  console.log('✅ All tests completed!');
}

// Run tests
testMarkdownProcessing().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

