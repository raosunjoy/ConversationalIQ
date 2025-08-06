/**
 * Vite Configuration for ConversationIQ Frontend
 * Builds React components for Zendesk app integration
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Build configuration for Zendesk assets
  build: {
    outDir: 'dist/zendesk/assets',
    emptyOutDir: false, // Don't clear the entire dist folder
    
    rollupOptions: {
      input: {
        // Main Zendesk app entry points
        app: resolve(__dirname, 'src/frontend/zendesk/app.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    
    // Target modern browsers (Zendesk supports modern browsers)
    target: 'es2020',
    
    // Source maps for debugging
    sourcemap: true,
  },
  
  // Development server configuration
  server: {
    port: 3001,
    cors: true,
    proxy: {
      // Proxy API calls to backend during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  
  // TypeScript and path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/frontend'),
      '@shared': resolve(__dirname, 'src/types'),
      '@ai': resolve(__dirname, 'src/ai'),
    },
  },
  
  // Environment variables
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  
  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
});