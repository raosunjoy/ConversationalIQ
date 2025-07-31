/**
 * API Server entry point
 * Starts the Express server with all middleware and routes
 */

import { createServer } from './server';
import { getConfig } from '../config/environment';

/**
 * Start the API server
 */
async function startApiServer(): Promise<void> {
  try {
    const { startServer } = await createServer();
    const config = getConfig();

    await startServer(config.port);
  } catch (error) {
    console.error('Failed to start API server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startApiServer();
}

export { startApiServer };
