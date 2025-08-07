/**
 * Security Middleware Collection
 * Comprehensive security hardening for ConversationIQ platform
 * Implements OWASP Top 10 protections and enterprise security controls
 */

import { Request, Response, NextFunction } from 'express';

interface RequestWithSession extends Request {
  session?: {
    csrfToken?: string;
    [key: string]: any;
  };
}
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult, param, query } from 'express-validator';
import { DatabaseService } from '../services/database';

// Rate limiting configurations for different endpoints
export const rateLimitConfigs = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Authentication endpoints - stricter limits
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 auth attempts per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
    skipSuccessfulRequests: true,
  }),

  // AI processing endpoints - moderate limits
  aiProcessing: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 AI processing requests per minute
    message: {
      error: 'AI processing rate limit exceeded, please slow down',
      code: 'AI_RATE_LIMIT_EXCEEDED',
    },
  }),

  // GraphQL endpoint - higher limits for real-time features
  graphql: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // 300 GraphQL requests per minute
    message: {
      error: 'GraphQL rate limit exceeded',
      code: 'GRAPHQL_RATE_LIMIT_EXCEEDED',
    },
  }),

  // Webhook endpoints - very restrictive
  webhook: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 1000, // 1000 webhook calls per 5 minutes
    keyGenerator: (req: Request) => {
      // Use webhook signature or IP for rate limiting
      return (
        (req.headers['x-webhook-signature'] as string) || req.ip || 'unknown'
      );
    },
    message: {
      error: 'Webhook rate limit exceeded',
      code: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
    },
  }),
};

// Security headers configuration using Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://static.zdassets.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", 'https://*.zendesk.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for Zendesk iframe embedding
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

// Input validation schemas
export const validationSchemas = {
  // Message validation
  message: [
    body('content')
      .isLength({ min: 1, max: 10000 })
      .withMessage('Message content must be between 1 and 10000 characters')
      .trim()
      .escape(),
    body('conversationId')
      .isUUID()
      .withMessage('Invalid conversation ID format'),
    body('sender')
      .isIn(['AGENT', 'CUSTOMER', 'SYSTEM'])
      .withMessage('Invalid sender type'),
  ],

  // Conversation validation
  conversation: [
    body('ticketId')
      .isLength({ min: 1, max: 100 })
      .withMessage('Ticket ID must be between 1 and 100 characters')
      .trim(),
    body('agentId').optional().isUUID().withMessage('Invalid agent ID format'),
    body('customerId').isUUID().withMessage('Invalid customer ID format'),
    body('status')
      .isIn(['OPEN', 'PENDING', 'SOLVED', 'CLOSED'])
      .withMessage('Invalid conversation status'),
    body('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('Invalid priority level'),
    body('tags')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Tags must be an array with maximum 20 items'),
    body('tags.*')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be between 1 and 50 characters')
      .trim(),
  ],

  // User/Agent validation
  user: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    body('name')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters')
      .trim(),
    body('role')
      .isIn(['agent', 'manager', 'admin'])
      .withMessage('Invalid role'),
    body('zendeskId')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Zendesk ID must be between 1 and 50 characters')
      .trim(),
    body('subdomain')
      .optional()
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/)
      .withMessage('Invalid subdomain format'),
  ],

  // ID parameter validation
  id: [param('id').isUUID().withMessage('Invalid ID format')],

  // Pagination validation
  pagination: [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative'),
    query('sortBy')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Sort field must be between 1 and 50 characters'),
    query('sortOrder')
      .optional()
      .isIn(['ASC', 'DESC', 'asc', 'desc'])
      .withMessage('Sort order must be ASC or DESC'),
  ],

  // Search validation
  search: [
    query('q')
      .optional()
      .isLength({ min: 1, max: 500 })
      .withMessage('Search query must be between 1 and 500 characters')
      .trim(),
    query('filters')
      .optional()
      .isJSON()
      .withMessage('Filters must be valid JSON'),
  ],
};

// CSRF Protection
export const csrfProtection = (
  req: RequestWithSession,
  res: Response,
  next: NextFunction
): Response | void => {
  // Skip CSRF for API endpoints with proper authentication
  if (req.path.startsWith('/api') && req.headers.authorization) {
    return next();
  }

  // Skip CSRF for webhooks with proper signature verification
  if (req.path.startsWith('/webhooks') && req.headers['x-webhook-signature']) {
    return next();
  }

  // Check for CSRF token in headers or body
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_TOKEN_INVALID',
    });
  }

  next();
};

// Request sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key names
        const cleanKey = key.replace(/[^\w.-]/g, '');
        sanitized[cleanKey] = sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// SQL injection prevention middleware
export const sqlInjectionProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(['";]|--|\|\/\*|\*\/)/g,
    /(0x[0-9A-Fa-f]+)/g,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return dangerousPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (value !== null && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const hasInjection =
    checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

  if (hasInjection) {
    return res.status(400).json({
      error: 'Potentially malicious input detected',
      code: 'MALICIOUS_INPUT_DETECTED',
    });
  }

  next();
};

// Validation error handler
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Input validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map((error: any) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      })),
    });
  }

  next();
};

// Security audit logging
interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  ip: string;
  userAgent: string;
  action: string;
  resource: string;
  method: string;
  statusCode?: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  details?: any;
}

class SecurityAuditor {
  private database: DatabaseService;

  constructor() {
    this.database = new DatabaseService();
  }

  async logSecurityEvent(entry: AuditLogEntry): Promise<void> {
    try {
      // In production, this would write to a dedicated audit log database
      console.log('SECURITY_AUDIT:', JSON.stringify(entry, null, 2));

      // Store critical events in database for compliance
      if (entry.risk === 'high' || entry.risk === 'critical') {
        // Implementation would save to audit_logs table
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

const securityAuditor = new SecurityAuditor();

// Security audit middleware
export const auditSecurity = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Capture response to log status code
  const originalSend = res.send;
  res.send = function (this: Response, body: any) {
    const processingTime = Date.now() - startTime;

    // Determine risk level based on various factors
    let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (res.statusCode >= 400) {
      risk = res.statusCode >= 500 ? 'high' : 'medium';
    }

    if (req.path.includes('auth') || req.path.includes('login')) {
      risk = risk === 'low' ? 'medium' : 'high';
    }

    if (processingTime > 5000) {
      // Slow requests might indicate attacks
      risk = risk === 'low' ? 'medium' : risk;
    }

    // Log security-relevant events
    securityAuditor.logSecurityEvent({
      timestamp: new Date(),
      userId: (req as any).user?.userId,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      action: req.method,
      resource: req.path,
      method: req.method,
      statusCode: res.statusCode,
      risk,
      details: {
        processingTime,
        contentLength: req.headers['content-length'],
        referer: req.headers.referer,
      },
    });

    return originalSend.call(this, body);
  };

  next();
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const clientIP = req.ip || req.connection.remoteAddress || '';

    // Check if IP is in whitelist
    const isAllowed = allowedIPs.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation support would go here
        return false;
      }
      return clientIP === allowedIP;
    });

    if (!isAllowed) {
      securityAuditor.logSecurityEvent({
        timestamp: new Date(),
        ip: clientIP,
        userAgent: req.headers['user-agent'] || 'unknown',
        action: req.method,
        resource: req.path,
        method: req.method,
        risk: 'critical',
        details: {
          reason: 'IP_NOT_WHITELISTED',
          attemptedAccess: req.path,
        },
      });

      return res.status(403).json({
        error: 'Access denied from this IP address',
        code: 'IP_NOT_ALLOWED',
      });
    }

    next();
  };
};

// Request size limiter
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  // 10MB default
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: `Request size exceeds limit of ${maxSize} bytes`,
        code: 'REQUEST_TOO_LARGE',
      });
    }

    next();
  };
};

// Export all security middleware as a collection
export const securityMiddleware = {
  rateLimitConfigs,
  securityHeaders,
  validationSchemas,
  csrfProtection,
  sanitizeInput,
  sqlInjectionProtection,
  handleValidationErrors,
  auditSecurity,
  ipWhitelist,
  requestSizeLimit,
};

export default securityMiddleware;
