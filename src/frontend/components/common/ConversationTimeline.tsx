/**
 * Conversation Timeline Component
 * Shows chronological list of messages with sentiment analysis
 */

import React from 'react';
import { ConversationTimelineProps, MessageTimelineItem } from '../../types';
import SentimentIndicator from './SentimentIndicator';

const ConversationTimeline: React.FC<ConversationTimelineProps> = ({
  messages,
  onMessageClick,
  filterType = 'all',
}) => {
  if (!messages || messages.length === 0) {
    return (
      <div className="timeline-empty">
        <div className="empty-icon">💬</div>
        <p>No messages to display</p>
      </div>
    );
  }

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return timestamp.toLocaleDateString();
  };

  const getMessageIcon = (isCustomer: boolean, isAlert: boolean): string => {
    if (isAlert) return '🚨';
    return isCustomer ? '👤' : '🎧';
  };

  const handleMessageClick = (messageId: string) => {
    if (onMessageClick) {
      onMessageClick(messageId);
    }
  };

  return (
    <div className="conversation-timeline">
      <div className="timeline-list">
        {messages.map(message => (
          <div
            key={message.id}
            className={`timeline-item ${message.isAlert ? 'alert' : ''} ${
              message.author === 'Customer' ? 'customer' : 'agent'
            }`}
            onClick={() => handleMessageClick(message.id)}
          >
            <div className="timeline-marker">
              <span className="message-icon">
                {getMessageIcon(message.author === 'Customer', message.isAlert)}
              </span>
            </div>

            <div className="timeline-content">
              <div className="message-header">
                <div className="message-author">{message.author}</div>
                <div className="message-timestamp">
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>

              <div className="message-body">
                <p className="message-text">{message.content}</p>
              </div>

              <div className="message-footer">
                <div className="sentiment-container">
                  <SentimentIndicator
                    sentiment={message.sentiment}
                    compact={true}
                  />
                </div>

                {message.intentions && message.intentions.length > 0 && (
                  <div className="intentions-container">
                    {message.intentions.slice(0, 2).map((intention, index) => (
                      <span key={index} className="intention-tag">
                        {intention.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {message.isAlert && (
                  <div className="alert-indicator">
                    <span className="alert-text">Requires Attention</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {messages.length === 0 && filterType !== 'all' && (
        <div className="timeline-empty">
          <div className="empty-icon">🔍</div>
          <p>No messages match the current filter</p>
        </div>
      )}
    </div>
  );
};

export default ConversationTimeline;
