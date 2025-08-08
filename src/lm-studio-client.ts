import OpenAI from 'openai';
import pRetry from 'p-retry';
import pTimeout from 'p-timeout';
import { config } from './config.js';
import { logger } from './logger.js';
import { LMStudioResponseSchema } from './validation.js';
import NodeCache from 'node-cache';

export class LMStudioClient {
  private client: OpenAI;
  private cache: NodeCache;
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private activeRequests: number = 0;
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private requestTimestamps: number[] = [];

  constructor() {
    this.client = new OpenAI({
      baseURL: `${config.lmStudio.baseUrl}/v1`,
      apiKey: config.lmStudio.apiKey,
      timeout: config.lmStudio.timeout,
      maxRetries: 0 // We handle retries ourselves
    });

    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      checkperiod: config.cache.checkPeriod,
      useClones: false
    });

    // Start health check loop
    this.startHealthCheckLoop();
  }

  private startHealthCheckLoop() {
    setInterval(async () => {
      await this.checkHealth();
    }, config.lmStudio.healthCheckInterval);
    
    // Initial health check
    this.checkHealth();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const startTime = Date.now();
      const response = await pTimeout(
        this.client.models.list(),
        { milliseconds: 5000 }
      );
      
      const duration = Date.now() - startTime;
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      logger.debug('LM Studio health check successful', { 
        duration_ms: duration,
        models_count: response.data.length 
      });
      
      return true;
    } catch (error) {
      this.isHealthy = false;
      logger.error('LM Studio health check failed', { error });
      return false;
    }
  }

  private enforceRateLimit(): void {
    if (!config.rateLimit.enabled) return;

    // Clean old timestamps
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    // Check rate limit
    if (this.requestTimestamps.length >= config.rateLimit.maxRequestsPerMinute) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Check concurrent requests
    if (this.activeRequests >= config.rateLimit.maxConcurrent) {
      throw new Error('Too many concurrent requests. Please try again later.');
    }

    this.requestTimestamps.push(Date.now());
  }

  async complete(
    prompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      cacheKey?: string;
      stream?: boolean;
    } = {}
  ): Promise<string> {
    // Check if we have a cached response
    if (config.cache.enabled && options.cacheKey) {
      const cached = this.cache.get<string>(options.cacheKey);
      if (cached) {
        logger.debug('Cache hit', { cacheKey: options.cacheKey });
        this.totalRequests++;
        return cached;
      }
    }

    // Enforce rate limiting
    this.enforceRateLimit();

    // Check health status
    if (!this.isHealthy && (Date.now() - this.lastHealthCheck) > 10000) {
      await this.checkHealth();
    }

    if (!this.isHealthy) {
      throw new Error('LM Studio is not responding. Please ensure it is running.');
    }

    this.activeRequests++;
    this.totalRequests++;
    const startTime = Date.now();

    try {
      const response = await pRetry(
        async () => {
          const completion = await pTimeout(
            this.client.chat.completions.create({
              model: config.lmStudio.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: options.temperature ?? 0.3,
              max_tokens: options.maxTokens,
              stream: options.stream ?? false
            }),
            { milliseconds: config.lmStudio.timeout }
          );

          // Validate response
          const validated = LMStudioResponseSchema.parse(completion);
          return validated;
        },
        {
          retries: config.lmStudio.maxRetries,
          minTimeout: config.lmStudio.retryDelay,
          maxTimeout: config.lmStudio.retryDelay * 3,
          onFailedAttempt: (error) => {
            logger.warn(`LM Studio request failed, attempt ${error.attemptNumber}/${config.lmStudio.maxRetries}`, {
              error: error.message,
              retriesLeft: error.retriesLeft
            });
          }
        }
      );

      const result = response.choices[0]?.message?.content || '';
      const duration = Date.now() - startTime;

      logger.info('LM Studio completion successful', {
        duration_ms: duration,
        prompt_length: prompt.length,
        response_length: result.length,
        tokens_used: response.usage?.total_tokens
      });

      // Cache the result if enabled
      if (config.cache.enabled && options.cacheKey) {
        this.cache.set(options.cacheKey, result);
      }

      return result;
    } catch (error) {
      this.totalErrors++;
      const duration = Date.now() - startTime;
      
      logger.error('LM Studio completion failed', {
        error,
        duration_ms: duration,
        prompt_length: prompt.length
      });

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Request timed out after ${config.lmStudio.timeout}ms`);
      }

      throw error;
    } finally {
      this.activeRequests--;
    }
  }

  async completeStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<void> {
    this.enforceRateLimit();

    if (!this.isHealthy) {
      throw new Error('LM Studio is not responding');
    }

    this.activeRequests++;
    this.totalRequests++;
    const startTime = Date.now();

    try {
      const stream = await this.client.chat.completions.create({
        model: config.lmStudio.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }

      const duration = Date.now() - startTime;
      logger.info('LM Studio streaming completion successful', {
        duration_ms: duration,
        prompt_length: prompt.length
      });
    } catch (error) {
      this.totalErrors++;
      logger.error('LM Studio streaming failed', { error });
      throw error;
    } finally {
      this.activeRequests--;
    }
  }

  getMetrics() {
    return {
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests : 0,
      cacheSize: this.cache.keys().length,
      requestsPerMinute: this.requestTimestamps.length
    };
  }

  async shutdown() {
    logger.info('Shutting down LM Studio client');
    this.cache.flushAll();
    this.cache.close();
  }
}