/**
 * Response Suggestions Panel
 * Shows AI-generated response suggestions with one-click insertion
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { Button } from '@zendeskgarden/react-buttons';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  setSuggestions,
  applySuggestion,
  provideFeedback,
  setLoading,
  setError,
} from '../../store/slices/suggestions-slice';
import {
  GET_RESPONSE_SUGGESTIONS,
  GENERATE_SUGGESTIONS,
  SUBMIT_SUGGESTION_FEEDBACK,
  SUGGESTIONS_GENERATED_SUBSCRIPTION,
} from '../../services/graphql-queries';
import {
  insertTextIntoComment,
  showNotification,
} from '../../services/zendesk-auth';
import { ZendeskTicket, ResponseSuggestion } from '../../types';
import SuggestionCard from '../common/SuggestionCard';
import LoadingSpinner from '../common/LoadingSpinner';

interface SuggestionsPanelProps {
  conversationId: string | null;
  ticket: ZendeskTicket;
}

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  conversationId,
  ticket,
}) => {
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [appliedSuggestionId, setAppliedSuggestionId] = useState<string | null>(
    null
  );

  // Get suggestions from store
  const suggestions = useAppSelector(state => state.suggestions.suggestions);
  const loading = useAppSelector(state => state.suggestions.loading);
  const error = useAppSelector(state => state.suggestions.error);
  const appliedSuggestions = useAppSelector(
    state => state.suggestions.appliedSuggestions
  );
  const feedbackGiven = useAppSelector(
    state => state.suggestions.feedbackGiven
  );

  // Query existing suggestions
  const {
    data: suggestionsData,
    loading: queryLoading,
    refetch,
  } = useQuery(GET_RESPONSE_SUGGESTIONS, {
    variables: { conversationId: conversationId || '' },
    skip: !conversationId,
    fetchPolicy: 'cache-and-network',
    onCompleted: data => {
      if (data?.suggestions) {
        dispatch(setSuggestions(data.suggestions));
      }
    },
    onError: error => {
      dispatch(setError(error.message));
    },
  });

  // Mutation to generate new suggestions
  const [generateSuggestions] = useMutation(GENERATE_SUGGESTIONS, {
    onCompleted: data => {
      if (data?.suggestions) {
        dispatch(setSuggestions(data.suggestions));
        showNotification('New suggestions generated!', 'notice');
      }
      setRefreshing(false);
    },
    onError: error => {
      dispatch(setError(error.message));
      showNotification('Failed to generate suggestions', 'error');
      setRefreshing(false);
    },
  });

  // Mutation to submit feedback
  const [submitFeedback] = useMutation(SUBMIT_SUGGESTION_FEEDBACK, {
    onError: error => {
      console.error('Failed to submit feedback:', error);
    },
  });

  // Subscribe to real-time suggestion updates
  useSubscription(SUGGESTIONS_GENERATED_SUBSCRIPTION, {
    variables: { conversationId: conversationId || '' },
    skip: !conversationId,
    onData: ({ data }) => {
      if (data?.data?.responseSuggested?.suggestions) {
        dispatch(setSuggestions(data.data.responseSuggested.suggestions));
        showNotification('New AI suggestions available!', 'notice');
      }
    },
  });

  useEffect(() => {
    dispatch(setLoading(queryLoading));
  }, [queryLoading, dispatch]);

  const handleRefreshSuggestions = () => {
    if (!conversationId) return;

    setRefreshing(true);
    generateSuggestions({
      variables: {
        conversationId,
        preferences: {
          tone: 'professional',
          includeTemplates: true,
          includeMacros: true,
        },
      },
    });
  };

  const handleApplySuggestion = async (suggestion: ResponseSuggestion) => {
    try {
      setAppliedSuggestionId(suggestion.id);

      // Insert text into Zendesk comment box
      insertTextIntoComment(suggestion.content);

      // Track as applied
      dispatch(applySuggestion(suggestion.id));

      // Auto-submit positive feedback for applied suggestions
      dispatch(
        provideFeedback({
          id: suggestion.id,
          rating: 4,
          helpful: true,
        })
      );

      // Submit feedback to backend
      await submitFeedback({
        variables: {
          suggestionId: suggestion.id,
          feedback: {
            rating: 4,
            used: true,
            helpful: true,
            agentId: 'current-agent', // Would get from auth context
          },
        },
      });

      showNotification('Response suggestion applied!', 'notice');
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
      showNotification('Failed to apply suggestion', 'error');
    } finally {
      setAppliedSuggestionId(null);
    }
  };

  const handleProvideFeedback = async (
    suggestionId: string,
    rating: number,
    helpful: boolean
  ) => {
    dispatch(provideFeedback({ id: suggestionId, rating, helpful }));

    try {
      await submitFeedback({
        variables: {
          suggestionId,
          feedback: {
            rating,
            used: appliedSuggestions.includes(suggestionId),
            helpful,
            agentId: 'current-agent',
          },
        },
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  if (loading && suggestions.length === 0) {
    return (
      <div className="suggestions-panel">
        <LoadingSpinner message="Generating AI suggestions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="suggestions-panel">
        <div className="suggestions-error">
          <div className="error-icon">⚠️</div>
          <h4>Unable to load suggestions</h4>
          <p>{error}</p>
          <Button onClick={handleRefreshSuggestions}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="suggestions-panel">
      {/* Header */}
      <div className="suggestions-header">
        <div className="header-content">
          <h4>AI Response Suggestions</h4>
          <div className="suggestions-meta">
            {suggestions.length > 0 && (
              <span className="suggestions-count">
                {suggestions.length} suggestions
              </span>
            )}
          </div>
        </div>
        <div className="suggestions-controls">
          <Button
            size="small"
            onClick={handleRefreshSuggestions}
            disabled={refreshing || !conversationId}
          >
            <span className="btn-icon">🔄</span>
            {refreshing ? 'Generating...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="suggestions-container">
        {suggestions.length === 0 ? (
          <div className="suggestions-empty">
            <div className="empty-icon">💡</div>
            <h4>No suggestions available</h4>
            <p>
              AI suggestions will appear here when conversation analysis is
              complete.
            </p>
            <Button
              isPrimary
              onClick={handleRefreshSuggestions}
              disabled={refreshing || !conversationId}
            >
              Generate Suggestions
            </Button>
          </div>
        ) : (
          <div className="suggestions-list">
            {suggestions
              .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
              .map(suggestion => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={() => handleApplySuggestion(suggestion)}
                  onFeedback={(rating, helpful) =>
                    handleProvideFeedback(suggestion.id, rating, helpful)
                  }
                  disabled={appliedSuggestionId === suggestion.id}
                  isApplied={appliedSuggestions.includes(suggestion.id)}
                  feedbackGiven={feedbackGiven[suggestion.id]}
                />
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="suggestions-footer">
        <div className="confidence-note">
          <span className="note-icon">💡</span>
          <span className="note-text">
            Suggestions are AI-generated and should be reviewed before sending
          </span>
        </div>

        {suggestions.length > 0 && (
          <div className="suggestion-stats">
            <div className="stat-item">
              <span className="stat-value">
                {Math.round(
                  (suggestions.reduce((sum, s) => sum + s.confidence, 0) /
                    suggestions.length) *
                    100
                )}
                %
              </span>
              <span className="stat-label">Avg Confidence</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{appliedSuggestions.length}</span>
              <span className="stat-label">Used</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionsPanel;
