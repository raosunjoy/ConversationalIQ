/**
 * Beta Program API Routes
 * Handles beta user management, feature flags, and feedback collection
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { featureFlagService } from '../../services/feature-flag-service';
import { betaProgramService } from '../../services/beta-program-service';
import { authenticateJWT } from '../../auth/middleware';
import { rateLimitConfigs } from '../../security/security-middleware';

const router = Router();

// Apply authentication and rate limiting
router.use(authenticateJWT);
router.use(rateLimitConfigs.general);

// Validation middleware
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Feature Flag Management Routes

/**
 * Get all feature flags
 * GET /beta-program/feature-flags
 */
router.get(
  '/feature-flags',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await featureFlagService.getAnalytics('7d');
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create a new feature flag
 * POST /beta-program/feature-flags
 */
router.post(
  '/feature-flags',
  [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required (1-100 characters)'),
    body('description')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Description is required (1-500 characters)'),
    body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
    body('rolloutPercentage')
      .isInt({ min: 0, max: 100 })
      .withMessage('Rollout percentage must be 0-100'),
    body('targetAudience')
      .isIn(['all', 'beta', 'internal', 'specific'])
      .withMessage('Invalid target audience'),
    body('createdBy').isString().withMessage('Created by is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flag = await featureFlagService.createFeatureFlag(req.body);
      res.status(201).json({
        success: true,
        data: flag,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a feature flag
 * PUT /beta-program/feature-flags/:flagId
 */
router.put(
  '/feature-flags/:flagId',
  [
    param('flagId').isString().withMessage('Flag ID is required'),
    body('enabled').optional().isBoolean(),
    body('rolloutPercentage').optional().isInt({ min: 0, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flagId } = req.params;
      const flag = await featureFlagService.updateFeatureFlag(flagId, req.body);
      res.json({
        success: true,
        data: flag,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Evaluate a feature flag for a user
 * GET /beta-program/feature-flags/:flagId/evaluate
 */
router.get(
  '/feature-flags/:flagId/evaluate',
  [
    param('flagId').isString().withMessage('Flag ID is required'),
    query('userId').isString().withMessage('User ID is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { flagId } = req.params;
      const { userId } = req.query as { userId: string };

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const evaluation = await featureFlagService.evaluateFlag(
        flagId,
        userId,
        req.body
      );
      res.json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Beta User Management Routes

/**
 * Get all beta users
 * GET /beta-program/users
 */
router.get(
  '/users',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const betaUsers = await featureFlagService.getBetaUsers();
      res.json({
        success: true,
        data: betaUsers,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Invite a user to the beta program
 * POST /beta-program/invitations
 */
router.post(
  '/invitations',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('invitedBy').isString().withMessage('Invited by is required'),
    body('metadata').optional().isObject(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, invitedBy, metadata = {} } = req.body;
      const invitation = await betaProgramService.inviteUser(
        email,
        invitedBy,
        metadata
      );

      res.status(201).json({
        success: true,
        data: invitation,
        message: 'Beta invitation sent successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Accept a beta invitation
 * POST /beta-program/invitations/accept
 */
router.post(
  '/invitations/accept',
  [
    body('token').isString().withMessage('Invitation token is required'),
    body('zendeskAccountId').optional().isString(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, zendeskAccountId } = req.body;
      const betaUser = await betaProgramService.acceptInvitation(token, {
        zendeskAccountId,
      });

      res.json({
        success: true,
        data: betaUser,
        message: 'Welcome to the beta program!',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Complete an onboarding step
 * POST /beta-program/onboarding/step
 */
router.post(
  '/onboarding/step',
  [
    body('userId').isString().withMessage('User ID is required'),
    body('stepName').isString().withMessage('Step name is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, stepName } = req.body;
      const onboarding = await betaProgramService.completeOnboardingStep(
        userId,
        stepName
      );

      res.json({
        success: true,
        data: onboarding,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Feedback Management Routes

/**
 * Submit beta feedback
 * POST /beta-program/feedback
 */
router.post(
  '/feedback',
  [
    body('userId').isString().withMessage('User ID is required'),
    body('type')
      .isIn([
        'feature_request',
        'bug_report',
        'general_feedback',
        'satisfaction_score',
      ])
      .withMessage('Invalid feedback type'),
    body('content')
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Content is required (1-2000 characters)'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be 1-5'),
    body('urgency')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid urgency level'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const feedback = await betaProgramService.submitFeedback({
        ...req.body,
        status: 'open',
        metadata: {},
      });

      res.status(201).json({
        success: true,
        data: feedback,
        message: 'Thank you for your feedback!',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get all feedback
 * GET /beta-program/feedback
 */
router.get(
  '/feedback',
  [
    query('type')
      .optional()
      .isIn([
        'feature_request',
        'bug_report',
        'general_feedback',
        'satisfaction_score',
      ]),
    query('urgency').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('status')
      .optional()
      .isIn(['open', 'in_review', 'planned', 'completed', 'declined']),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        type: req.query.type as any,
        urgency: req.query.urgency as any,
        status: req.query.status as any,
      };

      const feedback = await betaProgramService.getAllFeedback(filters);
      res.json({
        success: true,
        data: feedback,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Analytics and Metrics Routes

/**
 * Get beta program metrics
 * GET /beta-program/metrics
 */
router.get(
  '/metrics',
  [query('timeRange').optional().isIn(['24h', '7d', '30d'])],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timeRange = (req.query.timeRange as '24h' | '7d' | '30d') || '7d';
      const metrics = await betaProgramService.getMetrics(timeRange);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get feature flag analytics
 * GET /beta-program/analytics/feature-flags
 */
router.get(
  '/analytics/feature-flags',
  [query('timeRange').optional().isIn(['24h', '7d', '30d'])],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timeRange = (req.query.timeRange as '24h' | '7d' | '30d') || '7d';
      const analytics = await featureFlagService.getAnalytics(timeRange);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Health check for beta program services
 * GET /beta-program/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Basic health checks
    const betaUsers = await featureFlagService.getBetaUsers();
    const analytics = await featureFlagService.getAnalytics('24h');

    res.json({
      success: true,
      status: 'healthy',
      data: {
        betaUsersCount: betaUsers.length,
        activeFlagsCount: analytics.activeFlags,
        lastCheck: new Date(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as betaProgramRouter };
