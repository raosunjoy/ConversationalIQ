/**
 * Tests for JWT authentication service
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { JWTService } from './jwt';

describe('JWTService', () => {
  let jwtService: JWTService;
  const testSecret = 'test-secret-key-32-characters-long';

  beforeEach(() => {
    // Set test environment
    process.env.JWT_SECRET = testSecret;
    jwtService = new JWTService();
  });

  describe('Token Generation', () => {
    it('should generate a valid JWT token', async () => {
      const payload = {
        userId: 'user_123',
        email: 'test@example.com',
        role: 'agent',
      };

      const token = await jwtService.generateToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', async () => {
      const payload1 = { userId: 'user_1', email: 'user1@example.com' };
      const payload2 = { userId: 'user_2', email: 'user2@example.com' };

      const token1 = await jwtService.generateToken(payload1);
      const token2 = await jwtService.generateToken(payload2);

      expect(token1).not.toBe(token2);
    });

    it('should include expiry time in token', async () => {
      const payload = { userId: 'user_123' };
      const expiresIn = '1h';

      const token = await jwtService.generateToken(payload, expiresIn);
      const decoded = await jwtService.verifyToken(token);

      expect(decoded).toHaveProperty('exp');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should use default expiry if not specified', async () => {
      const payload = { userId: 'user_123' };

      const token = await jwtService.generateToken(payload);
      const decoded = await jwtService.verifyToken(token);

      expect(decoded).toHaveProperty('exp');
    });
  });

  describe('Token Verification', () => {
    it('should verify and decode a valid token', async () => {
      const payload = {
        userId: 'user_123',
        email: 'test@example.com',
        role: 'agent',
      };

      const token = await jwtService.generateToken(payload);
      const decoded = await jwtService.verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      await expect(jwtService.verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should throw error for expired token', async () => {
      const payload = { userId: 'user_123' };
      const token = await jwtService.generateToken(payload, '1ms');

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(jwtService.verifyToken(token)).rejects.toThrow();
    });

    it('should throw error for token with wrong secret', async () => {
      const payload = { userId: 'user_123' };
      const token = await jwtService.generateToken(payload);

      // Create new service with different secret
      process.env.JWT_SECRET = 'different-secret-key-32-chars-xx';
      const differentService = new JWTService();

      await expect(differentService.verifyToken(token)).rejects.toThrow();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh a valid token', async () => {
      const payload = { userId: 'user_123', email: 'test@example.com' };
      const originalToken = await jwtService.generateToken(payload);

      const newToken = await jwtService.refreshToken(originalToken);

      expect(newToken).not.toBe(originalToken);

      const decoded = await jwtService.verifyToken(newToken);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('should not refresh an expired token', async () => {
      const payload = { userId: 'user_123' };
      const expiredToken = await jwtService.generateToken(payload, '1ms');

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(jwtService.refreshToken(expiredToken)).rejects.toThrow();
    });

    it('should not refresh an invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      await expect(jwtService.refreshToken(invalidToken)).rejects.toThrow();
    });
  });

  describe('Zendesk Integration', () => {
    it('should generate token for Zendesk user', async () => {
      const zendeskUser = {
        userId: 'zendesk_123',
        email: 'agent@company.com',
        role: 'agent',
        zendeskId: 'zd_agent_456',
        subdomain: 'company',
      };

      const token = await jwtService.generateZendeskToken(zendeskUser);
      const decoded = await jwtService.verifyToken(token);

      expect(decoded.userId).toBe(zendeskUser.userId);
      expect(decoded.zendeskId).toBe(zendeskUser.zendeskId);
      expect(decoded.subdomain).toBe(zendeskUser.subdomain);
    });

    it('should include Zendesk-specific claims', async () => {
      const zendeskUser = {
        userId: 'zendesk_123',
        email: 'agent@company.com',
        role: 'admin',
        zendeskId: 'zd_admin_789',
        subdomain: 'company',
        permissions: ['read', 'write', 'admin'],
      };

      const token = await jwtService.generateZendeskToken(zendeskUser);
      const decoded = await jwtService.verifyToken(token);

      expect(decoded.permissions).toEqual(zendeskUser.permissions);
      expect(decoded.role).toBe('admin');
    });
  });

  describe('Token Blacklisting', () => {
    it('should blacklist a token', async () => {
      const payload = { userId: 'user_123' };
      const token = await jwtService.generateToken(payload);

      await jwtService.blacklistToken(token);
      const isBlacklisted = await jwtService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(true);
    });

    it('should not verify blacklisted token', async () => {
      const payload = { userId: 'user_123' };
      const token = await jwtService.generateToken(payload);

      await jwtService.blacklistToken(token);

      await expect(jwtService.verifyToken(token)).rejects.toThrow();
    });

    it('should handle non-blacklisted tokens correctly', async () => {
      const payload = { userId: 'user_123' };
      const token = await jwtService.generateToken(payload);

      const isBlacklisted = await jwtService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing JWT secret', () => {
      delete process.env.JWT_SECRET;

      expect(() => new JWTService()).toThrow(
        'JWT_SECRET environment variable is required'
      );
    });

    it('should handle malformed tokens gracefully', async () => {
      const malformedTokens = ['', 'not.a.jwt', 'malformed', null, undefined];

      for (const token of malformedTokens) {
        await expect(jwtService.verifyToken(token as any)).rejects.toThrow();
      }
    });

    it('should provide meaningful error messages', async () => {
      const invalidToken = 'invalid.jwt.token';

      try {
        await jwtService.verifyToken(invalidToken);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid token');
      }
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from Authorization header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const authHeader = `Bearer ${token}`;

      const extracted = jwtService.extractTokenFromHeader(authHeader);

      expect(extracted).toBe(token);
    });

    it('should handle missing Bearer prefix', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

      const extracted = jwtService.extractTokenFromHeader(token);

      expect(extracted).toBeNull();
    });

    it('should handle malformed Authorization header', () => {
      const malformedHeaders = [
        '',
        'Bearer',
        'InvalidPrefix token',
        null,
        undefined,
      ];

      for (const header of malformedHeaders) {
        const extracted = jwtService.extractTokenFromHeader(header as any);
        expect(extracted).toBeNull();
      }
    });
  });
});
