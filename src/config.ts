import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(dirname(__dirname), '.env') });

// Configuration schema with validation
const ConfigSchema = z.object({
  lmStudio: z.object({
    baseUrl: z.string().url().default('http://localhost:1234'),
    apiKey: z.string().default('lm-studio'),
    model: z.string().default('local-model'),
    maxRetries: z.number().int().positive().default(3),
    retryDelay: z.number().int().positive().default(1000),
    timeout: z.number().int().positive().default(30000), // 30 seconds
    healthCheckInterval: z.number().int().positive().default(60000), // 1 minute
  }),
  server: z.object({
    name: z.string().default('LMStudio'),
    version: z.string().default('1.0.0'),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    gracefulShutdownTimeout: z.number().int().positive().default(5000),
  }),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    maxRequestsPerMinute: z.number().int().positive().default(60),
    maxConcurrent: z.number().int().positive().default(10),
  }),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().int().positive().default(300), // 5 minutes
    checkPeriod: z.number().int().positive().default(60), // 1 minute
  }),
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    metricsPort: z.number().int().positive().default(9090),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// Parse and validate configuration
function loadConfig(): Config {
  try {
    const config = ConfigSchema.parse({
      lmStudio: {
        baseUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234',
        apiKey: process.env.LM_STUDIO_API_KEY || 'lm-studio',
        model: process.env.LM_STUDIO_MODEL || 'local-model',
        maxRetries: parseInt(process.env.LM_STUDIO_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.LM_STUDIO_RETRY_DELAY || '1000'),
        timeout: parseInt(process.env.LM_STUDIO_TIMEOUT || '30000'),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
      },
      server: {
        name: process.env.SERVER_NAME || 'LMStudio',
        version: process.env.SERVER_VERSION || '1.0.0',
        logLevel: process.env.LOG_LEVEL || 'info',
        gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '5000'),
      },
      rateLimit: {
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        maxRequestsPerMinute: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),
        maxConcurrent: parseInt(process.env.RATE_LIMIT_MAX_CONCURRENT || '10'),
      },
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.CACHE_TTL || '300'),
        checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '60'),
      },
      monitoring: {
        metricsEnabled: process.env.METRICS_ENABLED !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
      },
    });

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:', error.errors);
      throw new Error(`Invalid configuration: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export const config = loadConfig();