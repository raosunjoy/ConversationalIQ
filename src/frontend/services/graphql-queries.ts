/**
 * GraphQL Queries and Subscriptions
 * Defines all GraphQL operations for the frontend
 */

import { gql } from '@apollo/client';

// Fragment definitions for reusable pieces
export const SENTIMENT_FRAGMENT = gql`
  fragment SentimentInfo on SentimentAnalysis {
    score
    confidence
    label
    emotions {
      emotion
      confidence
      intensity
    }
    processingTime
    createdAt
  }
`;

export const MESSAGE_FRAGMENT = gql`
  fragment MessageInfo on Message {
    id
    content
    senderType
    timestamp: createdAt
    conversationId
    sentimentAnalysis {
      ...SentimentInfo
    }
  }
  ${SENTIMENT_FRAGMENT}
`;

export const CONVERSATION_FRAGMENT = gql`
  fragment ConversationInfo on Conversation {
    id
    customerId
    agentId
    ticketId: zendeskTicketId
    status
    priority
    createdAt
    updatedAt
    messages {
      ...MessageInfo
    }
  }
  ${MESSAGE_FRAGMENT}
`;

export const SUGGESTION_FRAGMENT = gql`
  fragment SuggestionInfo on ResponseSuggestion {
    id
    content
    confidence
    category
    tone
    tags
    macroId
    reasoning
    estimatedSatisfaction
    createdAt
  }
`;

// Queries
export const GET_CONVERSATION_BY_TICKET = gql`
  query GetConversationByTicket($ticketId: String!) {
    conversation: getConversationByTicket(ticketId: $ticketId) {
      ...ConversationInfo
    }
  }
  ${CONVERSATION_FRAGMENT}
`;

export const GET_CONVERSATION_ANALYTICS = gql`
  query GetConversationAnalytics($conversationId: ID!) {
    analytics: getConversationAnalytics(conversationId: $conversationId) {
      averageResponseTime
      messageCount
      escalationRisk
      customerSatisfactionPredict
      keyTopics
      conversationHealth
      sentimentTrend
      agentPerformanceScore
      lastUpdated
    }
  }
`;

export const GET_RESPONSE_SUGGESTIONS = gql`
  query GetResponseSuggestions($conversationId: ID!, $messageId: ID) {
    suggestions: getResponseSuggestions(
      conversationId: $conversationId
      messageId: $messageId
    ) {
      ...SuggestionInfo
    }
  }
  ${SUGGESTION_FRAGMENT}
`;

export const GET_MESSAGE_SENTIMENT = gql`
  query GetMessageSentiment($messageId: ID!) {
    sentiment: getMessageSentiment(messageId: $messageId) {
      ...SentimentInfo
    }
  }
  ${SENTIMENT_FRAGMENT}
`;

export const GET_AGENT_PERFORMANCE = gql`
  query GetAgentPerformance($agentId: ID!, $timeRange: TimeRangeInput) {
    performance: getAgentPerformance(agentId: $agentId, timeRange: $timeRange) {
      conversationsHandled
      averageResponseTime
      sentimentImprovement
      suggestionUsageRate
      customerSatisfaction
      escalationRate
      topCategories
      improvementAreas
      period {
        start
        end
      }
    }
  }
`;

export const GET_TEAM_METRICS = gql`
  query GetTeamMetrics($teamId: ID, $timeRange: TimeRangeInput) {
    metrics: getTeamMetrics(teamId: $teamId, timeRange: $timeRange) {
      totalAgents
      activeConversations
      averageSentiment
      escalationRate
      responseTimeP95
      satisfactionScore
      topPerformers {
        agentId
        name
        score
      }
      alertsCount
      period {
        start
        end
      }
    }
  }
`;

export const GET_CONVERSATION_INSIGHTS = gql`
  query GetConversationInsights($filters: InsightFiltersInput) {
    insights: getConversationInsights(filters: $filters) {
      id
      type
      title
      description
      severity
      conversationId
      agentId
      timestamp
      actionRequired
      suggestedActions
      metadata
    }
  }
`;

// Mutations
export const ANALYZE_MESSAGE = gql`
  mutation AnalyzeMessage($messageId: ID!) {
    result: analyzeMessage(messageId: $messageId) {
      messageId
      sentiment {
        ...SentimentInfo
      }
      intent {
        category
        confidence
        urgency
        actionRequired
      }
      processingTime
    }
  }
  ${SENTIMENT_FRAGMENT}
`;

export const GENERATE_SUGGESTIONS = gql`
  mutation GenerateResponseSuggestions(
    $conversationId: ID!
    $messageId: ID
    $preferences: SuggestionPreferencesInput
  ) {
    suggestions: generateResponseSuggestions(
      conversationId: $conversationId
      messageId: $messageId
      preferences: $preferences
    ) {
      ...SuggestionInfo
    }
  }
  ${SUGGESTION_FRAGMENT}
`;

export const SUBMIT_SUGGESTION_FEEDBACK = gql`
  mutation SubmitSuggestionFeedback(
    $suggestionId: ID!
    $feedback: SuggestionFeedbackInput!
  ) {
    success: submitSuggestionFeedback(
      suggestionId: $suggestionId
      feedback: $feedback
    )
  }
`;

export const UPDATE_CONVERSATION_STATUS = gql`
  mutation UpdateConversationStatus($conversationId: ID!, $status: String!) {
    conversation: updateConversationStatus(
      conversationId: $conversationId
      status: $status
    ) {
      id
      status
      updatedAt
    }
  }
`;

export const CREATE_CONVERSATION_NOTE = gql`
  mutation CreateConversationNote($conversationId: ID!, $note: String!) {
    note: createConversationNote(conversationId: $conversationId, note: $note) {
      id
      content
      createdAt
      agentId
    }
  }
`;

export const ESCALATE_CONVERSATION = gql`
  mutation EscalateConversation(
    $conversationId: ID!
    $reason: String!
    $priority: String
  ) {
    success: escalateConversation(
      conversationId: $conversationId
      reason: $reason
      priority: $priority
    )
  }
`;

// Subscriptions for real-time updates
export const SENTIMENT_ANALYZED_SUBSCRIPTION = gql`
  subscription OnSentimentAnalyzed($conversationId: ID!) {
    sentimentAnalyzed(conversationId: $conversationId) {
      messageId
      conversationId
      score
      confidence
      emotions
      timestamp
    }
  }
`;

export const SUGGESTIONS_GENERATED_SUBSCRIPTION = gql`
  subscription OnSuggestionsGenerated($conversationId: ID!) {
    responseSuggested(conversationId: $conversationId) {
      conversationId
      suggestions {
        ...SuggestionInfo
      }
      timestamp
    }
  }
  ${SUGGESTION_FRAGMENT}
`;

export const CONVERSATION_UPDATED_SUBSCRIPTION = gql`
  subscription OnConversationUpdated($conversationId: ID!) {
    conversationUpdated(conversationId: $conversationId) {
      id
      status
      priority
      lastActivity
      analytics {
        escalationRisk
        conversationHealth
        averageResponseTime
      }
      timestamp
    }
  }
`;

export const ANALYTICS_UPDATED_SUBSCRIPTION = gql`
  subscription OnAnalyticsUpdated($conversationId: ID!) {
    analyticsUpdated(conversationId: $conversationId) {
      conversationId
      analytics {
        averageResponseTime
        escalationRisk
        customerSatisfactionPredict
        conversationHealth
        keyTopics
      }
      timestamp
    }
  }
`;

export const TEAM_METRICS_SUBSCRIPTION = gql`
  subscription OnTeamMetricsUpdated($teamId: ID) {
    teamMetricsUpdated(teamId: $teamId) {
      totalAgents
      activeConversations
      averageSentiment
      escalationRate
      responseTimeP95
      satisfactionScore
      timestamp
    }
  }
`;

export const ALERTS_SUBSCRIPTION = gql`
  subscription OnAlertsUpdated($agentId: ID!) {
    alertsUpdated(agentId: $agentId) {
      id
      type
      severity
      conversationId
      message
      timestamp
      actionRequired
    }
  }
`;

// Input type definitions for TypeScript
export interface TimeRangeInput {
  start: string;
  end: string;
}

export interface SuggestionPreferencesInput {
  tone?: 'professional' | 'friendly' | 'empathetic' | 'formal';
  maxLength?: number;
  includeTemplates?: boolean;
  includeMacros?: boolean;
  categories?: string[];
}

export interface SuggestionFeedbackInput {
  rating: number; // 1-5
  used: boolean;
  helpful: boolean;
  reason?: string;
  agentId: string;
}

export interface InsightFiltersInput {
  severity?: string[];
  type?: string[];
  agentId?: string;
  timeRange?: TimeRangeInput;
  actionRequired?: boolean;
}