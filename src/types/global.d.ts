/**
 * Global type declarations for ConversationIQ
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      DATABASE_URL: string;
      REDIS_URL: string;
      JWT_SECRET: string;
      OPENAI_API_KEY: string;
      ZENDESK_CLIENT_ID: string;
      ZENDESK_CLIENT_SECRET: string;
      ENCRYPTION_KEY: string;
    }
  }

  // Test utilities
  namespace jest {
    interface Global {
      testUtils: {
        // Add test utility types here
      };
    }
  }
}

export {};
