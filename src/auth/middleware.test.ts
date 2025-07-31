/**
 * Tests for authentication middleware
 * Following TDD approach - tests written first
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Response, NextFunction } from 'express';
import {
  authenticateJWT,
  requireRole,
  AuthenticatedRequest,
  setJWTService,
} from './middleware';
import { JWTService } from './jwt';

describe('Authentication Middleware', () => {
  let mockJWTService: jest.Mocked<JWTService>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockJWTService = {
      verifyToken: jest.fn(),
      extractTokenFromHeader: jest.fn(),
      isTokenBlacklisted: jest.fn(),
    } as any;

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Inject mock JWT service
    setJWTService(mockJWTService);
  });

  describe('authenticateJWT middleware', () => {
    it('should authenticate valid JWT token', async () => {
      const token = 'valid.jwt.token';
      const decodedPayload = {
        userId: 'user_123',
        email: 'test@example.com',
        role: 'agent',
      };

      mockRequest.headers!.authorization = `Bearer ${token}`;
      mockJWTService.extractTokenFromHeader.mockReturnValue(token);
      mockJWTService.isTokenBlacklisted.mockResolvedValue(false);
      mockJWTService.verifyToken.mockResolvedValue(decodedPayload);

      await authenticateJWT(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockJWTService.extractTokenFromHeader).toHaveBeenCalledWith(
        `Bearer ${token}`
      );
      expect(mockJWTService.isTokenBlacklisted).toHaveBeenCalledWith(token);
      expect(mockJWTService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockRequest.user).toEqual(decodedPayload);
      expect(mockRequest.token).toBe(token);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      mockJWTService.extractTokenFromHeader.mockReturnValue(null);

      await authenticateJWT(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Access token is required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      const token = 'invalid.jwt.token';
      mockRequest.headers!.authorization = `Bearer ${token}`;
      mockJWTService.extractTokenFromHeader.mockReturnValue(token);
      mockJWTService.isTokenBlacklisted.mockResolvedValue(false);
      mockJWTService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      await authenticateJWT(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      const token = 'blacklisted.jwt.token';
      mockRequest.headers!.authorization = `Bearer ${token}`;
      mockJWTService.extractTokenFromHeader.mockReturnValue(token);
      mockJWTService.isTokenBlacklisted.mockResolvedValue(true);

      await authenticateJWT(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token has been revoked',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle token verification errors gracefully', async () => {
      const token = 'valid.jwt.token';
      mockRequest.headers!.authorization = `Bearer ${token}`;
      mockJWTService.extractTokenFromHeader.mockReturnValue(token);
      mockJWTService.isTokenBlacklisted.mockRejectedValue(
        new Error('Database error')
      );

      await authenticateJWT(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Authentication service unavailable',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for matching role', () => {
      mockRequest.user = {
        userId: 'user_123',
        role: 'admin',
      };

      const middleware = requireRole('admin');
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access for multiple matching roles', () => {
      mockRequest.user = {
        userId: 'user_123',
        role: 'agent',
      };

      const middleware = requireRole(['admin', 'agent']);
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for non-matching role', () => {
      mockRequest.user = {
        userId: 'user_123',
        role: 'agent',
      };

      const middleware = requireRole('admin');
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access when user has no role', () => {
      mockRequest.user = {
        userId: 'user_123',
      };

      const middleware = requireRole('admin');
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access when user is not authenticated', () => {
      // No user property set

      const middleware = requireRole('admin');
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Zendesk-specific authentication', () => {
    it('should handle Zendesk user properties', async () => {
      const token = 'zendesk.jwt.token';
      const zendeskPayload = {
        userId: 'zendesk_123',
        email: 'agent@company.com',
        role: 'agent',
        zendeskId: 'zd_agent_456',
        subdomain: 'company',
        permissions: ['read', 'write'],
      };

      mockRequest.headers!.authorization = `Bearer ${token}`;
      mockJWTService.extractTokenFromHeader.mockReturnValue(token);
      mockJWTService.isTokenBlacklisted.mockResolvedValue(false);
      mockJWTService.verifyToken.mockResolvedValue(zendeskPayload);

      await authenticateJWT(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual(zendeskPayload);
      expect(mockRequest.user!.zendeskId).toBe('zd_agent_456');
      expect(mockRequest.user!.subdomain).toBe('company');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate Zendesk subdomain if required', () => {
      mockRequest.user = {
        userId: 'zendesk_123',
        role: 'agent',
        subdomain: 'company',
      };

      const middleware = requireRole('agent');
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Permission-based access control', () => {
    it('should allow access with specific permission', () => {
      mockRequest.user = {
        userId: 'user_123',
        role: 'agent',
        permissions: ['read', 'write', 'conversations:view'],
      };

      const middleware = requireRole('agent');
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with complex role hierarchies', () => {
      mockRequest.user = {
        userId: 'user_123',
        role: 'manager',
        permissions: ['read', 'write', 'admin', 'team:manage'],
      };

      const middleware = requireRole(['agent', 'manager', 'admin']);
      middleware(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
