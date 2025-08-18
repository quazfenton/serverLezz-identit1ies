import React, { useState } from 'react';

export type RecommendationRowProps = {
  id: string;
  name: string;
  score: number; // 0-1
  reason?: string;
  onConnect?: (id: string) => void;
};

const RecommendationRow: React.FC<RecommendationRowProps> = ({
  id,
  name,
  score,
  reason,
  onConnect,
}) => {
  const [showReason, setShowReason] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent Match';
    if (score >= 0.6) return 'Good Match';
    if (score >= 0.4) return 'Fair Match';
    return 'Weak Match';
  };

  return (
    <div className="recommendation-row bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{name}</h4>
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
                {getScoreLabel(score)}
              </span>
              <span className="text-xs text-gray-500">
                {(score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {reason && (
            <button
              onClick={() => setShowReason(!showReason)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="View match details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          
          {onConnect && (
            <button 
              onClick={() => onConnect(id)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {reason && showReason && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <p className="text-sm text-blue-800 font-medium mb-1">Why this match?</p>
              <p className="text-sm text-blue-700">{reason}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationRow;


