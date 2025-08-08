import { 
  GenerateDocsSchema,
  SummarizeSchema,
  ExtractTagsSchema,
  AnalyzeCodeSchema,
  RefactorSuggestionsSchema,
  GenerateTestsSchema,
  sanitizeInput,
  detectPotentialInjection,
  ValidationError
} from './validation.js';
import { LMStudioClient } from './lm-studio-client.js';
import { logger } from './logger.js';
import crypto from 'crypto';

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
    default:
      return input;
  }
}