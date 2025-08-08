import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool as MCPTool
} from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { logger, logPerformance } from './logger.js';
import { LMStudioClient } from './lm-studio-client.js';
import { tools, getToolByName, validateToolInput } from './tools.js';
import { ValidationError } from './validation.js';
import crypto from 'crypto';

class LMStudioMCPServer {
  private server: Server;
  private lmStudioClient: LMStudioClient;
  private transport?: StdioServerTransport;
  private isShuttingDown = false;
  private activeRequests = new Set<string>();

  constructor() {
    this.server = new Server({
      name: config.server.name,
      version: config.server.version,
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.lmStudioClient = new LMStudioClient();
    this.setupHandlers();
    this.setupSignalHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Listing available tools');
      
      const mcpTools: MCPTool[] = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as any
      }));

      return { tools: mcpTools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestId = crypto.randomUUID();
      this.activeRequests.add(requestId);
      const startTime = Date.now();

      try {
        if (this.isShuttingDown) {
          throw new Error('Server is shutting down');
        }

        const { name, arguments: args } = request.params;
        logger.info('Tool call received', { requestId, tool: name });

        // Find the tool
        const tool = getToolByName(name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }

        // Validate input
        try {
          validateToolInput(name, args || {});
        } catch (error) {
          if (error instanceof ValidationError) {
            logger.warn('Input validation failed', { 
              requestId,
              error: error.message 
            });
            return {
              content: [{
                type: 'text' as const,
                text: `Validation error: ${error.message}`
              }],
              isError: true
            };
          }
          throw error;
        }

        // Call the tool handler
        logger.info('Executing tool handler', { 
          requestId,
          tool: name 
        });

        const response = await tool.handler(args || {}, this.lmStudioClient);

        logger.info('Tool execution successful', { 
          requestId,
          tool: name,
          responseLength: response.length,
          duration: Date.now() - startTime
        });
        
        logPerformance(`tool_${name}`, startTime, { 
          requestId,
          success: true 
        });

        return {
          content: [{
            type: 'text' as const,
            text: response
          }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Tool execution error', {
          requestId,
          tool: request.params.name,
          error: errorMessage
        });

        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${errorMessage}`
          }],
          isError: true
        };
      } finally {
        this.activeRequests.delete(requestId);
      }
    });
  }

  private setupSignalHandlers() {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      this.isShuttingDown = true;

      // Wait for active requests to complete (with timeout)
      const shutdownTimeout = setTimeout(() => {
        logger.warn('Forcefully shutting down after timeout');
        process.exit(1);
      }, config.server.gracefulShutdownTimeout);

      // Wait for requests to drain
      while (this.activeRequests.size > 0) {
        logger.info(`Waiting for ${this.activeRequests.size} active requests`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearTimeout(shutdownTimeout);
      
      if (this.transport) {
        await this.transport.close();
      }
      
      logger.info('Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  async start() {
    try {
      // Create transport and connect
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      
      logger.info('MCP Server started successfully', {
        name: config.server.name,
        version: config.server.version,
        lmStudioUrl: config.lmStudio.baseUrl
      });

      // Log available tools
      logger.info(`Available tools: ${tools.map(t => t.name).join(', ')}`);
      
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }
}

// Start the server
const server = new LMStudioMCPServer();
server.start().catch(error => {
  logger.error('Fatal error', { error });
  process.exit(1);
});