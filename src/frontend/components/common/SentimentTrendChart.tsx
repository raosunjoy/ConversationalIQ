/**
 * Sentiment Trend Chart Component
 * Shows sentiment changes over time
 */

import React from 'react';
import { SentimentAnalysis } from '../../types';

interface SentimentTrendChartProps {
  data: Array<{
    timestamp: Date;
    sentiment: SentimentAnalysis;
  }>;
  height?: number;
}

const SentimentTrendChart: React.FC<SentimentTrendChartProps> = ({
  data,
  height = 60,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="sentiment-trend-chart empty">
        <p>No trend data available</p>
      </div>
    );
  }

  const width = 200;
  const padding = 10;

  const minScore = Math.min(-1, Math.min(...data.map(d => d.sentiment.score)));
  const maxScore = Math.max(1, Math.max(...data.map(d => d.sentiment.score)));
  const scoreRange = maxScore - minScore;

  const getY = (score: number): number => {
    return (
      height -
      padding -
      ((score - minScore) / scoreRange) * (height - 2 * padding)
    );
  };

  const getX = (index: number): number => {
    return padding + (index / (data.length - 1)) * (width - 2 * padding);
  };

  const pathData = data
    .map((point, index) => {
      const x = getX(index);
      const y = getY(point.sentiment.score);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const getScoreColor = (score: number): string => {
    if (score > 0.2) return '#228f67';
    if (score < -0.2) return '#d93954';
    return '#cc8400';
  };

  return (
    <div className="sentiment-trend-chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background grid */}
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#e9ebed"
          strokeWidth="1"
          strokeDasharray="2,2"
        />

        {/* Trend line */}
        <path
          d={pathData}
          fill="none"
          stroke={getScoreColor(data[data.length - 1]?.sentiment.score || 0)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((point, index) => (
          <circle
            key={index}
            cx={getX(index)}
            cy={getY(point.sentiment.score)}
            r="3"
            fill={getScoreColor(point.sentiment.score)}
          />
        ))}
      </svg>

      <div className="chart-labels">
        <span className="chart-label start">
          {data[0].sentiment.score > 0 ? '+' : ''}
          {data[0].sentiment.score.toFixed(2)}
        </span>
        <span className="chart-label end">
          {data[data.length - 1].sentiment.score > 0 ? '+' : ''}
          {data[data.length - 1].sentiment.score.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export default SentimentTrendChart;
