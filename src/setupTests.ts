/**
 * Test setup configuration for Jest
 * Configures global test environment and mocks
 */

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
