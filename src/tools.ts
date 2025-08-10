import { 
  GenerateDocsSchema,
  SummarizeSchema,
  ExtractTagsSchema,
  AnalyzeCodeSchema,
  RefactorSuggestionsSchema,
  GenerateTestsSchema,
  ProcessMarkdownSchema,
  AnalyzeMarkdownSchema,
  SummarizeMarkdownSchema,
  TagMarkdownSchema,
  sanitizeInput,
  detectPotentialInjection,
  ValidationError
} from './validation.js';
import { LMStudioClient } from './lm-studio-client.js';
import { logger } from './logger.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any, client: LMStudioClient) => Promise<string>;
  cacheable?: boolean;
  timeout?: number;
}

function generateCacheKey(toolName: string, args: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(toolName);
  hash.update(JSON.stringify(args));
  return hash.digest('hex');
}

export const tools: Tool[] = [
  {
    name: 'generate_docs',
    description: 'Generate comprehensive documentation for code with various styles',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to document' },
        style: { 
          type: 'string', 
          enum: ['technical', 'user', 'api'],
          description: 'Documentation style'
        },
        language: { type: 'string', description: 'Programming language' },
        includeExamples: { type: 'boolean', description: 'Include usage examples' }
      },
      required: ['code']
    },
    cacheable: true,
    handler: async (args, client) => {
      const validated = GenerateDocsSchema.parse(args);
      
      // Security check
      if (detectPotentialInjection(validated.code)) {
        throw new ValidationError('Potentially unsafe code detected');
      }
      
      const sanitizedCode = sanitizeInput(validated.code);
      
      const prompt = `Generate ${validated.style} documentation for the following ${validated.language || 'code'}.
${validated.includeExamples ? 'Include practical usage examples.' : ''}

Code:
\`\`\`${validated.language || ''}
${sanitizedCode}
\`\`\`

Documentation format:
- Clear description of purpose
- Parameters/inputs explanation
- Return values/outputs
- ${validated.style === 'technical' ? 'Implementation details' : ''}
- ${validated.style === 'user' ? 'User-friendly explanations' : ''}
- ${validated.style === 'api' ? 'API usage patterns' : ''}
${validated.includeExamples ? '- Usage examples with expected outputs' : ''}`;

      const cacheKey = generateCacheKey('generate_docs', validated);
      return await client.complete(prompt, { 
        temperature: 0.3,
        cacheKey 
      });
    }
  },
  
  {
    name: 'summarize',
    description: 'Create concise summaries of code or text with configurable length',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to summarize' },
        max_words: { type: 'integer', description: 'Maximum words in summary' },
        style: { 
          type: 'string',
          enum: ['brief', 'detailed', 'bullet-points'],
          description: 'Summary style'
        }
      },
      required: ['content']
    },
    cacheable: true,
    handler: async (args, client) => {
      const validated = SummarizeSchema.parse(args);
      
      const sanitizedContent = sanitizeInput(validated.content);
      
      const styleInstructions = {
        'brief': 'Provide a concise, high-level summary',
        'detailed': 'Include key details and nuances',
        'bullet-points': 'Format as clear bullet points'
      };
      
      const prompt = `${styleInstructions[validated.style]}.
Maximum ${validated.max_words} words.

Content to summarize:
${sanitizedContent}

Summary:`;

      const cacheKey = generateCacheKey('summarize', validated);
      return await client.complete(prompt, {
        temperature: 0.2,
        maxTokens: validated.max_words * 2, // Approximate token count
        cacheKey
      });
    }
  },
  
  {
    name: 'extract_tags',
    description: 'Extract semantic tags and keywords from code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze' },
        language: { type: 'string', description: 'Programming language' },
        maxTags: { type: 'integer', description: 'Maximum number of tags' }
      },
      required: ['code', 'language']
    },
    cacheable: true,
    handler: async (args, client) => {
      const validated = ExtractTagsSchema.parse(args);
      
      if (detectPotentialInjection(validated.code)) {
        throw new ValidationError('Potentially unsafe code detected');
      }
      
      const sanitizedCode = sanitizeInput(validated.code);
      
      const prompt = `Extract up to ${validated.maxTags} semantic tags from this ${validated.language} code.
Focus on:
- Main functionality/purpose
- Key algorithms/patterns used
- Technologies/frameworks
- Data structures
- Design patterns
- Domain concepts

Code:
\`\`\`${validated.language}
${sanitizedCode}
\`\`\`

Return ONLY a JSON array of strings, no explanation:`;

      const cacheKey = generateCacheKey('extract_tags', validated);
      const response = await client.complete(prompt, {
        temperature: 0.1,
        cacheKey
      });
      
      // Validate JSON response
      try {
        const tags = JSON.parse(response);
        if (!Array.isArray(tags)) {
          throw new Error('Response is not an array');
        }
        return JSON.stringify(tags.slice(0, validated.maxTags));
      } catch (error) {
        logger.warn('Failed to parse tags as JSON, returning raw response', { error });
        return response;
      }
    }
  },
  
  {
    name: 'analyze_code',
    description: 'Perform comprehensive code analysis for issues and improvements',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze' },
        language: { type: 'string', description: 'Programming language' },
        checks: {
          type: 'array',
          items: { 
            type: 'string',
            enum: ['security', 'performance', 'style', 'bugs']
          },
          description: 'Types of analysis to perform'
        }
      },
      required: ['code', 'language']
    },
    timeout: 45000, // Longer timeout for complex analysis
    handler: async (args, client) => {
      const validated = AnalyzeCodeSchema.parse(args);
      
      if (detectPotentialInjection(validated.code)) {
        throw new ValidationError('Potentially unsafe code detected');
      }
      
      const sanitizedCode = sanitizeInput(validated.code);
      
      const checkDescriptions = {
        security: 'Security vulnerabilities (injection, XSS, authentication issues)',
        performance: 'Performance bottlenecks and optimization opportunities',
        style: 'Code style, readability, and best practices',
        bugs: 'Potential bugs, logic errors, and edge cases'
      };
      
      const selectedChecks = validated.checks
        .map(check => `- ${checkDescriptions[check]}`)
        .join('\n');
      
      const prompt = `Analyze this ${validated.language} code for:
${selectedChecks}

Code:
\`\`\`${validated.language}
${sanitizedCode}
\`\`\`

Provide a structured analysis with:
1. Issues found (categorized by severity: HIGH, MEDIUM, LOW)
2. Specific line numbers where applicable
3. Recommended fixes
4. Overall code quality score (1-10)`;

      return await client.complete(prompt, {
        temperature: 0.2,
        maxTokens: 2000
      });
    }
  },
  
  {
    name: 'refactor_suggestions',
    description: 'Suggest code refactoring improvements',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to refactor' },
        language: { type: 'string', description: 'Programming language' },
        focus: {
          type: 'string',
          enum: ['readability', 'performance', 'maintainability', 'all'],
          description: 'Refactoring focus area'
        }
      },
      required: ['code', 'language']
    },
    handler: async (args, client) => {
      const validated = RefactorSuggestionsSchema.parse(args);
      
      if (detectPotentialInjection(validated.code)) {
        throw new ValidationError('Potentially unsafe code detected');
      }
      
      const sanitizedCode = sanitizeInput(validated.code);
      
      const focusInstructions = {
        readability: 'Focus on making the code more readable and self-documenting',
        performance: 'Focus on performance optimizations and efficiency',
        maintainability: 'Focus on modularity, testability, and future extensibility',
        all: 'Consider all aspects: readability, performance, and maintainability'
      };
      
      const prompt = `Suggest refactoring improvements for this ${validated.language} code.
${focusInstructions[validated.focus]}.

Original code:
\`\`\`${validated.language}
${sanitizedCode}
\`\`\`

Provide:
1. Specific refactoring suggestions with explanations
2. Code snippets showing the improvements
3. Benefits of each change
4. Priority ranking (HIGH, MEDIUM, LOW)`;

      return await client.complete(prompt, {
        temperature: 0.3,
        maxTokens: 2000
      });
    }
  },
  
  {
    name: 'generate_tests',
    description: 'Generate comprehensive test cases for code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to test' },
        language: { type: 'string', description: 'Programming language' },
        framework: { type: 'string', description: 'Testing framework to use' },
        coverageTarget: { type: 'number', description: 'Target test coverage percentage' }
      },
      required: ['code', 'language']
    },
    handler: async (args, client) => {
      const validated = GenerateTestsSchema.parse(args);
      
      if (detectPotentialInjection(validated.code)) {
        throw new ValidationError('Potentially unsafe code detected');
      }
      
      const sanitizedCode = sanitizeInput(validated.code);
      
      const prompt = `Generate comprehensive test cases for this ${validated.language} code.
${validated.framework ? `Use ${validated.framework} testing framework.` : ''}
Target coverage: ${validated.coverageTarget}%

Code to test:
\`\`\`${validated.language}
${sanitizedCode}
\`\`\`

Generate tests that include:
1. Unit tests for each function/method
2. Edge cases and boundary conditions
3. Error handling scenarios
4. Integration tests if applicable
5. Mock objects/stubs where needed
6. Clear test descriptions
7. Assertions with expected values`;

      return await client.complete(prompt, {
        temperature: 0.2,
        maxTokens: 3000
      });
    }
  }
  ,
  {
    name: 'process_markdown',
    description: 'Process and streamline markdown documentation files',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to markdown file' },
        content: { type: 'string', description: 'Direct markdown content (if no filePath)' },
        action: {
          type: 'string',
          enum: ['streamline', 'technical', 'executive', 'api', 'tutorial'],
          description: 'Processing action to perform'
        },
        format: {
          type: 'string',
          enum: ['markdown', 'html', 'plain', 'structured'],
          description: 'Output format'
        },
        sections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific sections to focus on'
        },
        maxLength: { type: 'integer', description: 'Maximum output length in words' }
      },
      required: []
    },
    cacheable: true,
    timeout: 60000,
    handler: async (args, client) => {
      const validated = ProcessMarkdownSchema.parse(args);
      let content: string = '';
      
      if (validated.filePath) {
        try {
          const resolvedPath = path.resolve(validated.filePath);
          content = await fs.readFile(resolvedPath, 'utf-8');
          logger.info(`Loaded markdown file: ${resolvedPath}`);
        } catch (error) {
          throw new ValidationError(`Failed to read file: ${validated.filePath} - ${error}`);
        }
      } else if (validated.content) {
        content = validated.content;
      } else {
        throw new ValidationError('Either filePath or content must be provided');
      }
      
      const sanitizedContent = sanitizeInput(content);
      const action = validated.action || 'streamline';
      const format = validated.format || 'markdown';
      const maxLength = validated.maxLength || 2000;
      
      const actionPrompts = {
        streamline: `Streamline this documentation to be more concise and clear while preserving all critical information. Focus on:
- Removing redundancy
- Improving clarity
- Better organization
- Highlighting key features
- Making it scannable`,
        
        technical: `Convert this documentation into a detailed technical specification. Include:
- Architecture details
- Implementation specifics
- API references
- Code examples
- Performance considerations
- Security notes`,
        
        executive: `Create an executive summary of this documentation. Focus on:
- Business value
- Key capabilities
- ROI potential
- Strategic advantages
- High-level architecture`,
        
        api: `Transform this into API documentation. Structure it with:
- Endpoint definitions
- Request/response formats
- Authentication details
- Error codes
- Usage examples
- Rate limits`,
        
        tutorial: `Convert this into a step-by-step tutorial. Include:
- Prerequisites
- Setup instructions
- Hands-on exercises
- Code examples
- Troubleshooting tips
- Best practices`
      } as const;
      
      const sectionsFilter = validated.sections 
        ? `Focus particularly on these sections: ${validated.sections.join(', ')}`
        : '';
      
      const formatInstructions = {
        markdown: 'Output in clean, well-structured markdown format',
        html: 'Output in semantic HTML with appropriate tags',
        plain: 'Output in plain text with clear formatting',
        structured: 'Output as structured JSON with sections as keys'
      } as const;
      
      const prompt = `${actionPrompts[action]}

${sectionsFilter}

Maximum length: ${maxLength} words
${formatInstructions[format]}

Original documentation:
${sanitizedContent}

Processed output:`;
      
      const cacheKey = generateCacheKey('process_markdown', {
        action,
        format,
        sections: validated.sections,
        contentHash: crypto.createHash('sha256').update(sanitizedContent).digest('hex')
      });

      const response = await client.complete(prompt, {
        temperature: 0.3,
        maxTokens: maxLength * 2,
        cacheKey
      });

      if (format === 'structured') {
        try {
          return JSON.stringify(JSON.parse(response), null, 2);
        } catch {
          return JSON.stringify({ content: response }, null, 2);
        }
      }
      
      return response;
    }
  },
  {
    name: 'summarize_markdown',
    description: 'Extract key findings and create concise summaries from markdown documentation',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to markdown file' },
        content: { type: 'string', description: 'Direct markdown content (if no filePath)' },
        style: {
          type: 'string',
          enum: ['key-findings', 'tldr', 'overview', 'actionable', 'technical-summary'],
          description: 'Summary style'
        },
        maxPoints: { type: 'integer', description: 'Maximum number of key points' },
        maxWords: { type: 'integer', description: 'Maximum words in summary' }
      },
      required: []
    },
    cacheable: true,
    timeout: 45000,
    handler: async (args, client) => {
      const validated = SummarizeMarkdownSchema.parse(args);
      let content: string = '';
      
      if (validated.filePath) {
        try {
          const resolvedPath = path.resolve(validated.filePath);
          content = await fs.readFile(resolvedPath, 'utf-8');
          logger.info(`Loaded markdown file for summarization: ${resolvedPath}`);
        } catch (error) {
          throw new ValidationError(`Failed to read file: ${validated.filePath}`);
        }
      } else if (validated.content) {
        content = validated.content;
      } else {
        throw new ValidationError('Either filePath or content must be provided');
      }
      
      const sanitizedContent = sanitizeInput(content);
      const style = validated.style || 'key-findings';
      const maxPoints = validated.maxPoints || 5;
      const maxWords = validated.maxWords || 300;
      
      const stylePrompts = {
        'key-findings': `Extract the ${maxPoints} most important findings or features from this documentation. Focus on:
- Core capabilities
- Unique features
- Critical information
- Important dependencies or requirements
- Key benefits`,
        
        'tldr': `Create a TL;DR summary in ${maxWords} words or less. Include:
- What it is
- What it does
- Why it matters
- How to use it`,
        
        'overview': `Provide a high-level overview covering:
- Purpose and goals
- Main components
- Use cases
- Target audience`,
        
        'actionable': `Extract actionable items and next steps:
- Required actions
- Setup steps
- Configuration needed
- Commands to run
- Things to verify`,
        
        'technical-summary': `Create a technical summary highlighting:
- Architecture patterns
- Technologies used
- APIs and interfaces
- Performance characteristics
- Integration points`
      } as const;
      
      const prompt = `${stylePrompts[style]}

Maximum ${maxWords} words.
Format as a bulleted list for clarity.

Documentation:
${sanitizedContent}

Summary:`;

      const cacheKey = generateCacheKey('summarize_markdown', {
        style,
        maxPoints,
        maxWords,
        contentHash: crypto.createHash('sha256').update(sanitizedContent).digest('hex')
      });

      return await client.complete(prompt, {
        temperature: 0.2,
        maxTokens: maxWords * 2,
        cacheKey
      });
    }
  },
  {
    name: 'tag_markdown',
    description: 'Extract semantic tags and categories from markdown documentation',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to markdown file' },
        content: { type: 'string', description: 'Direct markdown content (if no filePath)' },
        maxTags: { type: 'integer', description: 'Maximum number of tags to extract' },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['technology', 'framework', 'language', 'pattern', 'domain', 'feature', 'tool']
          },
          description: 'Categories to focus on'
        },
        includeMetadata: { type: 'boolean', description: 'Include metadata about tags' }
      },
      required: []
    },
    cacheable: true,
    handler: async (args, client) => {
      const validated = TagMarkdownSchema.parse(args);
      let content: string = '';
      
      if (validated.filePath) {
        try {
          const resolvedPath = path.resolve(validated.filePath);
          content = await fs.readFile(resolvedPath, 'utf-8');
        } catch (error) {
          throw new ValidationError(`Failed to read file: ${validated.filePath}`);
        }
      } else if (validated.content) {
        content = validated.content;
      } else {
        throw new ValidationError('Either filePath or content must be provided');
      }
      
      const sanitizedContent = sanitizeInput(content);
      const maxTags = validated.maxTags || 10;
      const categories = validated.categories || ['technology', 'framework', 'feature'];
      const includeMetadata = validated.includeMetadata || false;
      
      const categoryDescriptions = {
        technology: 'Technologies, platforms, and tech stacks',
        framework: 'Frameworks, libraries, and SDKs',
        language: 'Programming languages',
        pattern: 'Design patterns, architectural patterns',
        domain: 'Business domain, industry, use case',
        feature: 'Key features and capabilities',
        tool: 'Tools, utilities, and services'
      } as const;
      
      const selectedCategories = categories
        .map(cat => `- ${categoryDescriptions[cat]}`)
        .join('\n');
      
      const prompt = `Extract up to ${maxTags} semantic tags from this markdown documentation.
Focus on these categories:
${selectedCategories}

${includeMetadata ? 'For each tag, provide: tag name, category, and relevance (high/medium/low)' : 'Return a simple list of tags'}

Documentation:
${sanitizedContent}

${includeMetadata ? 'Return as JSON format: [{"tag": "name", "category": "type", "relevance": "level"}]' : 'Return as JSON array of strings'}:`;
      
      const cacheKey = generateCacheKey('tag_markdown', {
        maxTags,
        categories,
        includeMetadata,
        contentHash: crypto.createHash('sha256').update(sanitizedContent).digest('hex')
      });

      const response = await client.complete(prompt, {
        temperature: 0.1,
        maxTokens: 500,
        cacheKey
      });
      
      try {
        const tags = JSON.parse(response);
        if (!Array.isArray(tags)) {
          throw new Error('Response is not an array');
        }
        return JSON.stringify(tags, null, 2);
      } catch (error) {
        logger.warn('Failed to parse tags as JSON, returning raw response', { error });
        return response;
      }
    }
  },
  {
    name: 'analyze_markdown',
    description: 'Analyze markdown documentation for quality, completeness, and improvements',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to markdown file' },
        content: { type: 'string', description: 'Direct markdown content (if no filePath)' },
        checks: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['completeness', 'clarity', 'structure', 'examples', 'consistency']
          },
          description: 'Types of analysis to perform'
        }
      },
      required: []
    },
    cacheable: true,
    handler: async (args, client) => {
      const validated = AnalyzeMarkdownSchema.parse(args);
      let content: string = '';
      
      if (validated.filePath) {
        try {
          const resolvedPath = path.resolve(validated.filePath);
          content = await fs.readFile(resolvedPath, 'utf-8');
        } catch (error) {
          throw new ValidationError(`Failed to read file: ${validated.filePath}`);
        }
      } else if (validated.content) {
        content = validated.content;
      } else {
        throw new ValidationError('Either filePath or content must be provided');
      }
      
      const sanitizedContent = sanitizeInput(content);
      const checks = validated.checks || ['completeness', 'clarity', 'structure'];
      
      const checkDescriptions = {
        completeness: 'Missing sections, incomplete explanations, lacking examples',
        clarity: 'Unclear language, jargon without explanation, ambiguous instructions',
        structure: 'Poor organization, inconsistent formatting, navigation issues',
        examples: 'Lack of examples, unclear code samples, missing use cases',
        consistency: 'Inconsistent terminology, conflicting information, style variations'
      } as const;
      
      const selectedChecks = checks
        .map(check => `- ${checkDescriptions[check]}`)
        .join('\n');
      
      const prompt = `Analyze this markdown documentation for:
${selectedChecks}

Documentation:
${sanitizedContent}

Provide a detailed analysis with:
1. Quality score (1-10) for each checked area
2. Specific issues found with line references where applicable
3. Improvement recommendations
4. Priority of fixes (HIGH, MEDIUM, LOW)
5. Overall documentation grade (A-F)`;
      
      return await client.complete(prompt, {
        temperature: 0.2,
        maxTokens: 2000
      });
    }
  }
];

export function getToolByName(name: string): Tool | undefined {
  return tools.find(tool => tool.name === name);
}

export function validateToolInput(toolName: string, input: any): any {
  const tool = getToolByName(toolName);
  if (!tool) {
    throw new ValidationError(`Unknown tool: ${toolName}`);
  }
  
  // Additional validation based on tool-specific schemas
  switch (toolName) {
    case 'generate_docs':
      return GenerateDocsSchema.parse(input);
    case 'summarize':
      return SummarizeSchema.parse(input);
    case 'extract_tags':
      return ExtractTagsSchema.parse(input);
    case 'analyze_code':
      return AnalyzeCodeSchema.parse(input);
    case 'refactor_suggestions':
      return RefactorSuggestionsSchema.parse(input);
    case 'generate_tests':
      return GenerateTestsSchema.parse(input);
    case 'process_markdown':
      return ProcessMarkdownSchema.parse(input);
    case 'summarize_markdown':
      return SummarizeMarkdownSchema.parse(input);
    case 'tag_markdown':
      return TagMarkdownSchema.parse(input);
    case 'analyze_markdown':
      return AnalyzeMarkdownSchema.parse(input);
    default:
      return input;
  }
}