/**
 * Webhook API Routes
 * Handles incoming webhooks from external services
 */

import { Router, Request, Response } from 'express';
import { zendeskWebhookProcessor } from '../../webhooks/zendesk-processor';

export const webhookRoutes = Router();

// Use raw body parsing for webhook signature verification
webhookRoutes.use('/zendesk', (req: Request, res: Response, next) => {
  // Store raw body for signature verification
  let rawBody = '';
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    rawBody += chunk;
  });
  
  req.on('end', () => {
    (req as any).rawBody = rawBody;
    try {
      req.body = JSON.parse(rawBody);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid JSON payload',
        message: 'Webhook payload must be valid JSON'
      });
    }
  });
});

/**
 * Zendesk webhook endpoint
 * Handles webhooks from Zendesk for specific app installations
 */
webhookRoutes.post('/zendesk/:installationId', async (req: Request, res: Response) => {
  try {
    await zendeskWebhookProcessor.processWebhook(req, res);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generic webhook health check
 */
webhookRoutes.get('/health', (req: Request, res: Response) => {
  const stats = zendeskWebhookProcessor.getStats();
  
  res.json({
    status: 'healthy',
    service: 'ConversationIQ Webhooks',
    timestamp: new Date().toISOString(),
    statistics: stats
  });
});

/**
 * Webhook validation endpoint for Zendesk
 * Used during webhook setup to validate the endpoint
 */
webhookRoutes.get('/zendesk/:installationId/validate', (req: Request, res: Response) => {
  const { installationId } = req.params;
  const { challenge } = req.query;

  // Return the challenge for webhook validation
  res.json({
    challenge: challenge || 'webhook-validation',
    installationId,
    status: 'valid',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get webhook statistics for monitoring
 */
webhookRoutes.get('/stats', (req: Request, res: Response) => {
  const stats = zendeskWebhookProcessor.getStats();
  
  res.json({
    webhooks: {
      zendesk: stats
    },
    timestamp: new Date().toISOString()
  });
});