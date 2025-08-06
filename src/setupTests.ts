/**
 * Test setup configuration for Jest
 * Configures global test environment and mocks
 */

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET =
  'test-jwt-secret-key-that-is-at-least-32-characters-long';
process.env.ZENDESK_CLIENT_ID = 'test-zendesk-client-id';
process.env.ZENDESK_CLIENT_SECRET = 'test-zendesk-client-secret';
process.env.ZENDESK_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3000';

// Setup global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities - properly typed
(globalThis as any).testUtils = {
  // Add common test utilities here
};
