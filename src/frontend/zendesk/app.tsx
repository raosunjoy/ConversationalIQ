/**
 * Main ConversationIQ App Component
 * Entry point for Zendesk app integration
 */

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import { ThemeProvider } from '@zendeskgarden/react-theming';
import { store } from '../store';
import { apolloClient } from '../services/apollo-client';
import {
  initializeZendeskClient,
  getCurrentUser,
  getCurrentTicket,
  onTicketChange,
} from '../services/zendesk-auth';
import {
  setUser,
  setTicket,
  setConnectionStatus,
  setError,
  setLoading,
} from '../store/slices/app-slice';
import { setCurrentConversationId } from '../store/slices/conversation-slice';
import AgentDashboard from '../components/AgentDashboard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ConnectionStatus from '../components/common/ConnectionStatus';
import '../styles/app.css';

const ConversationIQApp: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      store.dispatch(setLoading(true));
      store.dispatch(setConnectionStatus('connecting'));

      // Initialize Zendesk App Framework
      await initializeZendeskClient();
      console.log('Zendesk client initialized');

      // Get current user and ticket
      const [user, ticket] = await Promise.all([
        getCurrentUser(),
        getCurrentTicket(),
      ]);

      if (user) {
        store.dispatch(setUser(user));
        console.log('User loaded:', user.name);
      }

      if (ticket) {
        store.dispatch(setTicket(ticket));
        store.dispatch(setCurrentConversationId(`zendesk-${ticket.id}`));
        console.log('Ticket loaded:', ticket.id);
      }

      // Set up ticket change listener
      onTicketChange(updatedTicket => {
        store.dispatch(setTicket(updatedTicket));
        store.dispatch(setCurrentConversationId(`zendesk-${updatedTicket.id}`));
        console.log('Ticket updated:', updatedTicket.id);
      });

      store.dispatch(setConnectionStatus('connected'));
      setIsInitialized(true);
    } catch (error: any) {
      console.error('App initialization failed:', error);
      const errorMessage =
        error.message || 'Failed to initialize ConversationIQ';
      setInitError(errorMessage);
      store.dispatch(
        setError({
          code: 'INIT_ERROR',
          message: errorMessage,
          timestamp: new Date(),
          recoverable: true,
        })
      );
      store.dispatch(setConnectionStatus('error'));
    } finally {
      store.dispatch(setLoading(false));
    }
  };

  const handleRetry = () => {
    setInitError(null);
    setIsInitialized(false);
    initializeApp();
  };

  if (initError) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>Unable to load ConversationIQ</h3>
          <p className="error-message">{initError}</p>
          <button className="retry-btn" onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="loading-container">
        <LoadingSpinner />
        <p>Loading ConversationIQ...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        <ConnectionStatus />
        <AgentDashboard />
      </div>
    </ErrorBoundary>
  );
};

// Main App Wrapper with Providers
const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ApolloProvider client={apolloClient}>
        <ThemeProvider>
          <ConversationIQApp />
        </ThemeProvider>
      </ApolloProvider>
    </Provider>
  );
};

// Initialize and render the app
const container = document.getElementById('app');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
} else {
  console.error('App container not found');
}
