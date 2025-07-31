/**
 * Tests for main application entry point
 * Following TDD approach - tests written first
 */

import { describe, expect, it } from '@jest/globals';

describe('ConversationIQ Application', () => {
  // Save original NODE_ENV
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore NODE_ENV after each test
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should export a start function', async () => {
    const { startApp } = await import('./index');
    expect(typeof startApp).toBe('function');
  });

  it('should return app configuration when started', async () => {
    const { startApp } = await import('./index');
    const config = await startApp();

    expect(config).toHaveProperty('name');
    expect(config).toHaveProperty('version');
    expect(config).toHaveProperty('environment');
    expect(config.name).toBe('ConversationIQ');
  });

  it('should return development environment when NODE_ENV is undefined', async () => {
    delete process.env.NODE_ENV;
    const { startApp } = await import('./index');
    const config = await startApp();

    expect(config.environment).toBe('development');
  });

  it('should return correct environment when NODE_ENV is set', async () => {
    process.env.NODE_ENV = 'production';

    // Clear module cache to re-import with new environment
    delete require.cache[require.resolve('./index')];

    const { startApp } = await import('./index');
    const config = await startApp();

    expect(config.environment).toBe('production');
  });

  it('should have correct version and name', async () => {
    const { startApp } = await import('./index');
    const config = await startApp();

    expect(config.name).toBe('ConversationIQ');
    expect(config.version).toBe('1.0.0');
  });
});
