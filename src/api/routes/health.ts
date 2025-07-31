/**
 * Health check routes for ConversationIQ API
 * Provides liveness, readiness, and general health endpoints
 */

import { Router, Request, Response } from 'express';
import { getConfig } from '../../config/environment';
import { AppContext } from '../server';
import { getKafkaService } from '../../messaging/kafka';
import { getEventProcessor } from '../../messaging/event-processor';

export const healthRoutes = Router();

/**
 * Basic health check endpoint
 * Always returns 200 if the server is running
 */
healthRoutes.get('/', (req: Request, res: Response) => {
  const config = getConfig();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.environment,
  });
});

/**
 * Readiness check endpoint
 * Checks if all dependencies (database, etc.) are ready
 */
healthRoutes.get(
  '/ready',
  async (req: Request & { context?: AppContext }, res: Response) => {
    const timestamp = new Date().toISOString();

    try {
      if (!req.context?.database) {
        throw new Error('Database service not available');
      }

      // Check database health
      let databaseStatus = 'unknown';
      let databaseInfo: any = {
        status: 'unknown',
        error: 'No health check data available',
      };

      try {
        const healthCheck = await req.context.database.checkHealth();

        if (healthCheck) {
          databaseStatus = 'healthy';
          databaseInfo = {
            status: 'connected',
            lastCheck: healthCheck.lastCheck.toISOString(),
          };
        } else {
          databaseStatus = 'unknown';
          databaseInfo = {
            status: 'unknown',
            error: 'No health check data available',
          };
        }
      } catch (error) {
        databaseStatus = 'unhealthy';
        databaseInfo = {
          status: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      // Check Kafka health (only in non-test environments)
      let kafkaStatus = 'skipped';
      let kafkaInfo: any = { status: 'disabled' };
      
      const config = getConfig();
      if (config.environment !== 'test') {
        try {
          const kafkaService = getKafkaService();
          const kafkaHealth = await kafkaService.healthCheck();
          kafkaStatus = kafkaHealth.status;
          kafkaInfo = kafkaHealth.details;
        } catch (error) {
          kafkaStatus = 'unhealthy';
          kafkaInfo = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      // Check event processor health (only in non-test environments)
      let processorStatus = 'skipped';
      let processorInfo: any = { status: 'disabled' };
      
      if (config.environment !== 'test') {
        try {
          const eventProcessor = getEventProcessor();
          const processorHealth = eventProcessor.getHealth();
          processorStatus = processorHealth.status;
          processorInfo = processorHealth.details;
        } catch (error) {
          processorStatus = 'unhealthy';
          processorInfo = {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      // Determine overall readiness
      const healthyServices = [databaseStatus];
      if (config.environment !== 'test') {
        healthyServices.push(kafkaStatus, processorStatus);
      }
      
      const isReady = healthyServices.every(status => status === 'healthy');
      const statusCode = isReady ? 200 : 503;
      const status = isReady ? 'ready' : 'not ready';

      res.status(statusCode).json({
        status,
        timestamp,
        database: databaseInfo,
        kafka: kafkaInfo,
        eventProcessor: processorInfo,
        services: {
          database: databaseStatus,
          kafka: kafkaStatus,
          eventProcessor: processorStatus,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Liveness check endpoint
 * Checks if the server process is alive and responsive
 */
healthRoutes.get('/live', (req: Request, res: Response) => {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

  res.status(200).json({
    status: 'alive',
    timestamp,
    uptime,
    memory: {
      used: usedMemory,
      total: totalMemory,
      percentage: memoryPercentage,
    },
  });
});
