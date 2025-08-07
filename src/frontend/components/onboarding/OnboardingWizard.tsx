/**
 * Onboarding Wizard Component
 * Interactive step-by-step onboarding experience for new users
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Progress } from '@zendeskgarden/react-loaders';
import { Modal, Header, Body, Footer, FooterItem } from '@zendeskgarden/react-modals';
import { Field, Input, Label, Textarea } from '@zendeskgarden/react-forms';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'action' | 'verification' | 'setup' | 'tutorial';
  order: number;
  isRequired: boolean;
  estimatedTime: number;
  content: {
    instructions?: string;
    videoUrl?: string;
    documentationUrl?: string;
    checklistItems?: string[];
    actionRequired?: {
      type: string;
      endpoint?: string;
      parameters?: any;
    };
  };
  completionCriteria: {
    type: 'manual' | 'automatic' | 'api_verification';
    verificationEndpoint?: string;
  };
}

interface OnboardingJourney {
  id: string;
  name: string;
  description: string;
  steps: OnboardingStep[];
  estimatedDuration: number;
}

interface OnboardingSession {
  id: string;
  journeyId: string;
  status: 'in_progress' | 'completed' | 'paused';
  currentStepId?: string;
  progress: {
    stepsCompleted: string[];
    stepsSkipped: string[];
    overallProgress: number;
  };
}

interface OnboardingWizardProps {
  sessionId?: string;
  journeyId?: string;
  onComplete?: () => void;
  onClose?: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  sessionId,
  journeyId,
  onComplete,
  onClose
}) => {
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [journey, setJourney] = useState<OnboardingJourney | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpMessage, setHelpMessage] = useState('');
  const [stepData, setStepData] = useState<any>({});

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else if (journeyId) {
      startNewJourney(journeyId);
    }
  }, [sessionId, journeyId]);

  const loadSession = async (sessionId: string): Promise<void> => {
    try {
      setLoading(true);
      
      const [sessionData, journeyData] = await Promise.all([
        fetchOnboardingSession(sessionId),
        fetchJourneyForSession(sessionId)
      ]);

      setSession(sessionData);
      setJourney(journeyData);

      if (sessionData.currentStepId && journeyData) {
        const step = journeyData.steps.find(s => s.id === sessionData.currentStepId);
        setCurrentStep(step || journeyData.steps[0]);
      }
    } catch (error) {
      console.error('Failed to load onboarding session:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewJourney = async (journeyId: string): Promise<void> => {
    try {
      setLoading(true);
      
      const sessionId = await createOnboardingSession(journeyId);
      await loadSession(sessionId);
    } catch (error) {
      console.error('Failed to start onboarding journey:', error);
      setLoading(false);
    }
  };

  const fetchOnboardingSession = async (sessionId: string): Promise<OnboardingSession> => {
    // Simulate API call
    return {
      id: sessionId,
      journeyId: 'admin_setup',
      status: 'in_progress',
      currentStepId: 'welcome',
      progress: {
        stepsCompleted: [],
        stepsSkipped: [],
        overallProgress: 0
      }
    };
  };

  const fetchJourneyForSession = async (sessionId: string): Promise<OnboardingJourney> => {
    // Simulate API call
    return {
      id: 'admin_setup',
      name: 'Administrator Setup',
      description: 'Complete setup guide for ConversationIQ administrators',
      estimatedDuration: 45,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to ConversationIQ',
          description: 'Get introduced to the platform and its capabilities',
          type: 'info',
          order: 1,
          isRequired: true,
          estimatedTime: 5,
          content: {
            instructions: 'Welcome to ConversationIQ! This onboarding will help you set up your account and get the most value from our AI-powered conversation intelligence platform.',
            videoUrl: 'https://assets.conversationiq.com/videos/welcome-intro.mp4',
            checklistItems: [
              'Understand ConversationIQ\'s core capabilities',
              'Learn about sentiment analysis and response suggestions',
              'Review the dashboard overview'
            ]
          },
          completionCriteria: {
            type: 'manual'
          }
        },
        {
          id: 'zendesk_integration',
          title: 'Connect Zendesk Integration',
          description: 'Establish secure connection between ConversationIQ and your Zendesk instance',
          type: 'setup',
          order: 2,
          isRequired: true,
          estimatedTime: 10,
          content: {
            instructions: 'Connect your Zendesk account to enable real-time conversation analysis and response suggestions.',
            documentationUrl: 'https://docs.conversationiq.com/integrations/zendesk',
            actionRequired: {
              type: 'integration',
              endpoint: '/api/integrations/zendesk/connect',
              parameters: {
                subdomain: 'user_input',
                permissions: ['read:tickets', 'read:users', 'write:ticket_comments']
              }
            }
          },
          completionCriteria: {
            type: 'api_verification',
            verificationEndpoint: '/api/integrations/zendesk/status'
          }
        },
        {
          id: 'team_setup',
          title: 'Set Up Your Team',
          description: 'Invite team members and configure roles',
          type: 'setup',
          order: 3,
          isRequired: true,
          estimatedTime: 15,
          content: {
            instructions: 'Add your team members to ConversationIQ and assign appropriate roles.',
            checklistItems: [
              'Invite agents who will use ConversationIQ',
              'Assign manager roles to team leads',
              'Configure notification preferences',
              'Set up agent groups if needed'
            ]
          },
          completionCriteria: {
            type: 'api_verification',
            verificationEndpoint: '/api/organizations/team/status'
          }
        },
        {
          id: 'first_conversation',
          title: 'Process Your First Conversation',
          description: 'See ConversationIQ in action with a real conversation',
          type: 'verification',
          order: 4,
          isRequired: true,
          estimatedTime: 5,
          content: {
            instructions: 'Open a ticket in Zendesk and see how ConversationIQ provides real-time insights and suggestions.',
            videoUrl: 'https://assets.conversationiq.com/videos/first-conversation.mp4'
          },
          completionCriteria: {
            type: 'api_verification',
            verificationEndpoint: '/api/conversations/processed/count'
          }
        },
        {
          id: 'success_celebration',
          title: 'Setup Complete!',
          description: 'Congratulations on completing your ConversationIQ setup',
          type: 'info',
          order: 5,
          isRequired: false,
          estimatedTime: 2,
          content: {
            instructions: 'Your ConversationIQ setup is complete! Your team can now benefit from AI-powered conversation insights.',
            checklistItems: [
              'Share setup completion with your team',
              'Schedule regular analytics reviews',
              'Explore advanced features when ready',
              'Contact support if you need assistance'
            ]
          },
          completionCriteria: {
            type: 'manual'
          }
        }
      ]
    };
  };

  const createOnboardingSession = async (journeyId: string): Promise<string> => {
    // Simulate API call
    return 'session_12345';
  };

  const completeCurrentStep = async (): Promise<void> => {
    if (!session || !currentStep || !journey) return;

    try {
      setProcessing(true);

      // Handle different step types
      if (currentStep.type === 'setup' && currentStep.content.actionRequired) {
        await executeStepAction(currentStep);
      }

      const result = await completeStep(session.id, currentStep.id);
      
      // Update session state
      const updatedSession = {
        ...session,
        progress: {
          ...session.progress,
          stepsCompleted: [...session.progress.stepsCompleted, currentStep.id],
          overallProgress: ((session.progress.stepsCompleted.length + 1) / journey.steps.length) * 100
        }
      };
      setSession(updatedSession);

      if (result.journeyCompleted) {
        onComplete?.();
      } else if (result.nextStepId) {
        const nextStep = journey.steps.find(s => s.id === result.nextStepId);
        setCurrentStep(nextStep || null);
        setStepData({});
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
      alert('Failed to complete step. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const executeStepAction = async (step: OnboardingStep): Promise<void> => {
    if (!step.content.actionRequired) return;

    const { type, endpoint, parameters } = step.content.actionRequired;

    switch (type) {
      case 'integration':
        if (step.id === 'zendesk_integration') {
          await connectZendeskIntegration(stepData);
        }
        break;
      case 'configuration':
        // Handle configuration actions
        break;
      default:
        console.warn('Unknown action type:', type);
    }
  };

  const connectZendeskIntegration = async (data: any): Promise<void> => {
    // Simulate Zendesk integration
    if (!data.subdomain) {
      throw new Error('Zendesk subdomain is required');
    }
    
    // Simulate API call to connect Zendesk
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const completeStep = async (sessionId: string, stepId: string): Promise<{ nextStepId?: string; journeyCompleted: boolean }> => {
    // Simulate API call
    const currentStepIndex = journey!.steps.findIndex(s => s.id === stepId);
    const nextStep = journey!.steps[currentStepIndex + 1];
    
    return {
      nextStepId: nextStep?.id,
      journeyCompleted: !nextStep
    };
  };

  const skipCurrentStep = async (): Promise<void> => {
    if (!session || !currentStep || !journey || currentStep.isRequired) return;

    try {
      setProcessing(true);
      
      await skipStep(session.id, currentStep.id);
      
      const currentStepIndex = journey.steps.findIndex(s => s.id === currentStep.id);
      const nextStep = journey.steps[currentStepIndex + 1];
      
      if (nextStep) {
        setCurrentStep(nextStep);
        setStepData({});
      }

      const updatedSession = {
        ...session,
        progress: {
          ...session.progress,
          stepsSkipped: [...session.progress.stepsSkipped, currentStep.id]
        }
      };
      setSession(updatedSession);
    } catch (error) {
      console.error('Failed to skip step:', error);
    } finally {
      setProcessing(false);
    }
  };

  const skipStep = async (sessionId: string, stepId: string): Promise<void> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const requestHelp = async (): Promise<void> => {
    if (!helpMessage.trim()) return;

    try {
      await submitHelpRequest(session!.id, currentStep!.id, helpMessage);
      setShowHelpModal(false);
      setHelpMessage('');
      alert('Help request submitted! Our support team will reach out to you shortly.');
    } catch (error) {
      console.error('Failed to submit help request:', error);
      alert('Failed to submit help request. Please try again.');
    }
  };

  const submitHelpRequest = async (sessionId: string, stepId: string, message: string): Promise<void> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const goToPreviousStep = (): void => {
    if (!journey || !currentStep) return;

    const currentIndex = journey.steps.findIndex(s => s.id === currentStep.id);
    if (currentIndex > 0) {
      setCurrentStep(journey.steps[currentIndex - 1]);
      setStepData({});
    }
  };

  const renderStepContent = (): React.ReactNode => {
    if (!currentStep) return null;

    switch (currentStep.type) {
      case 'info':
        return (
          <div className="space-y-6">
            {currentStep.content.instructions && (
              <p className="text-gray-700">{currentStep.content.instructions}</p>
            )}
            
            {currentStep.content.videoUrl && (
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">📹 Watch the introduction video</p>
                <a 
                  href={currentStep.content.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open Video Tutorial
                </a>
              </div>
            )}

            {currentStep.content.checklistItems && (
              <div>
                <p className="font-medium text-gray-900 mb-3">What you'll learn:</p>
                <ul className="space-y-2">
                  {currentStep.content.checklistItems.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'setup':
        return (
          <div className="space-y-6">
            <p className="text-gray-700">{currentStep.content.instructions}</p>

            {currentStep.id === 'zendesk_integration' && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Connect Your Zendesk Account</h4>
                <Field>
                  <Label>Zendesk Subdomain</Label>
                  <Input
                    placeholder="yourcompany"
                    value={stepData.subdomain || ''}
                    onChange={(e) => setStepData({ ...stepData, subdomain: e.target.value })}
                  />
                  <div className="text-sm text-gray-600 mt-1">
                    Enter your Zendesk subdomain (e.g., if your Zendesk URL is yourcompany.zendesk.com, enter "yourcompany")
                  </div>
                </Field>
              </div>
            )}

            {currentStep.content.checklistItems && (
              <div>
                <p className="font-medium text-gray-900 mb-3">Setup checklist:</p>
                <ul className="space-y-2">
                  {currentStep.content.checklistItems.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <input 
                        type="checkbox" 
                        className="mt-1 mr-3"
                        onChange={() => {}}
                      />
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentStep.content.documentationUrl && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  📖 Need more details? Check our{' '}
                  <a 
                    href={currentStep.content.documentationUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    documentation
                  </a>
                </p>
              </div>
            )}
          </div>
        );

      case 'verification':
        return (
          <div className="space-y-6">
            <p className="text-gray-700">{currentStep.content.instructions}</p>

            {currentStep.content.videoUrl && (
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">📹 Watch the walkthrough</p>
                <a 
                  href={currentStep.content.videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Demo Video
                </a>
              </div>
            )}

            <Alert type="info">
              We'll automatically detect when you've completed this step. Try processing a conversation in Zendesk to continue.
            </Alert>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <p className="text-gray-700">{currentStep.content.instructions}</p>
          </div>
        );
    }
  };

  const canCompleteCurrentStep = (): boolean => {
    if (!currentStep) return false;

    switch (currentStep.id) {
      case 'zendesk_integration':
        return !!stepData.subdomain?.trim();
      default:
        return true;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Progress size="large" />
          <p className="mt-4 text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (!session || !journey || !currentStep) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert type="error">
          Unable to load onboarding session. Please try again.
        </Alert>
      </div>
    );
  }

  const currentStepIndex = journey.steps.findIndex(s => s.id === currentStep.id);
  const progressPercentage = ((currentStepIndex + 1) / journey.steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{journey.name}</h1>
            <p className="text-gray-600">{journey.description}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">
              Step {currentStepIndex + 1} of {journey.steps.length}
            </p>
            <p className="text-xs text-gray-500">
              ~{currentStep.estimatedTime} min remaining
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Overall Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} />
        </div>

        {/* Step indicator */}
        <div className="flex items-center space-x-2 mb-6">
          {journey.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                session.progress.stepsCompleted.includes(step.id)
                  ? 'bg-green-500 text-white'
                  : step.id === currentStep.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {session.progress.stepsCompleted.includes(step.id) ? '✓' : index + 1}
              </div>
              {index < journey.steps.length - 1 && (
                <div className={`flex-1 h-0.5 ${
                  session.progress.stepsCompleted.includes(step.id) ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow border p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{currentStep.title}</h2>
              {currentStep.isRequired && (
                <Badge type="warning">Required</Badge>
              )}
              <Badge type="neutral">{currentStep.type}</Badge>
            </div>
            <p className="text-gray-600">{currentStep.description}</p>
          </div>
          <Button 
            size="small" 
            onClick={() => setShowHelpModal(true)}
            aria-label="Get help with this step"
          >
            Need Help?
          </Button>
        </div>

        {renderStepContent()}

        {/* Actions */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <div>
            {currentStepIndex > 0 && (
              <Button onClick={goToPreviousStep} disabled={processing}>
                Previous
              </Button>
            )}
          </div>

          <div className="flex space-x-3">
            {!currentStep.isRequired && (
              <Button onClick={skipCurrentStep} disabled={processing}>
                Skip
              </Button>
            )}
            <Button 
              isPrimary 
              onClick={completeCurrentStep}
              disabled={processing || !canCompleteCurrentStep()}
            >
              {processing ? 'Processing...' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>

      {/* Close button */}
      {onClose && (
        <div className="text-center mt-6">
          <Button onClick={onClose} size="small">
            Close Onboarding
          </Button>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <Modal onClose={() => setShowHelpModal(false)}>
          <Header>Get Help with: {currentStep.title}</Header>
          <Body>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Having trouble with this step? Describe what you need help with and our support team will assist you.
              </p>
              <Field>
                <Label>What do you need help with?</Label>
                <Textarea
                  rows={4}
                  value={helpMessage}
                  onChange={(e) => setHelpMessage(e.target.value)}
                  placeholder="Describe the issue you're experiencing..."
                />
              </Field>
            </div>
          </Body>
          <Footer>
            <FooterItem>
              <Button onClick={() => setShowHelpModal(false)}>
                Cancel
              </Button>
            </FooterItem>
            <FooterItem>
              <Button isPrimary onClick={requestHelp} disabled={!helpMessage.trim()}>
                Submit Help Request
              </Button>
            </FooterItem>
          </Footer>
        </Modal>
      )}
    </div>
  );
};

export default OnboardingWizard;