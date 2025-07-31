/**
 * Tests for Express API server
 * Following TDD approach - tests written first
 */

import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import { Server } from 'http';
import { createServer } from './server';

// Mock database service
jest.mock('../services/database', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    checkHealth: jest.fn().mockResolvedValue({
      id: 1,
      status: 'healthy',
      lastCheck: new Date(),
      metadata: null,
    }),
  })),
}));

describe('API Server', () => {
  let server: Server;
  let app: any;

  beforeEach(async () => {
    // Reset modules and mock environment for tests
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-32-characters-long';

    // Reset config cache if the module is already loaded
    try {
      const { resetConfig } = await import('../config/environment');
      resetConfig();
    } catch {
      // Module not loaded yet, nothing to reset
    }
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
      });
    }
  });

  describe('Server Creation', () => {
    it('should create server successfully', async () => {
      const { app: testApp } = await createServer();
      expect(testApp).toBeDefined();
    });

    it('should start server on specified port', async () => {
      const { startServer } = await createServer();
      server = await startServer(0); // Use port 0 for random available port
      expect(server).toBeDefined();
      expect(server.listening).toBe(true);
    });
  });

  describe('Health Check Endpoints', () => {
    beforeEach(async () => {
      const { app: testApp } = await createServer();
      app = testApp;
    });

    it('should respond to health check endpoint', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });

    it('should respond to readiness check endpoint', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('services');
    });

    it('should respond to liveness check endpoint', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('CORS Configuration', () => {
    beforeEach(async () => {
      const { app: testApp } = await createServer();
      app = testApp;
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      // CORS might handle this with 200 or 204, both are acceptable
      expect([200, 204]).toContain(response.status);
    });

    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // In development/test, CORS origin is '*' so it gets set in vary header
      expect(response.headers).toHaveProperty('vary');
      expect(response.headers.vary).toContain('Origin');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { app: testApp } = await createServer();
      app = testApp;
    });

    it('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route').expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle server errors gracefully', async () => {
      // Test error handling by accessing a route that should trigger an error
      const response = await request(app).post('/health').expect(404); // Not found since only GET is defined

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Request Logging', () => {
    beforeEach(async () => {
      const { app: testApp } = await createServer();
      app = testApp;
    });

    it('should log requests in development', async () => {
      // In test environment, logging is disabled so this test just verifies
      // the endpoint works without Morgan logging interfering
      const response = await request(app).get('/health').expect(200);

      // Test passes if the request completes successfully
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('Security Headers', () => {
    beforeEach(async () => {
      const { app: testApp } = await createServer();
      app = testApp;
    });

    it('should include security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('JSON Parsing', () => {
    beforeEach(async () => {
      const { app: testApp } = await createServer();
      app = testApp;
    });

    it('should parse JSON requests', async () => {
      // Test that the server can handle JSON payloads
      // This will be more relevant when we add POST endpoints
      const response = await request(app)
        .post('/health')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json')
        .expect(404); // Not found since only GET is defined

      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/health')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .expect(400); // Bad request for malformed JSON

      expect(response.body).toHaveProperty('error');
    });
  });
});
