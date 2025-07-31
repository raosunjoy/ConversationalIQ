/**
 * Tests for health check routes
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
import { healthRoutes } from './health';
import { DatabaseService } from '../../services/database';

// Mock database service
jest.mock('../../services/database');

describe('Health Routes', () => {
  let app: Application;
  let mockDatabase: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    // Reset modules and set up test environment variables
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-32-characters-long';

    // Reset config cache if the module is already loaded
    try {
      const { resetConfig } = await import('../../config/environment');
      resetConfig();
    } catch {
      // Module not loaded yet, nothing to reset
    }

    app = express();
    mockDatabase = {
      checkHealth: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Add context to request
    app.use((req: any, res, next) => {
      req.context = { database: mockDatabase };
      next();
    });

    app.use('/health', healthRoutes);
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        environment: expect.any(String),
      });
    });

    it('should include version information', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should include current timestamp', async () => {
      const response = await request(app).get('/health').expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status when all services are ready', async () => {
      mockDatabase.checkHealth.mockResolvedValue({
        id: 1,
        status: 'healthy',
        lastCheck: new Date(),
        metadata: null,
      });

      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
        database: {
          status: 'connected',
          lastCheck: expect.any(String),
        },
        services: {
          database: 'healthy',
        },
      });
    });

    it('should return unhealthy status when database is down', async () => {
      mockDatabase.checkHealth.mockRejectedValue(
        new Error('Connection failed')
      );

      const response = await request(app).get('/health/ready').expect(503);

      expect(response.body).toEqual({
        status: 'not ready',
        timestamp: expect.any(String),
        database: {
          status: 'disconnected',
          error: 'Connection failed',
        },
        services: {
          database: 'unhealthy',
        },
      });
    });

    it('should handle database health check returning null', async () => {
      mockDatabase.checkHealth.mockResolvedValue(null);

      const response = await request(app).get('/health/ready').expect(503);

      expect(response.body).toEqual({
        status: 'not ready',
        timestamp: expect.any(String),
        database: {
          status: 'unknown',
          error: 'No health check data available',
        },
        services: {
          database: 'unknown',
        },
      });
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toEqual({
        status: 'alive',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        },
      });
    });

    it('should include uptime in seconds', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body.uptime).toBeGreaterThan(0);
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should include memory usage information', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
      expect(response.body.memory.percentage).toBeGreaterThan(0);
      expect(response.body.memory.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing context gracefully', async () => {
      const appWithoutContext = express();
      appWithoutContext.use('/health', healthRoutes);

      const response = await request(appWithoutContext)
        .get('/health/ready')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('HTTP Methods', () => {
    it('should handle unsupported methods gracefully', async () => {
      // Express will handle these with 404 since we only define GET routes
      await request(app).post('/health').expect(404);

      await request(app).put('/health/ready').expect(404);

      await request(app).delete('/health/live').expect(404);
    });
  });
});
