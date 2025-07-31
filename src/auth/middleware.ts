/**
 * Authentication middleware for ConversationIQ
 * Provides JWT-based authentication and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import { JWTService, JWTPayload } from './jwt';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  token?: string;
}

// Create JWT service instance lazily to support testing
let jwtService: JWTService;

function getJWTService(): JWTService {
  if (!jwtService) {
    jwtService = new JWTService();
  }
  return jwtService;
}

/**
 * Set JWT service instance (for testing)
 * @param service - JWT service instance
 */
export function setJWTService(service: JWTService): void {
  jwtService = service;
}

/**
 * Middleware to authenticate JWT tokens
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = getJWTService().extractTokenFromHeader(authHeader || '');

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token is required',
      });
      return;
    }

    // Check if token is blacklisted
    try {
      const isBlacklisted = await getJWTService().isTokenBlacklisted(token);

      if (isBlacklisted) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has been revoked',
        });
        return;
      }
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication service unavailable',
      });
      return;
    }

    // Verify token
    try {
      const decoded = await getJWTService().verifyToken(token);

      // Attach user and token to request
      req.user = decoded;
      req.token = token;

      next();
    } catch (error) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service unavailable',
    });
  }
}

/**
 * Middleware to require specific roles
 * @param requiredRoles - Role or array of roles required
 * @returns Express middleware function
 */
export function requireRole(requiredRoles: string | string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role;
    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific permissions
 * @param requiredPermissions - Permission or array of permissions required
 * @returns Express middleware function
 */
export function requirePermission(requiredPermissions: string | string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    const hasPermission = permissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require Zendesk integration
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireZendesk(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  if (!req.user.zendeskId || !req.user.subdomain) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Zendesk integration required',
    });
    return;
  }

  next();
}

/**
 * Middleware to validate Zendesk subdomain
 * @param allowedSubdomains - Array of allowed subdomains
 * @returns Express middleware function
 */
export function requireSubdomain(allowedSubdomains: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userSubdomain = req.user.subdomain;

    if (!userSubdomain || !allowedSubdomains.includes(userSubdomain)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied for this Zendesk instance',
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = getJWTService().extractTokenFromHeader(authHeader || '');

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    try {
      // Check if token is blacklisted
      const isBlacklisted = await getJWTService().isTokenBlacklisted(token);

      if (!isBlacklisted) {
        // Verify token
        const decoded = await getJWTService().verifyToken(token);
        req.user = decoded;
        req.token = token;
      }
    } catch (error) {
      // Token is invalid, but we continue without authentication
    }

    next();
  } catch (error) {
    // Service error, continue without authentication
    next();
  }
}

/**
 * Middleware to refresh JWT token if close to expiry
 * @param thresholdMinutes - Minutes before expiry to refresh (default: 15)
 * @returns Express middleware function
 */
export function refreshTokenMiddleware(thresholdMinutes: number = 15) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.token || !req.user) {
      next();
      return;
    }

    try {
      const expiration = getJWTService().getTokenExpiration(req.token);

      if (expiration) {
        const timeUntilExpiry = expiration - Date.now();
        const thresholdMs = thresholdMinutes * 60 * 1000;

        if (timeUntilExpiry <= thresholdMs) {
          // Token is close to expiry, refresh it
          const newToken = await getJWTService().refreshToken(req.token);

          // Add new token to response headers
          res.setHeader('X-New-Token', newToken);
        }
      }

      next();
    } catch (error) {
      // If refresh fails, continue with original token
      next();
    }
  };
}

/**
 * Middleware for logging authentication events
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function authLogger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const originalSend = res.json;

  res.json = function (data: any): Response {
    // Log authentication events (in non-test environments)
    if (process.env.NODE_ENV !== 'test') {
      const authEvent = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      };

      // Log failed authentication attempts
      if (res.statusCode === 401 || res.statusCode === 403) {
        // eslint-disable-next-line no-console
        console.warn('Authentication failed:', authEvent);
      }
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Create a combined authentication middleware with logging
 * @param options - Middleware options
 * @returns Express middleware function
 */
export function createAuthMiddleware(
  options: {
    required?: boolean;
    roles?: string[];
    permissions?: string[];
    requireZendesk?: boolean;
    allowedSubdomains?: string[];
    refreshThreshold?: number;
    enableLogging?: boolean;
  } = {}
): any[] {
  const middlewares: any[] = [];

  // Add logging if enabled
  if (options.enableLogging) {
    middlewares.push(authLogger);
  }

  // Add authentication
  if (options.required !== false) {
    middlewares.push(authenticateJWT);
  } else {
    middlewares.push(optionalAuth);
  }

  // Add role requirement
  if (options.roles && options.roles.length > 0) {
    middlewares.push(requireRole(options.roles));
  }

  // Add permission requirement
  if (options.permissions && options.permissions.length > 0) {
    middlewares.push(requirePermission(options.permissions));
  }

  // Add Zendesk requirement
  if (options.requireZendesk) {
    middlewares.push(requireZendesk);
  }

  // Add subdomain requirement
  if (options.allowedSubdomains && options.allowedSubdomains.length > 0) {
    middlewares.push(requireSubdomain(options.allowedSubdomains));
  }

  // Add token refresh
  if (options.refreshThreshold) {
    middlewares.push(refreshTokenMiddleware(options.refreshThreshold));
  }

  return middlewares;
}
