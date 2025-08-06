/**
 * Suggestion Card Component
 * Individual card displaying an AI response suggestion with actions
 */

import React, { useState } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import { ResponseSuggestion } from '../../types';

interface SuggestionCardProps {
  suggestion: ResponseSuggestion;
  onApply: () => void;
  onFeedback: (rating: number, helpful: boolean) => void;
  disabled?: boolean;
  isApplied?: boolean;
  feedbackGiven?: { rating: number; helpful: boolean };
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onApply,
  onFeedback,
  disabled = false,
  isApplied = false,
  feedbackGiven,
}) => {
  const [showFeedback, setShowFeedback] = useState(false);

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'template': return '📄';
      case 'generated': return '🤖';
      case 'macro': return '⚡';
      default: return '💡';
    }
  };

  const getToneColor = (tone: string): string => {
    switch (tone) {
      case 'professional': return '#1f73b7';
      case 'friendly': return '#228f67';
      case 'empathetic': return '#cc8400';
      case 'formal': return '#68737d';
      default: return '#2f3941';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#228f67';
    if (confidence >= 0.6) return '#cc8400';
    return '#d93954';
  };

  const handleFeedback = (rating: number, helpful: boolean) => {
    onFeedback(rating, helpful);
    setShowFeedback(false);
  };

  const truncateContent = (content: string, maxLength: number = 200): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className={`suggestion-card ${isApplied ? 'applied' : ''} ${disabled ? 'disabled' : ''}`}>
      {/* Header */}
      <div className="suggestion-header">
        <div className="suggestion-meta">
          <span className="category-badge">
            <span className="category-icon">{getCategoryIcon(suggestion.category)}</span>
            <span className="category-text">{suggestion.category}</span>
          </span>
          <span 
            className="tone-badge"
            style={{ backgroundColor: getToneColor(suggestion.tone) }}
          >
            {suggestion.tone}
          </span>
        </div>
        <div className="confidence-indicator">
          <div 
            className="confidence-bar"
            style={{ backgroundColor: getConfidenceColor(suggestion.confidence) }}
          >
            <div 
              className="confidence-fill"
              style={{ width: `${suggestion.confidence * 100}%` }}
            />
          </div>
          <span className="confidence-text">
            {Math.round(suggestion.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="suggestion-content">
        <p className="suggestion-text">
          {truncateContent(suggestion.content)}
        </p>
        
        {suggestion.reasoning && (
          <div className="suggestion-reasoning">
            <span className="reasoning-icon">🧠</span>
            <span className="reasoning-text">{suggestion.reasoning}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {suggestion.tags && suggestion.tags.length > 0 && (
        <div className="suggestion-tags">
          {suggestion.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="tag">
              {tag}
            </span>
          ))}
          {suggestion.tags.length > 3 && (
            <span className="tag more">+{suggestion.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="suggestion-actions">
        <div className="primary-actions">
          <Button
            isPrimary
            size="small"
            onClick={onApply}
            disabled={disabled}
          >
            <span className="btn-icon">📝</span>
            {isApplied ? 'Applied' : 'Use This'}
          </Button>
          
          {suggestion.macroId && (
            <Button
              size="small"
              onClick={onApply}
              disabled={disabled}
            >
              <span className="btn-icon">⚡</span>
              Apply Macro
            </Button>
          )}
        </div>

        <div className="secondary-actions">
          {!feedbackGiven && !isApplied && (
            <Button
              size="small"
              onClick={() => setShowFeedback(!showFeedback)}
              disabled={disabled}
            >
              <span className="btn-icon">👍</span>
              Feedback
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Section */}
      {showFeedback && !feedbackGiven && (
        <div className="feedback-section">
          <div className="feedback-header">
            <span>How helpful is this suggestion?</span>
          </div>
          <div className="feedback-options">
            <div className="rating-buttons">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className="rating-btn"
                  onClick={() => handleFeedback(rating, rating >= 4)}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div className="quick-feedback">
              <button
                className="feedback-btn helpful"
                onClick={() => handleFeedback(5, true)}
              >
                👍 Helpful
              </button>
              <button
                className="feedback-btn not-helpful"
                onClick={() => handleFeedback(2, false)}
              >
                👎 Not Helpful
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Given */}
      {feedbackGiven && (
        <div className="feedback-given">
          <span className="feedback-icon">
            {feedbackGiven.helpful ? '👍' : '👎'}
          </span>
          <span className="feedback-text">
            Thank you for your feedback!
          </span>
        </div>
      )}

      {/* Satisfaction Estimate */}
      {suggestion.estimatedSatisfaction && (
        <div className="satisfaction-estimate">
          <div className="satisfaction-label">
            Estimated customer satisfaction:
          </div>
          <div className="satisfaction-bar">
            <div 
              className="satisfaction-fill"
              style={{ width: `${suggestion.estimatedSatisfaction * 100}%` }}
            />
          </div>
          <div className="satisfaction-percentage">
            {Math.round(suggestion.estimatedSatisfaction * 100)}%
          </div>
        </div>
      )}

      {/* Applied Indicator */}
      {isApplied && (
        <div className="applied-indicator">
          <span className="applied-icon">✅</span>
          <span className="applied-text">Applied to response</span>
        </div>
      )}
    </div>
  );
};

export default SuggestionCard;