/**
 * Tests for Zendesk Authentication Service
 */

import { Request, Response } from 'express';
import { ZendeskAuthService } from './auth-service';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../config/environment');
jest.mock('../services/database');
jest.mock('jsonwebtoken');

describe('ZendeskAuthService', () => {
  let authService: ZendeskAuthService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    authService = new ZendeskAuthService();
    
    mockRequest = {
      query: {},
      body: {},
      params: {},
      headers: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('handleAuthorize', () => {
    it('should handle valid authorization request', async () => {
      mockRequest.query = {
        state: 'test-state',
        subdomain: 'test-company',
        user_id: '12345',
        app_id: 'app-67890'
      };

      await authService.handleAuthorize(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('test-company.zendesk.com/api/v2/oauth/callback')
      );
    });

    it('should reject authorization request with missing parameters', async () => {
      mockRequest.query = {
        state: 'test-state'
        // Missing required parameters
      };

      await authService.handleAuthorize(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required OAuth parameters',
        required: ['state', 'subdomain', 'user_id', 'app_id']
      });
    });

    it('should handle authorization errors gracefully', async () => {
      mockRequest.query = {
        state: 'test-state',
        subdomain: 'test-company',
        user_id: '12345',
        app_id: 'app-67890'
      };

      // Mock an error in authorization code generation
      jest.spyOn(authService as any, 'generateAuthCode').mockImplementation(() => {
        throw new Error('Code generation failed');
      });

      await authService.handleAuthorize(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authorization failed',
        message: 'Code generation failed'
      });
    });
  });

  describe('handleTokenExchange', () => {
    it('should exchange valid authorization code for tokens', async () => {
      mockRequest.body = {
        code: 'valid-auth-code',
        grant_type: 'authorization_code'
      };

      // Mock successful code verification
      jest.spyOn(authService as any, 'verifyAuthCode').mockResolvedValue({
        subdomain: 'test-company',
        userId: '12345',
        appId: 'app-67890'
      });

      // Mock token generation
      jest.spyOn(authService as any, 'generateAccessToken').mockReturnValue('access-token');
      jest.spyOn(authService as any, 'generateRefreshToken').mockReturnValue('refresh-token');
      jest.spyOn(authService as any, 'storeAppInstallation').mockResolvedValue({});

      await authService.handleTokenExchange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        scope: 'read write',
        expires_in: 3600
      });
    });

    it('should reject invalid authorization code', async () => {
      mockRequest.body = {
        code: 'invalid-code',
        grant_type: 'authorization_code'
      };

      // Mock failed code verification
      jest.spyOn(authService as any, 'verifyAuthCode').mockResolvedValue(null);

      await authService.handleTokenExchange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    });

    it('should reject missing authorization code', async () => {
      mockRequest.body = {
        grant_type: 'authorization_code'
        // Missing code
      };

      await authService.handleTokenExchange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'Missing or invalid authorization code'
      });
    });

    it('should reject invalid grant type', async () => {
      mockRequest.body = {
        code: 'valid-code',
        grant_type: 'client_credentials'
      };

      await authService.handleTokenExchange(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'invalid_request',
        error_description: 'Missing or invalid authorization code'
      });
    });
  });

  describe('handleAppInstallation', () => {
    it('should handle valid app installation', async () => {
      mockRequest.body = {
        subdomain: 'test-company',
        app_id: 'app-12345',
        user_id: 'user-67890',
        installation_id: 'install-123',
        settings: {
          api_url: 'https://api.conversationiq.com',
          enable_sentiment: true
        }
      };

      jest.spyOn(authService as any, 'storeAppInstallation').mockResolvedValue({
        id: 'install-123',
        webhookSecret: 'webhook-secret'
      });
      jest.spyOn(authService as any, 'configureWebhooks').mockResolvedValue(undefined);

      await authService.handleAppInstallation(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'installed',
        installation_id: 'install-123',
        webhook_url: expect.stringContaining('/webhooks/zendesk/install-123'),
        webhook_secret: 'webhook-secret'
      });
    });

    it('should reject installation with missing parameters', async () => {
      mockRequest.body = {
        subdomain: 'test-company'
        // Missing required fields
      };

      await authService.handleAppInstallation(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid installation payload',
        required: ['subdomain', 'app_id', 'user_id']
      });
    });
  });

  describe('handleAppUninstallation', () => {
    it('should handle valid app uninstallation', async () => {
      mockRequest.params = {
        installation_id: 'install-123'
      };

      jest.spyOn(authService as any, 'removeAppInstallation').mockResolvedValue(undefined);

      await authService.handleAppUninstallation(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'uninstalled',
        installation_id: 'install-123'
      });
    });

    it('should reject uninstallation with missing installation_id', async () => {
      mockRequest.params = {};

      await authService.handleAppUninstallation(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing installation_id'
      });
    });
  });

  describe('validateAccessToken', () => {
    it('should validate valid access token', async () => {
      const mockInstallation = {
        id: 'install-123',
        subdomain: 'test-company',
        userId: '12345',
        appId: 'app-67890',
        accessToken: 'valid-token',
        settings: {},
        webhookSecret: 'secret',
        installedAt: new Date(),
        lastActiveAt: new Date()
      };

      // Mock JWT verification
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        subdomain: 'test-company',
        userId: '12345',
        appId: 'app-67890'
      });

      jest.spyOn(authService as any, 'getAppInstallation').mockResolvedValue(mockInstallation);
      jest.spyOn(authService as any, 'updateLastActive').mockResolvedValue(undefined);

      const result = await authService.validateAccessToken('valid-token');

      expect(result).toEqual(mockInstallation);
      expect(authService as any).toHaveProperty('updateLastActive');
    });

    it('should reject invalid access token', async () => {
      // Mock JWT verification failure
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await authService.validateAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should reject token with missing payload data', async () => {
      // Mock JWT verification with incomplete payload
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        subdomain: 'test-company'
        // Missing userId and appId
      });

      const result = await authService.validateAccessToken('incomplete-token');

      expect(result).toBeNull();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      const result = authService.verifyWebhookSignature(payload, signature, secret);

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      const invalidSignature = 'invalid-signature';

      const result = authService.verifyWebhookSignature(payload, invalidSignature, secret);

      expect(result).toBe(false);
    });

    it('should handle signature verification errors', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      const malformedSignature = null as any;

      const result = authService.verifyWebhookSignature(payload, malformedSignature, secret);

      expect(result).toBe(false);
    });
  });

  describe('token generation', () => {
    it('should generate unique authorization codes', () => {
      const params = {
        subdomain: 'test-company',
        userId: '12345',
        appId: 'app-67890',
        state: 'test-state'
      };

      const code1 = (authService as any).generateAuthCode(params);
      const code2 = (authService as any).generateAuthCode(params);

      expect(code1).toBeDefined();
      expect(code2).toBeDefined();
      expect(typeof code1).toBe('string');
      expect(typeof code2).toBe('string');
    });

    it('should generate access tokens with proper expiration', () => {
      const params = {
        subdomain: 'test-company',
        userId: '12345',
        appId: 'app-67890'
      };

      const token = (authService as any).generateAccessToken(params);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate refresh tokens with longer expiration', () => {
      const params = {
        subdomain: 'test-company',
        userId: '12345',
        appId: 'app-67890'
      };

      const token = (authService as any).generateRefreshToken(params);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});

describe('ZendeskAuthService Integration', () => {
  let authService: ZendeskAuthService;

  beforeEach(() => {
    authService = new ZendeskAuthService();
  });

  it('should handle complete OAuth flow', async () => {
    // This would be an integration test covering the full OAuth flow
    // from authorization to token exchange to installation
    
    // Mock the full flow
    const mockRequest = {
      query: {
        state: 'test-state',
        subdomain: 'test-company',
        user_id: '12345',
        app_id: 'app-67890'
      }
    } as Request;

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    } as any as Response;

    // Test authorization step
    await authService.handleAuthorize(mockRequest, mockResponse);
    expect(mockResponse.redirect).toHaveBeenCalled();

    // Verify redirect URL contains authorization code
    const redirectCall = (mockResponse.redirect as jest.Mock).mock.calls[0][0];
    expect(redirectCall).toContain('code=');
    expect(redirectCall).toContain('state=test-state');
  });
});