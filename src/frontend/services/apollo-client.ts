/**
 * Apollo GraphQL Client Configuration
 * Handles real-time subscriptions and API communication with backend
 */

import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  split,
  from,
} from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getZendeskAuth } from './zendesk-auth';

// Get configuration from environment or Zendesk settings
const API_URL = window.__ZENDESK_APP_SETTINGS__?.api_url || 
  (typeof process !== 'undefined' ? process.env.VITE_API_URL : '') || 
  'http://localhost:3000';

const WS_URL = API_URL.replace(/^https?/, 'ws').replace(/^http/, 'ws');

// HTTP link for queries and mutations
const httpLink = createHttpLink({
  uri: `${API_URL}/graphql`,
});

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: `${WS_URL}/graphql`,
    connectionParams: async () => {
      const auth = await getZendeskAuth();
      return {
        authorization: auth?.token ? `Bearer ${auth.token}` : '',
        'zendesk-subdomain': auth?.subdomain || '',
      };
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

// Auth link to add JWT token to requests
const authLink = setContext(async (_, { headers }) => {
  const auth = await getZendeskAuth();
  
  return {
    headers: {
      ...headers,
      authorization: auth?.token ? `Bearer ${auth.token}` : '',
      'zendesk-subdomain': auth?.subdomain || '',
      'content-type': 'application/json',
    },
  };
});

// Error link for handling GraphQL errors
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Trigger re-authentication
        window.dispatchEvent(new CustomEvent('auth-error', { detail: message }));
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Dispatch network error event for UI handling
    window.dispatchEvent(
      new CustomEvent('network-error', { detail: networkError.message })
    );
  }
});

// Split link to route queries/mutations to HTTP and subscriptions to WebSocket
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([errorLink, authLink, httpLink])
);

// Apollo Client configuration
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      // Cache policies for real-time data
      Conversation: {
        fields: {
          messages: {
            merge(existing = [], incoming) {
              // Merge messages by ID, keeping the latest version
              const merged = [...existing];
              incoming.forEach((incomingMessage: any) => {
                const existingIndex = merged.findIndex(
                  (msg: any) => msg.id === incomingMessage.id
                );
                if (existingIndex >= 0) {
                  merged[existingIndex] = incomingMessage;
                } else {
                  merged.push(incomingMessage);
                }
              });
              return merged.sort((a: any, b: any) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
            },
          },
        },
      },
      Message: {
        fields: {
          sentimentAnalysis: {
            merge: true, // Always use the latest sentiment analysis
          },
          aiSuggestions: {
            merge: true, // Always use the latest suggestions
          },
        },
      },
      Query: {
        fields: {
          // Configure pagination for queries
          conversations: {
            keyArgs: ['filter'],
            merge(existing, incoming, { args }) {
              if (args?.offset === 0) {
                return incoming; // Reset for first page
              }
              return existing ? [...existing, ...incoming] : incoming;
            },
          },
        },
      },
    },
  }),
  
  // Default options
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all', // Show partial data even with errors
      fetchPolicy: 'cache-and-network', // Always get fresh data but show cached first
    },
    query: {
      errorPolicy: 'all',
      fetchPolicy: 'cache-first', // Use cache for one-time queries
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  
  // Enable developer tools in development
  connectToDevTools: __DEV__,
});

// Helper functions for common operations
export const clearCache = () => {
  apolloClient.cache.reset();
};

export const refetchAllQueries = () => {
  apolloClient.refetchQueries({ include: 'active' });
};

// Export for testing
export const getClient = () => apolloClient;

// Connection status monitoring
export const onConnectionStatusChange = (callback: (status: string) => void) => {
  // Monitor WebSocket connection status
  const wsClient = wsLink as any;
  if (wsClient.client) {
    wsClient.client.on('connected', () => callback('connected'));
    wsClient.client.on('closed', () => callback('disconnected'));
    wsClient.client.on('error', () => callback('error'));
  }
};

// Declare global types for TypeScript
declare global {
  interface Window {
    __ZENDESK_APP_SETTINGS__?: {
      api_url?: string;
      api_key?: string;
      enable_sentiment_analysis?: boolean;
      enable_response_suggestions?: boolean;
      escalation_threshold?: number;
    };
  }
}