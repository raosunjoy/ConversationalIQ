/**
 * Agent Dashboard Component
 * Main dashboard interface for customer service agents
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
// import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { 
  selectActiveTab, 
  selectTicket, 
  selectUser, 
  selectConnectionStatus 
} from '../store/slices/app-slice';
import { 
  selectCurrentConversationId,
  selectOverallSentiment,
  selectAnalytics,
  selectFilteredMessages
} from '../store/slices/conversation-slice';
import { setActiveTab } from '../store/slices/app-slice';
import { 
  GET_CONVERSATION_BY_TICKET,
  GET_CONVERSATION_ANALYTICS,
  SENTIMENT_ANALYZED_SUBSCRIPTION,
  ANALYTICS_UPDATED_SUBSCRIPTION
} from '../services/graphql-queries';
import SentimentPanel from './panels/SentimentPanel';
import SuggestionsPanel from './panels/SuggestionsPanel';
import AnalyticsPanel from './panels/AnalyticsPanel';
import QuickActionsButton from './common/QuickActionsButton';
import { resizeApp } from '../services/zendesk-auth';

const AgentDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectActiveTab);
  const ticket = useAppSelector(selectTicket);
  const user = useAppSelector(selectUser);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const conversationId = useAppSelector(selectCurrentConversationId);
  const overallSentiment = useAppSelector(selectOverallSentiment);
  const analytics = useAppSelector(selectAnalytics);
  const messages = useAppSelector(selectFilteredMessages);

  // const [tabHeight, setTabHeight] = useState(400);

  // Query conversation data when ticket changes
  const { data: conversationData, loading: loadingConversation, error: conversationError } = useQuery(
    GET_CONVERSATION_BY_TICKET,
    {
      variables: { ticketId: ticket?.id?.toString() || '' },
      skip: !ticket?.id,
      fetchPolicy: 'cache-and-network',
    }
  );

  // Query analytics data
  const { data: analyticsData, loading: loadingAnalytics } = useQuery(
    GET_CONVERSATION_ANALYTICS,
    {
      variables: { conversationId: conversationId || '' },
      skip: !conversationId,
      fetchPolicy: 'cache-and-network',
      pollInterval: 30000, // Poll every 30 seconds
    }
  );

  // Subscribe to real-time sentiment updates
  useSubscription(SENTIMENT_ANALYZED_SUBSCRIPTION, {
    variables: { conversationId: conversationId || '' },
    skip: !conversationId || connectionStatus !== 'connected',
    onData: ({ data }) => {
      if (data?.data?.sentimentAnalyzed) {
        // Handle real-time sentiment update
        console.log('New sentiment analysis:', data.data.sentimentAnalyzed);
      }
    },
  });

  // Subscribe to analytics updates
  useSubscription(ANALYTICS_UPDATED_SUBSCRIPTION, {
    variables: { conversationId: conversationId || '' },
    skip: !conversationId || connectionStatus !== 'connected',
    onData: ({ data }) => {
      if (data?.data?.analyticsUpdated) {
        // Handle real-time analytics update
        console.log('Analytics updated:', data.data.analyticsUpdated);
      }
    },
  });

  // Auto-resize based on content
  useEffect(() => {
    // Adjust height based on tab content
    const heights = { sentiment: 450, suggestions: 400, analytics: 350 };
    const newHeight = heights[activeTab];
    resizeApp(newHeight);
  }, [activeTab, messages.length]);

  // Show loading state
  if (loadingConversation && !conversationData) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading conversation data...</p>
      </div>
    );
  }

  // Show error state
  if (conversationError) {
    return (
      <div className="dashboard-error">
        <div className="error-icon">⚠️</div>
        <h3>Unable to load conversation</h3>
        <p>{conversationError.message}</p>
      </div>
    );
  }

  // Show no ticket state
  if (!ticket) {
    return (
      <div className="dashboard-empty">
        <div className="empty-icon">📝</div>
        <h3>No ticket selected</h3>
        <p>Please select a ticket to view conversation insights.</p>
      </div>
    );
  }

  return (
    <div className="agent-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="brand">
            <span className="brand-icon">🧠</span>
            <span className="brand-name">ConversationIQ</span>
          </div>
          <div className="ticket-info">
            <span className="ticket-id">#{ticket.id}</span>
            <span className="ticket-status">{ticket.status}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-tabs">
        <div className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === 'sentiment' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('sentiment'))}
          >
            <span className="tab-icon">😊</span>
            Sentiment
            {overallSentiment && (
              <span className={`sentiment-indicator ${overallSentiment.label.toLowerCase()}`}>
                {overallSentiment.score > 0 ? '↗' : overallSentiment.score < 0 ? '↘' : '→'}
              </span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('suggestions'))}
          >
            <span className="tab-icon">💡</span>
            Suggestions
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab('analytics'))}
          >
            <span className="tab-icon">📊</span>
            Analytics
            {analytics && analytics.escalationRisk > 0.7 && (
              <span className="risk-indicator">⚠️</span>
            )}
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'sentiment' && (
            <SentimentPanel 
              conversationId={conversationId}
              ticket={ticket}
              loading={loadingConversation}
            />
          )}
          
          {activeTab === 'suggestions' && (
            <SuggestionsPanel 
              conversationId={conversationId}
              ticket={ticket}
            />
          )}
          
          {activeTab === 'analytics' && (
            <AnalyticsPanel 
              conversationId={conversationId}
              analytics={analyticsData?.analytics}
              loading={loadingAnalytics}
            />
          )}
        </div>
      </div>

      {/* Quick Actions Button */}
      <QuickActionsButton 
        conversationId={conversationId}
        escalationRisk={analytics?.escalationRisk || 0}
      />
    </div>
  );
};

export default AgentDashboard;