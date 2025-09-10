import React, { useState, useMemo } from 'react';
import { Employee, Shift, Store } from '../../types';
import { CCNLViolation, CCNLComplianceReport } from '../../types/ccnl';
import { ccnlValidator } from '../../utils/ccnlValidation';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { getWeekDays, addDays } from '../../utils/timeUtils';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Calendar,
  User,
  FileText,
  Download,
  Eye,
  EyeOff,
  Scale,
  AlertCircle
} from 'lucide-react';

interface CCNLCompliancePanelProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  weekStart: Date;
  selectedStoreId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const CCNLCompliancePanel: React.FC<CCNLCompliancePanelProps> = ({
  employees,
  shifts,
  stores,
  weekStart,
  selectedStoreId,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CCNLComplianceReport | null>(null);
  const [showOnlyViolations, setShowOnlyViolations] = useState(true);

  // Filtra dipendenti per negozio se necessario
  const filteredEmployees = selectedStoreId 
    ? employees.filter(emp => emp.storeId === selectedStoreId && emp.isActive)
    : employees.filter(emp => emp.isActive);

  // Genera report di compliance per tutti i dipendenti
  const complianceReports = useMemo(() => {
    console.log('🏛️ Generating CCNL compliance reports...');
    
    return filteredEmployees.map(employee => {
      const report = ccnlValidator.generateWeeklyComplianceReport(employee, weekStart, shifts);
      
      console.log(`📊 Compliance report for ${employee.firstName} ${employee.lastName}:`, {
        violations: report.violations.length,
        score: report.complianceScore,
        status: report.overallStatus
      });
      
      return { employee, report };
    });
  }, [filteredEmployees, weekStart, shifts]);

  // Statistiche aggregate
  const aggregateStats = useMemo(() => {
    const totalEmployees = complianceReports.length;
    const compliantEmployees = complianceReports.filter(r => r.report.overallStatus === 'compliant').length;
    const totalViolations = complianceReports.reduce((sum, r) => sum + r.report.violations.length, 0);
    const criticalViolations = complianceReports.reduce((sum, r) => 
      sum + r.report.violations.filter(v => v.severity === 'critical').length, 0
    );
    const avgComplianceScore = totalEmployees > 0 
      ? complianceReports.reduce((sum, r) => sum + r.report.complianceScore, 0) / totalEmployees
      : 100;

    return {
      totalEmployees,
      compliantEmployees,
      totalViolations,
      criticalViolations,
      avgComplianceScore: Math.round(avgComplianceScore),
      complianceRate: totalEmployees > 0 ? Math.round((compliantEmployees / totalEmployees) * 100) : 100
    };
  }, [complianceReports]);

  // Filtra report per visualizzazione
  const visibleReports = useMemo(() => {
    let filtered = complianceReports;

    if (selectedEmployee !== 'all') {
      filtered = filtered.filter(r => r.employee.id === selectedEmployee);
    }

    if (showOnlyViolations) {
      filtered = filtered.filter(r => r.report.violations.length > 0);
    }

    return filtered;
  }, [complianceReports, selectedEmployee, showOnlyViolations]);

  const handleViewDetails = (report: CCNLComplianceReport) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const exportComplianceReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      weekPeriod: `${weekStart.toLocaleDateString()} - ${addDays(weekStart, 6).toLocaleDateString()}`,
      store: selectedStoreId ? stores.find(s => s.id === selectedStoreId)?.name : 'Tutti i negozi',
      aggregateStats,
      employeeReports: complianceReports.map(r => ({
        employee: `${r.employee.firstName} ${r.employee.lastName}`,
        complianceScore: r.report.complianceScore,
        status: r.report.overallStatus,
        violations: r.report.violations.length,
        criticalViolations: r.report.violations.filter(v => v.severity === 'critical').length
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CCNL_Compliance_Report_${weekStart.toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isCollapsed) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              aggregateStats.criticalViolations > 0 ? 'bg-red-500' : 
              aggregateStats.totalViolations > 0 ? 'bg-yellow-500' : 'bg-green-500'
            }`} />
            <div>
              <div className="font-medium text-sm flex items-center space-x-2">
                <Scale className="h-4 w-4 text-blue-600" />
                <span>CCNL Compliance: {aggregateStats.complianceRate}%</span>
              </div>
              <div className="text-xs text-gray-500">
                {aggregateStats.criticalViolations} violazioni critiche, {aggregateStats.totalViolations} totali
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {aggregateStats.criticalViolations > 0 && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                {aggregateStats.criticalViolations} critiche
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
                aggregateStats.criticalViolations > 0 ? 'bg-red-500' : 
                aggregateStats.totalViolations > 0 ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Scale className="h-5 w-5 text-blue-600" />
                  <span>CCNL del Commercio - Compliance</span>
                </h3>
                <p className="text-sm text-gray-600">
                  Monitoraggio riposi obbligatori secondo normativa del lavoro
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {aggregateStats.avgComplianceScore}
                </div>
                <div className="text-sm text-gray-500">
                  Score Medio
                </div>
              </div>
              
              <Button
                size="sm"
                variant="outline"
                icon={onToggleCollapse ? EyeOff : Download}
                onClick={onToggleCollapse || exportComplianceReport}
              >
                {onToggleCollapse ? 'Comprimi' : 'Esporta'}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="py-4 px-6 border-b border-gray-100">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                aggregateStats.complianceRate >= 90 ? 'bg-green-100' : 
                aggregateStats.complianceRate >= 70 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                {aggregateStats.complianceRate >= 90 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {aggregateStats.complianceRate}% Conformi
              </div>
              <div className="text-xs text-gray-500">
                {aggregateStats.compliantEmployees}/{aggregateStats.totalEmployees} dipendenti
              </div>
            </div>

            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                aggregateStats.criticalViolations === 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <AlertCircle className={`h-4 w-4 ${
                  aggregateStats.criticalViolations === 0 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {aggregateStats.criticalViolations}
              </div>
              <div className="text-xs text-gray-500">
                Violazioni Critiche
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xs font-semibold text-gray-900">
                Art. 15-16
              </div>
              <div className="text-xs text-gray-500">
                CCNL Riferimenti
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 mb-1">
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-xs font-semibold text-gray-900">
                11h + 35h
              </div>
              <div className="text-xs text-gray-500">
                Riposi Minimi
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tutti i Dipendenti</option>
                {filteredEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>

              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOnlyViolations}
                  onChange={(e) => setShowOnlyViolations(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700">Solo violazioni</span>
              </label>
            </div>

            <div className="text-sm text-gray-500">
              Settimana {weekStart.toLocaleDateString()} - {addDays(weekStart, 6).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Employee Reports */}
        <div className="p-6">
          <div className="space-y-4">
            {visibleReports.map(({ employee, report }) => (
              <EmployeeComplianceCard
                key={employee.id}
                employee={employee}
                report={report}
                onViewDetails={() => handleViewDetails(report)}
              />
            ))}

            {visibleReports.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {showOnlyViolations ? 'Nessuna violazione CCNL' : 'Nessun dipendente trovato'}
                </h3>
                <p className="text-gray-500">
                  {showOnlyViolations 
                    ? 'Tutti i dipendenti rispettano i requisiti di riposo obbligatori.'
                    : 'Modifica i filtri per visualizzare i dipendenti.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedReport(null);
          }}
          title="Dettagli Compliance CCNL"
          size="xl"
        >
          <CCNLComplianceDetails
            report={selectedReport}
            employee={filteredEmployees.find(e => e.id === selectedReport.employeeId)!}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedReport(null);
            }}
          />
        </Modal>
      )}
    </>
  );
};

// Componente per card singolo dipendente
interface EmployeeComplianceCardProps {
  employee: Employee;
  report: CCNLComplianceReport;
  onViewDetails: () => void;
}

const EmployeeComplianceCard: React.FC<EmployeeComplianceCardProps> = ({
  employee,
  report,
  onViewDetails
}) => {
  const criticalViolations = report.violations.filter(v => v.severity === 'critical');
  const warningViolations = report.violations.filter(v => v.severity === 'warning');

  const getStatusColor = () => {
    if (report.overallStatus === 'compliant') return 'border-green-200 bg-green-50';
    if (report.overallStatus === 'minor_violations') return 'border-yellow-200 bg-yellow-50';
    return 'border-red-200 bg-red-50';
  };

  const getStatusIcon = () => {
    if (report.overallStatus === 'compliant') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (report.overallStatus === 'minor_violations') return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  const getStatusLabel = () => {
    if (report.overallStatus === 'compliant') return 'Conforme';
    if (report.overallStatus === 'minor_violations') return 'Violazioni Minori';
    return 'Violazioni Maggiori';
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <div className="font-medium text-gray-900">
              {employee.firstName} {employee.lastName}
            </div>
            <div className="text-sm text-gray-600">
              {employee.contractHours}h contratto • Score: {report.complianceScore}/100
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className={`text-sm font-medium ${
              report.overallStatus === 'compliant' ? 'text-green-700' :
              report.overallStatus === 'minor_violations' ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {getStatusLabel()}
            </div>
            <div className="text-xs text-gray-500">
              {report.violations.length} violazioni totali
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            icon={FileText}
            onClick={onViewDetails}
          >
            Dettagli
          </Button>
        </div>
      </div>

      {/* Violazioni immediate */}
      {(criticalViolations.length > 0 || warningViolations.length > 0) && (
        <div className="mt-3 space-y-2">
          {criticalViolations.slice(0, 2).map((violation, index) => (
            <div key={index} className="text-sm bg-red-100 border border-red-200 rounded p-2">
              <div className="font-medium text-red-900">🚨 {violation.description}</div>
              <div className="text-xs text-red-700 mt-1">{violation.articleReference}</div>
            </div>
          ))}
          
          {warningViolations.slice(0, 1).map((violation, index) => (
            <div key={index} className="text-sm bg-yellow-100 border border-yellow-200 rounded p-2">
              <div className="font-medium text-yellow-900">⚠️ {violation.description}</div>
              <div className="text-xs text-yellow-700 mt-1">{violation.articleReference}</div>
            </div>
          ))}

          {(criticalViolations.length + warningViolations.length) > 3 && (
            <div className="text-xs text-gray-600">
              +{(criticalViolations.length + warningViolations.length) - 3} altre violazioni...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente per dettagli compliance (stub per ora)
const CCNLComplianceDetails: React.FC<{
  report: CCNLComplianceReport;
  employee: Employee;
  onClose: () => void;
}> = ({ report, employee, onClose }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Informazioni Dipendente</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-lg font-semibold">{employee.firstName} {employee.lastName}</div>
            <div className="text-sm text-gray-600">Contratto: {employee.contractHours}h/settimana</div>
            <div className="text-sm text-gray-600">
              Periodo: {report.weekStart.toLocaleDateString()} - {report.weekEnd.toLocaleDateString()}
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-2">Score Compliance</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-center mb-2">
              {report.complianceScore}/100
            </div>
            <div className={`text-center font-medium ${
              report.overallStatus === 'compliant' ? 'text-green-600' :
              report.overallStatus === 'minor_violations' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {report.overallStatus === 'compliant' ? '✅ Conforme' :
               report.overallStatus === 'minor_violations' ? '⚠️ Violazioni Minori' :
               '🚨 Violazioni Maggiori'}
            </div>
          </div>
        </div>
      </div>

      {/* Violazioni dettagliate */}
      {report.violations.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Violazioni CCNL</h4>
          <div className="space-y-3">
            {report.violations.map((violation, index) => (
              <div key={index} className={`p-4 rounded-lg border ${
                violation.severity === 'critical' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`font-medium mb-1 ${
                      violation.severity === 'critical' ? 'text-red-900' : 'text-yellow-900'
                    }`}>
                      {violation.severity === 'critical' ? '🚨' : '⚠️'} {violation.description}
                    </div>
                    <div className={`text-sm mb-2 ${
                      violation.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'
                    }`}>
                      {violation.articleReference}
                    </div>
                    <div className="text-sm text-gray-600">
                      💡 <strong>Risoluzione:</strong> {violation.suggestedResolution}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance riposo giornaliero */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Riposo Giornaliero (11h minime)</h4>
        <div className="grid grid-cols-7 gap-2">
          {report.dailyRestCompliance.map((day, index) => (
            <div key={index} className={`p-2 rounded text-center text-sm ${
              day.hasMinimumRest 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className="font-medium">
                {day.date.toLocaleDateString('it-IT', { weekday: 'short' })}
              </div>
              <div className="text-xs">
                {day.restHours.toFixed(1)}h
              </div>
              <div className="text-xs">
                {day.hasMinimumRest ? '✅' : '❌'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Riposo settimanale */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Riposo Settimanale</h4>
        <div className={`p-4 rounded-lg ${
          report.weeklyRestCompliance.hasWeeklyRest 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium ${
                report.weeklyRestCompliance.hasWeeklyRest ? 'text-green-900' : 'text-red-900'
              }`}>
                {report.weeklyRestCompliance.hasWeeklyRest ? '✅ Conforme' : '❌ Non Conforme'}
              </div>
              <div className="text-sm text-gray-600">
                Riposo effettivo: {report.weeklyRestCompliance.weeklyRestHours}h 
                (minimo: {report.weeklyRestCompliance.requiredWeeklyRest}h)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>
          Chiudi
        </Button>
      </div>
    </div>
  );
};