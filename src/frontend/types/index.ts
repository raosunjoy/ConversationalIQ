/**
 * Frontend Type Definitions
 * Shared types and interfaces for React components and services
 */

// Re-export AI types from backend
export * from '../../ai/models';

// Zendesk App Framework types
export interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'end_user';
  locale: string;
  timezone: string;
}

export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'problem' | 'incident' | 'question' | 'task';
  requester: {
    id: number;
    name: string;
    email: string;
  };
  assignee?: {
    id: number;
    name: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ZendeskComment {
  id: number;
  body: string;
  author: {
    id: number;
    name: string;
  };
  public: boolean;
  createdAt: string;
}

// App State Types
export interface AppState {
  user: ZendeskUser | null;
  ticket: ZendeskTicket | null;
  comments: ZendeskComment[];
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

// Real-time Data Types
export interface RealtimeConversationData {
  conversationId: string;
  sentiment: SentimentAnalysis;
  suggestions: ResponseSuggestion[];
  analytics: ConversationAnalytics;
  lastUpdated: Date;
}

export interface SentimentAnalysis {
  score: number; // -1 to 1
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  confidence: number; // 0 to 1
  emotions: EmotionData[];
  trend: 'improving' | 'declining' | 'stable';
}

export interface EmotionData {
  emotion: string;
  confidence: number;
  intensity: number;
}

export interface ResponseSuggestion {
  id: string;
  content: string;
  confidence: number;
  category: 'template' | 'generated' | 'macro';
  tone: 'professional' | 'friendly' | 'empathetic' | 'formal';
  tags: string[];
  macroId?: string;
  estimatedSatisfaction?: number;
}

export interface ConversationAnalytics {
  averageResponseTime: number; // in minutes
  messageCount: number;
  escalationRisk: number; // 0 to 1
  customerSatisfactionPredict: number; // 0 to 1
  keyTopics: string[];
  conversationHealth: 'excellent' | 'good' | 'concerning' | 'critical';
}

// Component Props Types
export interface SentimentIndicatorProps {
  sentiment: SentimentAnalysis;
  showTrend?: boolean;
  compact?: boolean;
}

export interface SuggestionCardProps {
  suggestion: ResponseSuggestion;
  onApply: (suggestion: ResponseSuggestion) => void;
  onFeedback: (suggestionId: string, rating: number) => void;
  disabled?: boolean;
}

export interface AnalyticsWidgetProps {
  analytics: ConversationAnalytics;
  refreshInterval?: number;
}

export interface ConversationTimelineProps {
  messages: MessageTimelineItem[];
  onMessageClick?: (messageId: string) => void;
  filterType?: 'all' | 'negative' | 'alerts';
}

export interface MessageTimelineItem {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
  sentiment: SentimentAnalysis;
  isAlert: boolean;
  intentions: string[];
}

// API Response Types
export interface APIResponse<T = any> {
  data: T;
  error?: string;
  status: 'success' | 'error';
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'sentiment_analyzed' | 'suggestions_generated' | 'analytics_updated';
  payload: any;
  conversationId: string;
  timestamp: Date;
}

// Manager Dashboard Types
export interface TeamMetrics {
  totalAgents: number;
  activeConversations: number;
  averageSentiment: number;
  escalationRate: number;
  responseTimeP95: number;
  satisfactionScore: number;
}

export interface AgentPerformance {
  agentId: string;
  name: string;
  avatar?: string;
  metrics: {
    conversationsHandled: number;
    averageResponseTime: number;
    sentimentImprovement: number;
    suggestionUsageRate: number;
    customerSatisfaction: number;
    escalationRate: number;
  };
  currentStatus: 'available' | 'busy' | 'away' | 'offline';
}

export interface ConversationInsight {
  id: string;
  type: 'escalation_risk' | 'positive_feedback' | 'training_opportunity' | 'best_practice';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conversationId: string;
  agentId: string;
  timestamp: Date;
  actionRequired: boolean;
  suggestedActions: string[];
}

// Form and Input Types
export interface FilterOptions {
  dateRange: {
    start: Date;
    end: Date;
  };
  sentimentFilter: 'all' | 'positive' | 'negative' | 'neutral';
  agentFilter: string[]; // agent IDs
  tagFilter: string[];
  priorityFilter: string[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  defaultView: 'sentiment' | 'suggestions' | 'analytics';
  suggestionCategories: string[];
  escalationThreshold: number;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

// Loading States
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// Component State Types
export interface ComponentState<T = any> {
  data: T | null;
  loading: LoadingState;
  error: AppError | null;
  lastFetched: Date | null;
}