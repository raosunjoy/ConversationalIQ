/**
 * Zendesk OAuth integration service
 * Handles OAuth flow, token management, and user information retrieval
 */

import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { getConfig } from '../config/environment';

export interface ZendeskTokenResponse {
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresIn: number;
  refreshToken?: string;
}

export interface ZendeskUserInfo {
  id: number;
  email: string;
  name: string;
  role: string;
  verified: boolean;
  active: boolean;
  timeZone?: string;
  locale?: string;
  subdomain: string;
}

export class ZendeskOAuthService {
  private clientId: string;
  private clientSecret: string;
  private defaultScopes: string[];

  constructor() {
    const config = getConfig();

    this.clientId =
      config.zendesk?.clientId || process.env.ZENDESK_CLIENT_ID || '';
    this.clientSecret =
      config.zendesk?.clientSecret || process.env.ZENDESK_CLIENT_SECRET || '';
    this.defaultScopes = ['read'];

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        'Zendesk OAuth credentials not configured. Some features may not work.'
      );
    }
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param subdomain - Zendesk subdomain
   * @param redirectUri - OAuth redirect URI
   * @param state - OAuth state parameter for security
   * @param scopes - OAuth scopes to request
   * @returns Authorization URL
   */
  getAuthorizationUrl(
    subdomain: string,
    redirectUri: string,
    state: string,
    scopes: string[] = this.defaultScopes
  ): string {
    if (
      !subdomain ||
      typeof subdomain !== 'string' ||
      !/^[a-zA-Z0-9-]+$/.test(subdomain)
    ) {
      throw new Error('Invalid subdomain format');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
    });

    return `https://${subdomain}.zendesk.com/oauth/authorizations/new?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from OAuth callback
   * @param redirectUri - OAuth redirect URI (must match authorization)
   * @param subdomain - Zendesk subdomain
   * @param scopes - OAuth scopes
   * @returns Token response
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    subdomain: string,
    scopes: string[] = this.defaultScopes
  ): Promise<ZendeskTokenResponse> {
    const tokenUrl = `https://${subdomain}.zendesk.com/oauth/tokens`;

    const requestData = {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
    };

    try {
      const response: AxiosResponse = await axios.post(tokenUrl, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type,
        scope: response.data.scope || 'read',
        expiresIn: response.data.expires_in,
        refreshToken: response.data.refresh_token,
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 404) {
          throw new Error('Zendesk subdomain not found');
        }

        if (status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          throw new Error(
            `Rate limit exceeded. Retry after ${retryAfter} seconds`
          );
        }

        if (errorData && errorData.error) {
          throw new Error(`OAuth token exchange failed: ${errorData.error}`);
        }
      }

      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user information using access token
   * @param accessToken - Zendesk access token
   * @param subdomain - Zendesk subdomain
   * @returns User information
   */
  async getUserInfo(
    accessToken: string,
    subdomain: string
  ): Promise<ZendeskUserInfo> {
    const userUrl = `https://${subdomain}.zendesk.com/api/v2/users/me.json`;

    try {
      const response: AxiosResponse = await axios.get(userUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10000,
      });

      const user = response.data.user;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        verified: user.verified,
        active: user.active,
        timeZone: user.time_zone,
        locale: user.locale,
        subdomain,
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;

        if (status === 401) {
          throw new Error('Invalid or expired access token');
        }

        if (status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          throw new Error(
            `Rate limit exceeded. Retry after ${retryAfter} seconds`
          );
        }
      }

      throw new Error('Failed to fetch user information');
    }
  }

  /**
   * Validate Zendesk access token
   * @param accessToken - Zendesk access token
   * @param subdomain - Zendesk subdomain
   * @returns True if token is valid, false otherwise
   */
  async validateToken(
    accessToken: string,
    subdomain: string
  ): Promise<boolean> {
    try {
      const validationUrl = `https://${subdomain}.zendesk.com/oauth/tokens/current`;

      const response: AxiosResponse = await axios.post(
        validationUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 5000,
        }
      );

      return response.data && response.data.active === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh expired access token
   * @param refreshToken - Refresh token
   * @param subdomain - Zendesk subdomain
   * @returns New token response
   */
  async refreshToken(
    refreshToken: string,
    subdomain: string
  ): Promise<ZendeskTokenResponse> {
    const tokenUrl = `https://${subdomain}.zendesk.com/oauth/tokens`;

    const requestData = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    try {
      const response: AxiosResponse = await axios.post(tokenUrl, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type,
        scope: response.data.scope || 'read',
        expiresIn: response.data.expires_in,
        refreshToken: response.data.refresh_token,
      };
    } catch (error: any) {
      if (error.response && error.response.data && error.response.data.error) {
        throw new Error(`Token refresh failed: ${error.response.data.error}`);
      }

      throw new Error('Token refresh failed');
    }
  }

  /**
   * Validate webhook signature from Zendesk
   * @param payload - Webhook payload
   * @param signature - Signature from webhook headers
   * @param secret - Webhook secret key
   * @returns True if signature is valid, false otherwise
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke Zendesk access token
   * @param accessToken - Access token to revoke
   * @param subdomain - Zendesk subdomain
   * @returns True if revocation was successful
   */
  async revokeToken(accessToken: string, subdomain: string): Promise<boolean> {
    try {
      const revokeUrl = `https://${subdomain}.zendesk.com/oauth/tokens/current`;

      await axios.delete(revokeUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10000,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available OAuth scopes for the client
   * @param subdomain - Zendesk subdomain
   * @returns Array of available scopes
   */
  async getAvailableScopes(subdomain: string): Promise<string[]> {
    try {
      const scopesUrl = `https://${subdomain}.zendesk.com/oauth/clients/${this.clientId}`;

      const response: AxiosResponse = await axios.get(scopesUrl, {
        timeout: 10000,
      });

      return response.data.scopes || this.defaultScopes;
    } catch (error) {
      // Return default scopes if unable to fetch
      return this.defaultScopes;
    }
  }

  /**
   * Generate state parameter for OAuth security
   * @returns Random state string
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate OAuth state parameter
   * @param receivedState - State received from OAuth callback
   * @param expectedState - Expected state value
   * @returns True if state is valid, false otherwise
   */
  validateState(receivedState: string, expectedState: string): boolean {
    if (!receivedState || !expectedState) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(receivedState),
      Buffer.from(expectedState)
    );
  }

  /**
   * Parse error from OAuth callback
   * @param error - Error code from OAuth callback
   * @param errorDescription - Error description from OAuth callback
   * @returns Formatted error message
   */
  parseOAuthError(error: string, errorDescription?: string): string {
    const errorMessages: Record<string, string> = {
      access_denied: 'User denied access to the application',
      invalid_request: 'Invalid OAuth request parameters',
      unsupported_response_type: 'Unsupported OAuth response type',
      invalid_scope: 'Invalid or unsupported OAuth scope',
      server_error: 'Zendesk server error occurred',
      temporarily_unavailable: 'Zendesk service is temporarily unavailable',
    };

    const message = errorMessages[error] || 'Unknown OAuth error occurred';

    if (errorDescription) {
      return `${message}: ${errorDescription}`;
    }

    return message;
  }
}
