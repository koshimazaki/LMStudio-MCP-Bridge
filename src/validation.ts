import { z } from 'zod';

// Tool input schemas with strict validation
export const GenerateDocsSchema = z.object({
  code: z.string().min(1).max(50000), // Reasonable code size limit
  style: z.enum(['technical', 'user', 'api']).default('technical'),
  language: z.string().optional(),
  includeExamples: z.boolean().default(false)
});

export const SummarizeSchema = z.object({
  content: z.string().min(1).max(100000),
  max_words: z.number().int().positive().max(1000).default(100),
  style: z.enum(['brief', 'detailed', 'bullet-points']).default('brief')
});

export const ExtractTagsSchema = z.object({
  code: z.string().min(1).max(50000),
  language: z.string().min(1).max(50),
  maxTags: z.number().int().positive().max(20).default(10)
});

export const AnalyzeCodeSchema = z.object({
  code: z.string().min(1).max(50000),
  language: z.string().min(1).max(50),
  checks: z.array(z.enum(['security', 'performance', 'style', 'bugs'])).default(['security', 'bugs'])
});

export const RefactorSuggestionsSchema = z.object({
  code: z.string().min(1).max(50000),
  language: z.string().min(1).max(50),
  focus: z.enum(['readability', 'performance', 'maintainability', 'all']).default('all')
});

export const GenerateTestsSchema = z.object({
  code: z.string().min(1).max(50000),
  language: z.string().min(1).max(50),
  framework: z.string().optional(),
  coverageTarget: z.number().min(0).max(100).default(80)
});

export const ProcessMarkdownSchema = z.object({
  filePath: z.string().optional(),
  content: z.string().optional(),
  action: z.enum(['streamline', 'technical', 'executive', 'api', 'tutorial']).default('streamline'),
  format: z.enum(['markdown', 'html', 'plain', 'structured']).default('markdown'),
  sections: z.array(z.string()).optional(),
  maxLength: z.number().int().positive().max(10000).default(2000)
}).refine(data => data.filePath || data.content, {
  message: 'Either filePath or content must be provided'
});

export const AnalyzeMarkdownSchema = z.object({
  filePath: z.string().optional(),
  content: z.string().optional(),
  checks: z.array(z.enum(['completeness', 'clarity', 'structure', 'examples', 'consistency'])).default(['completeness', 'clarity', 'structure'])
}).refine(data => data.filePath || data.content, {
  message: 'Either filePath or content must be provided'
});

export const SummarizeMarkdownSchema = z.object({
  filePath: z.string().optional(),
  content: z.string().optional(),
  style: z.enum(['key-findings', 'tldr', 'overview', 'actionable', 'technical-summary']).default('key-findings'),
  maxPoints: z.number().int().positive().max(20).default(5),
  maxWords: z.number().int().positive().max(1000).default(300)
}).refine(data => data.filePath || data.content, {
  message: 'Either filePath or content must be provided'
});

export const TagMarkdownSchema = z.object({
  filePath: z.string().optional(),
  content: z.string().optional(),
  maxTags: z.number().int().positive().max(30).default(10),
  categories: z.array(z.enum(['technology', 'framework', 'language', 'pattern', 'domain', 'feature', 'tool'])).optional(),
  includeMetadata: z.boolean().default(false)
}).refine(data => data.filePath || data.content, {
  message: 'Either filePath or content must be provided'
});

// Response validation schemas
export const LMStudioResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: z.object({
      role: z.string(),
      content: z.string()
    }),
    finish_reason: z.string().nullable()
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number()
  }).optional()
});

// Tool metadata validation
export const ToolMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  inputSchema: z.record(z.any()),
  cacheable: z.boolean().default(false),
  timeout: z.number().positive().optional()
});

// Sanitization functions
export function sanitizeInput(input: string): string {
  // Remove potential injection attempts
  return input
    .replace(/[<>]/g, '') // Remove HTML-like tags
    .replace(/\x00/g, '') // Remove null bytes
    .trim();
}

export function validateJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Security checks
export function detectPotentialInjection(input: string): boolean {
  const suspiciousPatterns = [
    /system\s*\(/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /__proto__/i,
    /constructor\s*\[/i,
    /import\s*\(/i,
    /require\s*\(/i
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}