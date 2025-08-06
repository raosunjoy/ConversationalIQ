/**
 * Contextual Insights Component
 * Displays AI-generated contextual insights for conversations
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@apollo/client';
import { gql } from 'graphql-tag';
import { RootState } from '../store';
import { Badge } from '@zendeskgarden/react-tags';
import { Button } from '@zendeskgarden/react-buttons';
import { Tooltip } from '@zendeskgarden/react-tooltips';
import { Accordion, AccordionSection } from '@zendeskgarden/react-forms';
import './ContextualInsights.css';

interface CustomerProfile {
  id: string;
  email: string;
  name?: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  totalTickets: number;
  totalSpent: number;
  satisfaction: number;
  language: string;
  timezone: string;
  preferences: any;
  history: any;
  segments: string[];
}

interface ConversationContext {
  conversationId: string;
  customerProfile: CustomerProfile;
  conversationMemory: any;
}

// GraphQL Query
const GET_CONVERSATION_CONTEXT = gql`
  query GetConversationContext($conversationId: ID!) {
    getConversationContext(conversationId: $conversationId) {
      conversationId
      customerProfile {
        id
        email
        name
        tier
        totalTickets
        totalSpent
        satisfaction
        language
        timezone
        preferences
        history
        segments
      }
      conversationMemory
    }
  }
`;

export const ContextualInsights: React.FC = () => {
  const { activeConversationId } = useSelector(
    (state: RootState) => state.conversation
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['profile'])
  );

  // Query for conversation context
  const {
    data: contextData,
    loading,
    error,
  } = useQuery<{
    getConversationContext: ConversationContext;
  }>(GET_CONVERSATION_CONTEXT, {
    variables: { conversationId: activeConversationId },
    skip: !activeConversationId,
  });

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getTierColor = (tier: string): 'grey' | 'yellow' | 'red' => {
    switch (tier) {
      case 'ENTERPRISE':
        return 'red';
      case 'PREMIUM':
        return 'yellow';
      case 'BASIC':
        return 'grey';
      default:
        return 'grey';
    }
  };

  const getSatisfactionColor = (
    satisfaction: number
  ): 'red' | 'yellow' | 'green' => {
    if (satisfaction >= 0.8) return 'green';
    if (satisfaction >= 0.6) return 'yellow';
    return 'red';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatSatisfactionScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };

  if (!activeConversationId) {
    return (
      <div className="contextual-insights empty">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <div className="empty-message">
            Select a conversation to view insights
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="contextual-insights loading">
        <div className="loading-indicator">Loading contextual insights...</div>
      </div>
    );
  }

  if (error || !contextData?.getConversationContext) {
    return (
      <div className="contextual-insights error">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <div className="error-message">
            Failed to load contextual insights
          </div>
        </div>
      </div>
    );
  }

  const { customerProfile, conversationMemory } =
    contextData.getConversationContext;

  return (
    <div className="contextual-insights">
      <div className="insights-header">
        <h3>Contextual Insights</h3>
        <Badge hue="blue">AI-Powered</Badge>
      </div>

      <Accordion level={6} className="insights-accordion">
        {/* Customer Profile Section */}
        <AccordionSection
          value="profile"
          label="Customer Profile"
          isExpanded={expandedSections.has('profile')}
          onChange={() => handleSectionToggle('profile')}
        >
          <div className="profile-section">
            <div className="profile-header">
              <div className="customer-name">
                <strong>{customerProfile.name || customerProfile.email}</strong>
                <Badge hue={getTierColor(customerProfile.tier)} size="small">
                  {customerProfile.tier}
                </Badge>
              </div>
              <div className="customer-email">{customerProfile.email}</div>
            </div>

            <div className="profile-metrics">
              <div className="metric">
                <div className="metric-label">Total Spent</div>
                <div className="metric-value">
                  {formatCurrency(customerProfile.totalSpent)}
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Total Tickets</div>
                <div className="metric-value">
                  {customerProfile.totalTickets}
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Satisfaction</div>
                <div className="metric-value">
                  <Badge
                    hue={getSatisfactionColor(customerProfile.satisfaction)}
                    size="small"
                  >
                    {formatSatisfactionScore(customerProfile.satisfaction)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="profile-details">
              <div className="detail-row">
                <span className="detail-label">Language:</span>
                <span className="detail-value">
                  {customerProfile.language.toUpperCase()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Timezone:</span>
                <span className="detail-value">{customerProfile.timezone}</span>
              </div>
              {customerProfile.segments.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Segments:</span>
                  <div className="segments">
                    {customerProfile.segments.map((segment, index) => (
                      <Badge key={index} hue="grey" size="small">
                        {segment}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </AccordionSection>

        {/* Conversation History Section */}
        <AccordionSection
          value="history"
          label="Conversation History"
          isExpanded={expandedSections.has('history')}
          onChange={() => handleSectionToggle('history')}
        >
          <div className="history-section">
            {customerProfile.history?.previousIssues?.length > 0 && (
              <div className="previous-issues">
                <h4>Previous Issues</h4>
                {customerProfile.history.previousIssues
                  .slice(0, 3)
                  .map((issue: string, index: number) => (
                    <div key={index} className="issue-item">
                      <Badge hue="yellow" size="small">
                        Issue
                      </Badge>
                      <span>{issue}</span>
                    </div>
                  ))}
                {customerProfile.history.previousIssues.length > 3 && (
                  <div className="more-issues">
                    +{customerProfile.history.previousIssues.length - 3} more
                    issues
                  </div>
                )}
              </div>
            )}

            <div className="history-metrics">
              <div className="metric">
                <div className="metric-label">Resolution Success</div>
                <div className="metric-value">
                  {Math.round(
                    (customerProfile.history?.resolutionSuccess || 0) * 100
                  )}
                  %
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Escalations</div>
                <div className="metric-value">
                  {customerProfile.history?.escalationCount || 0}
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">Avg Response Time</div>
                <div className="metric-value">
                  {Math.round(
                    (customerProfile.history?.averageResponseTime || 0) / 60
                  )}
                  h
                </div>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* Conversation Context Section */}
        <AccordionSection
          value="context"
          label="Current Context"
          isExpanded={expandedSections.has('context')}
          onChange={() => handleSectionToggle('context')}
        >
          <div className="context-section">
            {conversationMemory?.context && (
              <>
                {conversationMemory.context.issues?.length > 0 && (
                  <div className="current-issues">
                    <h4>Current Issues</h4>
                    {conversationMemory.context.issues.map(
                      (issue: string, index: number) => (
                        <Badge key={index} hue="red" size="small">
                          {issue}
                        </Badge>
                      )
                    )}
                  </div>
                )}

                {conversationMemory.context.products?.length > 0 && (
                  <div className="mentioned-products">
                    <h4>Products Mentioned</h4>
                    {conversationMemory.context.products.map(
                      (product: string, index: number) => (
                        <Badge key={index} hue="blue" size="small">
                          {product}
                        </Badge>
                      )
                    )}
                  </div>
                )}

                {conversationMemory.context.keywords?.length > 0 && (
                  <div className="keywords">
                    <h4>Key Topics</h4>
                    <div className="keywords-list">
                      {conversationMemory.context.keywords
                        .slice(0, 8)
                        .map((keyword: string, index: number) => (
                          <Badge key={index} hue="grey" size="small">
                            {keyword}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {conversationMemory?.summary && (
              <div className="conversation-summary">
                <h4>Summary</h4>
                <div className="summary-item">
                  <span className="summary-label">Main Issue:</span>
                  <span className="summary-value">
                    {conversationMemory.summary.mainIssue || 'Not identified'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Status:</span>
                  <Badge hue="blue" size="small">
                    {conversationMemory.summary.outcome}
                  </Badge>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Predicted Satisfaction:</span>
                  <Badge
                    hue={getSatisfactionColor(
                      conversationMemory.summary.satisfactionPredicted
                    )}
                    size="small"
                  >
                    {formatSatisfactionScore(
                      conversationMemory.summary.satisfactionPredicted
                    )}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* AI Recommendations Section */}
        <AccordionSection
          value="recommendations"
          label="AI Recommendations"
          isExpanded={expandedSections.has('recommendations')}
          onChange={() => handleSectionToggle('recommendations')}
        >
          <div className="recommendations-section">
            <div className="recommendation-item">
              <Badge hue="blue" size="small">
                Tone
              </Badge>
              <span>
                {customerProfile.preferences?.communicationStyle === 'formal'
                  ? 'Use formal, professional language'
                  : 'Casual, friendly tone is appropriate'}
              </span>
            </div>

            {customerProfile.tier === 'ENTERPRISE' && (
              <div className="recommendation-item">
                <Badge hue="red" size="small">
                  Priority
                </Badge>
                <span>Enterprise customer - prioritize response</span>
              </div>
            )}

            {customerProfile.satisfaction < 0.7 && (
              <div className="recommendation-item">
                <Badge hue="yellow" size="small">
                  Caution
                </Badge>
                <span>Customer has low satisfaction - be extra attentive</span>
              </div>
            )}

            {(customerProfile.history?.escalationCount || 0) > 0 && (
              <div className="recommendation-item">
                <Badge hue="orange" size="small">
                  History
                </Badge>
                <span>Customer has escalated before - monitor closely</span>
              </div>
            )}
          </div>
        </AccordionSection>
      </Accordion>
    </div>
  );
};
