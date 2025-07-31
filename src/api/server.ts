/**
 * Express API server for ConversationIQ
 * Provides REST endpoints and GraphQL integration
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server } from 'http';
import { getConfig } from '../config/environment';
import { DatabaseService } from '../services/database';
import { healthRoutes } from './routes/health';
import { zendeskRoutes } from './routes/zendesk';
import { webhookRoutes } from './routes/webhooks';
import { initializeKafka, shutdownKafka } from '../messaging/kafka';
import { startEventProcessor, stopEventProcessor } from '../messaging/event-processor';

export interface ServerError extends Error {
  status?: number;
  statusCode?: number;
}

export interface AppContext {
  database: DatabaseService;
}

/**
 * Create Express application with middleware and routes
 * @returns Express app and server control functions
 */
export async function createServer(): Promise<{
  app: Application;
  startServer: (port?: number) => Promise<Server>;
  stopServer: () => Promise<void>;
}> {
  const app = express();
  const config = getConfig();

  // Initialize database service
  const database = new DatabaseService();

  // Create app context
  const appContext: AppContext = {
    database,
  };

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for iframe embedding in Zendesk
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      optionsSuccessStatus: 200,
    })
  );

  // Request logging (disabled in test environment)
  if (config.environment !== 'test') {
    app.use(morgan('combined'));
  }

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Add context to request object
  app.use(
    (
      req: Request & { context?: AppContext },
      res: Response,
      next: NextFunction
    ) => {
      req.context = appContext;
      next();
    }
  );

  // Health check routes
  app.use('/health', healthRoutes);

  // Zendesk app routes
  app.use('/zendesk', zendeskRoutes);

  // Webhook routes
  app.use('/webhooks', webhookRoutes);

  // GraphQL endpoint (placeholder for now)
  app.use('/graphql', (req: Request, res: Response) => {
    res.status(501).json({
      error: 'Not Implemented',
      message: 'GraphQL endpoint not yet implemented',
    });
  });

  // API version prefix for REST endpoints (catch-all for undefined endpoints)
  app.use('/api/v1', (req: Request, res: Response) => {
    res.status(501).json({
      error: 'Not Implemented',
      message: 'REST API endpoints not yet implemented',
    });
  });

  // 404 handler for unknown routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  app.use(
    (
      err: ServerError,
      req: Request,
      res: Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      next: NextFunction
    ): void => {
      // Log error in non-test environments
      if (config.environment !== 'test') {
        console.error('Server Error:', err);
      }

      // Handle JSON parsing errors
      if (err.message?.includes('JSON')) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Default error response
      const statusCode = err.status || err.statusCode || 500;
      const message =
        statusCode === 500 ? 'Internal Server Error' : err.message;

      res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : 'Error',
        message,
        timestamp: new Date().toISOString(),
        ...(config.isDevelopment && { stack: err.stack }),
      });
    }
  );

  let server: Server | null = null;

  /**
   * Start the server on specified port
   * @param port - Port number (defaults to config port)
   * @returns HTTP Server instance
   */
  const startServer = async (port?: number): Promise<Server> => {
    const serverPort = port ?? config.port;

    // Connect to database
    await database.connect();

    // Initialize Kafka and event processing
    if (config.environment !== 'test') {
      try {
        await initializeKafka();
        await startEventProcessor();
        console.log('📡 Kafka and event processing initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Kafka:', error);
        // Continue without Kafka in development, but fail in production
        if (config.isProduction) {
          throw error;
        }
      }
    }

    return new Promise((resolve, reject) => {
      server = app.listen(serverPort, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          if (config.environment !== 'test') {
            console.log(`🚀 Server running on port ${serverPort}`);
            console.log(
              `📊 Health check: http://localhost:${serverPort}/health`
            );
            console.log(`🔍 GraphQL: http://localhost:${serverPort}/graphql`);
          }
          resolve(server!);
        }
      });
    });
  };

  /**
   * Stop the server gracefully
   */
  const stopServer = async (): Promise<void> => {
    // Stop event processing and Kafka
    if (config.environment !== 'test') {
      try {
        await stopEventProcessor();
        await shutdownKafka();
        console.log('📴 Kafka and event processing shut down');
      } catch (error) {
        console.error('❌ Error shutting down Kafka:', error);
      }
    }

    if (server) {
      await new Promise<void>(resolve => {
        server!.close(() => {
          if (config.environment !== 'test') {
            console.log('🛑 Server stopped');
          }
          resolve();
        });
      });
    }

    // Disconnect from database
    await database.disconnect();
  };

  return {
    app,
    startServer,
    stopServer,
  };
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
