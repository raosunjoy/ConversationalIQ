/**
 * Tutorial Launcher Component
 * Provides easy access to all available tutorials and tracks user progress
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import {
  Modal,
  Header,
  Body,
  Footer,
  Close,
} from '@zendeskgarden/react-modals';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Field, Input, Label } from '@zendeskgarden/react-forms';
import InteractiveTutorial, { Tutorial } from './InteractiveTutorial';
import {
  tutorialService,
  TutorialProgress,
} from '../../services/tutorial-service';

interface TutorialLauncherProps {
  userId: string;
  isVisible: boolean;
  onClose: () => void;
  autoStartRecommended?: boolean;
}

const TutorialLauncher: React.FC<TutorialLauncherProps> = ({
  userId,
  isVisible,
  onClose,
  autoStartRecommended = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userProgress, setUserProgress] = useState<
    Record<string, TutorialProgress>
  >({});
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (isVisible) {
      loadUserData();

      // Auto-start recommended tutorial if enabled
      if (autoStartRecommended) {
        const recommended = tutorialService.getRecommendedTutorials(userId);
        if (recommended.length > 0) {
          startTutorial(recommended[0]);
        }
      }
    }
  }, [isVisible, userId, autoStartRecommended]);

  const loadUserData = (): void => {
    const userState = tutorialService.getUserState(userId);
    setUserProgress(userState.tutorialProgress);
    setAnalytics(tutorialService.getTutorialAnalytics(userId));
  };

  const startTutorial = (tutorial: Tutorial): void => {
    if (tutorialService.startTutorial(userId, tutorial.id)) {
      setActiveTutorial(tutorial);
    }
  };

  const handleTutorialComplete = (
    tutorialId: string,
    completed: boolean
  ): void => {
    tutorialService.completeTutorial(userId, tutorialId, completed);
    setActiveTutorial(null);
    loadUserData();
  };

  const getFilteredTutorials = (): Tutorial[] => {
    let tutorials = tutorialService.getAllTutorials();

    // Filter by category
    if (selectedCategory !== 'all') {
      tutorials = tutorials.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tutorials = tutorials.filter(
        t =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return tutorials;
  };

  const getRecommendedTutorials = (): Tutorial[] => {
    return tutorialService.getRecommendedTutorials(userId);
  };

  const getTutorialStatus = (
    tutorial: Tutorial
  ): 'completed' | 'in-progress' | 'available' | 'locked' => {
    const userState = tutorialService.getUserState(userId);

    if (userState.completedTutorials.includes(tutorial.id)) {
      return 'completed';
    }

    if (userState.inProgressTutorials.includes(tutorial.id)) {
      return 'in-progress';
    }

    if (tutorial.prerequisites) {
      const hasPrerequisites = tutorial.prerequisites.every(prereq =>
        userState.completedTutorials.includes(prereq)
      );
      if (!hasPrerequisites) {
        return 'locked';
      }
    }

    return 'available';
  };

  const getStatusBadge = (
    status: string,
    tutorial: Tutorial
  ): React.ReactElement => {
    switch (status) {
      case 'completed':
        return <Badge type="positive">✓ Completed</Badge>;
      case 'in-progress':
        return <Badge type="warning">In Progress</Badge>;
      case 'available':
        return <Badge type="neutral">Available</Badge>;
      case 'locked':
        return <Badge type="neutral">🔒 Locked</Badge>;
      default:
        return <Badge type="neutral">Available</Badge>;
    }
  };

  const getProgressPercentage = (tutorial: Tutorial): number => {
    const progress = userProgress[tutorial.id];
    if (!progress) return 0;

    return (progress.completedSteps.length / tutorial.steps.length) * 100;
  };

  const TutorialCard: React.FC<{ tutorial: Tutorial }> = ({ tutorial }) => {
    const status = getTutorialStatus(tutorial);
    const progressPercentage = getProgressPercentage(tutorial);
    const isLocked = status === 'locked';

    return (
      <div
        className={`border rounded-lg p-4 ${isLocked ? 'opacity-50' : 'hover:shadow-md'} transition-shadow`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{tutorial.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{tutorial.description}</p>
          </div>
          {getStatusBadge(status, tutorial)}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <span>⏱️ {tutorial.estimatedDuration} min</span>
          <Badge type="neutral">{tutorial.category.replace('-', ' ')}</Badge>
        </div>

        {progressPercentage > 0 && progressPercentage < 100 && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs text-gray-500">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {tutorial.prerequisites && tutorial.prerequisites.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Prerequisites:</div>
            <div className="flex flex-wrap gap-1">
              {tutorial.prerequisites.map(prereq => {
                const prereqTutorial = tutorialService.getTutorial(prereq);
                const isComplete = tutorialService
                  .getUserState(userId)
                  .completedTutorials.includes(prereq);
                return (
                  <Badge
                    key={prereq}
                    type={isComplete ? 'positive' : 'warning'}
                    className="text-xs"
                  >
                    {isComplete ? '✓' : '○'} {prereqTutorial?.title || prereq}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {status === 'in-progress' && (
              <Button size="small" onClick={() => startTutorial(tutorial)}>
                Continue
              </Button>
            )}
            {status === 'available' && (
              <Button
                size="small"
                isPrimary
                onClick={() => startTutorial(tutorial)}
              >
                Start Tutorial
              </Button>
            )}
            {status === 'completed' && (
              <Button size="small" onClick={() => startTutorial(tutorial)}>
                Review
              </Button>
            )}
            {status === 'locked' && (
              <Button size="small" disabled>
                Complete Prerequisites
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const AnalyticsPanel: React.FC = () => {
    if (!analytics) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {analytics.completedTutorials}
            </div>
            <div className="text-sm text-blue-800">Completed</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(analytics.completionRate)}%
            </div>
            <div className="text-sm text-green-800">Completion Rate</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(analytics.averageTimePerTutorial / 60)}
            </div>
            <div className="text-sm text-purple-800">Avg. Minutes</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">
              {analytics.totalTutorials}
            </div>
            <div className="text-sm text-orange-800">Total Available</div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Learning Path Progress</h4>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full flex items-center justify-center"
              style={{ width: `${analytics.completionRate}%` }}
            >
              <span className="text-xs text-white font-medium">
                {Math.round(analytics.completionRate)}%
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            You're doing great! Keep going to unlock advanced features and
            become a ConversationIQ expert.
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal isOpen={isVisible} onClose={onClose} className="max-w-4xl">
        <Header>
          <h2>ConversationIQ Tutorials</h2>
          <Close aria-label="Close tutorials" />
        </Header>
        <Body>
          <Tabs selectedItem={selectedCategory} onChange={setSelectedCategory}>
            <TabList>
              <Tab item="all">All Tutorials</Tab>
              <Tab item="recommended">Recommended</Tab>
              <Tab item="getting-started">Getting Started</Tab>
              <Tab item="advanced">Advanced</Tab>
              <Tab item="beta">Beta Features</Tab>
              <Tab item="progress">My Progress</Tab>
            </TabList>

            <div className="mt-4">
              <Field>
                <Label>Search Tutorials</Label>
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by title or description..."
                />
              </Field>
            </div>

            <TabPanel item="all">
              <div className="grid gap-4 mt-4">
                {getFilteredTutorials().map(tutorial => (
                  <TutorialCard key={tutorial.id} tutorial={tutorial} />
                ))}
              </div>
            </TabPanel>

            <TabPanel item="recommended">
              <div className="space-y-4 mt-4">
                <Alert type="info">
                  These tutorials are recommended based on your current progress
                  and role.
                </Alert>
                <div className="grid gap-4">
                  {getRecommendedTutorials().map(tutorial => (
                    <TutorialCard key={tutorial.id} tutorial={tutorial} />
                  ))}
                </div>
              </div>
            </TabPanel>

            <TabPanel item="getting-started">
              <div className="grid gap-4 mt-4">
                {tutorialService
                  .getTutorialsByCategory('getting-started')
                  .map(tutorial => (
                    <TutorialCard key={tutorial.id} tutorial={tutorial} />
                  ))}
              </div>
            </TabPanel>

            <TabPanel item="advanced">
              <div className="grid gap-4 mt-4">
                {tutorialService
                  .getTutorialsByCategory('advanced')
                  .map(tutorial => (
                    <TutorialCard key={tutorial.id} tutorial={tutorial} />
                  ))}
              </div>
            </TabPanel>

            <TabPanel item="beta">
              <div className="space-y-4 mt-4">
                <Alert type="warning">
                  These tutorials cover beta features that may change or be
                  removed in future updates.
                </Alert>
                <div className="grid gap-4">
                  {tutorialService
                    .getTutorialsByCategory('beta')
                    .map(tutorial => (
                      <TutorialCard key={tutorial.id} tutorial={tutorial} />
                    ))}
                </div>
              </div>
            </TabPanel>

            <TabPanel item="progress">
              <div className="mt-4">
                <AnalyticsPanel />
              </div>
            </TabPanel>
          </Tabs>
        </Body>
        <Footer>
          <Button onClick={onClose}>Close</Button>
        </Footer>
      </Modal>

      {/* Active Tutorial */}
      {activeTutorial && (
        <InteractiveTutorial
          tutorial={activeTutorial}
          isVisible={true}
          onClose={() => setActiveTutorial(null)}
          onComplete={handleTutorialComplete}
          autoStart={true}
        />
      )}
    </>
  );
};

export default TutorialLauncher;
