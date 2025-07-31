/**
 * Tests for Zendesk OAuth integration
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { ZendeskOAuthService } from './zendesk';

// Mock HTTP requests
jest.mock('axios');
const mockAxios = jest.mocked(require('axios'));

describe('ZendeskOAuthService', () => {
  let zendeskService: ZendeskOAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-32-characters-long';
    process.env.ZENDESK_CLIENT_ID = 'test_zendesk_client_id';
    process.env.ZENDESK_CLIENT_SECRET = 'test_zendesk_client_secret';

    // Reset configuration cache
    try {
      const { resetConfig } = await import('../config/environment');
      resetConfig();
    } catch {
      // Module not loaded yet, nothing to reset
    }

    zendeskService = new ZendeskOAuthService();
  });

  describe('OAuth URL Generation', () => {
    it('should generate correct OAuth authorization URL', () => {
      const subdomain = 'company';
      const redirectUri = 'https://app.conversationiq.com/auth/callback';
      const state = 'random-state-string';

      const authUrl = zendeskService.getAuthorizationUrl(
        subdomain,
        redirectUri,
        state
      );

      expect(authUrl).toContain(
        `https://${subdomain}.zendesk.com/oauth/authorizations/new`
      );
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain(
        `redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('scope=read');
    });

    it('should handle custom scopes', () => {
      const subdomain = 'company';
      const redirectUri = 'https://app.conversationiq.com/auth/callback';
      const state = 'random-state-string';
      const scopes = ['read', 'write', 'admin'];

      const authUrl = zendeskService.getAuthorizationUrl(
        subdomain,
        redirectUri,
        state,
        scopes
      );

      expect(authUrl).toContain('scope=read+write+admin');
    });

    it('should validate subdomain format', () => {
      const invalidSubdomains = [
        '',
        'invalid.subdomain',
        'sub domain',
        null,
        undefined,
      ];

      for (const subdomain of invalidSubdomains) {
        expect(() => {
          zendeskService.getAuthorizationUrl(
            subdomain as any,
            'https://app.conversationiq.com/auth/callback',
            'state'
          );
        }).toThrow('Invalid subdomain format');
      }
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for access token', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'zendesk_access_token_123',
          token_type: 'Bearer',
          scope: 'read write',
          expires_in: 3600,
        },
      };

      mockAxios.post.mockResolvedValue(mockTokenResponse);

      const result = await zendeskService.exchangeCodeForToken(
        'auth_code_123',
        'https://app.conversationiq.com/auth/callback',
        'company'
      );

      expect(result).toEqual({
        accessToken: 'zendesk_access_token_123',
        tokenType: 'Bearer',
        scope: 'read write',
        expiresIn: 3600,
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://company.zendesk.com/oauth/tokens',
        expect.objectContaining({
          grant_type: 'authorization_code',
          code: 'auth_code_123',
          client_id: expect.any(String),
          client_secret: expect.any(String),
          redirect_uri: 'https://app.conversationiq.com/auth/callback',
          scope: 'read',
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        })
      );
    });

    it('should handle token exchange errors', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'The provided authorization grant is invalid',
          },
        },
      });

      await expect(
        zendeskService.exchangeCodeForToken(
          'invalid_code',
          'https://app.conversationiq.com/auth/callback',
          'company'
        )
      ).rejects.toThrow('OAuth token exchange failed: invalid_grant');
    });

    it('should handle network errors during token exchange', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        zendeskService.exchangeCodeForToken(
          'auth_code_123',
          'https://app.conversationiq.com/auth/callback',
          'company'
        )
      ).rejects.toThrow('Failed to exchange authorization code');
    });
  });

  describe('User Information Retrieval', () => {
    it('should fetch user information with access token', async () => {
      const mockUserResponse = {
        data: {
          user: {
            id: 123456,
            email: 'agent@company.com',
            name: 'John Agent',
            role: 'agent',
            verified: true,
            active: true,
            time_zone: 'America/New_York',
            locale: 'en-US',
          },
        },
      };

      mockAxios.get.mockResolvedValue(mockUserResponse);

      const userInfo = await zendeskService.getUserInfo(
        'zendesk_access_token_123',
        'company'
      );

      expect(userInfo).toEqual({
        id: 123456,
        email: 'agent@company.com',
        name: 'John Agent',
        role: 'agent',
        verified: true,
        active: true,
        timeZone: 'America/New_York',
        locale: 'en-US',
        subdomain: 'company',
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://company.zendesk.com/api/v2/users/me.json',
        {
          headers: {
            Authorization: 'Bearer zendesk_access_token_123',
          },
          timeout: 10000,
        }
      );
    });

    it('should handle user info fetch errors', async () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: 'Unauthorized',
          },
        },
      });

      await expect(
        zendeskService.getUserInfo('invalid_token', 'company')
      ).rejects.toThrow('Invalid or expired access token');
    });

    it('should handle admin users', async () => {
      const mockAdminResponse = {
        data: {
          user: {
            id: 789012,
            email: 'admin@company.com',
            name: 'Jane Admin',
            role: 'admin',
            verified: true,
            active: true,
          },
        },
      };

      mockAxios.get.mockResolvedValue(mockAdminResponse);

      const userInfo = await zendeskService.getUserInfo(
        'admin_access_token',
        'company'
      );

      expect(userInfo.role).toBe('admin');
      expect(userInfo.email).toBe('admin@company.com');
    });
  });

  describe('Token Validation', () => {
    it('should validate active Zendesk token', async () => {
      const mockValidationResponse = {
        data: {
          active: true,
          scope: 'read write',
          client_id: 'zendesk_client_id',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      };

      mockAxios.post.mockResolvedValue(mockValidationResponse);

      const isValid = await zendeskService.validateToken(
        'zendesk_access_token_123',
        'company'
      );

      expect(isValid).toBe(true);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://company.zendesk.com/oauth/tokens/current',
        {},
        {
          headers: {
            Authorization: 'Bearer zendesk_access_token_123',
          },
          timeout: 5000,
        }
      );
    });

    it('should detect invalid Zendesk token', async () => {
      const mockValidationResponse = {
        data: {
          active: false,
        },
      };

      mockAxios.post.mockResolvedValue(mockValidationResponse);

      const isValid = await zendeskService.validateToken(
        'invalid_token',
        'company'
      );

      expect(isValid).toBe(false);
    });

    it('should handle token validation errors', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 401,
        },
      });

      const isValid = await zendeskService.validateToken(
        'invalid_token',
        'company'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh expired access token', async () => {
      const mockRefreshResponse = {
        data: {
          access_token: 'new_zendesk_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh_token',
        },
      };

      mockAxios.post.mockResolvedValue(mockRefreshResponse);

      const result = await zendeskService.refreshToken(
        'old_refresh_token',
        'company'
      );

      expect(result).toEqual({
        accessToken: 'new_zendesk_access_token',
        tokenType: 'Bearer',
        scope: 'read',
        expiresIn: 3600,
        refreshToken: 'new_refresh_token',
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://company.zendesk.com/oauth/tokens',
        expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: 'old_refresh_token',
        }),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        })
      );
    });

    it('should handle refresh token errors', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
          },
        },
      });

      await expect(
        zendeskService.refreshToken('invalid_refresh_token', 'company')
      ).rejects.toThrow('Token refresh failed');
    });
  });

  describe('Webhook Validation', () => {
    it('should validate webhook signatures', () => {
      const payload = JSON.stringify({ event: 'ticket.created' });
      const signature = 'expected_signature_hash';
      const webhookSecret = 'webhook_secret_key';

      const isValid = zendeskService.validateWebhookSignature(
        payload,
        signature,
        webhookSecret
      );

      expect(typeof isValid).toBe('boolean');
    });

    it('should reject invalid webhook signatures', () => {
      const payload = JSON.stringify({ event: 'ticket.created' });
      const invalidSignature = 'invalid_signature';
      const webhookSecret = 'webhook_secret_key';

      const isValid = zendeskService.validateWebhookSignature(
        payload,
        invalidSignature,
        webhookSecret
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockAxios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      });

      await expect(
        zendeskService.exchangeCodeForToken('code', 'redirect', 'company')
      ).rejects.toThrow('Failed to exchange authorization code');
    });

    it('should handle rate limiting', async () => {
      mockAxios.get.mockRejectedValue({
        response: {
          status: 429,
          headers: {
            'retry-after': '60',
          },
        },
      });

      await expect(
        zendeskService.getUserInfo('token', 'company')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle subdomain not found', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          status: 404,
        },
      });

      await expect(
        zendeskService.exchangeCodeForToken('code', 'redirect', 'nonexistent')
      ).rejects.toThrow('Zendesk subdomain not found');
    });
  });
});
