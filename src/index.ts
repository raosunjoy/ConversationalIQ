/**
 * ConversationIQ Application Entry Point
 * Main application bootstrapping and configuration
 */

export interface AppConfig {
  name: string;
  version: string;
  environment: string;
}

/**
 * Starts the ConversationIQ application
 * @returns Promise resolving to application configuration
 */
export async function startApp(): Promise<AppConfig> {
  const config: AppConfig = {
    name: 'ConversationIQ',
    version: '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
  };

  return config;
}

// Only start the app if this file is run directly
// Note: Using require.main check for CommonJS compatibility in tests
/* istanbul ignore if */
if (require.main === module) {
  startApp()
    .then(config => {
      console.log(
        `🚀 ${config.name} v${config.version} started in ${config.environment} mode`
      );
    })
    .catch(error => {
      console.error('Failed to start application:', error);
      process.exit(1);
    });
}
