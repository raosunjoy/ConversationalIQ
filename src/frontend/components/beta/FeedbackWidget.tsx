/**
 * Beta Feedback Widget Component
 * Allows beta users to submit feedback directly from the application
 */

import React, { useState } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import { Field, Label, Textarea, Select } from '@zendeskgarden/react-forms';
import {
  Modal,
  Header,
  Body,
  Footer,
  Close,
} from '@zendeskgarden/react-modals';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert, Paragraph } from '@zendeskgarden/react-notifications';

interface FeedbackData {
  type:
    | 'feature_request'
    | 'bug_report'
    | 'general_feedback'
    | 'satisfaction_score';
  content: string;
  rating?: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  featureContext?: string;
}

interface FeedbackWidgetProps {
  userId: string;
  isVisible?: boolean;
  onClose?: () => void;
  context?: string; // Current page/feature context
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  userId,
  isVisible = false,
  onClose,
  context,
}) => {
  const [isOpen, setIsOpen] = useState(isVisible);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData>({
    type: 'general_feedback',
    content: '',
    urgency: 'medium',
    featureContext: context,
  });

  const handleClose = (): void => {
    setIsOpen(false);
    setSubmitted(false);
    setFeedback({
      type: 'general_feedback',
      content: '',
      urgency: 'medium',
      featureContext: context,
    });
    if (onClose) onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    if (!feedback.content.trim()) return;

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/beta-program/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...feedback,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      // Handle error state
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFeedback = (updates: Partial<FeedbackData>): void => {
    setFeedback(prev => ({ ...prev, ...updates }));
  };

  const renderStarRating = (): React.ReactElement => {
    const rating = feedback.rating || 0;
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            className={`text-2xl ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            } hover:text-yellow-400 transition-colors`}
            onClick={() => updateFeedback({ rating: star })}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <Header>
          <h2>Thank You!</h2>
          <Close aria-label="Close modal" />
        </Header>
        <Body>
          <Alert type="success">
            <Paragraph>
              Your feedback has been submitted successfully. We appreciate your
              input in making ConversationIQ better!
            </Paragraph>
          </Alert>
        </Body>
        <Footer>
          <Button isPrimary onClick={handleClose}>
            Close
          </Button>
        </Footer>
      </Modal>
    );
  }

  return (
    <>
      {/* Floating feedback button */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 shadow-lg"
            title="Send Feedback"
          >
            💬
          </Button>
        </div>
      )}

      {/* Feedback Modal */}
      <Modal isOpen={isOpen} onClose={handleClose}>
        <Header>
          <h2>Beta Feedback</h2>
          <Close aria-label="Close modal" />
        </Header>
        <Body>
          <div className="space-y-4">
            {/* Context Information */}
            {context && (
              <Alert type="info">
                <Paragraph className="text-sm">
                  Providing feedback for: <strong>{context}</strong>
                </Paragraph>
              </Alert>
            )}

            {/* Feedback Type */}
            <Field>
              <Label>Type of Feedback</Label>
              <Select
                value={feedback.type}
                onChange={e =>
                  updateFeedback({
                    type: e.target.value as FeedbackData['type'],
                  })
                }
              >
                <option value="feature_request">Feature Request</option>
                <option value="bug_report">Bug Report</option>
                <option value="general_feedback">General Feedback</option>
                <option value="satisfaction_score">Satisfaction Rating</option>
              </Select>
            </Field>

            {/* Satisfaction Rating */}
            {feedback.type === 'satisfaction_score' && (
              <Field>
                <Label>How satisfied are you with this feature?</Label>
                <div className="mt-2">
                  {renderStarRating()}
                  <p className="text-sm text-gray-600 mt-1">
                    Click stars to rate (1 = Poor, 5 = Excellent)
                  </p>
                </div>
              </Field>
            )}

            {/* Urgency Level */}
            <Field>
              <Label>Urgency Level</Label>
              <Select
                value={feedback.urgency}
                onChange={e =>
                  updateFeedback({
                    urgency: e.target.value as FeedbackData['urgency'],
                  })
                }
              >
                <option value="low">Low - General improvement</option>
                <option value="medium">Medium - Would be helpful</option>
                <option value="high">High - Impacts my workflow</option>
                <option value="critical">Critical - Blocking my work</option>
              </Select>
            </Field>

            {/* Feedback Content */}
            <Field>
              <Label>
                {feedback.type === 'feature_request' &&
                  "Describe the feature you'd like to see"}
                {feedback.type === 'bug_report' &&
                  'Describe the issue you encountered'}
                {feedback.type === 'general_feedback' && 'Share your thoughts'}
                {feedback.type === 'satisfaction_score' &&
                  'What could we improve?'}
              </Label>
              <Textarea
                value={feedback.content}
                onChange={e => updateFeedback({ content: e.target.value })}
                placeholder={
                  feedback.type === 'feature_request'
                    ? 'I would love to see...'
                    : feedback.type === 'bug_report'
                      ? 'Steps to reproduce: 1. ...'
                      : feedback.type === 'satisfaction_score'
                        ? 'This could be better if...'
                        : 'I think that...'
                }
                rows={4}
                className="resize-none"
              />
              <div className="text-xs text-gray-500 mt-1">
                {feedback.content.length}/2000 characters
              </div>
            </Field>

            {/* Quick Feedback Templates */}
            <div>
              <Label>Quick Templates (click to use)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {feedback.type === 'feature_request' && (
                  <>
                    <Badge
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() =>
                        updateFeedback({
                          content:
                            'I would like to export conversation analytics to CSV format.',
                        })
                      }
                    >
                      Export feature
                    </Badge>
                    <Badge
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() =>
                        updateFeedback({
                          content:
                            'Add support for custom sentiment analysis rules based on our industry terminology.',
                        })
                      }
                    >
                      Custom rules
                    </Badge>
                  </>
                )}
                {feedback.type === 'bug_report' && (
                  <>
                    <Badge
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() =>
                        updateFeedback({
                          content:
                            'The page loads slowly when viewing conversation history.',
                        })
                      }
                    >
                      Performance issue
                    </Badge>
                    <Badge
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() =>
                        updateFeedback({
                          content:
                            'The sentiment indicator shows incorrect results for certain messages.',
                        })
                      }
                    >
                      Display issue
                    </Badge>
                  </>
                )}
                {feedback.type === 'general_feedback' && (
                  <>
                    <Badge
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() =>
                        updateFeedback({
                          content:
                            'The interface is intuitive and easy to use.',
                        })
                      }
                    >
                      Praise UI
                    </Badge>
                    <Badge
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() =>
                        updateFeedback({
                          content:
                            'This feature saves me a lot of time during customer interactions.',
                        })
                      }
                    >
                      Time saver
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </Body>
        <Footer>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            isPrimary
            onClick={handleSubmit}
            disabled={!feedback.content.trim() || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </Footer>
      </Modal>
    </>
  );
};

// Quick feedback hook for easy integration
export const useBetaFeedback = (userId: string, context?: string) => {
  const [isVisible, setIsVisible] = useState(false);

  const showFeedback = (): void => setIsVisible(true);
  const hideFeedback = (): void => setIsVisible(false);

  const FeedbackComponent = (): React.ReactElement => (
    <FeedbackWidget
      userId={userId}
      isVisible={isVisible}
      onClose={hideFeedback}
      context={context}
    />
  );

  return {
    showFeedback,
    hideFeedback,
    FeedbackComponent,
  };
};

export default FeedbackWidget;
