/**
 * Analytics Panel Component
 * Shows conversation analytics and performance metrics
 */

import React from 'react';
import { ConversationAnalytics } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import MetricCard from '../common/MetricCard';
import HealthIndicator from '../common/HealthIndicator';

interface AnalyticsPanelProps {
  conversationId: string | null;
  analytics: ConversationAnalytics | null;
  loading?: boolean;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  conversationId,
  analytics,
  loading = false,
}) => {
  if (loading && !analytics) {
    return (
      <div className="analytics-panel">
        <LoadingSpinner message="Loading analytics..." />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-panel">
        <div className="analytics-empty">
          <div className="empty-icon">📊</div>
          <h4>No analytics available</h4>
          <p>Analytics will appear when conversation data is processed.</p>
        </div>
      </div>
    );
  }

  const formatResponseTime = (minutes: number): string => {
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getHealthColor = (health: string): string => {
    switch (health) {
      case 'excellent':
        return '#228f67';
      case 'good':
        return '#87c442';
      case 'concerning':
        return '#f79a3e';
      case 'critical':
        return '#d93954';
      default:
        return '#68737d';
    }
  };

  const getEscalationRiskLevel = (
    risk: number
  ): { level: string; color: string } => {
    if (risk >= 0.8) return { level: 'Critical', color: '#d93954' };
    if (risk >= 0.6) return { level: 'High', color: '#f79a3e' };
    if (risk >= 0.3) return { level: 'Medium', color: '#cc8400' };
    return { level: 'Low', color: '#228f67' };
  };

  const escalationRisk = getEscalationRiskLevel(analytics.escalationRisk);

  return (
    <div className="analytics-panel">
      {/* Overview Metrics */}
      <div className="analytics-overview">
        <div className="metrics-grid">
          <MetricCard
            title="Response Time"
            value={formatResponseTime(analytics.averageResponseTime)}
            subtitle="Average"
            trend={
              analytics.averageResponseTime < 5
                ? 'positive'
                : analytics.averageResponseTime < 15
                  ? 'neutral'
                  : 'negative'
            }
            icon="⏱️"
          />

          <MetricCard
            title="Messages"
            value={analytics.messageCount.toString()}
            subtitle="Total exchanged"
            icon="💬"
          />

          <MetricCard
            title="Escalation Risk"
            value={`${Math.round(analytics.escalationRisk * 100)}%`}
            subtitle={escalationRisk.level}
            trend={
              analytics.escalationRisk < 0.3
                ? 'positive'
                : analytics.escalationRisk < 0.6
                  ? 'neutral'
                  : 'negative'
            }
            icon="⚠️"
            color={escalationRisk.color}
          />

          <MetricCard
            title="Satisfaction"
            value={`${Math.round(analytics.customerSatisfactionPredict * 100)}%`}
            subtitle="Predicted"
            trend={
              analytics.customerSatisfactionPredict > 0.8
                ? 'positive'
                : analytics.customerSatisfactionPredict > 0.6
                  ? 'neutral'
                  : 'negative'
            }
            icon="😊"
          />
        </div>
      </div>

      {/* Conversation Health */}
      <div className="conversation-health">
        <div className="health-header">
          <h4>Conversation Health</h4>
        </div>
        <div className="health-content">
          <HealthIndicator
            health={analytics.conversationHealth}
            size="large"
            showDetails={true}
          />
          <div className="health-description">
            {analytics.conversationHealth === 'excellent' &&
              'Conversation is proceeding very well with positive sentiment and engagement.'}
            {analytics.conversationHealth === 'good' &&
              'Conversation is on track with mostly positive interactions.'}
            {analytics.conversationHealth === 'concerning' &&
              'Some issues detected. Consider reviewing conversation tone and approach.'}
            {analytics.conversationHealth === 'critical' &&
              'Immediate attention required. Consider escalation or intervention.'}
          </div>
        </div>
      </div>

      {/* Key Topics */}
      {analytics.keyTopics && analytics.keyTopics.length > 0 && (
        <div className="key-topics">
          <div className="topics-header">
            <h4>Key Topics Discussed</h4>
          </div>
          <div className="topics-list">
            {analytics.keyTopics.map((topic, index) => (
              <span key={index} className="topic-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Metrics */}
      <div className="detailed-metrics">
        <div className="metrics-section">
          <h4>Performance Breakdown</h4>

          <div className="metric-row">
            <div className="metric-label">Communication Efficiency</div>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{
                  width: `${Math.max(0, 100 - analytics.averageResponseTime * 2)}%`,
                  backgroundColor:
                    analytics.averageResponseTime < 10 ? '#228f67' : '#f79a3e',
                }}
              />
            </div>
            <div className="metric-value">
              {Math.max(0, 100 - Math.round(analytics.averageResponseTime * 2))}
              %
            </div>
          </div>

          <div className="metric-row">
            <div className="metric-label">Engagement Level</div>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{
                  width: `${Math.min(100, analytics.messageCount * 10)}%`,
                  backgroundColor:
                    analytics.messageCount > 5 ? '#228f67' : '#cc8400',
                }}
              />
            </div>
            <div className="metric-value">
              {Math.min(100, analytics.messageCount * 10)}%
            </div>
          </div>

          <div className="metric-row">
            <div className="metric-label">Resolution Progress</div>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{
                  width: `${analytics.customerSatisfactionPredict * 100}%`,
                  backgroundColor: getHealthColor(analytics.conversationHealth),
                }}
              />
            </div>
            <div className="metric-value">
              {Math.round(analytics.customerSatisfactionPredict * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Action Recommendations */}
      <div className="action-recommendations">
        <div className="recommendations-header">
          <h4>Recommended Actions</h4>
        </div>
        <div className="recommendations-list">
          {analytics.escalationRisk > 0.7 && (
            <div className="recommendation-item critical">
              <span className="rec-icon">🚨</span>
              <div className="rec-content">
                <div className="rec-title">Consider Escalation</div>
                <div className="rec-description">
                  High escalation risk detected. Consider involving a
                  supervisor.
                </div>
              </div>
            </div>
          )}

          {analytics.averageResponseTime > 15 && (
            <div className="recommendation-item warning">
              <span className="rec-icon">⏰</span>
              <div className="rec-content">
                <div className="rec-title">Improve Response Time</div>
                <div className="rec-description">
                  Response time is above average. Consider using AI suggestions
                  for faster replies.
                </div>
              </div>
            </div>
          )}

          {analytics.customerSatisfactionPredict < 0.6 && (
            <div className="recommendation-item info">
              <span className="rec-icon">💡</span>
              <div className="rec-content">
                <div className="rec-title">Focus on Customer Satisfaction</div>
                <div className="rec-description">
                  Consider adjusting tone and approach to improve customer
                  experience.
                </div>
              </div>
            </div>
          )}

          {analytics.conversationHealth === 'excellent' && (
            <div className="recommendation-item success">
              <span className="rec-icon">✅</span>
              <div className="rec-content">
                <div className="rec-title">Great Job!</div>
                <div className="rec-description">
                  Conversation is proceeding excellently. Keep up the good work!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
