import React, { useState } from 'react';
import { Scale, TrendingUp, ArrowRightLeft, Clock, Target, CheckCircle, XCircle, AlertTriangle, BarChart3, Users, Store } from 'lucide-react';
import { useWorkloadBalancer, BalancingSuggestion, BalancingMetrics } from '../hooks/useWorkloadBalancer';
import { Employee, Store as StoreType, Shift } from '../types';
import { ValidationAdminSettings } from '../types/validation';

interface BalancingPanelProps {
  employees: Employee[];
  shifts: Shift[];
  stores: StoreType[];
  weekStart: Date;
  adminSettings?: ValidationAdminSettings;
  selectedStoreId?: string;
  onApplySuggestion?: (suggestion: BalancingSuggestion) => Promise<void>;
  onApplyAllAutoSuggestions?: (suggestions: BalancingSuggestion[]) => Promise<void>;
  onStoreFilterChange?: (storeId: string) => void;
}

export const BalancingPanel: React.FC<BalancingPanelProps> = ({
  employees,
  shifts,
  stores,
  weekStart,
  adminSettings,
  selectedStoreId,
  onApplySuggestion,
  onApplyAllAutoSuggestions,
  onStoreFilterChange
}) => {
  const [selectedSuggestionType, setSelectedSuggestionType] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [showMetrics, setShowMetrics] = useState(true);
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());

  // 🔍 DEBUG: Log props BalancingPanel
  console.log('🔍 BalancingPanel DEBUG:', {
    selectedStoreId,
    storesCount: stores.length,
    employeesCount: employees.length,
    shiftsCount: shifts.length,
    onStoreFilterChange: !!onStoreFilterChange
  });

  const {
    suggestions,
    metrics,
    canBalance,
    getSuggestionsByType,
    getHighPrioritySuggestions,
    getAutoApplicableSuggestions,
    estimateTotalBalancingTime,
    hasBalancingOpportunities,
    needsUrgentBalancing
  } = useWorkloadBalancer({
    employees,
    shifts,
    stores,
    weekStart,
    adminSettings,
    enabled: true,
    storeFilter: selectedStoreId
  });

  const handleApplySuggestion = async (suggestion: BalancingSuggestion) => {
    if (!onApplySuggestion) return;
    
    setApplyingIds(prev => new Set(prev).add(suggestion.id));
    try {
      await onApplySuggestion(suggestion);
    } finally {
      setApplyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(suggestion.id);
        return newSet;
      });
    }
  };

  const handleApplyAllAuto = async () => {
    if (!onApplyAllAutoSuggestions) return;
    
    const autoSuggestions = getAutoApplicableSuggestions();
    autoSuggestions.forEach(s => setApplyingIds(prev => new Set(prev).add(s.id)));
    
    try {
      await onApplyAllAutoSuggestions(autoSuggestions);
    } finally {
      autoSuggestions.forEach(s => setApplyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(s.id);
        return newSet;
      }));
    }
  };

  const filteredSuggestions = suggestions.filter(suggestion => {
    const typeMatch = selectedSuggestionType === 'all' || suggestion.type === selectedSuggestionType;
    const priorityMatch = selectedPriority === 'all' || suggestion.priority === selectedPriority;
    return typeMatch && priorityMatch;
  });

  const getSeverityIcon = (priority: BalancingSuggestion['priority']) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium': return <TrendingUp className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Target className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeIcon = (type: BalancingSuggestion['type']) => {
    switch (type) {
      case 'redistribute': return <ArrowRightLeft className="w-4 h-4" />;
      case 'swap_shifts': return <ArrowRightLeft className="w-4 h-4" />;
      case 'add_shift': return <CheckCircle className="w-4 h-4" />;
      case 'remove_shift': return <XCircle className="w-4 h-4" />;
      case 'adjust_hours': return <Clock className="w-4 h-4" />;
    }
  };

  const getBalanceColor = (balance: BalancingMetrics['overallBalance']) => {
    switch (balance) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
    }
  };

  // 🗑️ Rimosso il messaggio "Workload Ottimamente Bilanciato" ridondante
  // Se non ci sono opportunità di bilanciamento, non mostriamo nulla
  if (!hasBalancingOpportunities) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Scale className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Algoritmo Bilanciamento Automatico</h3>
              <p className="text-sm text-gray-600">
                {suggestions.length} suggerimenti trovati • Tempo stimato: {Math.ceil(estimateTotalBalancingTime() / 60)} min
              </p>
            </div>
          </div>
          
          {needsUrgentBalancing && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-red-50 rounded-full">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700">Azione Urgente Richiesta</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Summary */}
      {showMetrics && metrics && (
        <div className="p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Overall Balance */}
            <div className={`p-4 rounded-lg ${getBalanceColor(metrics.overallBalance)}`}>
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">Bilanciamento Generale</span>
              </div>
              <p className="text-2xl font-bold capitalize">{metrics.overallBalance}</p>
              <p className="text-sm">Score Equità: {metrics.currentEquityScore}%</p>
            </div>

            {/* Workload Distribution */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-700">Distribuzione Ore</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {metrics.workloadDistribution.filter(w => Math.abs(w.deviationPercent) > 20).length}
              </p>
              <p className="text-sm text-blue-600">Dipendenti sbilanciati</p>
            </div>

            {/* Store Balance */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Store className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-700">Equilibrio Negozi</span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {metrics.storeBalance.filter(s => s.staffingLevel !== 'optimal').length}
              </p>
              <p className="text-sm text-purple-600">Negozi da riequilibrare</p>
            </div>
          </div>

          {/* Potential Improvement */}
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
            <span className="text-sm text-gray-600">Miglioramento Potenziale Equità:</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-semibold text-gray-700">{metrics.currentEquityScore}%</span>
              <ArrowRightLeft className="w-4 h-4 text-gray-400" />
              <span className="text-lg font-semibold text-green-600">{metrics.potentialEquityScore}%</span>
              <span className="text-sm text-green-600">
                (+{(metrics.potentialEquityScore - metrics.currentEquityScore).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center space-x-4">
            {/* 🆕 Store Filter */}
            {stores.length > 1 && onStoreFilterChange && (
              <select
                value={selectedStoreId || 'all'}
                onChange={(e) => onStoreFilterChange(e.target.value === 'all' ? '' : e.target.value)}
                className="px-3 py-2 border border-blue-300 rounded-md text-sm bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">🏪 Tutti i Negozi</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            )}

            {/* Type Filter */}
            <select
              value={selectedSuggestionType}
              onChange={(e) => setSelectedSuggestionType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutti i Tipi</option>
              <option value="redistribute">Redistribuzione</option>
              <option value="swap_shifts">Scambio Turni</option>
              <option value="adjust_hours">Aggiusta Orari</option>
              <option value="add_shift">Aggiungi Turno</option>
              <option value="remove_shift">Rimuovi Turno</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutte le Priorità</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Bassa</option>
            </select>

            {/* Toggle Metrics */}
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {showMetrics ? 'Nascondi Metriche' : 'Mostra Metriche'}
            </button>
          </div>

          {/* Apply All Auto */}
          {getAutoApplicableSuggestions().length > 0 && onApplyAllAutoSuggestions && (
            <button
              onClick={handleApplyAllAuto}
              disabled={applyingIds.size > 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Applica Tutti gli Automatici ({getAutoApplicableSuggestions().length})
            </button>
          )}
        </div>
      </div>

      {/* Suggestions List */}
      <div className="divide-y divide-gray-200">
        {filteredSuggestions.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Nessun suggerimento trovato per i filtri selezionati.
          </div>
        ) : (
          filteredSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center space-x-3 mb-2">
                    {getSeverityIcon(suggestion.priority)}
                    {getTypeIcon(suggestion.type)}
                    <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      suggestion.priority === 'high' ? 'bg-red-100 text-red-700' :
                      suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {suggestion.priority === 'high' ? 'Alta' :
                       suggestion.priority === 'medium' ? 'Media' : 'Bassa'}
                    </span>
                    {suggestion.autoApplicable && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Auto
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-700 mb-3">{suggestion.description}</p>

                  {/* Impact Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Ore Coinvolte:</span>
                      <span className="font-medium">{suggestion.proposedChanges.impact.hoursChange}h</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600">Miglioramento Equità:</span>
                      <span className="font-medium text-green-600">+{suggestion.proposedChanges.impact.equityImprovement}%</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Scale className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600">Bilanciamento:</span>
                      <span className="font-medium text-blue-600">+{suggestion.proposedChanges.impact.workloadBalance}%</span>
                    </div>
                  </div>

                  {/* Change Details */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{suggestion.proposedChanges.action}:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-700">{suggestion.proposedChanges.from}</span>
                        <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{suggestion.proposedChanges.to}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                {onApplySuggestion && (
                  <div className="ml-4">
                    <button
                      onClick={() => handleApplySuggestion(suggestion)}
                      disabled={applyingIds.has(suggestion.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        suggestion.autoApplicable
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {applyingIds.has(suggestion.id) ? 'Applicando...' : 'Applica'}
                    </button>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      ~{suggestion.estimatedDuration} min
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};