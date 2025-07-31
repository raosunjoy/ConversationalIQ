/**
 * JWT authentication service for ConversationIQ
 * Handles token generation, verification, and management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { StringValue } from 'ms';

export interface JWTPayload {
  userId: string;
  email?: string | undefined;
  role?: string | undefined;
  zendeskId?: string | undefined;
  subdomain?: string | undefined;
  permissions?: string[] | undefined;
  tokenType?: string | undefined;
  refreshedAt?: number | undefined;
  [key: string]: any;
}

export interface ZendeskUser extends JWTPayload {
  zendeskId: string;
  subdomain: string;
}

export class JWTService {
  private secret: string;
  private blacklistedTokens: Set<string> = new Set();

  constructor() {
    this.secret = process.env.JWT_SECRET;

    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    if (this.secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  /**
   * Generate a JWT token with the given payload
   * @param payload - Token payload
   * @param expiresIn - Token expiration time (default: 24h)
   * @returns JWT token string
   */
  async generateToken(
    payload: JWTPayload,
    expiresIn: StringValue | number = '24h'
  ): Promise<string> {
    try {
      const options: jwt.SignOptions = {
        issuer: 'conversationiq',
        audience: 'conversationiq-users',
        expiresIn,
      };

      const token = jwt.sign(
        {
          ...payload,
          iat: Math.floor(Date.now() / 1000),
        },
        this.secret,
        options
      );

      return token;
    } catch (error) {
      throw new Error(
        `Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify and decode a JWT token
   * @param token - JWT token to verify
   * @returns Decoded token payload
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: Token must be a non-empty string');
    }

    // Check if token is blacklisted
    if (await this.isTokenBlacklisted(token)) {
      throw new Error('Invalid token: Token has been revoked');
    }

    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'conversationiq',
        audience: 'conversationiq-users',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid token: ${error.message}`);
      }
      throw new Error(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh a JWT token by generating a new one with the same payload
   * @param token - Existing token to refresh
   * @param expiresIn - New token expiration time
   * @returns New JWT token
   */
  async refreshToken(
    token: string,
    expiresIn: StringValue | number = '24h'
  ): Promise<string> {
    // Verify the existing token first
    const payload = await this.verifyToken(token);

    // Remove JWT-specific claims
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iat, exp, iss, aud, jti, ...cleanPayload } = payload as any;

    // Add a refresh timestamp to ensure uniqueness
    const refreshedPayload = {
      ...cleanPayload,
      refreshedAt: Math.floor(Date.now() / 1000),
    };

    // Generate new token with refreshed payload
    return await this.generateToken(refreshedPayload, expiresIn);
  }

  /**
   * Generate a JWT token specifically for Zendesk users
   * @param user - Zendesk user information
   * @param expiresIn - Token expiration time
   * @returns JWT token string
   */
  async generateZendeskToken(
    user: ZendeskUser,
    expiresIn: StringValue | number = '24h'
  ): Promise<string> {
    const payload: JWTPayload = {
      userId: user.userId,
      ...(user.email && { email: user.email }),
      ...(user.role && { role: user.role }),
      zendeskId: user.zendeskId,
      subdomain: user.subdomain,
      ...(user.permissions && { permissions: user.permissions }),
      tokenType: 'zendesk',
    };

    return await this.generateToken(payload, expiresIn);
  }

  /**
   * Add a token to the blacklist
   * @param token - Token to blacklist
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      // Verify token first to get its ID/signature
      const decoded = jwt.decode(token) as any;

      if (decoded && decoded.jti) {
        // Use JTI (JWT ID) if available
        this.blacklistedTokens.add(decoded.jti);
      } else {
        // Use token hash as identifier
        const tokenHash = crypto
          .createHash('sha256')
          .update(token)
          .digest('hex');
        this.blacklistedTokens.add(tokenHash);
      }
    } catch (error) {
      // If token is invalid, still add its hash to blacklist
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      this.blacklistedTokens.add(tokenHash);
    }
  }

  /**
   * Check if a token is blacklisted
   * @param token - Token to check
   * @returns True if blacklisted, false otherwise
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const decoded = jwt.decode(token) as any;

      if (decoded && decoded.jti) {
        return this.blacklistedTokens.has(decoded.jti);
      } else {
        const tokenHash = crypto
          .createHash('sha256')
          .update(token)
          .digest('hex');
        return this.blacklistedTokens.has(tokenHash);
      }
    } catch (error) {
      // If token is invalid, check its hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      return this.blacklistedTokens.has(tokenHash);
    }
  }

  /**
   * Extract JWT token from Authorization header
   * @param authHeader - Authorization header value
   * @returns Extracted token or null if invalid
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }

  /**
   * Generate a JWT token with a unique ID for better tracking
   * @param payload - Token payload
   * @param expiresIn - Token expiration time
   * @returns JWT token with JTI claim
   */
  async generateTokenWithId(
    payload: JWTPayload,
    expiresIn: StringValue | number = '24h'
  ): Promise<string> {
    const tokenId = crypto.randomUUID();

    const tokenPayload = {
      ...payload,
      jti: tokenId,
    };

    return await this.generateToken(tokenPayload, expiresIn);
  }

  /**
   * Decode a JWT token without verification (for inspection purposes)
   * @param token - JWT token to decode
   * @returns Decoded token payload or null if invalid
   */
  decodeTokenUnsafe(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token);
      return decoded as JWTPayload | null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiration time
   * @param token - JWT token
   * @returns Expiration timestamp or null if invalid
   */
  getTokenExpiration(token: string): number | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.exp ? decoded.exp * 1000 : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a token is expired
   * @param token - JWT token
   * @returns True if expired, false otherwise
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);

    if (!expiration) {
      return true; // Consider invalid tokens as expired
    }

    return Date.now() >= expiration;
  }
}
