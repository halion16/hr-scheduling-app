import React, { useState, useMemo } from 'react';
import { Brain, TrendingUp, AlertTriangle, Target, Clock, Users, BarChart3, PieChart, Activity, Zap, Shield, CheckCircle } from 'lucide-react';
import { useSchedulingAI, AISchedulingSuggestion, SchedulingMetrics, WorkloadPrediction } from '../../hooks/useSchedulingAI';
import { Employee, Store, Shift } from '../../types';

interface AnalyticsDashboardProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  weekStart: Date;
  onApplyAISuggestion?: (suggestion: AISchedulingSuggestion) => Promise<void>;
  onOptimizeSchedule?: () => Promise<void>;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = React.memo(({
  employees,
  shifts,
  stores,
  weekStart,
  onApplyAISuggestion,
  onOptimizeSchedule
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'suggestions' | 'metrics'>('overview');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const {
    generateIntelligentSuggestions,
    generateWorkloadPredictions,
    calculateSchedulingMetrics,
    generateOptimizedSchedule,
    enabled
  } = useSchedulingAI({
    employees,
    shifts,
    stores,
    weekStart,
    enabled: true
  });

  const suggestions = useMemo(() => generateIntelligentSuggestions(), [generateIntelligentSuggestions]);
  const predictions = useMemo(() => generateWorkloadPredictions(), [generateWorkloadPredictions]);
  const metrics = useMemo(() => calculateSchedulingMetrics(), [calculateSchedulingMetrics]);

  const handleApplySuggestion = async (suggestion: AISchedulingSuggestion) => {
    if (!onApplyAISuggestion) return;

    setProcessingIds(prev => new Set(prev).add(suggestion.id));
    try {
      await onApplyAISuggestion(suggestion);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(suggestion.id);
        return newSet;
      });
    }
  };

  const handleOptimizeSchedule = async () => {
    if (!onOptimizeSchedule) return;

    setProcessingIds(prev => new Set(prev).add('optimize-all'));
    try {
      await onOptimizeSchedule();
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete('optimize-all');
        return newSet;
      });
    }
  };

  const getMetricColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 55) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getMetricIcon = (score: number) => {
    if (score >= 85) return <CheckCircle className="w-5 h-5" />;
    if (score >= 70) return <Target className="w-5 h-5" />;
    if (score >= 55) return <Clock className="w-5 h-5" />;
    return <AlertTriangle className="w-5 h-5" />;
  };

  const getPriorityColor = (priority: AISchedulingSuggestion['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTypeIcon = (type: AISchedulingSuggestion['type']) => {
    switch (type) {
      case 'optimization': return <Zap className="w-4 h-4" />;
      case 'prediction': return <TrendingUp className="w-4 h-4" />;
      case 'anomaly': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  if (!enabled) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analytics Disabilitato</h3>
          <p className="text-gray-600">Abilita l'AI per accedere alle analisi avanzate e suggerimenti intelligenti.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="w-6 h-6 text-purple-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Analytics Dashboard</h2>
              <p className="text-sm text-gray-600">Analisi intelligente e ottimizzazione automatica</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              AI Attivo
            </span>
            {onOptimizeSchedule && (
              <button
                onClick={handleOptimizeSchedule}
                disabled={processingIds.has('optimize-all')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                {processingIds.has('optimize-all') ? 'Ottimizzando...' : '🤖 Ottimizza AI'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'overview', label: 'Panoramica', icon: Activity },
            { id: 'metrics', label: 'Metriche', icon: BarChart3 },
            { id: 'suggestions', label: 'Suggerimenti AI', icon: Brain },
            { id: 'predictions', label: 'Predizioni', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Score Generale AI</span>
                </div>
                <p className="text-2xl font-bold text-purple-900 mt-1">{metrics.overallScore}%</p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Suggerimenti Attivi</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 mt-1">{suggestions.length}</p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Predizioni</span>
                </div>
                <p className="text-2xl font-bold text-green-900 mt-1">{predictions.length}</p>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700">Anomalie</span>
                </div>
                <p className="text-2xl font-bold text-orange-900 mt-1">
                  {suggestions.filter(s => s.type === 'anomaly').length}
                </p>
              </div>
            </div>

            {/* Top Suggestions Preview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Suggerimenti AI</h3>
              <div className="space-y-3">
                {suggestions.slice(0, 3).map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getTypeIcon(suggestion.type)}
                      <div>
                        <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                        <p className="text-sm text-gray-600">{suggestion.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                        {suggestion.priority === 'critical' ? 'Critico' :
                         suggestion.priority === 'high' ? 'Alto' :
                         suggestion.priority === 'medium' ? 'Medio' : 'Basso'}
                      </span>
                      <span className="text-sm text-gray-500">{suggestion.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Metriche Performance AI</h3>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { key: 'efficiency', label: 'Efficienza', value: metrics.efficiency, description: 'Ottimizzazione distribuzione carichi' },
                { key: 'fairness', label: 'Equità', value: metrics.fairness, description: 'Bilanciamento tra dipendenti' },
                { key: 'compliance', label: 'Conformità', value: metrics.compliance, description: 'Rispetto vincoli normativi' },
                { key: 'satisfaction', label: 'Soddisfazione', value: metrics.satisfaction, description: 'Allineamento preferenze' },
                { key: 'adaptability', label: 'Flessibilità', value: metrics.adaptability, description: 'Capacità di adattamento' },
                { key: 'overallScore', label: 'Score Generale', value: metrics.overallScore, description: 'Valutazione complessiva AI' }
              ].map((metric) => (
                <div key={metric.key} className={`p-6 rounded-lg border-2 ${getMetricColor(metric.value)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      {getMetricIcon(metric.value)}
                      <h4 className="font-semibold">{metric.label}</h4>
                    </div>
                    <span className="text-2xl font-bold">{metric.value}%</span>
                  </div>
                  <p className="text-sm opacity-80">{metric.description}</p>

                  {/* Progress Bar */}
                  <div className="mt-3 bg-white bg-opacity-50 rounded-full h-2">
                    <div
                      className="bg-current rounded-full h-2 transition-all duration-300"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Suggerimenti Intelligenti AI</h3>
              <span className="text-sm text-gray-500">{suggestions.length} suggerimenti trovati</span>
            </div>

            {suggestions.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Nessun Suggerimento</h4>
                <p className="text-gray-600">L'AI non ha identificato opportunità di miglioramento al momento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-center space-x-3 mb-3">
                          {getTypeIcon(suggestion.type)}
                          <h4 className="font-semibold text-gray-900">{suggestion.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                            {suggestion.priority === 'critical' ? 'Critico' :
                             suggestion.priority === 'high' ? 'Alto' :
                             suggestion.priority === 'medium' ? 'Medio' : 'Basso'}
                          </span>
                          {suggestion.automatable && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Auto
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-gray-700 mb-4">{suggestion.description}</p>

                        {/* Impact Metrics */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Efficienza</p>
                            <p className={`font-semibold ${suggestion.impact.efficiency >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {suggestion.impact.efficiency >= 0 ? '+' : ''}{suggestion.impact.efficiency}%
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Soddisfazione</p>
                            <p className={`font-semibold ${suggestion.impact.satisfaction >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {suggestion.impact.satisfaction >= 0 ? '+' : ''}{suggestion.impact.satisfaction}%
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Conformità</p>
                            <p className={`font-semibold ${suggestion.impact.compliance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {suggestion.impact.compliance >= 0 ? '+' : ''}{suggestion.impact.compliance}%
                            </p>
                          </div>
                        </div>

                        {/* Savings */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Risparmi Stimati:</span>
                            <div className="flex items-center space-x-4">
                              <span className="text-gray-700">
                                {suggestion.estimatedSavings.hours.toFixed(1)}h
                              </span>
                              <span className="font-medium text-green-600">
                                €{suggestion.estimatedSavings.cost.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Required */}
                        <div className="text-sm">
                          <span className="text-gray-600">Azione Richiesta: </span>
                          <span className="text-gray-900">{suggestion.actionRequired}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      {onApplyAISuggestion && (
                        <div className="ml-6 flex flex-col items-center">
                          <button
                            onClick={() => handleApplySuggestion(suggestion)}
                            disabled={processingIds.has(suggestion.id)}
                            className={`px-4 py-2 rounded-md text-sm font-medium ${
                              suggestion.automatable
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {processingIds.has(suggestion.id) ? 'Applicando...' : 'Applica'}
                          </button>
                          <div className="text-center mt-2">
                            <span className="text-xs text-gray-500">Confidenza: {suggestion.confidence}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Predizioni Carico di Lavoro</h3>

            {predictions.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Nessuna Predizione</h4>
                <p className="text-gray-600">Le predizioni AI saranno generate automaticamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stores.map(store => {
                  const storePredictions = predictions.filter(p => p.storeId === store.id);

                  return (
                    <div key={store.id} className="border border-gray-200 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 mb-4">{store.name}</h4>

                      <div className="space-y-3">
                        {storePredictions.slice(0, 5).map((prediction, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium text-gray-900">
                                {prediction.date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </p>
                              <p className="text-sm text-gray-600">
                                Staff richiesto: {prediction.requiredStaff}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">
                                {(prediction.predictedDemand * 100).toFixed(0)}%
                              </p>
                              <p className="text-xs text-gray-500">
                                Confidenza: {prediction.confidence.toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});