/**
 * Contextual Help System
 * Provides intelligent, context-aware help and guidance throughout the application
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import {
  Modal,
  Header,
  Body,
  Footer,
  Close,
} from '@zendeskgarden/react-modals';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Field, Input, Label } from '@zendeskgarden/react-forms';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';

export interface HelpContent {
  id: string;
  title: string;
  content: string;
  category:
    | 'quick-help'
    | 'feature-guide'
    | 'troubleshooting'
    | 'best-practices';
  context?: string[]; // Component contexts where this help is relevant
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  relatedTopics?: string[];
  lastUpdated: Date;
}

export interface ContextualHelpProps {
  context: string; // Current component/page context
  isVisible: boolean;
  onClose: () => void;
  position?: 'right' | 'left' | 'bottom';
  userId?: string;
}

interface HelpTooltipProps {
  content: string;
  title: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  trigger: React.ReactElement;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title,
  position,
  trigger,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipWidth = 300;
      const tooltipHeight = 120;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - tooltipHeight - 10;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + 10;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - 10;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + 10;
          break;
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < 10) left = 10;
      if (left + tooltipWidth > viewportWidth - 10) {
        left = viewportWidth - tooltipWidth - 10;
      }
      if (top < 10) top = 10;
      if (top + tooltipHeight > viewportHeight - 10) {
        top = viewportHeight - tooltipHeight - 10;
      }

      setTooltipStyle({
        position: 'fixed',
        top,
        left,
        width: tooltipWidth,
        zIndex: 10000,
      });
    }
  }, [isVisible, position]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-block"
      >
        {trigger}
      </div>

      {isVisible && (
        <div style={tooltipStyle}>
          <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl">
            <div className="font-medium text-sm mb-1">{title}</div>
            <div className="text-xs opacity-90">{content}</div>
          </div>
        </div>
      )}
    </>
  );
};

class ContextualHelpService {
  private helpContent: Map<string, HelpContent[]> = new Map();
  private userPreferences: Map<string, any> = new Map();

  constructor() {
    this.initializeHelpContent();
  }

  private initializeHelpContent(): void {
    // Sentiment Analysis Help
    this.addHelpContent([
      {
        id: 'sentiment-basics',
        title: 'Understanding Sentiment Indicators',
        content:
          "Sentiment indicators show your customer's emotional state using colors: Green (positive), Yellow (neutral), Red (negative). The percentage shows AI confidence in this reading.",
        category: 'quick-help',
        context: ['sentiment-panel', 'sentiment-indicator'],
        difficulty: 'beginner',
        tags: ['sentiment', 'basics', 'indicators'],
        lastUpdated: new Date(),
      },
      {
        id: 'sentiment-trend',
        title: 'Reading Sentiment Trends',
        content:
          'The sentiment trend chart shows how customer mood changes over time. Look for sharp drops (potential issues) or steady improvements (successful de-escalation).',
        category: 'feature-guide',
        context: ['sentiment-panel', 'analytics'],
        difficulty: 'intermediate',
        tags: ['sentiment', 'trends', 'analytics'],
        relatedTopics: ['escalation-prevention'],
        lastUpdated: new Date(),
      },
      {
        id: 'sentiment-confidence',
        title: 'Confidence Scores Explained',
        content:
          'Confidence scores above 85% are highly reliable. Lower scores (50-85%) suggest ambiguous language or sarcasm. Use your judgment with low-confidence readings.',
        category: 'best-practices',
        context: ['sentiment-panel'],
        difficulty: 'advanced',
        tags: ['sentiment', 'confidence', 'accuracy'],
        lastUpdated: new Date(),
      },
    ]);

    // Response Suggestions Help
    this.addHelpContent([
      {
        id: 'suggestion-types',
        title: 'Types of Response Suggestions',
        content:
          'Empathy responses acknowledge feelings, Solution responses provide answers, Information responses gather details, and De-escalation responses calm frustration.',
        category: 'quick-help',
        context: ['suggestions-panel'],
        difficulty: 'beginner',
        tags: ['suggestions', 'types', 'responses'],
        lastUpdated: new Date(),
      },
      {
        id: 'customizing-suggestions',
        title: 'Personalizing AI Suggestions',
        content:
          'Always customize suggestions to match your voice and the specific situation. Click the edit icon to modify before inserting. The AI provides a starting point, not a final answer.',
        category: 'best-practices',
        context: ['suggestions-panel'],
        difficulty: 'intermediate',
        tags: ['suggestions', 'customization', 'personalization'],
        lastUpdated: new Date(),
      },
    ]);

    // Analytics Help
    this.addHelpContent([
      {
        id: 'performance-metrics',
        title: 'Key Performance Metrics',
        content:
          'CSAT measures customer satisfaction, FCR tracks first-contact resolution, and Response Time shows how quickly you reply. Higher is better for CSAT and FCR, lower is better for Response Time.',
        category: 'feature-guide',
        context: ['analytics-panel', 'dashboard'],
        difficulty: 'beginner',
        tags: ['analytics', 'metrics', 'performance'],
        lastUpdated: new Date(),
      },
    ]);

    // Escalation Prevention Help
    this.addHelpContent([
      {
        id: 'escalation-risk-levels',
        title: 'Escalation Risk Levels',
        content:
          'Green (0-25%): Normal conversation. Yellow (26-65%): Monitor closely. Red (66-85%): Take preventive action. Flashing Red (86%+): Immediate intervention needed.',
        category: 'troubleshooting',
        context: ['escalation-panel'],
        difficulty: 'intermediate',
        tags: ['escalation', 'risk', 'prevention'],
        relatedTopics: ['deescalation-techniques'],
        lastUpdated: new Date(),
      },
      {
        id: 'deescalation-techniques',
        title: 'De-escalation Best Practices',
        content:
          '1. Acknowledge the issue 2. Apologize sincerely 3. Take ownership 4. Provide specific next steps 5. Set clear expectations 6. Follow up proactively',
        category: 'best-practices',
        context: ['escalation-panel', 'suggestions-panel'],
        difficulty: 'advanced',
        tags: ['deescalation', 'techniques', 'customer-service'],
        lastUpdated: new Date(),
      },
    ]);

    // Beta Program Help
    this.addHelpContent([
      {
        id: 'beta-feedback',
        title: 'Providing Effective Beta Feedback',
        content:
          'Be specific about issues, include steps to reproduce bugs, suggest improvements with context, and rate urgency appropriately to help us prioritize.',
        category: 'quick-help',
        context: ['beta-feedback', 'feedback-widget'],
        difficulty: 'beginner',
        tags: ['beta', 'feedback', 'testing'],
        lastUpdated: new Date(),
      },
    ]);
  }

  private addHelpContent(content: HelpContent[]): void {
    content.forEach(item => {
      item.context?.forEach(context => {
        if (!this.helpContent.has(context)) {
          this.helpContent.set(context, []);
        }
        this.helpContent.get(context)!.push(item);
      });
    });
  }

  getContextualHelp(context: string): HelpContent[] {
    return this.helpContent.get(context) || [];
  }

  searchHelp(query: string): HelpContent[] {
    const results: HelpContent[] = [];
    const searchLower = query.toLowerCase();

    this.helpContent.forEach(contentArray => {
      contentArray.forEach(content => {
        if (
          content.title.toLowerCase().includes(searchLower) ||
          content.content.toLowerCase().includes(searchLower) ||
          content.tags.some(tag => tag.toLowerCase().includes(searchLower))
        ) {
          if (!results.find(r => r.id === content.id)) {
            results.push(content);
          }
        }
      });
    });

    return results;
  }

  getRelatedHelp(helpId: string): HelpContent[] {
    const allContent = Array.from(this.helpContent.values()).flat();
    const currentHelp = allContent.find(h => h.id === helpId);

    if (!currentHelp?.relatedTopics) return [];

    return allContent.filter(h => currentHelp.relatedTopics!.includes(h.id));
  }
}

const helpService = new ContextualHelpService();

const ContextualHelp: React.FC<ContextualHelpProps> = ({
  context,
  isVisible,
  onClose,
  position = 'right',
  userId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<string>('contextual');
  const [selectedHelp, setSelectedHelp] = useState<HelpContent | null>(null);

  const contextualHelp = helpService.getContextualHelp(context);
  const searchResults = searchQuery ? helpService.searchHelp(searchQuery) : [];

  const getFilteredHelp = (): HelpContent[] => {
    if (selectedCategory === 'contextual') return contextualHelp;
    if (selectedCategory === 'search') return searchResults;

    const allHelp = Array.from(helpService['helpContent'].values()).flat();
    return allHelp.filter(h => h.category === selectedCategory);
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'quick-help':
        return '⚡';
      case 'feature-guide':
        return '📖';
      case 'troubleshooting':
        return '🔧';
      case 'best-practices':
        return '⭐';
      default:
        return '❓';
    }
  };

  const getDifficultyColor = (
    difficulty: string
  ): 'positive' | 'warning' | 'danger' => {
    switch (difficulty) {
      case 'beginner':
        return 'positive';
      case 'intermediate':
        return 'warning';
      case 'advanced':
        return 'danger';
      default:
        return 'positive';
    }
  };

  const HelpCard: React.FC<{ help: HelpContent }> = ({ help }) => (
    <div
      className="border rounded-lg p-4 hover:shadow-md cursor-pointer transition-shadow"
      onClick={() => setSelectedHelp(help)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getCategoryIcon(help.category)}</span>
          <h3 className="font-semibold text-sm">{help.title}</h3>
        </div>
        <Badge type={getDifficultyColor(help.difficulty)} className="text-xs">
          {help.difficulty}
        </Badge>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{help.content}</p>

      <div className="flex flex-wrap gap-1 mb-2">
        {help.tags.slice(0, 3).map(tag => (
          <Badge key={tag} type="neutral" className="text-xs">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );

  const HelpDetail: React.FC<{ help: HelpContent }> = ({ help }) => {
    const relatedHelp = helpService.getRelatedHelp(help.id);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button size="small" onClick={() => setSelectedHelp(null)}>
            ← Back
          </Button>
          <Badge type={getDifficultyColor(help.difficulty)}>
            {help.difficulty}
          </Badge>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-2xl">{getCategoryIcon(help.category)}</span>
            <h2 className="text-xl font-bold">{help.title}</h2>
          </div>

          <div className="prose text-sm mb-4">
            {help.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-2">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {help.tags.map(tag => (
            <Badge key={tag} type="neutral" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {relatedHelp.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Related Topics</h3>
            <div className="space-y-2">
              {relatedHelp.map(related => (
                <button
                  key={related.id}
                  onClick={() => setSelectedHelp(related)}
                  className="block w-full text-left p-2 rounded border hover:bg-gray-50 text-sm"
                >
                  {getCategoryIcon(related.category)} {related.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <Modal isOpen={true} onClose={onClose} className="max-w-2xl">
      <Header>
        <div className="flex items-center space-x-2">
          <span>❓</span>
          <h2>Help & Guidance</h2>
          {context && (
            <Badge type="neutral" className="text-xs">
              {context.replace('-', ' ')}
            </Badge>
          )}
        </div>
        <Close aria-label="Close help" />
      </Header>
      <Body className="max-h-96 overflow-y-auto">
        {selectedHelp ? (
          <HelpDetail help={selectedHelp} />
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <Field>
              <Label>Search Help Topics</Label>
              <Input
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (e.target.value) setSelectedCategory('search');
                }}
                placeholder="Search help topics..."
              />
            </Field>

            {/* Category Tabs */}
            <Tabs
              selectedItem={selectedCategory}
              onChange={setSelectedCategory}
            >
              <TabList>
                <Tab item="contextual">For This Page</Tab>
                <Tab item="quick-help">Quick Help</Tab>
                <Tab item="feature-guide">Feature Guides</Tab>
                <Tab item="troubleshooting">Troubleshooting</Tab>
                <Tab item="best-practices">Best Practices</Tab>
                {searchQuery && <Tab item="search">Search Results</Tab>}
              </TabList>

              <TabPanel item="contextual">
                {contextualHelp.length > 0 ? (
                  <div className="space-y-3 mt-4">
                    <Alert type="info">
                      Help topics specifically for this page and feature.
                    </Alert>
                    {contextualHelp.map(help => (
                      <HelpCard key={help.id} help={help} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No contextual help available for this page.</p>
                    <p className="text-sm mt-2">
                      Try searching or browse other categories.
                    </p>
                  </div>
                )}
              </TabPanel>

              <TabPanel item="quick-help">
                <div className="space-y-3 mt-4">
                  {getFilteredHelp().map(help => (
                    <HelpCard key={help.id} help={help} />
                  ))}
                </div>
              </TabPanel>

              <TabPanel item="feature-guide">
                <div className="space-y-3 mt-4">
                  {getFilteredHelp().map(help => (
                    <HelpCard key={help.id} help={help} />
                  ))}
                </div>
              </TabPanel>

              <TabPanel item="troubleshooting">
                <div className="space-y-3 mt-4">
                  {getFilteredHelp().map(help => (
                    <HelpCard key={help.id} help={help} />
                  ))}
                </div>
              </TabPanel>

              <TabPanel item="best-practices">
                <div className="space-y-3 mt-4">
                  {getFilteredHelp().map(help => (
                    <HelpCard key={help.id} help={help} />
                  ))}
                </div>
              </TabPanel>

              {searchQuery && (
                <TabPanel item="search">
                  <div className="space-y-3 mt-4">
                    {searchResults.length > 0 ? (
                      <>
                        <p className="text-sm text-gray-600">
                          Found {searchResults.length} result
                          {searchResults.length !== 1 ? 's' : ''} for "
                          {searchQuery}"
                        </p>
                        {searchResults.map(help => (
                          <HelpCard key={help.id} help={help} />
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No results found for "{searchQuery}"</p>
                        <p className="text-sm mt-2">
                          Try different keywords or browse categories.
                        </p>
                      </div>
                    )}
                  </div>
                </TabPanel>
              )}
            </Tabs>
          </div>
        )}
      </Body>
      <Footer>
        <div className="flex justify-between items-center w-full">
          <div className="text-xs text-gray-500">
            Need more help? Contact support or check the full documentation.
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </Footer>
    </Modal>
  );
};

// Hook for using contextual help in components
export const useContextualHelp = (context: string) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  const showHelp = (): void => setIsHelpVisible(true);
  const hideHelp = (): void => setIsHelpVisible(false);

  const HelpButton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <Button
      size="small"
      onClick={showHelp}
      title="Get help for this section"
      className={`help-button ${className}`}
    >
      ❓
    </Button>
  );

  const HelpModal: React.FC<{ userId?: string }> = ({ userId }) => (
    <ContextualHelp
      context={context}
      isVisible={isHelpVisible}
      onClose={hideHelp}
      userId={userId}
    />
  );

  return { showHelp, hideHelp, HelpButton, HelpModal, isHelpVisible };
};

// Quick help tooltip for inline help
export const QuickHelpTooltip: React.FC<{
  helpId: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ helpId, children, position = 'top' }) => {
  // Find help content by ID
  const allHelp = Array.from(helpService['helpContent'].values()).flat();
  const helpContent = allHelp.find(h => h.id === helpId);

  if (!helpContent) return children;

  return (
    <HelpTooltip
      title={helpContent.title}
      content={helpContent.content}
      position={position}
      trigger={children}
    />
  );
};

export default ContextualHelp;
