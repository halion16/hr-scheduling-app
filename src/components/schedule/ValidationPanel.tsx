import React, { useState } from 'react';
import { useShiftGridValidation } from '../../hooks/useShiftGridValidation';
import { Store, Shift, Employee } from '../../types';
import { ValidationIssue, ValidationAdminSettings } from '../../types/validation';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  TrendingUp,
  TrendingDown,
  Calendar,
  Eye,
  Settings,
  BarChart3,
  AlertCircle,
  Info,
  Scale
} from 'lucide-react';

interface ValidationPanelProps {
  store: Store;
  shifts: Shift[];
  employees: Employee[];
  weekStart: Date;
  adminSettings?: ValidationAdminSettings;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  store,
  shifts,
  employees,
  weekStart,
  adminSettings,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const validation = useShiftGridValidation({
    store,
    shifts,
    employees,
    weekStart,
    adminSettings
  });

  if (isCollapsed) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              validation.isValid ? 'bg-green-500' : 
              validation.needsImmedateAttention ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <div>
              <div className="font-medium text-sm">
                Validazione: {validation.summary.scoreGrade}
              </div>
    {/* CCNL Compliance Quick Check */}
    <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Scale className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            CCNL del Commercio
          </span>
        </div>
        <div className="text-sm text-blue-700">
          Controllo riposi obbligatori attivo
        </div>
      </div>
    </div>

              <div className="text-xs text-gray-500">
                Score: {validation.score}/100
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {validation.criticalIssues.length > 0 && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                {validation.criticalIssues.length} critici
              </span>
            )}
            {validation.warnings.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                {validation.warnings.length} avvisi
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              icon={Eye}
              onClick={onToggleCollapse}
            >
              Espandi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full ${
                validation.isValid ? 'bg-green-500' : 
                validation.needsImmedateAttention ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Validazione Griglia Turni
                </h3>
                <p className="text-sm text-gray-600">
                  Analisi automatica della copertura e del personale
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {validation.score}
                </div>
                <div className="text-sm text-gray-500">
                  {validation.summary.scoreGrade}
                </div>
              </div>
              
              <Button
                size="sm"
                variant="outline"
                icon={onToggleCollapse ? TrendingDown : Settings}
                onClick={onToggleCollapse || (() => setShowDetails(true))}
              >
                {onToggleCollapse ? 'Comprimi' : 'Dettagli'}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats - Compatto su singola riga */}
        <div className="py-4 px-6 border-b border-gray-100">
          <div className="grid grid-cols-4 gap-4">
            {/* Status Generale */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                validation.isValid ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {validation.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {validation.isValid ? 'Valida' : 'Necessita Correzioni'}
              </div>
              <div className="text-xs text-gray-500">
                {validation.summary.validDays}/{validation.summary.totalDays} giorni OK
              </div>
            </div>

            {/* Copertura */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {validation.coverageStats.averageCoverage}%
              </div>
              <div className="text-xs text-gray-500">
                Copertura Media
              </div>
            </div>

            {/* Issues Critici */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                validation.criticalIssues.length > 0 ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <AlertCircle className={`h-4 w-4 ${
                  validation.criticalIssues.length > 0 ? 'text-red-600' : 'text-green-600'
                }`} />
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {validation.criticalIssues.length}
              </div>
              <div className="text-xs text-gray-500">
                Issues Critici
              </div>
            </div>

            {/* Avvisi */}
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                validation.warnings.length > 0 ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                <Info className={`h-4 w-4 ${
                  validation.warnings.length > 0 ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {validation.warnings.length}
              </div>
              <div className="text-xs text-gray-500">
                Avvisi
              </div>
            </div>
          </div>
        </div>

        {/* Issues più importanti */}
        {(validation.criticalIssues.length > 0 || validation.warnings.length > 0) && (
          <div className="p-6 border-b border-gray-100">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Issues da Risolvere
            </h4>
            
            <div className="space-y-3">
              {validation.criticalIssues.slice(0, 3).map((issue, index) => (
                <IssueCard key={`critical-${index}`} issue={issue} />
              ))}
              
              {validation.warnings.slice(0, 2).map((issue, index) => (
                <IssueCard key={`warning-${index}`} issue={issue} />
              ))}
              
              {(validation.criticalIssues.length + validation.warnings.length) > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetails(true)}
                  className="w-full"
                >
                  Visualizza tutti i {validation.criticalIssues.length + validation.warnings.length} problemi
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Daily Overview */}
        <div className="p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            Panoramica Giornaliera
          </h4>
          
          <div className="grid grid-cols-7 gap-2">
            {validation.validationResult.dailyResults.map((day, index) => (
              <DayCard
                key={index}
                day={day}
                onClick={() => setSelectedDay(day.date)}
                isSelected={selectedDay?.toDateString() === day.date.toDateString()}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title="Dettagli Validazione Completa"
        size="xl"
      >
        <ValidationDetailsModal
          validation={validation}
          onClose={() => setShowDetails(false)}
        />
      </Modal>

      {/* Day Details Modal */}
      {selectedDay && (
        <Modal
          isOpen={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={`Dettagli ${selectedDay.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`}
          size="lg"
        >
          <DayValidationDetails
            day={validation.getDayValidation(selectedDay)!}
            onClose={() => setSelectedDay(null)}
          />
        </Modal>
      )}
    </>
  );
};

// Componente per card issue con indicazione del giorno
const IssueCard: React.FC<{ issue: ValidationIssue }> = ({ issue }) => {
  const severityColors = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const severityIcons = {
    critical: AlertTriangle,
    warning: AlertCircle,
    info: Info
  };

  const Icon = severityIcons[issue.severity];

  // Formatta il giorno se disponibile
  const formatIssueDay = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleDateString('it-IT', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <div className={`p-3 rounded-lg border ${severityColors[issue.severity]}`}>
      <div className="flex items-start space-x-3">
        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Header con giorno se disponibile */}
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium">
              {issue.message}
            </div>
            {issue.date && (
              <div className="flex items-center space-x-1 bg-white bg-opacity-60 rounded px-2 py-1">
                <Calendar className="h-3 w-3 opacity-70" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {formatIssueDay(issue.date)}
                </span>
              </div>
            )}
          </div>
          
          {issue.description && (
            <div className="text-xs mt-1 opacity-90">
              {issue.description}
            </div>
          )}
          
          {/* Time range se disponibile */}
          {issue.timeRange && (
            <div className="text-xs mt-1 opacity-80 font-mono">
              🕐 {issue.timeRange.start} - {issue.timeRange.end}
            </div>
          )}
          
          {issue.suggestedAction && (
            <div className="text-xs mt-2 font-medium bg-white bg-opacity-40 rounded px-2 py-1">
              💡 {issue.suggestedAction}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente per card giorno
const DayCard: React.FC<{
  day: any;
  onClick: () => void;
  isSelected: boolean;
}> = ({ day, onClick, isSelected }) => {
  const getStatusColor = () => {
    if (!day.isStoreOpen) return 'bg-gray-100 text-gray-600';
    if (!day.hasShifts) return 'bg-red-100 text-red-700';
    if (day.isValid) return 'bg-green-100 text-green-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getStatusIcon = () => {
    if (!day.isStoreOpen) return null;
    if (!day.hasShifts) return <AlertTriangle className="h-3 w-3" />;
    if (day.isValid) return <CheckCircle className="h-3 w-3" />;
    return <AlertCircle className="h-3 w-3" />;
  };

  return (
    <button
      onClick={onClick}
      className={`p-2 text-center rounded-lg border-2 transition-all hover:shadow-md ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      } ${getStatusColor()}`}
    >
      <div className="text-xs font-medium">
        {day.date.toLocaleDateString('it-IT', { weekday: 'short' })}
      </div>
      <div className="text-xs mt-1">
        {day.date.getDate()}
      </div>
      {getStatusIcon() && (
        <div className="flex justify-center mt-1">
          {getStatusIcon()}
        </div>
      )}
      {day.isStoreOpen && (
        <div className="text-xs mt-1">
          {Math.round(day.coverage.coveragePercentage)}%
        </div>
      )}
    </button>
  );
};

// Componente per dettagli completi (stub)
const ValidationDetailsModal: React.FC<{
  validation: any;
  onClose: () => void;
}> = ({ validation, onClose }) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900 mb-2">
          {validation.score}/100
        </div>
        <div className="text-lg text-gray-600">
          {validation.summary.scoreGrade}
        </div>
      </div>
      
      {/* Qui andrebbero tutti i dettagli completi */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600">
          Dettagli completi della validazione saranno implementati qui...
        </p>
      </div>
    </div>
  );
};

// Componente per dettagli giorno (stub)
const DayValidationDetails: React.FC<{
  day: any;
  onClose: () => void;
}> = ({ day, onClose }) => {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Stato Generale</h4>
        <div className="text-sm text-gray-600">
          <p>Negozio aperto: {day.isStoreOpen ? 'Sì' : 'No'}</p>
          <p>Ha turni: {day.hasShifts ? 'Sì' : 'No'}</p>
          <p>Valido: {day.isValid ? 'Sì' : 'No'}</p>
          <p>Copertura: {day.coverage.coveragePercentage.toFixed(1)}%</p>
        </div>
      </div>
      
      {day.issues.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Issues</h4>
          <div className="space-y-2">
            {day.issues.map((issue: ValidationIssue, index: number) => (
              <IssueCard key={index} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};