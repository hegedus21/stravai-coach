
import React from 'react';
import { AIAnalysis } from '../types';

interface AnalysisViewProps {
  analysis: AIAnalysis | null;
  loading: boolean;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 animate-pulse font-medium">Coach Gemini is analyzing your performance...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-300 flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No Analysis Loaded</h3>
        <p className="text-gray-500 max-w-xs mx-auto mt-2">Select an activity from the list to get professional AI coaching insights.</p>
      </div>
    );
  }

  // Fix: Renamed performanceScore to effectivenessScore
  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm overflow-hidden relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="p-1.5 bg-orange-100 rounded-lg text-orange-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            Performance Insights
          </h2>
          {/* Fix: Renamed performanceScore to effectivenessScore */}
          <div className={`px-4 py-2 rounded-xl flex items-center gap-2 ${scoreColor(analysis.effectivenessScore)}`}>
            <span className="text-xs font-bold uppercase tracking-wider">Score</span>
            <span className="text-2xl font-black">{analysis.effectivenessScore}</span>
          </div>
        </div>

        <p className="text-gray-700 leading-relaxed mb-8">
          {analysis.summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50/50 rounded-xl p-4 border border-green-100">
            <h3 className="text-green-800 text-sm font-bold uppercase mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Key Strengths
            </h3>
            <ul className="space-y-2">
              {analysis.pros.map((pro, i) => (
                <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-green-400 shrink-0" />
                  {pro}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
            <h3 className="text-blue-800 text-sm font-bold uppercase mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              Trend Analysis
            </h3>
            <p className="text-sm text-blue-700 leading-relaxed">
              {/* Fix: analysis.trendImpact is now defined in types.ts */}
              {analysis.trendImpact}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>
        
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <span className="p-1 bg-white/20 rounded text-white">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </span>
          Pro Coach Next Step
        </h3>
        <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest font-bold">Suggested training session</p>
        
        <div className="space-y-4">
          <div className="flex flex-col">
            <span className="text-orange-400 text-xs font-bold uppercase mb-1">Workout Type</span>
            <span className="text-xl font-bold">{analysis.nextTrainingSuggestion.type}</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-orange-400 text-xs font-bold uppercase mb-1">The Goal</span>
            <p className="text-sm text-gray-200">{analysis.nextTrainingSuggestion.description}</p>
          </div>

          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg border border-white/5">
            <span className="text-xs text-white/60">Target Metrics:</span>
            {/* Fix: analysis.nextTrainingSuggestion.targetMetrics is now defined in types.ts */}
            <span className="text-sm font-mono font-bold text-orange-300">{analysis.nextTrainingSuggestion.targetMetrics}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;