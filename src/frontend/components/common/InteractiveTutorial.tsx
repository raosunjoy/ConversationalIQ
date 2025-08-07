/**
 * Interactive Tutorial Component
 * Provides step-by-step guided tours for ConversationIQ features
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

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'scroll' | 'wait';
  duration?: number; // milliseconds for wait action
  validation?: () => boolean; // function to check if step is completed
  optional?: boolean;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'getting-started' | 'advanced' | 'beta' | 'troubleshooting';
  estimatedDuration: number; // minutes
  prerequisites?: string[];
  steps: TutorialStep[];
}

interface InteractiveTutorialProps {
  tutorial: Tutorial;
  isVisible: boolean;
  onClose: () => void;
  onComplete: (tutorialId: string, completed: boolean) => void;
  autoStart?: boolean;
}

interface HighlightOverlayProps {
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  step: TutorialStep;
  currentStepIndex: number;
  totalSteps: number;
}

const HighlightOverlay: React.FC<HighlightOverlayProps> = ({
  target,
  position,
  onNext,
  onPrevious,
  onSkip,
  step,
  currentStepIndex,
  totalSteps,
}) => {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (target) {
      const element = document.querySelector(target) as HTMLElement;
      if (element) {
        setTargetElement(element);

        // Scroll element into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });

        // Calculate overlay position
        const rect = element.getBoundingClientRect();
        const padding = 8;

        setOverlayStyle({
          position: 'fixed',
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          border: '3px solid #1f73b7',
          borderRadius: '8px',
          backgroundColor: 'rgba(31, 115, 183, 0.1)',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          pointerEvents: 'none',
          animation: 'tutorialPulse 2s infinite',
        });

        // Calculate tooltip position
        let tooltipTop = 0;
        let tooltipLeft = 0;
        const tooltipWidth = 320;
        const tooltipHeight = 200;

        switch (position) {
          case 'top':
            tooltipTop = rect.top - tooltipHeight - 20;
            tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'bottom':
            tooltipTop = rect.bottom + 20;
            tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'left':
            tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
            tooltipLeft = rect.left - tooltipWidth - 20;
            break;
          case 'right':
            tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
            tooltipLeft = rect.right + 20;
            break;
        }

        // Ensure tooltip stays within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (tooltipLeft < 10) tooltipLeft = 10;
        if (tooltipLeft + tooltipWidth > viewportWidth - 10) {
          tooltipLeft = viewportWidth - tooltipWidth - 10;
        }
        if (tooltipTop < 10) tooltipTop = 10;
        if (tooltipTop + tooltipHeight > viewportHeight - 10) {
          tooltipTop = viewportHeight - tooltipHeight - 10;
        }

        setTooltipStyle({
          position: 'fixed',
          top: tooltipTop,
          left: tooltipLeft,
          width: tooltipWidth,
          zIndex: 10001,
          pointerEvents: 'all',
        });
      }
    }
  }, [target, position]);

  return (
    <>
      {/* Highlight overlay */}
      <div style={overlayStyle} />

      {/* Tooltip */}
      <div style={tooltipStyle}>
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {step.title}
              </h3>
              <Badge type="neutral" className="mt-1">
                Step {currentStepIndex + 1} of {totalSteps}
              </Badge>
            </div>
            <Button size="small" onClick={onSkip} title="Close tutorial">
              ✕
            </Button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              {step.content}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <Button
              size="small"
              disabled={currentStepIndex === 0}
              onClick={onPrevious}
            >
              Previous
            </Button>

            <div className="flex space-x-2">
              {step.optional && (
                <Button size="small" onClick={onNext}>
                  Skip
                </Button>
              )}
              <Button size="small" isPrimary onClick={onNext}>
                {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  tutorial,
  isVisible,
  onClose,
  onComplete,
  autoStart = false,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible && autoStart) {
      startTutorial();
    }
  }, [isVisible, autoStart]);

  useEffect(() => {
    // Add tutorial styles to document
    const style = document.createElement('style');
    style.textContent = `
      @keyframes tutorialPulse {
        0% { box-shadow: 0 0 0 0 rgba(31, 115, 183, 0.7), 0 0 0 9999px rgba(0, 0, 0, 0.5); }
        70% { box-shadow: 0 0 0 10px rgba(31, 115, 183, 0), 0 0 0 9999px rgba(0, 0, 0, 0.5); }
        100% { box-shadow: 0 0 0 0 rgba(31, 115, 183, 0), 0 0 0 9999px rgba(0, 0, 0, 0.5); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startTutorial = (): void => {
    setShowIntro(false);
    setIsActive(true);
    setCurrentStepIndex(0);
    setCompletedSteps([]);
  };

  const nextStep = (): void => {
    const currentStep = tutorial.steps[currentStepIndex];

    // Mark step as completed
    setCompletedSteps(prev => [...prev, currentStep.id]);

    if (currentStepIndex < tutorial.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      completeTutorial(true);
    }
  };

  const previousStep = (): void => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const skipTutorial = (): void => {
    completeTutorial(false);
  };

  const completeTutorial = (completed: boolean): void => {
    setIsActive(false);
    setShowIntro(true);
    onComplete(tutorial.id, completed);
    onClose();
  };

  const handleStepAction = (): void => {
    const currentStep = tutorial.steps[currentStepIndex];

    if (currentStep.action === 'wait' && currentStep.duration) {
      // Auto-advance after duration
      setTimeout(() => {
        nextStep();
      }, currentStep.duration);
    } else if (currentStep.validation) {
      // Check if validation passes
      if (currentStep.validation()) {
        nextStep();
      }
    } else {
      // Manual advancement
      nextStep();
    }
  };

  useEffect(() => {
    if (isActive) {
      const currentStep = tutorial.steps[currentStepIndex];
      if (currentStep.action === 'wait' && currentStep.duration) {
        intervalRef.current = setTimeout(() => {
          nextStep();
        }, currentStep.duration);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentStepIndex, isActive]);

  if (!isVisible) {
    return null;
  }

  const currentStep = tutorial.steps[currentStepIndex];
  const progressPercentage =
    ((currentStepIndex + 1) / tutorial.steps.length) * 100;

  return (
    <>
      {/* Introduction Modal */}
      {showIntro && (
        <Modal isOpen={true} onClose={onClose}>
          <Header>
            <h2>{tutorial.title}</h2>
            <Close aria-label="Close tutorial" />
          </Header>
          <Body>
            <div className="space-y-4">
              <p className="text-gray-700">{tutorial.description}</p>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  What you'll learn:
                </h3>
                <ul className="space-y-1 text-sm text-blue-800">
                  {tutorial.steps.slice(0, 3).map((step, index) => (
                    <li key={step.id}>• {step.title}</li>
                  ))}
                  {tutorial.steps.length > 3 && (
                    <li>• And {tutorial.steps.length - 3} more steps...</li>
                  )}
                </ul>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  ⏱️ Estimated time: {tutorial.estimatedDuration} minutes
                </span>
                <Badge type="neutral">{tutorial.category}</Badge>
              </div>

              {tutorial.prerequisites && tutorial.prerequisites.length > 0 && (
                <Alert type="warning">
                  <strong>Prerequisites:</strong> Make sure you have completed:{' '}
                  {tutorial.prerequisites.join(', ')}
                </Alert>
              )}
            </div>
          </Body>
          <Footer>
            <Button onClick={onClose}>Not Now</Button>
            <Button isPrimary onClick={startTutorial}>
              Start Tutorial
            </Button>
          </Footer>
        </Modal>
      )}

      {/* Progress indicator */}
      {isActive && (
        <div className="fixed top-4 right-4 z-[9999] bg-white rounded-lg shadow-lg p-3 border">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium">Tutorial Progress</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2 w-32">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {currentStepIndex + 1}/{tutorial.steps.length}
            </span>
            <Button size="small" onClick={skipTutorial} title="Exit tutorial">
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Interactive overlay */}
      {isActive && currentStep && (
        <HighlightOverlay
          target={currentStep.target || ''}
          position={currentStep.position || 'bottom'}
          step={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={tutorial.steps.length}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skipTutorial}
        />
      )}
    </>
  );
};

export default InteractiveTutorial;
