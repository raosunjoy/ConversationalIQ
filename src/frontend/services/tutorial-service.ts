/**
 * Tutorial Service
 * Manages interactive tutorials and user progress tracking
 */

import { Tutorial, TutorialStep } from '../components/common/InteractiveTutorial';

export interface TutorialProgress {
  tutorialId: string;
  completed: boolean;
  completedSteps: string[];
  startedAt: Date;
  completedAt?: Date;
  timeSpent: number; // seconds
}

export interface UserTutorialState {
  userId: string;
  completedTutorials: string[];
  inProgressTutorials: string[];
  tutorialProgress: Record<string, TutorialProgress>;
  preferences: {
    autoStart: boolean;
    showHints: boolean;
    skipOptionalSteps: boolean;
  };
}

class TutorialService {
  private tutorials: Map<string, Tutorial> = new Map();
  private userProgress: Map<string, UserTutorialState> = new Map();
  private currentTutorial: string | null = null;

  constructor() {
    this.initializeTutorials();
    this.loadUserProgress();
  }

  private initializeTutorials(): void {
    // Getting Started Tutorials
    this.addTutorial(this.createAgentOnboardingTutorial());
    this.addTutorial(this.createSentimentAnalysisTutorial());
    this.addTutorial(this.createResponseSuggestionsTutorial());
    this.addTutorial(this.createEscalationPreventionTutorial());
    
    // Advanced Tutorials
    this.addTutorial(this.createAnalyticsDashboardTutorial());
    this.addTutorial(this.createCustomTemplatesTutorial());
    this.addTutorial(this.createPerformanceOptimizationTutorial());
    
    // Beta Features
    this.addTutorial(this.createBetaFeedbackTutorial());
    this.addTutorial(this.createFeatureFlagTutorial());
    
    // Manager Tutorials
    this.addTutorial(this.createManagerDashboardTutorial());
    this.addTutorial(this.createTeamAnalyticsTutorial());
  }

  private createAgentOnboardingTutorial(): Tutorial {
    return {
      id: 'agent-onboarding',
      title: 'Welcome to ConversationIQ!',
      description: 'Learn the basics of using ConversationIQ to enhance your customer conversations.',
      category: 'getting-started',
      estimatedDuration: 5,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to ConversationIQ',
          content: 'ConversationIQ appears in your Zendesk sidebar and provides real-time insights about customer conversations. Let\'s explore the main features together.',
          target: '.conversation-iq-sidebar',
          position: 'left'
        },
        {
          id: 'sentiment-panel',
          title: 'Sentiment Analysis Panel',
          content: 'This panel shows the customer\'s current emotional state. Green means positive, yellow is neutral, and red indicates frustration or negative sentiment.',
          target: '.sentiment-panel',
          position: 'right'
        },
        {
          id: 'suggestions-panel',
          title: 'AI Response Suggestions',
          content: 'Here you\'ll find AI-generated response suggestions tailored to the conversation context. Click any suggestion to insert it into your reply.',
          target: '.suggestions-panel',
          position: 'right'
        },
        {
          id: 'analytics-panel',
          title: 'Conversation Analytics',
          content: 'Track conversation health, customer journey, and your performance metrics in real-time.',
          target: '.analytics-panel',
          position: 'right'
        },
        {
          id: 'try-suggestion',
          title: 'Try a Suggestion',
          content: 'Click on any response suggestion to see how it works. Don\'t worry, you can edit it before sending!',
          target: '.suggestion-card:first-child',
          position: 'left',
          action: 'click',
          validation: () => document.querySelector('.zendesk-editor')?.textContent?.length > 0
        }
      ]
    };
  }

  private createSentimentAnalysisTutorial(): Tutorial {
    return {
      id: 'sentiment-analysis-deep-dive',
      title: 'Understanding Sentiment Analysis',
      description: 'Master the art of reading customer emotions and adapting your responses accordingly.',
      category: 'getting-started',
      estimatedDuration: 7,
      prerequisites: ['agent-onboarding'],
      steps: [
        {
          id: 'sentiment-basics',
          title: 'Reading Sentiment Indicators',
          content: 'Sentiment is shown as a color-coded indicator with a confidence score. High confidence (90%+) means the AI is very sure about the emotional reading.',
          target: '.sentiment-indicator',
          position: 'bottom'
        },
        {
          id: 'sentiment-trend',
          title: 'Sentiment Trends Over Time',
          content: 'This chart shows how the customer\'s mood has changed throughout the conversation. Look for patterns and turning points.',
          target: '.sentiment-trend-chart',
          position: 'top'
        },
        {
          id: 'emotion-breakdown',
          title: 'Detailed Emotion Analysis',
          content: 'Beyond basic sentiment, we identify specific emotions like frustration, confusion, or appreciation. Use this to craft more empathetic responses.',
          target: '.emotion-breakdown',
          position: 'bottom'
        },
        {
          id: 'sentiment-alerts',
          title: 'Sentiment-Based Alerts',
          content: 'When sentiment drops significantly, you\'ll see alerts here. These help you catch potential escalations early.',
          target: '.sentiment-alerts',
          position: 'left'
        }
      ]
    };
  }

  private createResponseSuggestionsTutorial(): Tutorial {
    return {
      id: 'response-suggestions-mastery',
      title: 'Mastering AI Response Suggestions',
      description: 'Learn how to effectively use and customize AI-generated response suggestions.',
      category: 'getting-started',
      estimatedDuration: 8,
      prerequisites: ['agent-onboarding'],
      steps: [
        {
          id: 'suggestion-types',
          title: 'Types of Suggestions',
          content: 'Suggestions are categorized by type: Empathy (💙), Solution (⚡), Information Gathering (❓), and De-escalation (🔧).',
          target: '.suggestion-categories',
          position: 'right'
        },
        {
          id: 'confidence-scores',
          title: 'Understanding Confidence Scores',
          content: 'Each suggestion has a confidence score. Higher scores mean the AI believes this response is more likely to be effective.',
          target: '.suggestion-confidence',
          position: 'left'
        },
        {
          id: 'customizing-suggestions',
          title: 'Customizing Before Sending',
          content: 'Always personalize suggestions to match your voice and the specific customer situation. Click the edit icon to modify before inserting.',
          target: '.suggestion-edit-button',
          position: 'top'
        },
        {
          id: 'feedback-system',
          title: 'Providing Feedback',
          content: 'Use the thumbs up/down buttons to rate suggestion quality. This helps improve future recommendations.',
          target: '.suggestion-feedback',
          position: 'bottom'
        },
        {
          id: 'save-templates',
          title: 'Saving Personal Templates',
          content: 'Found a suggestion that works well? Save it as a personal template for future use.',
          target: '.save-template-button',
          position: 'left'
        }
      ]
    };
  }

  private createEscalationPreventionTutorial(): Tutorial {
    return {
      id: 'escalation-prevention',
      title: 'Preventing Customer Escalations',
      description: 'Learn to identify and prevent potential escalations before they happen.',
      category: 'advanced',
      estimatedDuration: 10,
      prerequisites: ['agent-onboarding', 'sentiment-analysis-deep-dive'],
      steps: [
        {
          id: 'risk-indicators',
          title: 'Escalation Risk Indicators',
          content: 'Watch for these risk levels: Green (low), Yellow (medium), Red (high), and Flashing Red (critical). Each requires different response strategies.',
          target: '.escalation-risk-indicator',
          position: 'right'
        },
        {
          id: 'early-warning-signs',
          title: 'Early Warning System',
          content: 'The AI monitors conversation patterns, sentiment trends, and customer history to predict escalation risk before it\'s obvious.',
          target: '.early-warning-panel',
          position: 'left'
        },
        {
          id: 'deescalation-suggestions',
          title: 'De-escalation Techniques',
          content: 'When risk is detected, you\'ll see specialized de-escalation suggestions. These are proven techniques for calming frustrated customers.',
          target: '.deescalation-suggestions',
          position: 'bottom'
        },
        {
          id: 'supervisor-alerts',
          title: 'When to Involve Supervisors',
          content: 'Critical risk situations trigger supervisor alerts. Don\'t wait - proactive escalation often leads to better outcomes.',
          target: '.supervisor-alert-button',
          position: 'top'
        }
      ]
    };
  }

  private createBetaFeedbackTutorial(): Tutorial {
    return {
      id: 'beta-feedback',
      title: 'Providing Beta Feedback',
      description: 'Learn how to effectively provide feedback during the beta program.',
      category: 'beta',
      estimatedDuration: 4,
      steps: [
        {
          id: 'feedback-widget',
          title: 'Feedback Widget',
          content: 'Click this floating button anytime to share feedback about your experience with ConversationIQ.',
          target: '.feedback-widget-button',
          position: 'left'
        },
        {
          id: 'feedback-types',
          title: 'Types of Feedback',
          content: 'You can submit feature requests, bug reports, general feedback, or satisfaction ratings. Each type helps us improve different aspects.',
          target: '.feedback-type-selector',
          position: 'top'
        },
        {
          id: 'urgency-levels',
          title: 'Setting Urgency',
          content: 'Help us prioritize by setting the right urgency level. Critical issues get immediate attention from our development team.',
          target: '.urgency-selector',
          position: 'bottom'
        }
      ]
    };
  }

  private createManagerDashboardTutorial(): Tutorial {
    return {
      id: 'manager-dashboard',
      title: 'Manager Dashboard Overview',
      description: 'Explore the comprehensive analytics and management tools for team leaders.',
      category: 'advanced',
      estimatedDuration: 12,
      steps: [
        {
          id: 'team-overview',
          title: 'Team Performance Overview',
          content: 'Get a bird\'s-eye view of your team\'s performance with key metrics like CSAT, FCR, and escalation rates.',
          target: '.team-overview-panel',
          position: 'bottom'
        },
        {
          id: 'individual-analytics',
          title: 'Individual Agent Analytics',
          content: 'Drill down into each agent\'s performance to identify top performers and coaching opportunities.',
          target: '.agent-performance-table',
          position: 'top'
        },
        {
          id: 'coaching-insights',
          title: 'AI-Powered Coaching Insights',
          content: 'Get personalized coaching recommendations based on each agent\'s interaction patterns and areas for improvement.',
          target: '.coaching-recommendations',
          position: 'right'
        },
        {
          id: 'business-intelligence',
          title: 'Business Intelligence Panel',
          content: 'Understand customer trends, common issues, and opportunities for process improvement.',
          target: '.business-intelligence-panel',
          position: 'left'
        }
      ]
    };
  }

  // Additional tutorial creation methods would continue here...
  private createAnalyticsDashboardTutorial(): Tutorial {
    return {
      id: 'analytics-dashboard',
      title: 'Analytics Deep Dive',
      description: 'Master the analytics dashboard to track your performance and identify improvement opportunities.',
      category: 'advanced',
      estimatedDuration: 8,
      prerequisites: ['agent-onboarding'],
      steps: [
        {
          id: 'performance-metrics',
          title: 'Key Performance Metrics',
          content: 'Track your CSAT scores, response times, resolution rates, and sentiment improvement over time.',
          target: '.performance-metrics-panel',
          position: 'bottom'
        },
        {
          id: 'trend-analysis',
          title: 'Trend Analysis',
          content: 'Identify patterns in your performance data to understand your strengths and areas for improvement.',
          target: '.trend-analysis-chart',
          position: 'top'
        }
      ]
    };
  }

  private createCustomTemplatesTutorial(): Tutorial {
    return {
      id: 'custom-templates',
      title: 'Creating Custom Response Templates',
      description: 'Learn to create and manage personalized response templates for common scenarios.',
      category: 'advanced',
      estimatedDuration: 6,
      prerequisites: ['response-suggestions-mastery'],
      steps: [
        {
          id: 'template-creation',
          title: 'Creating Templates',
          content: 'Save your most effective responses as templates for future use. This builds your personal knowledge base.',
          target: '.template-creation-panel',
          position: 'right'
        }
      ]
    };
  }

  private createPerformanceOptimizationTutorial(): Tutorial {
    return {
      id: 'performance-optimization',
      title: 'Optimizing Your Performance',
      description: 'Advanced techniques for maximizing your effectiveness with ConversationIQ.',
      category: 'advanced',
      estimatedDuration: 10,
      prerequisites: ['analytics-dashboard'],
      steps: [
        {
          id: 'workflow-optimization',
          title: 'Optimizing Your Workflow',
          content: 'Learn keyboard shortcuts and workflow tips to work more efficiently with ConversationIQ.',
          target: '.workflow-tips-panel',
          position: 'left'
        }
      ]
    };
  }

  private createFeatureFlagTutorial(): Tutorial {
    return {
      id: 'feature-flags',
      title: 'Understanding Feature Flags',
      description: 'Learn about beta features and how feature flags work in ConversationIQ.',
      category: 'beta',
      estimatedDuration: 5,
      steps: [
        {
          id: 'what-are-flags',
          title: 'What Are Feature Flags?',
          content: 'Feature flags allow us to gradually roll out new features to beta users like you for testing.',
          target: '.feature-flag-indicator',
          position: 'bottom'
        }
      ]
    };
  }

  private createTeamAnalyticsTutorial(): Tutorial {
    return {
      id: 'team-analytics',
      title: 'Team Analytics for Managers',
      description: 'Advanced team analytics and coaching insights for managers.',
      category: 'advanced',
      estimatedDuration: 15,
      prerequisites: ['manager-dashboard'],
      steps: [
        {
          id: 'team-comparisons',
          title: 'Team Performance Comparisons',
          content: 'Compare your team\'s performance against benchmarks and identify areas for collective improvement.',
          target: '.team-comparison-chart',
          position: 'top'
        }
      ]
    };
  }

  addTutorial(tutorial: Tutorial): void {
    this.tutorials.set(tutorial.id, tutorial);
  }

  getTutorial(id: string): Tutorial | null {
    return this.tutorials.get(id) || null;
  }

  getAllTutorials(): Tutorial[] {
    return Array.from(this.tutorials.values());
  }

  getTutorialsByCategory(category: Tutorial['category']): Tutorial[] {
    return Array.from(this.tutorials.values()).filter(
      tutorial => tutorial.category === category
    );
  }

  getRecommendedTutorials(userId: string): Tutorial[] {
    const userState = this.getUserState(userId);
    const completed = new Set(userState.completedTutorials);
    
    // Filter out completed tutorials and check prerequisites
    return Array.from(this.tutorials.values()).filter(tutorial => {
      if (completed.has(tutorial.id)) return false;
      
      if (tutorial.prerequisites) {
        return tutorial.prerequisites.every(prereq => completed.has(prereq));
      }
      
      return true;
    });
  }

  startTutorial(userId: string, tutorialId: string): boolean {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) return false;
    
    const userState = this.getUserState(userId);
    
    // Check prerequisites
    if (tutorial.prerequisites) {
      const completed = new Set(userState.completedTutorials);
      const hasPrerequisites = tutorial.prerequisites.every(prereq => 
        completed.has(prereq)
      );
      
      if (!hasPrerequisites) {
        console.warn(`Prerequisites not met for tutorial: ${tutorialId}`);
        return false;
      }
    }
    
    // Initialize progress tracking
    userState.tutorialProgress[tutorialId] = {
      tutorialId,
      completed: false,
      completedSteps: [],
      startedAt: new Date(),
      timeSpent: 0
    };
    
    if (!userState.inProgressTutorials.includes(tutorialId)) {
      userState.inProgressTutorials.push(tutorialId);
    }
    
    this.currentTutorial = tutorialId;
    this.saveUserProgress(userId);
    
    return true;
  }

  completeTutorial(userId: string, tutorialId: string, completed: boolean): void {
    const userState = this.getUserState(userId);
    const progress = userState.tutorialProgress[tutorialId];
    
    if (progress) {
      progress.completed = completed;
      progress.completedAt = new Date();
      
      if (completed && !userState.completedTutorials.includes(tutorialId)) {
        userState.completedTutorials.push(tutorialId);
      }
      
      // Remove from in-progress
      const inProgressIndex = userState.inProgressTutorials.indexOf(tutorialId);
      if (inProgressIndex > -1) {
        userState.inProgressTutorials.splice(inProgressIndex, 1);
      }
      
      this.saveUserProgress(userId);
    }
    
    if (this.currentTutorial === tutorialId) {
      this.currentTutorial = null;
    }
  }

  updateStepProgress(
    userId: string, 
    tutorialId: string, 
    stepId: string
  ): void {
    const userState = this.getUserState(userId);
    const progress = userState.tutorialProgress[tutorialId];
    
    if (progress && !progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
      this.saveUserProgress(userId);
    }
  }

  getTutorialProgress(userId: string, tutorialId: string): TutorialProgress | null {
    const userState = this.getUserState(userId);
    return userState.tutorialProgress[tutorialId] || null;
  }

  getUserState(userId: string): UserTutorialState {
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, {
        userId,
        completedTutorials: [],
        inProgressTutorials: [],
        tutorialProgress: {},
        preferences: {
          autoStart: true,
          showHints: true,
          skipOptionalSteps: false
        }
      });
    }
    
    return this.userProgress.get(userId)!;
  }

  updateUserPreferences(
    userId: string, 
    preferences: Partial<UserTutorialState['preferences']>
  ): void {
    const userState = this.getUserState(userId);
    userState.preferences = { ...userState.preferences, ...preferences };
    this.saveUserProgress(userId);
  }

  private loadUserProgress(): void {
    try {
      const saved = localStorage.getItem('conversationiq_tutorial_progress');
      if (saved) {
        const data = JSON.parse(saved);
        Object.entries(data).forEach(([userId, state]) => {
          this.userProgress.set(userId, state as UserTutorialState);
        });
      }
    } catch (error) {
      console.error('Failed to load tutorial progress:', error);
    }
  }

  private saveUserProgress(userId: string): void {
    try {
      const allProgress: Record<string, UserTutorialState> = {};
      this.userProgress.forEach((state, id) => {
        allProgress[id] = state;
      });
      
      localStorage.setItem(
        'conversationiq_tutorial_progress', 
        JSON.stringify(allProgress)
      );
    } catch (error) {
      console.error('Failed to save tutorial progress:', error);
    }
  }

  // Analytics methods
  getTutorialAnalytics(userId: string): {
    totalTutorials: number;
    completedTutorials: number;
    completionRate: number;
    averageTimePerTutorial: number;
    favoriteCategory: string;
  } {
    const userState = this.getUserState(userId);
    const totalTutorials = this.tutorials.size;
    const completedTutorials = userState.completedTutorials.length;
    const completionRate = (completedTutorials / totalTutorials) * 100;
    
    // Calculate average time
    const completedProgress = Object.values(userState.tutorialProgress)
      .filter(p => p.completed);
    const averageTimePerTutorial = completedProgress.length > 0
      ? completedProgress.reduce((sum, p) => sum + p.timeSpent, 0) / completedProgress.length
      : 0;
    
    // Find favorite category
    const categoryCount: Record<string, number> = {};
    completedProgress.forEach(progress => {
      const tutorial = this.tutorials.get(progress.tutorialId);
      if (tutorial) {
        categoryCount[tutorial.category] = (categoryCount[tutorial.category] || 0) + 1;
      }
    });
    
    const favoriteCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'getting-started';
    
    return {
      totalTutorials,
      completedTutorials,
      completionRate,
      averageTimePerTutorial,
      favoriteCategory
    };
  }
}

export const tutorialService = new TutorialService();