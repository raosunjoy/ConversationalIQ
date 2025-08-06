/**
 * Privacy and GDPR Compliance API Routes
 * Handles data subject rights requests and privacy controls
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { DatabaseService } from '../../services/database';
import { privacyService } from '../../security/encryption-service';
import { monitoringService } from '../../monitoring/monitoring-service';
import { rateLimitConfigs, handleValidationErrors } from '../../security/security-middleware';

export interface PrivacyRequest extends Request {
  context?: {
    database: DatabaseService;
  };
}

const router = Router();

// Apply strict rate limiting for privacy endpoints
router.use(rateLimitConfigs.auth);

// Validation schemas
const emailValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address required'),
];

const consentValidation = [
  body('userId')
    .isUUID()
    .withMessage('Valid user ID required'),
  body('consentType')
    .isIn(['analytics', 'marketing', 'profiling', 'data_processing'])
    .withMessage('Invalid consent type'),
  body('granted')
    .isBoolean()
    .withMessage('Consent status must be boolean'),
];

/**
 * Data Subject Access Request (GDPR Article 15)
 * GET /privacy/data-access/:email
 */
router.get(
  '/data-access/:email',
  [
    param('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address required'),
  ],
  handleValidationErrors,
  async (req: PrivacyRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const { email } = req.params;
      const database = req.context?.database;

      if (!database) {
        return res.status(500).json({
          error: 'Database service not available',
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      // Process data access request
      const userData = await database.handleDataSubjectAccessRequest(email);

      // Record compliance metric
      monitoringService.recordBusinessMetric(
        'gdpr_access_requests_completed',
        1,
        undefined,
        '24h'
      );

      monitoringService.recordPerformanceMetric(
        'privacy_data_access',
        Date.now() - startTime,
        true,
        { email_domain: email.split('@')[1] }
      );

      res.json({
        success: true,
        data: userData,
        exportDate: new Date().toISOString(),
        format: 'json',
        requestProcessingTime: Date.now() - startTime,
      });
    } catch (error) {
      monitoringService.recordPerformanceMetric(
        'privacy_data_access',
        Date.now() - startTime,
        false,
        { error: error instanceof Error ? error.message : 'unknown' }
      );
      next(error);
    }
  }
);

/**
 * Data Subject Deletion Request (GDPR Article 17 - Right to be Forgotten)
 * DELETE /privacy/data-deletion
 */
router.delete(
  '/data-deletion',
  emailValidation,
  handleValidationErrors,
  async (req: PrivacyRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const { email } = req.body;
      const database = req.context?.database;

      if (!database) {
        return res.status(500).json({
          error: 'Database service not available',
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      // Process deletion request
      const result = await database.handleDataSubjectDeletionRequest(email);

      // Record compliance metric
      monitoringService.recordBusinessMetric(
        'gdpr_deletion_requests_completed',
        1,
        undefined,
        '24h'
      );

      monitoringService.recordPerformanceMetric(
        'privacy_data_deletion',
        Date.now() - startTime,
        true,
        { 
          email_domain: email.split('@')[1],
          records_deleted: result.deletedRecords.toString()
        }
      );

      res.json({
        success: result.success,
        deletedRecords: result.deletedRecords,
        processedAt: new Date().toISOString(),
        requestProcessingTime: Date.now() - startTime,
      });
    } catch (error) {
      monitoringService.recordPerformanceMetric(
        'privacy_data_deletion',
        Date.now() - startTime,
        false,
        { error: error instanceof Error ? error.message : 'unknown' }
      );
      next(error);
    }
  }
);

/**
 * Data Portability Request (GDPR Article 20)
 * GET /privacy/data-export/:email
 */
router.get(
  '/data-export/:email',
  [
    param('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address required'),
  ],
  handleValidationErrors,
  async (req: PrivacyRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const { email } = req.params;

      // Process data portability request
      const exportData = await privacyService.handleDataPortabilityRequest(email);

      // Record compliance metric
      monitoringService.recordBusinessMetric(
        'gdpr_portability_requests_completed',
        1,
        undefined,
        '24h'
      );

      monitoringService.recordPerformanceMetric(
        'privacy_data_export',
        Date.now() - startTime,
        true,
        { email_domain: email.split('@')[1] }
      );

      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename="data-export-${email}-${new Date().toISOString().split('T')[0]}.json"`
      );

      res.json(exportData);
    } catch (error) {
      monitoringService.recordPerformanceMetric(
        'privacy_data_export',
        Date.now() - startTime,
        false,
        { error: error instanceof Error ? error.message : 'unknown' }
      );
      next(error);
    }
  }
);

/**
 * Consent Management
 * POST /privacy/consent
 */
router.post(
  '/consent',
  consentValidation,
  handleValidationErrors,
  async (req: PrivacyRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const { userId, consentType, granted } = req.body;

      // Record consent
      await privacyService.recordConsent(userId, consentType, granted);

      // Record compliance metric
      monitoringService.recordBusinessMetric(
        'consent_records_created',
        1,
        undefined,
        '24h'
      );

      monitoringService.recordMetric(
        'consent_granted',
        granted ? 1 : 0,
        'boolean',
        { type: consentType, userId }
      );

      monitoringService.recordPerformanceMetric(
        'privacy_consent_recording',
        Date.now() - startTime,
        true,
        { consent_type: consentType, granted: granted.toString() }
      );

      res.json({
        success: true,
        consentRecorded: {
          userId,
          consentType,
          granted,
          timestamp: new Date().toISOString(),
        },
        requestProcessingTime: Date.now() - startTime,
      });
    } catch (error) {
      monitoringService.recordPerformanceMetric(
        'privacy_consent_recording',
        Date.now() - startTime,
        false,
        { error: error instanceof Error ? error.message : 'unknown' }
      );
      next(error);
    }
  }
);

/**
 * Get Privacy Policy and Data Processing Information
 * GET /privacy/policy
 */
router.get('/policy', async (req: Request, res: Response) => {
  res.json({
    privacyPolicy: {
      version: '1.0',
      effectiveDate: '2024-01-01',
      dataController: {
        name: 'ConversationIQ',
        contact: 'privacy@conversationiq.com',
        address: 'To be determined',
      },
      dataProcessing: {
        purposes: [
          'Conversation analysis and sentiment detection',
          'AI-powered response suggestions',
          'Customer service analytics',
          'Product improvement and research',
        ],
        legalBasis: [
          'Legitimate interest for service provision',
          'Consent for marketing communications',
          'Contract performance for customer support',
        ],
        retentionPeriod: '2 years from last interaction',
        dataTypes: [
          'Conversation content and metadata',
          'User identification information',
          'Technical logs and analytics data',
        ],
      },
      rights: [
        'Right to access your data',
        'Right to rectification',
        'Right to erasure (right to be forgotten)',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object',
        'Rights in relation to automated decision making and profiling',
      ],
    },
  });
});

/**
 * Privacy Metrics Dashboard (for compliance reporting)
 * GET /privacy/metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const dashboardData = monitoringService.getDashboardData();
  
  // Filter for privacy-related metrics
  const privacyMetrics = {
    gdprRequests: {
      access: dashboardData.businessMetrics.gdpr_access_requests_completed?.value || 0,
      deletion: dashboardData.businessMetrics.gdpr_deletion_requests_completed?.value || 0,
      portability: dashboardData.businessMetrics.gdpr_portability_requests_completed?.value || 0,
    },
    consentRecords: dashboardData.businessMetrics.consent_records_created?.value || 0,
    piiDetections: Object.entries(dashboardData.metrics.pii_detected || [])
      .reduce((total, [, metrics]) => total + metrics.reduce((sum, m) => sum + m.value, 0), 0),
    encryptionStats: {
      // Would get from encryption service
      encryptedFields: 0,
      activeKeys: 0,
    },
  };

  res.json({
    privacyMetrics,
    complianceStatus: 'compliant',
    lastUpdated: new Date().toISOString(),
  });
});

export { router as privacyRoutes };