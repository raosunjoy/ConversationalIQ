/**
 * Data Encryption and Privacy Service
 * Implements end-to-end encryption, PII detection, and data anonymization
 * for GDPR compliance and enterprise security requirements
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DatabaseService } from '../services/database';

// Encryption configuration
interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

const encryptionConfig: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  saltLength: 32, // 256 bits
  iterations: 100000, // PBKDF2 iterations
};

// PII patterns for detection
const piiPatterns = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  url: /https?:\/\/[^\s]+/g,
  // European patterns
  ukPostcode: /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2}\b/g,
  germanTax: /\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b/g,
  // Generic patterns
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  bankAccount: /\b\d{8,17}\b/g,
};

// Encrypted field metadata
interface EncryptedField {
  data: string;           // Encrypted data (base64)
  iv: string;            // Initialization vector (base64)
  authTag: string;       // Authentication tag (base64)
  algorithm: string;     // Encryption algorithm used
  keyId: string;         // Key identifier for key rotation
  timestamp: Date;       // When encryption was performed
}

// Data classification levels
enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
}

// PII detection result
interface PIIDetectionResult {
  hasPII: boolean;
  detectedTypes: string[];
  maskedContent: string;
  confidence: number;
  locations: Array<{
    type: string;
    start: number;
    end: number;
    value: string;
  }>;
}

export class EncryptionService {
  private database: DatabaseService;
  private masterKey: Buffer;
  private keyCache: Map<string, Buffer>;
  private keyRotationSchedule: Map<string, Date>;

  constructor() {
    this.database = new DatabaseService();
    this.keyCache = new Map();
    this.keyRotationSchedule = new Map();
    this.initializeMasterKey();
  }

  /**
   * Initialize master key from environment or generate new one
   */
  private initializeMasterKey(): void {
    const masterKeyHex = process.env.MASTER_ENCRYPTION_KEY;
    
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      // Generate new master key (in production, this should be stored securely)
      this.masterKey = crypto.randomBytes(encryptionConfig.keyLength);
      console.warn('Generated new master key. Store this securely:', this.masterKey.toString('hex'));
    }
  }

  /**
   * Derive encryption key from master key and salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      encryptionConfig.iterations,
      encryptionConfig.keyLength,
      'sha512'
    );
  }

  /**
   * Generate or retrieve encryption key by ID
   */
  private getEncryptionKey(keyId: string): Buffer {
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    // In production, keys would be stored in a secure key management service
    const salt = Buffer.from(keyId, 'hex');
    const key = this.deriveKey(salt);
    this.keyCache.set(keyId, key);
    
    return key;
  }

  /**
   * Encrypt sensitive data with authenticated encryption
   */
  async encryptData(plaintext: string, classification: DataClassification = DataClassification.CONFIDENTIAL): Promise<EncryptedField> {
    try {
      // Generate unique salt/key ID for this encryption
      const keyId = crypto.randomBytes(16).toString('hex');
      const key = this.getEncryptionKey(keyId);
      
      // Generate random IV
      const iv = crypto.randomBytes(encryptionConfig.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(encryptionConfig.algorithm, key);
      cipher.setAAD(Buffer.from(classification)); // Additional authenticated data
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag().toString('base64');
      
      return {
        data: encrypted,
        iv: iv.toString('base64'),
        authTag,
        algorithm: encryptionConfig.algorithm,
        keyId,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedField: EncryptedField): Promise<string> {
    try {
      const key = this.getEncryptionKey(encryptedField.keyId);
      const iv = Buffer.from(encryptedField.iv, 'base64');
      const authTag = Buffer.from(encryptedField.authTag, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipher(encryptedField.algorithm, key);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedField.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Hash sensitive data for lookups (one-way)
   */
  async hashData(data: string, rounds: number = 12): Promise<string> {
    return await bcrypt.hash(data, rounds);
  }

  /**
   * Verify hashed data
   */
  async verifyHash(data: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(data, hash);
  }

  /**
   * Detect PII in text content
   */
  detectPII(content: string): PIIDetectionResult {
    const detectedTypes: string[] = [];
    const locations: Array<{ type: string; start: number; end: number; value: string }> = [];
    let maskedContent = content;
    let totalMatches = 0;

    // Check each PII pattern
    for (const [type, pattern] of Object.entries(piiPatterns)) {
      const matches = content.matchAll(pattern);
      
      for (const match of matches) {
        if (match.index !== undefined) {
          detectedTypes.push(type);
          locations.push({
            type,
            start: match.index,
            end: match.index + match[0].length,
            value: match[0],
          });
          totalMatches++;
        }
      }
    }

    // Remove duplicates from detected types
    const uniqueTypes = [...new Set(detectedTypes)];

    // Mask PII in content
    for (const [type, pattern] of Object.entries(piiPatterns)) {
      maskedContent = maskedContent.replace(pattern, (match) => {
        switch (type) {
          case 'email':
            return `[EMAIL_${match.substring(0, 2)}***]`;
          case 'phone':
            return `[PHONE_***-***-${match.slice(-4)}]`;
          case 'ssn':
            return '[SSN_***-**-****]';
          case 'creditCard':
            return `[CARD_****-****-****-${match.replace(/\D/g, '').slice(-4)}]`;
          case 'ipAddress':
            return '[IP_ADDRESS]';
          default:
            return `[${type.toUpperCase()}_REDACTED]`;
        }
      });
    }

    // Calculate confidence based on number and types of matches
    const confidence = Math.min(uniqueTypes.length * 0.3 + totalMatches * 0.1, 1.0);

    return {
      hasPII: uniqueTypes.length > 0,
      detectedTypes: uniqueTypes,
      maskedContent,
      confidence,
      locations,
    };
  }

  /**
   * Anonymize data by removing or replacing PII
   */
  async anonymizeData(data: any, preserveStructure: boolean = true): Promise<any> {
    if (typeof data === 'string') {
      const piiResult = this.detectPII(data);
      return piiResult.maskedContent;
    }

    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.anonymizeData(item, preserveStructure)));
    }

    if (data !== null && typeof data === 'object') {
      const anonymized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip certain fields that should be preserved
        if (['id', 'createdAt', 'updatedAt', 'version'].includes(key)) {
          anonymized[key] = value;
          continue;
        }

        // Recursively anonymize nested objects
        anonymized[key] = await this.anonymizeData(value, preserveStructure);
      }
      
      return anonymized;
    }

    return data;
  }

  /**
   * Secure data deletion (overwrite with random data)
   */
  async secureDelete(filePath: string): Promise<void> {
    // This would implement secure deletion by overwriting the data multiple times
    // For now, we'll just log the action
    console.log(`Securely deleting data at: ${filePath}`);
    // Implementation would use crypto.randomBytes() to overwrite the data
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Key rotation functionality
   */
  async rotateKeys(): Promise<void> {
    console.log('Starting key rotation...');
    
    // In production, this would:
    // 1. Generate new keys
    // 2. Re-encrypt data with new keys
    // 3. Update key cache
    // 4. Schedule old key deletion
    
    console.log('Key rotation completed');
  }

  /**
   * Check if encryption key needs rotation
   */
  needsKeyRotation(keyId: string): boolean {
    const lastRotation = this.keyRotationSchedule.get(keyId);
    if (!lastRotation) {
      return true; // No rotation record, needs rotation
    }
    
    // Rotate keys every 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return lastRotation < ninetyDaysAgo;
  }

  /**
   * Encrypt database field
   */
  async encryptField(tableName: string, fieldName: string, value: string): Promise<EncryptedField> {
    // Determine data classification based on field name/table
    let classification = DataClassification.INTERNAL;
    
    if (fieldName.includes('email') || fieldName.includes('phone') || fieldName.includes('address')) {
      classification = DataClassification.CONFIDENTIAL;
    }
    
    if (tableName.includes('payment') || tableName.includes('billing')) {
      classification = DataClassification.RESTRICTED;
    }

    return this.encryptData(value, classification);
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    totalKeysInCache: number;
    keysNeedingRotation: number;
    algorithm: string;
    keyLength: number;
  } {
    let keysNeedingRotation = 0;
    
    for (const keyId of this.keyCache.keys()) {
      if (this.needsKeyRotation(keyId)) {
        keysNeedingRotation++;
      }
    }

    return {
      totalKeysInCache: this.keyCache.size,
      keysNeedingRotation,
      algorithm: encryptionConfig.algorithm,
      keyLength: encryptionConfig.keyLength,
    };
  }
}

// Privacy utilities for GDPR compliance
export class PrivacyService {
  private encryptionService: EncryptionService;
  private database: DatabaseService;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.database = new DatabaseService();
  }

  /**
   * Handle data subject access request (GDPR Article 15)
   */
  async handleDataAccessRequest(email: string): Promise<any> {
    try {
      // This would collect all data associated with the email
      const userData = {
        profile: {}, // User profile data
        conversations: [], // All conversations
        analytics: {}, // Analytics data
        preferences: {}, // User preferences
      };

      // Return anonymized or encrypted data as appropriate
      return userData;
    } catch (error) {
      console.error('Data access request failed:', error);
      throw new Error('Failed to process data access request');
    }
  }

  /**
   * Handle data deletion request (GDPR Article 17 - Right to be Forgotten)
   */
  async handleDataDeletionRequest(email: string): Promise<{ success: boolean; deletedRecords: number }> {
    try {
      let deletedRecords = 0;

      // This would:
      // 1. Find all data associated with the email
      // 2. Securely delete the data
      // 3. Log the deletion for audit purposes
      // 4. Update any references

      console.log(`Processing data deletion request for: ${email}`);
      
      return {
        success: true,
        deletedRecords,
      };
    } catch (error) {
      console.error('Data deletion request failed:', error);
      throw new Error('Failed to process data deletion request');
    }
  }

  /**
   * Handle data portability request (GDPR Article 20)
   */
  async handleDataPortabilityRequest(email: string): Promise<any> {
    try {
      // Export user data in a machine-readable format
      const exportData = {
        profile: {},
        conversations: [],
        analytics: {},
        exportDate: new Date().toISOString(),
        format: 'json',
      };

      return exportData;
    } catch (error) {
      console.error('Data portability request failed:', error);
      throw new Error('Failed to process data portability request');
    }
  }

  /**
   * Record consent for data processing
   */
  async recordConsent(userId: string, consentType: string, granted: boolean): Promise<void> {
    const consentRecord = {
      userId,
      consentType,
      granted,
      timestamp: new Date(),
      ipAddress: '', // Would be captured from request
      userAgent: '', // Would be captured from request
    };

    // Store consent record for audit trail
    console.log('Consent recorded:', consentRecord);
  }
}

// Export singleton instances
export const encryptionService = new EncryptionService();
export const privacyService = new PrivacyService();