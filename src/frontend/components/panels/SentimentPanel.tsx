/**
 * Sentiment Analysis Panel
 * Shows real-time sentiment analysis and conversation timeline
 */

import React, { useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@zendeskgarden/react-buttons';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  selectFilteredMessages,
  selectMessageFilter,
  selectOverallSentiment,
  selectSentimentHistory,
  setMessageFilter,
  setOverallSentiment,
  setMessages,
} from '../../store/slices/conversation-slice';
import {
  GET_MESSAGE_SENTIMENT,
  ANALYZE_MESSAGE,
} from '../../services/graphql-queries';
import { ZendeskTicket } from '../../types';
import SentimentIndicator from '../common/SentimentIndicator';
import ConversationTimeline from '../common/ConversationTimeline';
import SentimentTrendChart from '../common/SentimentTrendChart';

interface SentimentPanelProps {
  conversationId: string | null;
  ticket: ZendeskTicket;
  loading?: boolean;
}

const SentimentPanel: React.FC<SentimentPanelProps> = ({
  conversationId,
  ticket,
  loading = false,
}) => {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectFilteredMessages);
  const messageFilter = useAppSelector(selectMessageFilter);
  const overallSentiment = useAppSelector(selectOverallSentiment);
  const sentimentHistory = useAppSelector(selectSentimentHistory);

  // Mutation to trigger sentiment analysis
  const [analyzeMessage] = useMutation(ANALYZE_MESSAGE, {
    onCompleted: data => {
      if (data?.result?.sentiment) {
        dispatch(setOverallSentiment(data.result.sentiment));
      }
    },
    onError: error => {
      console.error('Failed to analyze message:', error);
    },
  });

  // Load initial sentiment data
  useEffect(() => {
    if (conversationId && messages.length === 0) {
      // Load conversation messages and sentiment data
      loadConversationData();
    }
  }, [conversationId]);

  const loadConversationData = async () => {
    // This would typically load from the conversation query
    // For now, we'll simulate some data
    const mockMessages = [
      {
        id: '1',
        content: 'I am having trouble with my billing account',
        author: 'Customer',
        timestamp: new Date(Date.now() - 3600000),
        sentiment: {
          score: -0.4,
          label: 'NEGATIVE' as const,
          confidence: 0.85,
          emotions: [
            { emotion: 'frustration', confidence: 0.8, intensity: 0.6 },
          ],
          trend: 'stable' as const,
        },
        isAlert: true,
        intentions: ['billing_inquiry', 'problem_report'],
      },
      {
        id: '2',
        content: 'Thank you for your help!',
        author: 'Customer',
        timestamp: new Date(Date.now() - 1800000),
        sentiment: {
          score: 0.8,
          label: 'POSITIVE' as const,
          confidence: 0.92,
          emotions: [{ emotion: 'gratitude', confidence: 0.9, intensity: 0.7 }],
          trend: 'improving' as const,
        },
        isAlert: false,
        intentions: ['gratitude'],
      },
    ];

    dispatch(setMessages(mockMessages));

    // Calculate overall sentiment
    const avgScore =
      mockMessages.reduce((sum, msg) => sum + msg.sentiment.score, 0) /
      mockMessages.length;
    dispatch(
      setOverallSentiment({
        score: avgScore,
        label:
          avgScore > 0.1
            ? 'POSITIVE'
            : avgScore < -0.1
              ? 'NEGATIVE'
              : 'NEUTRAL',
        confidence: 0.8,
        emotions: [],
        trend: 'improving',
      })
    );
  };

  const handleFilterChange = (filter: 'all' | 'negative' | 'alerts') => {
    dispatch(setMessageFilter(filter));
  };

  const handleRefreshSentiment = () => {
    if (messages.length > 0) {
      const lastMessageId = messages[messages.length - 1].id;
      analyzeMessage({ variables: { messageId: lastMessageId } });
    }
  };

  if (loading) {
    return (
      <div className="sentiment-panel loading">
        <div className="loading-spinner"></div>
        <p>Analyzing conversation sentiment...</p>
      </div>
    );
  }

  return (
    <div className="sentiment-panel">
      {/* Sentiment Overview */}
      <div className="sentiment-overview">
        <div className="sentiment-score-card">
          <SentimentIndicator
            sentiment={overallSentiment}
            showTrend={true}
            size="large"
          />
          <div className="sentiment-actions">
            <Button
              size="small"
              onClick={handleRefreshSentiment}
              disabled={loading || !conversationId}
            >
              <span className="btn-icon">🔄</span>
              Refresh
            </Button>
          </div>
        </div>

        {/* Sentiment Trend Chart */}
        {sentimentHistory.length > 1 && (
          <div className="sentiment-trend">
            <SentimentTrendChart data={sentimentHistory} height={80} />
          </div>
        )}
      </div>

      {/* Conversation Timeline */}
      <div className="conversation-timeline">
        <div className="timeline-header">
          <h4>Message Analysis</h4>
          <div className="timeline-filters">
            <Button
              size="small"
              isPrimary={messageFilter === 'all'}
              onClick={() => handleFilterChange('all')}
            >
              All ({messages.length})
            </Button>
            <Button
              size="small"
              isPrimary={messageFilter === 'negative'}
              onClick={() => handleFilterChange('negative')}
            >
              Negative
            </Button>
            <Button
              size="small"
              isPrimary={messageFilter === 'alerts'}
              onClick={() => handleFilterChange('alerts')}
            >
              Alerts
            </Button>
          </div>
        </div>

        <ConversationTimeline
          messages={messages}
          onMessageClick={messageId => {
            console.log('Message clicked:', messageId);
            // Could trigger detailed analysis
          }}
          filterType={messageFilter}
        />
      </div>

      {/* Quick Insights */}
      <div className="quick-insights">
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-value">
              {messages.filter(m => m.isAlert).length}
            </div>
            <div className="insight-label">Alerts</div>
          </div>
          <div className="insight-card">
            <div className="insight-value">
              {overallSentiment?.confidence
                ? `${Math.round(overallSentiment.confidence * 100)}%`
                : '--'}
            </div>
            <div className="insight-label">Confidence</div>
          </div>
          <div className="insight-card">
            <div className="insight-value">{messages.length}</div>
            <div className="insight-label">Messages</div>
          </div>
        </div>
      </div>

      {/* Escalation Warning */}
      {overallSentiment && overallSentiment.score < -0.5 && (
        <div className="escalation-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <strong>Escalation Recommended</strong>
            <p>
              Sentiment is strongly negative. Consider escalating to a
              supervisor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentPanel;
