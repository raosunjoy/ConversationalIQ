/**
 * Documentation Search System
 * Provides full-text search across all documentation with intelligent filtering and suggestions
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import {
  Modal,
  Header,
  Body,
  Footer,
  Close,
} from '@zendeskgarden/react-modals';
import { Field, Input, Label, Select } from '@zendeskgarden/react-forms';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';

export interface DocumentationItem {
  id: string;
  title: string;
  content: string;
  category:
    | 'user-guide'
    | 'api-docs'
    | 'tutorials'
    | 'help'
    | 'troubleshooting';
  subcategory?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lastUpdated: Date;
  url?: string;
  excerpt?: string;
  metadata?: {
    author?: string;
    version?: string;
    relatedTopics?: string[];
    prerequisites?: string[];
  };
}

export interface SearchResult extends DocumentationItem {
  score: number;
  highlightedContent: string;
  matchingTags: string[];
  relevanceReason: string;
}

interface DocumentationSearchProps {
  isVisible: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialCategory?: string;
  onNavigate?: (url: string) => void;
}

interface SearchFilters {
  category: string;
  difficulty: string;
  dateRange: string;
  tags: string[];
}

class DocumentationSearchService {
  private documents: DocumentationItem[] = [];
  private searchIndex: Map<string, DocumentationItem[]> = new Map();

  constructor() {
    this.initializeDocuments();
    this.buildSearchIndex();
  }

  private initializeDocuments(): void {
    // Agent User Guide sections
    this.addDocument({
      id: 'agent-guide-getting-started',
      title: 'Getting Started with ConversationIQ',
      content:
        'Welcome to ConversationIQ! This comprehensive guide will help you get the most out of our AI-powered conversation intelligence platform. Learn about dashboard overview, real-time features, response suggestions, sentiment analysis, escalation prevention, and analytics.',
      category: 'user-guide',
      subcategory: 'agent-guide',
      tags: ['getting-started', 'basics', 'onboarding', 'dashboard'],
      difficulty: 'beginner',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#getting-started',
      excerpt:
        'Learn the fundamentals of ConversationIQ including setup, authentication, and main interface components.',
    });

    this.addDocument({
      id: 'agent-guide-sentiment-analysis',
      title: 'Understanding Sentiment Analysis',
      content:
        'ConversationIQ uses advanced AI to analyze customer emotions in real-time. Learn how to read sentiment indicators, understand confidence scores, track emotion trends, and use sentiment data to improve customer interactions.',
      category: 'user-guide',
      subcategory: 'agent-guide',
      tags: ['sentiment', 'emotions', 'ai-analysis', 'customer-mood'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#sentiment-analysis',
      excerpt:
        'Master sentiment analysis to better understand and respond to customer emotions.',
    });

    this.addDocument({
      id: 'agent-guide-response-suggestions',
      title: 'Using AI Response Suggestions',
      content:
        'Learn how to effectively use AI-generated response suggestions. Understand different types of suggestions (empathy, solution, information gathering), confidence scores, customization techniques, and best practices for personalization.',
      category: 'user-guide',
      subcategory: 'agent-guide',
      tags: ['ai-suggestions', 'responses', 'personalization', 'empathy'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#response-suggestions',
      excerpt:
        'Master AI response suggestions to provide faster, more effective customer support.',
    });

    this.addDocument({
      id: 'agent-guide-escalation-prevention',
      title: 'Preventing Customer Escalations',
      content:
        'ConversationIQ helps identify potential escalations before they happen. Learn about risk indicators, early warning systems, de-escalation strategies, and when to involve supervisors.',
      category: 'user-guide',
      subcategory: 'agent-guide',
      tags: ['escalation', 'prevention', 'de-escalation', 'risk-management'],
      difficulty: 'advanced',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#escalation-prevention',
      excerpt:
        'Proactively prevent escalations with AI-powered risk detection and proven de-escalation techniques.',
    });

    // Manager Guide sections
    this.addDocument({
      id: 'manager-guide-team-dashboard',
      title: 'Manager Team Dashboard',
      content:
        'Comprehensive analytics and management tools for team leaders. Monitor team performance, individual agent analytics, coaching insights, and business intelligence. Track KPIs, identify improvement opportunities, and make data-driven decisions.',
      category: 'user-guide',
      subcategory: 'manager-guide',
      tags: ['management', 'analytics', 'team-performance', 'kpis'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/manager-guide.md#team-dashboard-overview',
      excerpt:
        'Use the manager dashboard to optimize team performance and track business metrics.',
    });

    this.addDocument({
      id: 'manager-guide-performance-analytics',
      title: 'Performance Analytics for Managers',
      content:
        'Deep dive into individual agent analysis, comparative performance, team trends and patterns. Learn how to use AI-powered coaching insights, identify top performers, and develop improvement strategies.',
      category: 'user-guide',
      subcategory: 'manager-guide',
      tags: ['performance', 'analytics', 'coaching', 'improvement'],
      difficulty: 'advanced',
      lastUpdated: new Date(),
      url: '/docs/manager-guide.md#performance-analytics',
      excerpt:
        'Analyze team performance and provide data-driven coaching to improve results.',
    });

    // API Documentation
    this.addDocument({
      id: 'api-authentication',
      title: 'API Authentication',
      content:
        'ConversationIQ uses JWT-based authentication with Zendesk OAuth integration. Learn about the authentication flow, required headers, token structure, and security best practices.',
      category: 'api-docs',
      tags: ['authentication', 'jwt', 'oauth', 'security', 'api'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/api-documentation.md#authentication',
      excerpt:
        'Secure API access using JWT tokens and Zendesk OAuth integration.',
    });

    this.addDocument({
      id: 'api-conversations',
      title: 'Conversations API',
      content:
        'REST API endpoints for managing conversations. Get conversations, retrieve conversation details with analytics, filter by status and date ranges, access sentiment analysis and performance metrics.',
      category: 'api-docs',
      tags: ['api', 'conversations', 'rest', 'endpoints', 'analytics'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/api-documentation.md#conversations',
      excerpt:
        'Programmatically access and manage customer conversations through the API.',
    });

    this.addDocument({
      id: 'api-response-suggestions',
      title: 'Response Suggestions API',
      content:
        'API endpoints for AI-generated response suggestions. Get suggestions by conversation ID, filter by type, provide feedback on suggestion quality, and track suggestion performance.',
      category: 'api-docs',
      tags: ['api', 'suggestions', 'ai', 'responses', 'feedback'],
      difficulty: 'advanced',
      lastUpdated: new Date(),
      url: '/docs/api-documentation.md#response-suggestions',
      excerpt:
        'Integrate AI response suggestions into your applications via REST API.',
    });

    this.addDocument({
      id: 'api-graphql',
      title: 'GraphQL API',
      content:
        'GraphQL endpoint for flexible data querying. Schema overview, example queries and mutations, real-time subscriptions for conversation updates, and WebSocket integration.',
      category: 'api-docs',
      tags: ['graphql', 'api', 'queries', 'subscriptions', 'realtime'],
      difficulty: 'advanced',
      lastUpdated: new Date(),
      url: '/docs/api-documentation.md#graphql-api',
      excerpt:
        'Use GraphQL for flexible, efficient data querying and real-time subscriptions.',
    });

    // Interactive Tutorials
    this.addDocument({
      id: 'tutorial-agent-onboarding',
      title: 'Agent Onboarding Tutorial',
      content:
        'Interactive walkthrough of ConversationIQ for new agents. Learn the sidebar interface, sentiment panel, suggestions panel, analytics panel, and how to try your first suggestion.',
      category: 'tutorials',
      tags: ['tutorial', 'onboarding', 'interactive', 'getting-started'],
      difficulty: 'beginner',
      lastUpdated: new Date(),
      url: '/tutorials/agent-onboarding',
      excerpt:
        'Step-by-step interactive tutorial for new ConversationIQ users.',
    });

    this.addDocument({
      id: 'tutorial-sentiment-mastery',
      title: 'Sentiment Analysis Deep Dive Tutorial',
      content:
        'Advanced tutorial on mastering sentiment analysis. Learn to read indicators, understand trends, analyze emotions, and respond to sentiment-based alerts effectively.',
      category: 'tutorials',
      tags: ['tutorial', 'sentiment', 'advanced', 'emotions'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/tutorials/sentiment-analysis',
      excerpt:
        'Master sentiment analysis with this comprehensive interactive tutorial.',
    });

    // Troubleshooting
    this.addDocument({
      id: 'troubleshooting-sentiment-incorrect',
      title: 'Sentiment Analysis Seems Incorrect',
      content:
        "If sentiment readings don't match your assessment, check message context for sarcasm or complex language, review confidence scores, consider cultural differences, and use the feedback system to improve accuracy.",
      category: 'troubleshooting',
      tags: ['troubleshooting', 'sentiment', 'accuracy', 'feedback'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#troubleshooting',
      excerpt:
        'Resolve issues with sentiment analysis accuracy and interpretation.',
    });

    this.addDocument({
      id: 'troubleshooting-no-suggestions',
      title: 'No Response Suggestions Appearing',
      content:
        "When suggestions don't appear, ensure sufficient conversation context, check internet connection, verify supported issue types, and refresh the app if needed.",
      category: 'troubleshooting',
      tags: ['troubleshooting', 'suggestions', 'loading', 'connectivity'],
      difficulty: 'beginner',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#troubleshooting',
      excerpt: 'Fix issues with missing or delayed AI response suggestions.',
    });

    this.addDocument({
      id: 'troubleshooting-performance-issues',
      title: 'App Performance Issues',
      content:
        'Resolve slow loading and delayed suggestions by checking internet speed, closing unnecessary tabs, clearing browser cache, trying different browsers, and contacting support if issues persist.',
      category: 'troubleshooting',
      tags: ['troubleshooting', 'performance', 'speed', 'browser'],
      difficulty: 'beginner',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#troubleshooting',
      excerpt: 'Improve ConversationIQ performance and resolve speed issues.',
    });

    // Help Content
    this.addDocument({
      id: 'help-keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      content:
        'Maximize efficiency with keyboard shortcuts: Alt+S (focus suggestions), Ctrl+1-9 (insert suggestions), Ctrl+E (edit suggestion), Ctrl+R (refresh analysis), and many more.',
      category: 'help',
      tags: ['shortcuts', 'keyboard', 'efficiency', 'productivity'],
      difficulty: 'intermediate',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#keyboard-shortcuts',
      excerpt: 'Speed up your workflow with ConversationIQ keyboard shortcuts.',
    });

    this.addDocument({
      id: 'help-beta-feedback',
      title: 'Providing Beta Feedback',
      content:
        'Help improve ConversationIQ by providing effective feedback. Learn about feedback types, urgency levels, writing helpful reports, and using the feedback widget.',
      category: 'help',
      tags: ['beta', 'feedback', 'improvement', 'testing'],
      difficulty: 'beginner',
      lastUpdated: new Date(),
      url: '/docs/agent-user-guide.md#beta-features',
      excerpt:
        'Contribute to product improvement through effective beta feedback.',
    });
  }

  private addDocument(doc: DocumentationItem): void {
    this.documents.push(doc);
  }

  private buildSearchIndex(): void {
    this.documents.forEach(doc => {
      // Index by words in title and content
      const words = [
        ...doc.title.toLowerCase().split(/\s+/),
        ...doc.content.toLowerCase().split(/\s+/),
      ];
      const uniqueWords = [...new Set(words)];

      uniqueWords.forEach(word => {
        if (word.length > 2) {
          // Skip very short words
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, []);
          }
          this.searchIndex.get(word)!.push(doc);
        }
      });

      // Index by tags
      doc.tags.forEach(tag => {
        const tagWords = tag.toLowerCase().split('-');
        tagWords.forEach(tagWord => {
          if (!this.searchIndex.has(tagWord)) {
            this.searchIndex.set(tagWord, []);
          }
          this.searchIndex.get(tagWord)!.push(doc);
        });
      });
    });
  }

  search(query: string, filters: Partial<SearchFilters> = {}): SearchResult[] {
    if (!query.trim()) return [];

    const queryWords = query.toLowerCase().trim().split(/\s+/);
    const candidateResults = new Map<
      string,
      { doc: DocumentationItem; scores: number[] }
    >();

    // Find documents that match query words
    queryWords.forEach(word => {
      const matchingDocs = this.searchIndex.get(word) || [];
      matchingDocs.forEach(doc => {
        if (!candidateResults.has(doc.id)) {
          candidateResults.set(doc.id, { doc, scores: [] });
        }

        // Calculate relevance score
        let score = 0;

        // Title matches are highly weighted
        if (doc.title.toLowerCase().includes(word)) {
          score += 10;
        }

        // Tag matches are also important
        if (doc.tags.some(tag => tag.toLowerCase().includes(word))) {
          score += 8;
        }

        // Content matches
        const contentMatches = (
          doc.content.toLowerCase().match(new RegExp(word, 'g')) || []
        ).length;
        score += Math.min(contentMatches * 2, 10); // Cap content score

        // Exact phrase matches get bonus
        if (doc.content.toLowerCase().includes(query.toLowerCase())) {
          score += 15;
        }

        candidateResults.get(doc.id)!.scores.push(score);
      });
    });

    // Process results and apply filters
    const results: SearchResult[] = [];

    candidateResults.forEach(({ doc, scores }) => {
      // Apply filters
      if (
        filters.category &&
        filters.category !== 'all' &&
        doc.category !== filters.category
      ) {
        return;
      }

      if (
        filters.difficulty &&
        filters.difficulty !== 'all' &&
        doc.difficulty !== filters.difficulty
      ) {
        return;
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(filterTag =>
          doc.tags.some(docTag =>
            docTag.toLowerCase().includes(filterTag.toLowerCase())
          )
        );
        if (!hasMatchingTag) return;
      }

      // Calculate final score
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      const averageScore = totalScore / scores.length;
      const matchingWordsBonus = scores.length * 5; // Bonus for matching multiple words
      const finalScore = averageScore + matchingWordsBonus;

      // Generate highlighted content
      const highlightedContent = this.highlightMatches(doc.content, queryWords);

      // Find matching tags
      const matchingTags = doc.tags.filter(tag =>
        queryWords.some(word => tag.toLowerCase().includes(word))
      );

      // Generate relevance reason
      const relevanceReason = this.generateRelevanceReason(
        doc,
        queryWords,
        scores
      );

      results.push({
        ...doc,
        score: finalScore,
        highlightedContent,
        matchingTags,
        relevanceReason,
      });
    });

    // Sort by relevance score and return top results
    return results.sort((a, b) => b.score - a.score).slice(0, 50); // Limit results
  }

  private highlightMatches(content: string, queryWords: string[]): string {
    let highlighted = content;
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });

    // Return first 200 characters with some context
    const firstMatch = highlighted.search(/<mark>/i);
    if (firstMatch === -1) return content.substring(0, 200) + '...';

    const start = Math.max(0, firstMatch - 50);
    const excerpt = highlighted.substring(start, start + 200);
    return (start > 0 ? '...' : '') + excerpt + '...';
  }

  private generateRelevanceReason(
    doc: DocumentationItem,
    queryWords: string[],
    scores: number[]
  ): string {
    const reasons: string[] = [];

    if (doc.title.toLowerCase().includes(queryWords.join(' ').toLowerCase())) {
      reasons.push('title match');
    }

    if (doc.tags.some(tag => queryWords.some(word => tag.includes(word)))) {
      reasons.push('relevant topic');
    }

    if (scores.some(score => score > 15)) {
      reasons.push('strong content match');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'content relevance';
  }

  getPopularSearches(): string[] {
    return [
      'getting started',
      'sentiment analysis',
      'response suggestions',
      'escalation prevention',
      'api authentication',
      'troubleshooting',
      'keyboard shortcuts',
      'manager dashboard',
      'performance analytics',
    ];
  }

  getAllCategories(): string[] {
    return [
      'all',
      'user-guide',
      'api-docs',
      'tutorials',
      'help',
      'troubleshooting',
    ];
  }

  getAllTags(): string[] {
    const allTags = new Set<string>();
    this.documents.forEach(doc => {
      doc.tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }

  getSuggestedQueries(partialQuery: string): string[] {
    if (partialQuery.length < 2) return [];

    const suggestions = new Set<string>();
    const partial = partialQuery.toLowerCase();

    // Find matching document titles
    this.documents.forEach(doc => {
      if (doc.title.toLowerCase().includes(partial)) {
        suggestions.add(doc.title);
      }

      // Find matching tags
      doc.tags.forEach(tag => {
        if (tag.toLowerCase().includes(partial)) {
          suggestions.add(tag.replace('-', ' '));
        }
      });
    });

    return Array.from(suggestions).slice(0, 5);
  }
}

const searchService = new DocumentationSearchService();

const DocumentationSearch: React.FC<DocumentationSearchProps> = ({
  isVisible,
  onClose,
  initialQuery = '',
  initialCategory = 'all',
  onNavigate,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({
    category: initialCategory,
    difficulty: 'all',
    dateRange: 'all',
    tags: [],
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        const searchResults = searchService.search(query, filters);
        setResults(searchResults);
        setIsSearching(false);
      }, 300);
    } else {
      setResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, filters]);

  // Query suggestions
  useEffect(() => {
    if (query.length >= 2) {
      const suggestions = searchService.getSuggestedQueries(query);
      setSuggestions(suggestions);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleResultClick = (result: SearchResult): void => {
    if (result.url && onNavigate) {
      onNavigate(result.url);
    } else {
      setSelectedResult(result);
    }
  };

  const popularSearches = searchService.getPopularSearches();
  const categories = searchService.getAllCategories();

  const ResultCard: React.FC<{ result: SearchResult }> = ({ result }) => (
    <div
      className="border rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow"
      onClick={() => handleResultClick(result)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-lg text-blue-600 hover:text-blue-800">
          {result.title}
        </h3>
        <div className="flex items-center space-x-2">
          <Badge type="neutral" className="text-xs">
            {result.category.replace('-', ' ')}
          </Badge>
          <Badge
            type={
              result.difficulty === 'beginner'
                ? 'positive'
                : result.difficulty === 'intermediate'
                  ? 'warning'
                  : 'danger'
            }
            className="text-xs"
          >
            {result.difficulty}
          </Badge>
        </div>
      </div>

      <div
        className="text-sm text-gray-700 mb-3"
        dangerouslySetInnerHTML={{ __html: result.highlightedContent }}
      />

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {result.matchingTags.slice(0, 3).map(tag => (
            <Badge key={tag} type="warning" className="text-xs">
              {tag}
            </Badge>
          ))}
          {result.tags
            .filter(tag => !result.matchingTags.includes(tag))
            .slice(0, 2)
            .map(tag => (
              <Badge key={tag} type="neutral" className="text-xs">
                {tag}
              </Badge>
            ))}
        </div>
        <div className="text-xs text-gray-500">
          Score: {Math.round(result.score)} • {result.relevanceReason}
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isVisible} onClose={onClose} className="max-w-4xl">
      <Header>
        <h2>🔍 Documentation Search</h2>
        <Close aria-label="Close search" />
      </Header>
      <Body className="max-h-[70vh] overflow-y-auto">
        {selectedResult ? (
          <div className="space-y-4">
            <Button size="small" onClick={() => setSelectedResult(null)}>
              ← Back to Results
            </Button>

            <div>
              <h2 className="text-2xl font-bold mb-4">
                {selectedResult.title}
              </h2>
              <div className="flex items-center space-x-2 mb-4">
                <Badge type="neutral">
                  {selectedResult.category.replace('-', ' ')}
                </Badge>
                <Badge
                  type={
                    selectedResult.difficulty === 'beginner'
                      ? 'positive'
                      : selectedResult.difficulty === 'intermediate'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {selectedResult.difficulty}
                </Badge>
                <span className="text-sm text-gray-500">
                  Last updated:{' '}
                  {selectedResult.lastUpdated.toLocaleDateString()}
                </span>
              </div>

              <div className="prose max-w-none">
                <p>{selectedResult.content}</p>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedResult.tags.map(tag => (
                    <Badge key={tag} type="neutral" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedResult.url && (
                <div className="mt-4">
                  <Button
                    isPrimary
                    onClick={() => onNavigate?.(selectedResult.url!)}
                  >
                    View Full Documentation
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search Input */}
            <div className="space-y-4">
              <Field>
                <Label>Search Documentation</Label>
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search guides, API docs, tutorials..."
                  className="text-lg p-3"
                />
              </Field>

              {/* Search Suggestions */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-gray-600">Suggestions:</span>
                  {suggestions.map(suggestion => (
                    <Button
                      key={suggestion}
                      size="small"
                      onClick={() => setQuery(suggestion)}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field>
                <Label>Category</Label>
                <Select
                  value={filters.category}
                  onChange={e =>
                    setFilters(prev => ({ ...prev, category: e.target.value }))
                  }
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all'
                        ? 'All Categories'
                        : category.replace('-', ' ')}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field>
                <Label>Difficulty</Label>
                <Select
                  value={filters.difficulty}
                  onChange={e =>
                    setFilters(prev => ({
                      ...prev,
                      difficulty: e.target.value,
                    }))
                  }
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </Field>

              <Field>
                <Label>Content Type</Label>
                <Select
                  value={filters.dateRange}
                  onChange={e =>
                    setFilters(prev => ({ ...prev, dateRange: e.target.value }))
                  }
                >
                  <option value="all">All Content</option>
                  <option value="recent">Recently Updated</option>
                  <option value="popular">Most Popular</option>
                </Select>
              </Field>
            </div>

            {/* Results */}
            {query && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {isSearching
                      ? 'Searching...'
                      : `${results.length} results for "${query}"`}
                  </h3>
                  {results.length > 0 && (
                    <Button size="small" onClick={() => setQuery('')}>
                      Clear Search
                    </Button>
                  )}
                </div>

                {results.length > 0 ? (
                  <div className="space-y-4">
                    {results.map(result => (
                      <ResultCard key={result.id} result={result} />
                    ))}
                  </div>
                ) : (
                  !isSearching &&
                  query && (
                    <div className="text-center py-8">
                      <Alert type="warning">
                        No results found for "{query}". Try different keywords
                        or check the popular searches below.
                      </Alert>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Popular Searches */}
            {!query && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Popular Searches</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {popularSearches.map(search => (
                    <Button
                      key={search}
                      size="small"
                      onClick={() => setQuery(search)}
                      className="justify-start"
                    >
                      🔍 {search}
                    </Button>
                  ))}
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">
                    Browse by Category
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories
                      .filter(cat => cat !== 'all')
                      .map(category => {
                        const categoryDocs = searchService['documents'].filter(
                          doc => doc.category === category
                        );
                        return (
                          <div key={category} className="border rounded-lg p-4">
                            <h4 className="font-medium mb-2">
                              {category.replace('-', ' ')}
                            </h4>
                            <p className="text-sm text-gray-600 mb-3">
                              {categoryDocs.length} documents
                            </p>
                            <Button
                              size="small"
                              onClick={() =>
                                setFilters(prev => ({ ...prev, category }))
                              }
                            >
                              Browse {category.replace('-', ' ')}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Body>
      <Footer>
        <div className="flex justify-between items-center w-full">
          <div className="text-xs text-gray-500">
            Can't find what you're looking for?{' '}
            <a
              href="mailto:support@conversationiq.com"
              className="text-blue-600"
            >
              Contact Support
            </a>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </Footer>
    </Modal>
  );
};

export default DocumentationSearch;
