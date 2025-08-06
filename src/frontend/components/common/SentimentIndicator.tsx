/**
 * Sentiment Indicator Component
 * Visual representation of sentiment analysis results
 */

import React from 'react';
import { SentimentAnalysis } from '../../types';

interface SentimentIndicatorProps {
  sentiment: SentimentAnalysis | null;
  showTrend?: boolean;
  size?: 'small' | 'medium' | 'large';
  compact?: boolean;
}

const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({ 
  sentiment, 
  showTrend = false, 
  size = 'medium',
  compact = false 
}) => {
  if (!sentiment) {
    return (
      <div className={`sentiment-indicator ${size} empty`}>
        <div className="score-value">--</div>
        <div className="score-label">No Data</div>
      </div>
    );
  }

  const getSentimentColor = (score: number): string => {
    if (score > 0.2) return 'positive';
    if (score < -0.2) return 'negative';
    return 'neutral';
  };

  const getSentimentIcon = (label: string): string => {
    switch (label) {
      case 'POSITIVE': return '😊';
      case 'NEGATIVE': return '😟';
      default: return '😐';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '↗️';
      case 'declining': return '↘️';
      default: return '→';
    }
  };

  const formatScore = (score: number): string => {
    return (score > 0 ? '+' : '') + score.toFixed(2);
  };

  const getScorePercentage = (score: number): number => {
    // Convert -1 to 1 scale to 0 to 100 percentage
    return ((score + 1) / 2) * 100;
  };

  const sentimentColor = getSentimentColor(sentiment.score);
  const scorePercentage = getScorePercentage(sentiment.score);

  if (compact) {
    return (
      <div className={`sentiment-indicator compact ${sentimentColor}`}>
        <span className="sentiment-icon">{getSentimentIcon(sentiment.label)}</span>
        <span className="sentiment-score">{formatScore(sentiment.score)}</span>
        {showTrend && (
          <span className="trend-icon">{getTrendIcon(sentiment.trend)}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`sentiment-indicator ${size} ${sentimentColor}`}>
      <div className="sentiment-display">
        <div className="sentiment-icon-large">
          {getSentimentIcon(sentiment.label)}
        </div>
        <div className="sentiment-details">
          <div className="score-value">
            {formatScore(sentiment.score)}
          </div>
          <div className="score-label">
            {sentiment.label.charAt(0) + sentiment.label.slice(1).toLowerCase()}
          </div>
          <div className="confidence-value">
            {Math.round(sentiment.confidence * 100)}% confident
          </div>
        </div>
        {showTrend && (
          <div className="trend-indicator">
            <span className="trend-icon">{getTrendIcon(sentiment.trend)}</span>
            <span className="trend-label">{sentiment.trend}</span>
          </div>
        )}
      </div>

      {/* Visual sentiment bar */}
      <div className="sentiment-bar-container">
        <div className="sentiment-bar">
          <div 
            className={`sentiment-fill ${sentimentColor}`}
            style={{ width: `${scorePercentage}%` }}
          />
          <div className="sentiment-marker" style={{ left: '50%' }} />
        </div>
        <div className="sentiment-scale">
          <span>Negative</span>
          <span>Neutral</span>
          <span>Positive</span>
        </div>
      </div>

      {/* Emotions breakdown */}
      {sentiment.emotions && sentiment.emotions.length > 0 && (
        <div className="emotions-breakdown">
          <div className="emotions-label">Detected Emotions:</div>
          <div className="emotions-list">
            {sentiment.emotions.slice(0, 3).map((emotion, index) => (
              <span key={index} className="emotion-tag">
                {emotion.emotion} ({Math.round(emotion.confidence * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentIndicator;