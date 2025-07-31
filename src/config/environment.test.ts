/**
 * Tests for environment configuration
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset modules and environment
    jest.resetModules();
    process.env = { ...originalEnv };

    // Reset config cache if the module is already loaded
    try {
      const { resetConfig } = await import('./environment');
      resetConfig();
    } catch {
      // Module not loaded yet, nothing to reset
    }
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Configuration Loading', () => {
    it('should load configuration with default values', async () => {
      // Set minimal required environment variables
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.JWT_SECRET = 'test-secret-key-32-characters-long';

      const { getConfig } = await import('./environment');
      const config = getConfig();

      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('redis');
      expect(config).toHaveProperty('jwt');
      expect(config.port).toBe(3000);
      expect(config.environment).toBe('test');
    });

    it('should load configuration from environment variables', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.DATABASE_URL = 'postgresql://prod:prod@localhost:5432/prod';
      process.env.REDIS_URL = 'redis://localhost:6379/1';
      process.env.JWT_SECRET = 'super-secret-jwt-key-32-chars-xx';
      process.env.OPENAI_API_KEY = 'sk-test123';

      const { getConfig } = await import('./environment');
      const config = getConfig();

      expect(config.environment).toBe('production');
      expect(config.port).toBe(8080);
      expect(config.database.url).toBe(
        'postgresql://prod:prod@localhost:5432/prod'
      );
      expect(config.redis.url).toBe('redis://localhost:6379/1');
      expect(config.jwt.secret).toBe('super-secret-jwt-key-32-chars-xx');
      expect(config.ai.openaiApiKey).toBe('sk-test123');
    });

    it('should throw error for missing required environment variables', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;

      await expect(async () => {
        const { getConfig } = await import('./environment');
        getConfig();
      }).rejects.toThrow('Missing required environment variable');
    });

    it('should validate JWT secret length', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.JWT_SECRET = 'short';

      await expect(async () => {
        const { getConfig } = await import('./environment');
        getConfig();
      }).rejects.toThrow('JWT_SECRET must be at least 32 characters');
    });
  });

  describe('Environment-specific Configuration', () => {
    it('should set development-specific configuration', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://dev:dev@localhost:5432/dev';
      process.env.JWT_SECRET = 'development-secret-key-32-chars-x';

      const { getConfig } = await import('./environment');
      const config = getConfig();

      expect(config.environment).toBe('development');
      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.cors.origin).toBe('*');
    });

    it('should set production-specific configuration', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod:prod@localhost:5432/prod';
      process.env.JWT_SECRET = 'production-secret-key-32-chars-x';
      process.env.ALLOWED_ORIGINS =
        'https://app.conversationiq.com,https://admin.conversationiq.com';

      const { getConfig } = await import('./environment');
      const config = getConfig();

      expect(config.environment).toBe('production');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.cors.origin).toEqual([
        'https://app.conversationiq.com',
        'https://admin.conversationiq.com',
      ]);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate database URL format', async () => {
      process.env.DATABASE_URL = 'invalid-url';
      process.env.JWT_SECRET = 'test-secret-key-32-characters-long';

      await expect(async () => {
        const { getConfig } = await import('./environment');
        getConfig();
      }).rejects.toThrow('Invalid DATABASE_URL format');
    });

    it('should validate Redis URL format', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.JWT_SECRET = 'test-secret-key-32-characters-long';
      process.env.REDIS_URL = 'invalid-redis-url';

      await expect(async () => {
        const { getConfig } = await import('./environment');
        getConfig();
      }).rejects.toThrow('Invalid REDIS_URL format');
    });

    it('should validate port number', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.JWT_SECRET = 'test-secret-key-32-characters-long';
      process.env.PORT = 'invalid-port';

      await expect(async () => {
        const { getConfig } = await import('./environment');
        getConfig();
      }).rejects.toThrow('PORT must be a valid number');
    });
  });

  describe('Configuration Caching', () => {
    it('should cache configuration after first load', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.JWT_SECRET = 'test-secret-key-32-characters-long';

      const { getConfig } = await import('./environment');
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2); // Same reference indicates caching
    });
  });
});
