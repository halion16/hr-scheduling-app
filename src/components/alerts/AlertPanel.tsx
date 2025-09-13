import React, { useState } from 'react';
import { WorkloadAlert, AlertSummary } from '../../hooks/useWorkloadAlerts';
import { Store as StoreType } from '../../types';
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
  stores: StoreType[];
  selectedStoreId?: string;
  onAlertDismiss?: (alertId: string) => void;
  onAlertAction?: (alert: WorkloadAlert) => void;
  onStoreFilterChange?: (storeId: string) => void;
  // 🆕 Nuovi handler per azioni specifiche
  onJustifyUnderload?: (alert: WorkloadAlert, reason: string) => void;
  onMoveToHourBank?: (alert: WorkloadAlert, hours: number) => void;
  className?: string;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  alertSummary,
  stores,
  selectedStoreId,
  onAlertDismiss,
  onAlertAction,
  onStoreFilterChange,
  onJustifyUnderload,
  onMoveToHourBank,
  className = ""
}) => {
  // 🔍 DEBUG: Log props AlertPanel
  console.log('🔍 AlertPanel DEBUG:', {
    selectedStoreId,
    storesCount: stores.length,
    alertsCount: alerts.length,
    onStoreFilterChange: !!onStoreFilterChange
  });
  const [filterType, setFilterType] = useState<WorkloadAlert['type'] | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<WorkloadAlert['severity'] | 'all'>('all');
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  
  // 🆕 Stato per modal risoluzione sottoutilizzo
  const [resolvingAlert, setResolvingAlert] = useState<WorkloadAlert | null>(null);
  const [resolveReason, setResolveReason] = useState('');

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

          {/* 🆕 Filtro per Negozio */}
          {stores.length > 1 && onStoreFilterChange && (
            <select
              value={selectedStoreId || 'all'}
              onChange={(e) => onStoreFilterChange(e.target.value === 'all' ? '' : e.target.value)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-md bg-blue-50 border-blue-200"
            >
              <option value="all">🏪 Tutti i Negozi</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          )}

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

      {/* Lista Alert con Scorrimento */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header della lista */}
        {filteredAlerts.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                Alert Attivi ({filteredAlerts.length})
              </h3>
              {filteredAlerts.length > 4 && (
                <span className="text-xs text-gray-500 flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
                  Scorri per vedere tutti
                </span>
              )}
            </div>
          </div>
        )}
        
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun Alert</h3>
            <p className="text-gray-600">
              {alerts.length === 0 
                ? 'Non ci sono alert attivi al momento.' 
                : 'Nessun alert corrisponde ai filtri selezionati.'}
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
            const isDismissed = dismissedAlerts.has(alert.id);
            
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-lg border-l-4 shadow-sm border border-gray-200 ${getSeverityColor(alert.severity)} ${
                  isDismissed ? 'opacity-60' : ''
                } ${alert.severity === 'critical' ? 'ring-1 ring-red-200' : ''}`}
              >
                <div className="p-3">
                  {/* Header compatto con titolo e azioni */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1">
                      {getSeverityIcon(alert.severity)}
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

                    {/* Actions compatte */}
                    <div className="flex items-center space-x-1">
                      {alert.type === 'underloaded' && alert.actionRequired && !isDismissed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setResolvingAlert(alert)}
                          className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700"
                        >
                          Risolvi
                        </Button>
                      )}
                      
                      {alert.actionRequired && alert.type !== 'underloaded' && !isDismissed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAction(alert)}
                          className="text-xs px-2 py-1"
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

                  {/* Messaggio compatto */}
                  <p className="text-sm text-gray-700 mb-2 ml-7">{alert.message}</p>
                  
                  {/* Info layout orizzontale compatto */}
                  <div className="flex items-center justify-between ml-7">
                    {/* Dettagli a sinistra */}
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
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
                    </div>

                    {/* Valori e ore a destra */}
                    <div className="flex items-center space-x-3 text-xs">
                      <div className="text-gray-600">
                        <strong>{alert.currentValue}</strong>
                        {alert.type !== 'equity_critical' && (
                          <span className="text-gray-500"> / {alert.thresholdValue}</span>
                        )}
                      </div>
                      
                      {/* Ore in eccesso/difetto inline */}
                      {alert.excessHours && (
                        <div className="flex items-center space-x-1 text-red-600 bg-red-50 px-2 py-1 rounded">
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium">+{alert.excessHours}h</span>
                        </div>
                      )}
                      {alert.deficitHours && (
                        <div className="flex items-center space-x-1 text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          <TrendingDown className="h-3 w-3" />
                          <span className="font-medium">-{alert.deficitHours}h</span>
                        </div>
                      )}
                      {alert.contractHours && (
                        <div className="text-gray-500">
                          <span>Max: {alert.contractHours}h</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
              })}
            </div>
          </div>
        )}
      </div>


      {/* 🆕 Modal Risoluzione Sottoutilizzo */}
      {resolvingAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Risolvi Sottoutilizzo
                </h3>
                <button
                  onClick={() => {
                    setResolvingAlert(null);
                    setResolveReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{resolvingAlert.employeeName}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Ore attuali: <strong>{resolvingAlert.currentValue}h</strong></div>
                  <div>Ore minime richieste: <strong>{resolvingAlert.thresholdValue}h</strong></div>
                  <div className="text-orange-600">
                    Difetto: <strong>{resolvingAlert.deficitHours}h</strong>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-700 mb-4">
                  Come vuoi risolvere questo sottoutilizzo?
                </p>

                {/* Opzione 1: Giustifica */}
                <button
                  onClick={() => {
                    if (onJustifyUnderload && resolvingAlert) {
                      onJustifyUnderload(resolvingAlert, resolveReason || 'Sottoutilizzo giustificato');
                      setResolvingAlert(null);
                      setResolveReason('');
                    }
                  }}
                  className="w-full p-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Giustifica Sottoutilizzo</div>
                      <div className="text-xs text-gray-600">
                        Permessi, malattie, ferie o altre assenze giustificate
                      </div>
                    </div>
                  </div>
                </button>

                {/* Opzione 2: Banca Ore */}
                {resolvingAlert.canMoveToHourBank && (
                  <button
                    onClick={() => {
                      if (onMoveToHourBank && resolvingAlert?.deficitHours) {
                        onMoveToHourBank(resolvingAlert, resolvingAlert.deficitHours);
                        setResolvingAlert(null);
                        setResolveReason('');
                      }
                    }}
                    className="w-full p-3 border border-green-200 rounded-lg hover:bg-green-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Sposta in Banca Ore</div>
                        <div className="text-xs text-gray-600">
                          Le {resolvingAlert.deficitHours}h saranno recuperate successivamente
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                {/* Campo Note (opzionale) */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Note aggiuntive (opzionale)
                  </label>
                  <textarea
                    value={resolveReason}
                    onChange={(e) => setResolveReason(e.target.value)}
                    placeholder="Aggiungi una nota per spiegare la risoluzione..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setResolvingAlert(null);
                    setResolveReason('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};