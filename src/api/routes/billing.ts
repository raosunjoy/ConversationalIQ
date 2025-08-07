/**
 * Billing API Routes
 * REST API endpoints for subscription and billing management
 */

import express from 'express';
import { Request, Response, NextFunction } from 'express';
import SubscriptionService from '../../services/subscription-service';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = express.Router();
const subscriptionService = new SubscriptionService();

// Apply authentication to all routes
router.use(authMiddleware);

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    organizationId: string;
    role: string;
  };
}

// Get subscription plans
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = subscriptionService.getAvailablePlans();
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    next(error);
  }
});

// Get current subscription
router.get('/subscription', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    
    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }

    // Get usage analytics for the subscription
    const usageAnalytics = await subscriptionService.getUsageAnalytics(subscription.id);
    
    res.json({
      success: true,
      data: {
        ...subscription,
        analytics: usageAnalytics
      }
    });
  } catch (error) {
    next(error);
  }
});

// Start trial
router.post('/trial', [
  body('zendeskSubdomain').isString().notEmpty(),
  body('zendeskAccountId').isString().notEmpty()
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { zendeskSubdomain, zendeskAccountId } = req.body;
    
    // Check if organization already has a subscription
    const existingSubscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Organization already has an active subscription'
      });
    }

    const subscriptionId = await subscriptionService.startTrial(
      req.user.organizationId,
      {
        subdomain: zendeskSubdomain,
        accountId: zendeskAccountId
      }
    );

    const subscription = await subscriptionService.getSubscription(subscriptionId);

    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Trial subscription created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Extend trial
router.post('/trial/extend', [
  body('days').isInt({ min: 1, max: 30 })
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { days } = req.body;
    
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    if (subscription.status !== 'trialing') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not in trial status'
      });
    }

    await subscriptionService.extendTrial(subscription.id, days);
    const updatedSubscription = await subscriptionService.getSubscription(subscription.id);

    res.json({
      success: true,
      data: updatedSubscription,
      message: `Trial extended by ${days} days`
    });
  } catch (error) {
    next(error);
  }
});

// Convert trial to paid subscription
router.post('/subscription/convert', [
  body('planId').isString().notEmpty(),
  body('agentCount').isInt({ min: 1 }),
  body('paymentMethodId').isString().notEmpty()
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, agentCount, paymentMethodId } = req.body;
    
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    if (subscription.status !== 'trialing') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not in trial status'
      });
    }

    await subscriptionService.convertTrialToSubscription(
      subscription.id,
      planId,
      paymentMethodId,
      agentCount
    );

    const updatedSubscription = await subscriptionService.getSubscription(subscription.id);

    res.json({
      success: true,
      data: updatedSubscription,
      message: 'Trial converted to paid subscription successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Create new subscription (direct, no trial)
router.post('/subscription', [
  body('planId').isString().notEmpty(),
  body('agentCount').isInt({ min: 1 }),
  body('paymentMethodId').isString().notEmpty(),
  body('zendeskSubdomain').isString().notEmpty(),
  body('zendeskAccountId').isString().notEmpty()
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, agentCount, paymentMethodId, zendeskSubdomain, zendeskAccountId } = req.body;
    
    // Check if organization already has a subscription
    const existingSubscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'Organization already has an active subscription'
      });
    }

    const subscriptionId = await subscriptionService.createSubscription(
      req.user.organizationId,
      planId,
      agentCount,
      paymentMethodId,
      {
        subdomain: zendeskSubdomain,
        accountId: zendeskAccountId
      }
    );

    const subscription = await subscriptionService.getSubscription(subscriptionId);

    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Update subscription
router.put('/subscription', [
  body('planId').optional().isString(),
  body('agentCount').optional().isInt({ min: 1 })
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, agentCount } = req.body;
    
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    if (planId) {
      await subscriptionService.changeSubscriptionPlan(subscription.id, planId, agentCount);
    }

    const updatedSubscription = await subscriptionService.getSubscription(subscription.id);

    res.json({
      success: true,
      data: updatedSubscription,
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Cancel subscription
router.delete('/subscription', [
  body('cancelAtPeriodEnd').optional().isBoolean()
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { cancelAtPeriodEnd = true } = req.body;
    
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    await subscriptionService.cancelSubscription(subscription.id, cancelAtPeriodEnd);
    const updatedSubscription = await subscriptionService.getSubscription(subscription.id);

    res.json({
      success: true,
      data: updatedSubscription,
      message: cancelAtPeriodEnd ? 'Subscription will be canceled at period end' : 'Subscription canceled immediately'
    });
  } catch (error) {
    next(error);
  }
});

// Get invoices
router.get('/invoices', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const invoices = await subscriptionService.getInvoices(subscription.id);

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    next(error);
  }
});

// Generate invoice
router.post('/invoices/generate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const invoiceId = await subscriptionService.generateInvoice(subscription.id);

    res.status(201).json({
      success: true,
      data: { invoiceId },
      message: 'Invoice generated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Download invoice
router.get('/invoices/:invoiceId/download', [
  param('invoiceId').isString().notEmpty()
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { invoiceId } = req.params;
    
    // In a real implementation, you would:
    // 1. Verify the invoice belongs to the user's organization
    // 2. Generate or retrieve the PDF invoice
    // 3. Stream the file to the response
    
    // For now, we'll simulate the download
    res.json({
      success: true,
      data: {
        downloadUrl: `/api/files/invoices/${invoiceId}.pdf`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      }
    });
  } catch (error) {
    next(error);
  }
});

// Track usage
router.post('/usage', [
  body('type').isIn(['conversation', 'api_call', 'response_suggestion', 'escalation_prevention']),
  body('count').isInt({ min: 1 })
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { type, count } = req.body;
    
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const usageData: any = {};
    
    switch (type) {
      case 'conversation':
        usageData.conversations = count;
        usageData.sentimentAnalyses = count;
        break;
      case 'api_call':
        usageData.apiCalls = count;
        break;
      case 'response_suggestion':
        usageData.responsesSuggested = count;
        break;
      case 'escalation_prevention':
        usageData.escalationsPrevented = count;
        break;
    }

    await subscriptionService.trackUsage(subscription.id, usageData);

    res.json({
      success: true,
      message: 'Usage tracked successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get usage analytics
router.get('/usage/analytics', [
  query('period').optional().isIn(['day', 'week', 'month', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], validateRequest, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await subscriptionService.getOrganizationSubscription(req.user.organizationId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const analytics = await subscriptionService.getUsageAnalytics(subscription.id);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription metrics (admin only)
router.get('/metrics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const metrics = await subscriptionService.getSubscriptionMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

// Stripe webhook handler
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      return res.status(400).json({
        success: false,
        message: 'Stripe webhook secret not configured'
      });
    }

    // In a real implementation, you would:
    // 1. Verify the webhook signature using Stripe library
    // 2. Parse the event
    // 3. Handle different event types (payment_succeeded, payment_failed, etc.)
    // 4. Update subscription status accordingly

    // For now, we'll just acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

// Error handler
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Billing API Error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

export default router;