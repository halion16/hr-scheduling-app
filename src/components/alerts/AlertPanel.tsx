import React, { useState } from 'react';
import { WorkloadAlert, AlertSummary } from '../../hooks/useWorkloadAlerts';
import { Button } from '../common/Button';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  Clock,
  Users,
  Store,
  TrendingDown,
  TrendingUp,
  Eye,
  EyeOff,
  Filter,
  CheckCircle,
  X
} from 'lucide-react';

interface AlertPanelProps {
  alerts: WorkloadAlert[];
  alertSummary: AlertSummary;
  onAlertDismiss?: (alertId: string) => void;
  onAlertAction?: (alert: WorkloadAlert) => void;
  className?: string;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  alertSummary,
  onAlertDismiss,
  onAlertAction,
  className = ""
}) => {
  const [filterType, setFilterType] = useState<WorkloadAlert['type'] | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<WorkloadAlert['severity'] | 'all'>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Filtra alert
  const filteredAlerts = alerts.filter(alert => {
    if (dismissedAlerts.has(alert.id) && !showDismissed) return false;
    if (filterType !== 'all' && alert.type !== filterType) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    return true;
  });

  const getSeverityIcon = (severity: WorkloadAlert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'high': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'low': return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: WorkloadAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'low': return 'bg-blue-50 border-blue-200';
    }
  };

  const getTypeIcon = (type: WorkloadAlert['type']) => {
    switch (type) {
      case 'overloaded': return <TrendingUp className="h-4 w-4" />;
      case 'underloaded': return <TrendingDown className="h-4 w-4" />;
      case 'equity_critical': return <Users className="h-4 w-4" />;
      case 'store_imbalance': return <Store className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: WorkloadAlert['type']) => {
    switch (type) {
      case 'overloaded': return 'Sovraccarico';
      case 'underloaded': return 'Sottoutilizzo';
      case 'equity_critical': return 'Equità Critica';
      case 'store_imbalance': return 'Sbilanciamento Negozi';
    }
  };

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    onAlertDismiss?.(alertId);
  };

  const handleAction = (alert: WorkloadAlert) => {
    onAlertAction?.(alert);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header con Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Alert Workload</h2>
              <p className="text-sm text-gray-600">
                {alertSummary.total} alert attivi
                {alertSummary.critical > 0 && (
                  <span className="ml-2 inline-flex px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                    {alertSummary.critical} critici
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="flex space-x-2">
            <div className="text-center p-2 bg-red-50 rounded-lg min-w-[60px]">
              <p className="text-xs text-gray-600">Critici</p>
              <p className="text-lg font-bold text-red-600">{alertSummary.critical}</p>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-lg min-w-[60px]">
              <p className="text-xs text-gray-600">Alti</p>
              <p className="text-lg font-bold text-orange-600">{alertSummary.high}</p>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded-lg min-w-[60px]">
              <p className="text-xs text-gray-600">Medi</p>
              <p className="text-lg font-bold text-yellow-600">{alertSummary.medium}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtri:</span>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1 text-xs border border-gray-300 rounded-md"
          >
            <option value="all">Tutti i tipi</option>
            <option value="overloaded">Sovraccarico</option>
            <option value="underloaded">Sottoutilizzo</option>
            <option value="equity_critical">Equità Critica</option>
            <option value="store_imbalance">Sbilanciamento Negozi</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as any)}
            className="px-3 py-1 text-xs border border-gray-300 rounded-md"
          >
            <option value="all">Tutte le severità</option>
            <option value="critical">Solo Critici</option>
            <option value="high">Solo Alti</option>
            <option value="medium">Solo Medi</option>
            <option value="low">Solo Bassi</option>
          </select>

          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`px-3 py-1 text-xs rounded-md border ${
              showDismissed 
                ? 'bg-gray-100 border-gray-300 text-gray-700' 
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            {showDismissed ? <Eye className="h-3 w-3 inline mr-1" /> : <EyeOff className="h-3 w-3 inline mr-1" />}
            {showDismissed ? 'Nascondi dismissi' : 'Mostra dismissi'}
          </button>
        </div>
      </div>

      {/* Lista Alert */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun Alert</h3>
            <p className="text-gray-600">
              {alerts.length === 0 
                ? 'Non ci sono alert attivi al momento.' 
                : 'Nessun alert corrisponde ai filtri selezionati.'}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isDismissed = dismissedAlerts.has(alert.id);
            
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-lg border-l-4 shadow-sm border border-gray-200 ${getSeverityColor(alert.severity)} ${
                  isDismissed ? 'opacity-60' : ''
                } ${alert.severity === 'critical' ? 'ring-1 ring-red-200' : ''}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900">{alert.title}</h3>
                          <div className="flex items-center space-x-1">
                            {getTypeIcon(alert.type)}
                            <span className="text-xs text-gray-500">{getTypeLabel(alert.type)}</span>
                          </div>
                          {alert.actionRequired && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                              Azione Richiesta
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        
                        {/* Dettagli aggiuntivi */}
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{alert.timestamp.toLocaleTimeString('it-IT', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}</span>
                          </div>
                          
                          {alert.employeeName && (
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{alert.employeeName}</span>
                            </div>
                          )}
                          
                          {alert.storeName && (
                            <div className="flex items-center space-x-1">
                              <Store className="h-3 w-3" />
                              <span>{alert.storeName}</span>
                            </div>
                          )}
                          
                          <div>
                            Valore: <strong>{alert.currentValue}</strong>
                            {alert.type !== 'equity_critical' && (
                              <span> / {alert.thresholdValue}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {alert.actionRequired && !isDismissed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAction(alert)}
                          className="text-xs"
                        >
                          Risolvi
                        </Button>
                      )}
                      
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className={`p-1 rounded-full transition-colors ${
                          isDismissed 
                            ? 'bg-green-100 text-green-600' 
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        title={isDismissed ? 'Alert dismisso' : 'Dismissi alert'}
                      >
                        {isDismissed ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary by Type */}
      {alertSummary.total > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Riepilogo per Tipo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(alertSummary.byType).map(([type, count]) => {
              if (count === 0) return null;
              return (
                <div key={type} className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center mb-1">
                    {getTypeIcon(type as WorkloadAlert['type'])}
                  </div>
                  <p className="text-xs text-gray-600">{getTypeLabel(type as WorkloadAlert['type'])}</p>
                  <p className="text-lg font-bold text-gray-900">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};