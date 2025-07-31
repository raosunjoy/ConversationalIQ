/**
 * Zendesk App Authentication Service
 * Handles OAuth flow and secure app authentication
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config/environment';
import { DatabaseService } from '../services/database';

export interface ZendeskAppInstallation {
  id: string;
  subdomain: string;
  appId: string;
  userId: string;
  installationId: string;
  accessToken: string;
  refreshToken?: string;
  settings: Record<string, any>;
  webhookSecret: string;
  installedAt: Date;
  lastActiveAt: Date;
}

export interface ZendeskOAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
  expires_in?: number;
}

/**
 * Zendesk App Authentication Service
 */
export class ZendeskAuthService {
  private config = getConfig();
  private dbService = new DatabaseService();

  /**
   * Handle Zendesk OAuth authorization request
   */
  async handleAuthorize(req: Request, res: Response): Promise<void> {
    try {
      const { state, subdomain, user_id, app_id } = req.query;

      // Validate required parameters
      if (!state || !subdomain || !user_id || !app_id) {
        res.status(400).json({
          error: 'Missing required OAuth parameters',
          required: ['state', 'subdomain', 'user_id', 'app_id']
        });
        return;
      }

      // Generate authorization code
      const authCode = this.generateAuthCode({
        subdomain: subdomain as string,
        userId: user_id as string,
        appId: app_id as string,
        state: state as string
      });

      // Store authorization context temporarily
      await this.storeAuthContext(authCode, {
        subdomain: subdomain as string,
        userId: user_id as string,
        appId: app_id as string,
        state: state as string,
        timestamp: Date.now()
      });

      // Redirect back to Zendesk with authorization code
      const redirectUrl = `https://${subdomain}.zendesk.com/api/v2/oauth/callback`;
      const callbackUrl = `${redirectUrl}?code=${authCode}&state=${state}`;
      
      res.redirect(callbackUrl);
    } catch (error) {
      console.error('Zendesk OAuth authorization error:', error);
      res.status(500).json({
        error: 'Authorization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle Zendesk OAuth token exchange
   */
  async handleTokenExchange(req: Request, res: Response): Promise<void> {
    try {
      const { code, grant_type } = req.body;

      if (!code || grant_type !== 'authorization_code') {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing or invalid authorization code'
        });
        return;
      }

      // Verify and decode authorization code
      const authContext = await this.verifyAuthCode(code);
      if (!authContext) {
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code'
        });
        return;
      }

      // Generate access token
      const accessToken = this.generateAccessToken({
        subdomain: authContext.subdomain,
        userId: authContext.userId,
        appId: authContext.appId
      });

      // Generate refresh token
      const refreshToken = this.generateRefreshToken({
        subdomain: authContext.subdomain,
        userId: authContext.userId,
        appId: authContext.appId
      });

      // Store app installation
      await this.storeAppInstallation({
        subdomain: authContext.subdomain,
        userId: authContext.userId,
        appId: authContext.appId,
        accessToken,
        refreshToken
      });

      // Return OAuth tokens
      const tokenResponse: ZendeskOAuthTokens = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        scope: 'read write',
        expires_in: 3600 // 1 hour
      };

      res.json(tokenResponse);
    } catch (error) {
      console.error('Zendesk OAuth token exchange error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Token exchange failed'
      });
    }
  }

  /**
   * Handle app installation
   */
  async handleAppInstallation(req: Request, res: Response): Promise<void> {
    try {
      const installation = req.body;
      
      // Validate installation payload
      if (!installation.subdomain || !installation.app_id || !installation.user_id) {
        res.status(400).json({
          error: 'Invalid installation payload',
          required: ['subdomain', 'app_id', 'user_id']
        });
        return;
      }

      // Generate webhook secret for this installation
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      // Store installation
      const installationRecord = await this.storeAppInstallation({
        subdomain: installation.subdomain,
        userId: installation.user_id,
        appId: installation.app_id,
        installationId: installation.installation_id,
        settings: installation.settings || {},
        webhookSecret
      });

      // Configure webhook endpoint
      await this.configureWebhooks(installationRecord);

      res.status(201).json({
        status: 'installed',
        installation_id: installationRecord.id,
        webhook_url: `${this.config.zendesk.apiUrl}/webhooks/zendesk/${installationRecord.id}`,
        webhook_secret: webhookSecret
      });
    } catch (error) {
      console.error('Zendesk app installation error:', error);
      res.status(500).json({
        error: 'Installation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle app uninstallation
   */
  async handleAppUninstallation(req: Request, res: Response): Promise<void> {
    try {
      const { installation_id } = req.params;

      if (!installation_id) {
        res.status(400).json({
          error: 'Missing installation_id'
        });
        return;
      }

      // Remove installation from database
      await this.removeAppInstallation(installation_id);

      res.status(200).json({
        status: 'uninstalled',
        installation_id
      });
    } catch (error) {
      console.error('Zendesk app uninstallation error:', error);
      res.status(500).json({
        error: 'Uninstallation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Validate app access token
   */
  async validateAccessToken(token: string): Promise<ZendeskAppInstallation | null> {
    try {
      // Verify JWT token
      const payload = jwt.verify(token, this.config.jwt.secret) as any;
      
      if (!payload.subdomain || !payload.userId || !payload.appId) {
        return null;
      }

      // Get installation from database
      const installation = await this.getAppInstallation(
        payload.subdomain,
        payload.userId,
        payload.appId
      );

      if (!installation || installation.accessToken !== token) {
        return null;
      }

      // Update last active timestamp
      await this.updateLastActive(installation.id);

      return installation;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Generate authorization code
   */
  private generateAuthCode(params: {
    subdomain: string;
    userId: string;
    appId: string;
    state: string;
  }): string {
    const payload = {
      ...params,
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
    };

    return jwt.sign(payload, this.config.jwt.secret, { algorithm: 'HS256' });
  }

  /**
   * Generate access token
   */
  private generateAccessToken(params: {
    subdomain: string;
    userId: string;
    appId: string;
  }): string {
    const payload = {
      ...params,
      type: 'access_token',
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };

    return jwt.sign(payload, this.config.jwt.secret, { algorithm: 'HS256' });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(params: {
    subdomain: string;
    userId: string;
    appId: string;
  }): string {
    const payload = {
      ...params,
      type: 'refresh_token',
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30 days
    };

    return jwt.sign(payload, this.config.jwt.secret, { algorithm: 'HS256' });
  }

  /**
   * Store authorization context temporarily
   */
  private async storeAuthContext(code: string, context: any): Promise<void> {
    // In a real implementation, you'd store this in Redis or similar
    // For now, we'll use the JWT token itself to store context
    console.log('Storing auth context for code:', code);
  }

  /**
   * Verify authorization code
   */
  private async verifyAuthCode(code: string): Promise<any> {
    try {
      const payload = jwt.verify(code, this.config.jwt.secret) as any;
      
      // Check if code is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store app installation in database
   */
  private async storeAppInstallation(params: {
    subdomain: string;
    userId: string;
    appId: string;
    installationId?: string;
    accessToken?: string;
    refreshToken?: string;
    settings?: Record<string, any>;
    webhookSecret?: string;
  }): Promise<ZendeskAppInstallation> {
    const installation: ZendeskAppInstallation = {
      id: params.installationId || crypto.randomUUID(),
      subdomain: params.subdomain,
      appId: params.appId,
      userId: params.userId,
      installationId: params.installationId || crypto.randomUUID(),
      accessToken: params.accessToken || '',
      refreshToken: params.refreshToken || '',
      settings: params.settings || {},
      webhookSecret: params.webhookSecret || crypto.randomBytes(32).toString('hex'),
      installedAt: new Date(),
      lastActiveAt: new Date()
    };

    // In a real implementation, store in database
    // For now, we'll simulate database storage
    console.log('Storing app installation:', installation.id);

    return installation;
  }

  /**
   * Get app installation from database
   */
  private async getAppInstallation(
    subdomain: string,
    userId: string,
    appId: string
  ): Promise<ZendeskAppInstallation | null> {
    // In a real implementation, query from database
    // For now, return a mock installation
    return {
      id: 'mock-installation',
      subdomain,
      userId,
      appId,
      installationId: 'mock-installation-id',
      accessToken: 'mock-token',
      settings: {},
      webhookSecret: 'mock-webhook-secret',
      installedAt: new Date(),
      lastActiveAt: new Date()
    };
  }

  /**
   * Remove app installation
   */
  private async removeAppInstallation(installationId: string): Promise<void> {
    // In a real implementation, delete from database
    console.log('Removing app installation:', installationId);
  }

  /**
   * Update last active timestamp
   */
  private async updateLastActive(installationId: string): Promise<void> {
    // In a real implementation, update in database
    console.log('Updating last active for installation:', installationId);
  }

  /**
   * Configure webhooks for installation
   */
  private async configureWebhooks(installation: ZendeskAppInstallation): Promise<void> {
    // Configure webhooks with Zendesk
    const webhookConfig = {
      webhook: {
        name: `ConversationIQ-${installation.subdomain}`,
        endpoint: `${this.config.zendesk.apiUrl}/webhooks/zendesk/${installation.id}`,
        http_method: 'POST',
        request_format: 'json',
        status: 'active',
        subscriptions: [
          'conditional_ticket_events',
          'ticket_comment_events'
        ]
      }
    };

    console.log('Configuring webhooks for installation:', installation.id, webhookConfig);
    
    // In a real implementation, make API call to Zendesk to configure webhooks
    // This would require Zendesk Admin API access
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Get installation by webhook endpoint
   */
  async getInstallationByWebhookEndpoint(installationId: string): Promise<ZendeskAppInstallation | null> {
    return this.getAppInstallation('mock', 'mock', 'mock');
  }
}

// Export singleton instance
export const zendeskAuthService = new ZendeskAuthService();