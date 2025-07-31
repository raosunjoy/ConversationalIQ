/**
 * Environment configuration management for ConversationIQ
 * Handles loading, validation, and caching of configuration
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectionTimeoutMs?: number;
}

export interface RedisConfig {
  url: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface JWTConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
}

export interface KafkaConfig {
  brokers: string[];
  ssl?: boolean;
  saslMechanism?: string | undefined;
  saslUsername?: string | undefined;
  saslPassword?: string | undefined;
  partitions: number;
  replicationFactor: number;
}

export interface AIConfig {
  openaiApiKey: string | undefined;
  openaiModel: string | undefined;
  maxTokens: number | undefined;
  temperature: number | undefined;
}

export interface ZendeskConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  webhookSecret: string | undefined;
  apiUrl: string | undefined;
}

export interface CorsConfig {
  origin: string | string[];
  credentials: boolean;
  methods: string[];
}

export interface MonitoringConfig {
  datadogApiKey: string | undefined;
  sentryDsn: string | undefined;
  enableMetrics: boolean;
}

export interface AppConfig {
  // Basic app settings
  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  port: number;

  // Service configurations
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JWTConfig;
  kafka: KafkaConfig;
  ai: AIConfig;
  zendesk: ZendeskConfig;
  cors: CorsConfig;
  monitoring: MonitoringConfig;
}

let cachedConfig: AppConfig | null = null;

/**
 * Validates required environment variables
 */
function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Validate JWT secret length
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  // Validate database URL format
  if (!process.env.DATABASE_URL!.startsWith('postgresql://')) {
    throw new Error(
      'Invalid DATABASE_URL format - must be a PostgreSQL connection string'
    );
  }

  // Validate Redis URL format if provided
  if (process.env.REDIS_URL && !process.env.REDIS_URL.startsWith('redis://')) {
    throw new Error(
      'Invalid REDIS_URL format - must be a Redis connection string'
    );
  }

  // Validate port if provided
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('PORT must be a valid number between 1 and 65535');
    }
  }
}

/**
 * Creates application configuration from environment variables
 */
function createConfig(): AppConfig {
  validateEnvironment();

  const environment = process.env.NODE_ENV || 'development';
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';
  const isTest = environment === 'test';

  // Parse allowed origins for CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  const corsOrigin = allowedOrigins
    ? allowedOrigins.split(',').map(origin => origin.trim())
    : isDevelopment
      ? '*'
      : [];

  const config: AppConfig = {
    // Basic app settings
    environment,
    isDevelopment,
    isProduction,
    isTest,
    port: parseInt(process.env.PORT || '3000', 10),

    // Database configuration
    database: {
      url: process.env.DATABASE_URL!,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      connectionTimeoutMs: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || '5000',
        10
      ),
    },

    // Redis configuration
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
    },

    // JWT configuration
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: process.env.JWT_ISSUER || 'conversationiq',
    },

    // Kafka configuration
    kafka: {
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      ssl: process.env.KAFKA_SSL === 'true',
      saslMechanism: process.env.KAFKA_SASL_MECHANISM,
      saslUsername: process.env.KAFKA_SASL_USERNAME,
      saslPassword: process.env.KAFKA_SASL_PASSWORD,
      partitions: parseInt(process.env.KAFKA_PARTITIONS || '3', 10),
      replicationFactor: parseInt(
        process.env.KAFKA_REPLICATION_FACTOR || '1',
        10
      ),
    },

    // AI services configuration
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000', 10),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    },

    // Zendesk integration configuration
    zendesk: {
      clientId: process.env.ZENDESK_CLIENT_ID,
      clientSecret: process.env.ZENDESK_CLIENT_SECRET,
      webhookSecret: process.env.ZENDESK_WEBHOOK_SECRET,
      apiUrl: process.env.ZENDESK_API_URL || 'https://api.zendesk.com',
    },

    // CORS configuration
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    },

    // Monitoring configuration
    monitoring: {
      datadogApiKey: process.env.DATADOG_API_KEY,
      sentryDsn: process.env.SENTRY_DSN,
      enableMetrics: process.env.ENABLE_METRICS === 'true' || isProduction,
    },
  };

  return config;
}

/**
 * Gets the application configuration
 * Caches the configuration after first load for performance
 */
export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = createConfig();
  }
  return cachedConfig;
}

/**
 * Resets the cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Type-safe environment variable access
 */
export const env = {
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },

  get PORT(): number {
    return parseInt(process.env.PORT || '3000', 10);
  },

  get DATABASE_URL(): string {
    return process.env.DATABASE_URL || '';
  },

  get REDIS_URL(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  },

  get JWT_SECRET(): string {
    return process.env.JWT_SECRET || '';
  },

  isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  },

  isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },

  isTest(): boolean {
    return this.NODE_ENV === 'test';
  },
};

// Export default configuration for convenience
// Note: Commented out to avoid loading issues in tests
// export default getConfig();
