import React, { useState, useMemo } from 'react';
import { Employee, Store } from '../../types';
import { useHourBank } from '../../hooks/useHourBank';
import { useScheduleData } from '../../hooks/useScheduleData';
import { addDays, getStartOfWeek } from '../../utils/timeUtils';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { Input } from '../common/Input';
import { HourBankStoreView } from './HourBankStoreView';
import { HourBankEmployeeDetail } from './HourBankEmployeeDetail';
import { RecoveryRequestForm } from './RecoveryRequestForm';
import { HourBankStatistics } from './HourBankStatistics';
import { useAuth } from '../../hooks/useAuth';
import { ProtectedRoute, usePermissionGuard } from '../auth/ProtectedRoute';
import { 
  Banknote, 
  Calculator, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Users,
  Store as StoreIcon,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  Settings,
  BarChart3,
  Calendar,
  Plus
} from 'lucide-react';

// Helper functions for period calculations
const calculatePeriodDates = (
  period: 'week' | 'month' | 'quarter' | 'custom',
  customStartDate?: string,
  customEndDate?: string
): { startDate: Date; endDate: Date } => {
  const now = new Date();
  
  switch (period) {
    case 'week':
      return {
        startDate: addDays(now, -7),
        endDate: now
      };
    case 'month':
      return {
        startDate: addDays(now, -30),
        endDate: now
      };
    case 'quarter':
      return {
        startDate: addDays(now, -90),
        endDate: now
      };
    case 'custom':
      return {
        startDate: customStartDate ? new Date(customStartDate) : addDays(now, -7),
        endDate: customEndDate ? new Date(customEndDate) : now
      };
    default:
      return {
        startDate: addDays(now, -7),
        endDate: now
      };
  }
};

const getPeriodText = (
  period: 'week' | 'month' | 'quarter' | 'custom',
  startDate: Date,
  endDate: Date
): string => {
  switch (period) {
    case 'week':
      return 'Ultima Settimana';
    case 'month':
      return 'Ultimo Mese';
    case 'quarter':
      return 'Ultimo Trimestre';
    case 'custom':
      return 'Periodo Personalizzato';
    default:
      return 'Ultimo Periodo';
  }
};

interface HourBankDashboardProps {
  employees: Employee[];
}

export const HourBankDashboard: React.FC<HourBankDashboardProps> = ({ employees }) => {
  const { hasPermission } = useAuth();
  const { renderIfPermission } = usePermissionGuard();
  const { stores, shifts } = useScheduleData();
  const {
    hourBankAccounts,
    hourBankEntries,
    recoveryRequests,
    isCalculating,
    lastCalculation,
    calculationLog,
    calculateHourBank,
    recalculateAllAccounts,
    createRecoveryRequest,
    getStoreHourBankSummary,
    getEmployeeHourBankReport,
    getHourBankStatistics,
    exportHourBankData,
    resetStoreHourBank,
    resetAllHourBankData
  } = useHourBank();

  const [selectedView, setSelectedView] = useState<'overview' | 'by-store' | 'by-employee' | 'requests' | 'statistics'>('overview');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [calculationPeriod, setCalculationPeriod] = useState<'week' | 'month' | 'quarter' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const activeStores = stores.filter(store => store.isActive);
  const activeEmployees = employees.filter(emp => emp.isActive);

  // Statistiche generali
  const overallStats = getHourBankStatistics();

  // Quick calculation trigger
  const handleQuickCalculation = async () => {
    console.log('🚀 Avvio calcolo rapido banca ore...');
    
    const { startDate, endDate } = calculatePeriodDates(calculationPeriod, customStartDate, customEndDate);
    
    const result = await calculateHourBank(activeEmployees, activeStores, shifts, {
      includeLockedShifts: true,
      includeCompletedShifts: false, // Solo turni non completati per calcolo corrente
      recalculateFromStart: false,
      startDate,
      endDate
    });

    if (result.success) {
      alert(`✅ Calcolo completato!\n\n📊 ${result.entriesCreated} nuove entries create\n👥 ${result.accountsUpdated} account aggiornati\n⏱️ Durata: ${result.duration?.toFixed(0)}ms`);
    } else {
      alert(`❌ Errore durante il calcolo:\n\n${result.error}`);
    }
  };

  // Full recalculation
  const handleFullRecalculation = async () => {
    if (!confirm('⚠️ Questa operazione ricalcolerà completamente la banca ore da zero.\n\nTutti i dati precedenti verranno sovrascritti.\n\nContinuare?')) {
      return;
    }

    const result = await recalculateAllAccounts(activeEmployees, activeStores, shifts);
    
    if (result.success) {
      alert(`✅ Ricalcolo completo terminato!\n\n📊 ${result.entriesCreated} entries create\n👥 ${result.accountsUpdated} account aggiornati\n⏱️ Durata: ${result.duration?.toFixed(0)}ms`);
    } else {
      alert(`❌ Errore durante il ricalcolo:\n\n${result.error}`);
    }
    
    setShowCalculationModal(false);
  };

  const storeOptions = [
    { value: '', label: 'Tutti i Negozi' },
    ...activeStores.map(store => ({
      value: store.id,
      label: store.name
    }))
  ];

  const employeeOptions = [
    { value: '', label: 'Tutti i Dipendenti' },
    ...activeEmployees.map(emp => ({
      value: emp.id,
      label: `${emp.firstName} ${emp.lastName}`
    }))
  ];

  const filteredEmployees = selectedStoreId 
    ? activeEmployees.filter(emp => emp.storeId === selectedStoreId)
    : activeEmployees;

  const navigationTabs = [
    { id: 'overview' as const, name: 'Panoramica', icon: BarChart3 },
    { id: 'by-store' as const, name: 'Per Negozio', icon: StoreIcon },
    { id: 'by-employee' as const, name: 'Per Dipendente', icon: Users },
    { id: 'requests' as const, name: 'Richieste', icon: Calendar },
    { id: 'statistics' as const, name: 'Statistiche', icon: Settings }
  ];

  return (
    <div className="space-y-4">
      {/* Header compatto */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 rounded-lg p-2">
              <Banknote className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Banca Ore</h1>
              <p className="text-sm text-gray-600">Gestione eccedenze e deficit orari per dipendente</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-right text-sm">
              <div className="text-gray-500">Ultimo calcolo:</div>
              <div className="font-medium text-gray-900">
                {lastCalculation ? lastCalculation.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'Mai'}
              </div>
            </div>
            
            <Button
              icon={Calculator}
              onClick={handleQuickCalculation}
              disabled={isCalculating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCalculating ? 'Calcolando...' : 'Calcola Ore'}
            </Button>
            
            <Button
              variant="outline"
              icon={Settings}
              onClick={() => setShowCalculationModal(true)}
            >
              Opzioni
            </Button>
          </div>
        </div>

        {/* Statistiche rapide */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-blue-900">{overallStats.totalAccounts}</div>
            <div className="text-xs text-blue-700">Account Attivi</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-900">{overallStats.accountsWithCredit}</div>
            <div className="text-xs text-green-700">Con Credito</div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-900">{overallStats.accountsWithDebt}</div>
            <div className="text-xs text-red-700">Con Debito</div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-yellow-900">{overallStats.totalPendingRecoveries}</div>
            <div className="text-xs text-yellow-700">Recuperi Pending</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 p-1">
            {navigationTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedView(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedView === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {selectedView === 'overview' && (
            <OverviewTab
              overallStats={overallStats}
              stores={activeStores}
              getStoreHourBankSummary={getStoreHourBankSummary}
              onCalculate={handleQuickCalculation}
              isCalculating={isCalculating}
              exportHourBankData={exportHourBankData}
              calculationPeriod={calculationPeriod}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
            />
          )}

          {selectedView === 'by-store' && (
            <StoreTab
              stores={activeStores}
              selectedStoreId={selectedStoreId}
              onStoreSelect={setSelectedStoreId}
              employees={filteredEmployees}
              getStoreHourBankSummary={getStoreHourBankSummary}
              getEmployeeHourBankReport={getEmployeeHourBankReport}
            />
          )}

          {selectedView === 'by-employee' && (
            <EmployeeTab
              employees={filteredEmployees}
              selectedEmployeeId={selectedEmployeeId}
              onEmployeeSelect={setSelectedEmployeeId}
              getEmployeeHourBankReport={getEmployeeHourBankReport}
              onCreateRecoveryRequest={() => setShowRecoveryModal(true)}
            />
          )}

          {selectedView === 'requests' && (
            <RequestsTab
              recoveryRequests={recoveryRequests}
              employees={activeEmployees}
              hourBankAccounts={hourBankAccounts}
              onCreateRequest={() => setShowRecoveryModal(true)}
            />
          )}

          {selectedView === 'statistics' && (
            <HourBankStatistics
              statistics={overallStats}
              entries={hourBankEntries}
              accounts={hourBankAccounts}
              employees={activeEmployees}
              stores={activeStores}
            />
          )}
        </div>
      </div>

      {/* Recovery Request Modal */}
      <Modal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        title="Nuova Richiesta Recupero Ore"
        size="lg"
      >
        <RecoveryRequestForm
          employees={filteredEmployees}
          hourBankAccounts={hourBankAccounts}
          onSubmit={(requestData) => {
            try {
              createRecoveryRequest(requestData);
              setShowRecoveryModal(false);
              alert('✅ Richiesta di recupero creata con successo!');
            } catch (error) {
              alert(`❌ Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
            }
          }}
          onCancel={() => setShowRecoveryModal(false)}
        />
      </Modal>

      {/* Calculation Options Modal */}
      <Modal
        isOpen={showCalculationModal}
        onClose={() => setShowCalculationModal(false)}
        title="Opzioni Calcolo Banca Ore"
        size="md"
      >
        <CalculationOptionsModal
          onQuickCalc={handleQuickCalculation}
          onFullRecalc={handleFullRecalculation}
          onExport={exportHourBankData}
          onClose={() => setShowCalculationModal(false)}
          isCalculating={isCalculating}
          calculationLog={calculationLog}
          stores={activeStores}
          resetStoreHourBank={resetStoreHourBank}
          resetAllHourBankData={resetAllHourBankData}
          calculationPeriod={calculationPeriod}
          setCalculationPeriod={setCalculationPeriod}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
        />
      </Modal>
    </div>
  );
};

// Overview Tab Component
interface OverviewTabProps {
  overallStats: any;
  stores: Store[];
  getStoreHourBankSummary: (storeId: string, storeName: string) => any;
  onCalculate: () => void;
  isCalculating: boolean;
  exportHourBankData: () => void;
  calculationPeriod: 'week' | 'month' | 'quarter' | 'custom';
  customStartDate: string;
  customEndDate: string;
  onCreateRecoveryRequest: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  overallStats,
  stores,
  getStoreHourBankSummary,
  onCalculate,
  isCalculating,
  exportHourBankData,
  calculationPeriod,
  customStartDate,
  customEndDate,
  onCreateRecoveryRequest
}) => {
  const { startDate, endDate } = calculatePeriodDates(calculationPeriod, customStartDate, customEndDate);
  const periodText = getPeriodText(calculationPeriod, startDate, endDate);
  
  return (
    <div className="space-y-6">
      {/* Period Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">
            Calcolo per: {periodText}
          </span>
        </div>
        <div className="text-sm text-blue-800 mt-1">
          📅 Dal {startDate.toLocaleDateString('it-IT')} al {endDate.toLocaleDateString('it-IT')}
          ({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} giorni)
        </div>
        
        <div className="mt-4 pt-3 border-t border-blue-200">
          <Button
            onClick={onCalculate}
            disabled={isCalculating}
            icon={isCalculating ? RefreshCw : Calculator}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isCalculating ? 'Calcolando...' : `Calcola ${periodText}`}
          </Button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-900">{overallStats.largestCredit.toFixed(1)}h</div>
              <div className="text-sm text-green-700">Credito Massimo</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center space-x-3">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-900">{overallStats.largestDebt.toFixed(1)}h</div>
              <div className="text-sm text-red-700">Debito Massimo</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-900">{overallStats.averageBalance.toFixed(1)}h</div>
              <div className="text-sm text-blue-700">Media Bilanci</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold text-yellow-900">{overallStats.pendingRecoveryHours.toFixed(1)}h</div>
              <div className="text-sm text-yellow-700">Ore Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Summary */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Riepilogo per Negozio</h3>
        </div>
        
        <div className="p-4">
          <div className="space-y-3">
            {stores.map(store => {
              const summary = getStoreHourBankSummary(store.id, store.name);
              
              return (
                <div key={store.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 rounded-lg p-2">
                      <StoreIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{store.name}</div>
                      <div className="text-sm text-gray-600">
                        {summary.totalEmployees} dipendenti • 
                        Bilancio: {summary.netBalance > 0 ? '+' : ''}{summary.netBalance.toFixed(1)}h
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-green-600 font-medium">
                        +{summary.totalCredit.toFixed(1)}h credito
                      </div>
                      <div className="text-sm text-red-600 font-medium">
                        -{summary.totalDebt.toFixed(1)}h debito
                      </div>
                    </div>
                    
                    <div className={`w-3 h-3 rounded-full ${
                      summary.netBalance > 5 ? 'bg-green-500' :
                      summary.netBalance < -5 ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} title={`Bilancio netto: ${summary.netBalance.toFixed(1)}h`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          onClick={onCalculate}
          disabled={isCalculating}
          icon={isCalculating ? RefreshCw : Calculator}
          className="w-full bg-green-600 hover:bg-green-700 py-4"
        >
          {isCalculating ? 'Calcolando...' : 'Calcolo Rapido'}
        </Button>
        
        <Button
          onClick={onCreateRecoveryRequest}
          icon={Plus}
          variant="outline"
          className="w-full py-4"
        >
          Richiedi Recupero
        </Button>
        
        <Button
          onClick={exportHourBankData}
          icon={Download}
          variant="outline"
          className="w-full py-4"
        >
          Esporta Dati
        </Button>
      </div>
    </div>
  );
};

// Store Tab Component
interface StoreTabProps {
  stores: Store[];
  selectedStoreId: string;
  onStoreSelect: (storeId: string) => void;
  employees: Employee[];
  getStoreHourBankSummary: (storeId: string, storeName: string) => any;
  getEmployeeHourBankReport: (employeeId: string, employees: Employee[]) => any;
}

const StoreTab: React.FC<StoreTabProps> = ({
  stores,
  selectedStoreId,
  onStoreSelect,
  employees,
  getStoreHourBankSummary,
  getEmployeeHourBankReport
}) => {
  const storeOptions = stores.map(store => ({
    value: store.id,
    label: store.name
  }));

  const selectedStore = stores.find(store => store.id === selectedStoreId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Banca Ore per Negozio</h3>
        <Select
          value={selectedStoreId}
          onChange={onStoreSelect}
          options={[
            { value: '', label: 'Seleziona negozio...' },
            ...storeOptions
          ]}
          className="min-w-[200px]"
        />
      </div>

      {selectedStore && (
        <HourBankStoreView
          store={selectedStore}
          employees={employees}
          getStoreHourBankSummary={getStoreHourBankSummary}
          getEmployeeHourBankReport={getEmployeeHourBankReport}
        />
      )}

      {!selectedStore && (
        <div className="text-center py-12">
          <StoreIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Seleziona un Negozio</h3>
          <p className="text-gray-500">Scegli un negozio per visualizzare la banca ore dei dipendenti</p>
        </div>
      )}
    </div>
  );
};

// Employee Tab Component
interface EmployeeTabProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onEmployeeSelect: (employeeId: string) => void;
  getEmployeeHourBankReport: (employeeId: string, employees: Employee[]) => any;
  onCreateRecoveryRequest: () => void;
}

const EmployeeTab: React.FC<EmployeeTabProps> = ({
  employees,
  selectedEmployeeId,
  onEmployeeSelect,
  getEmployeeHourBankReport,
  onCreateRecoveryRequest
}) => {
  const { renderIfPermission } = usePermissionGuard();
  const employeeOptions = employees.map(emp => ({
    value: emp.id,
    label: `${emp.firstName} ${emp.lastName}`
  }));

  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
  const employeeReport = selectedEmployeeId ? getEmployeeHourBankReport(selectedEmployeeId, employees) : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Dettaglio per Dipendente</h3>
        <div className="flex space-x-3">
          <Select
            value={selectedEmployeeId}
            onChange={onEmployeeSelect}
            options={[
              { value: '', label: 'Seleziona dipendente...' },
              ...employeeOptions
            ]}
            className="min-w-[200px]"
          />
          {renderIfPermission('manage_hour_bank', (
            <Button
              onClick={onCreateRecoveryRequest}
              icon={Plus}
              variant="outline"
            >
              Richiedi Recupero
            </Button>
          ))}
        </div>
      </div>

      {employeeReport && selectedEmployee && (
        <HourBankEmployeeDetail
          employee={selectedEmployee}
          report={employeeReport}
          onCreateRecoveryRequest={onCreateRecoveryRequest}
        />
      )}

      {!selectedEmployee && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Seleziona un Dipendente</h3>
          <p className="text-gray-500">Scegli un dipendente per visualizzare il dettaglio della banca ore</p>
        </div>
      )}
    </div>
  );
};

// Requests Tab Component
interface RequestsTabProps {
  recoveryRequests: any[];
  employees: Employee[];
  hourBankAccounts: any[];
  onCreateRequest: () => void;
}

const RequestsTab: React.FC<RequestsTabProps> = ({
  recoveryRequests,
  employees,
  hourBankAccounts,
  onCreateRequest
}) => {
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  const pendingRequests = recoveryRequests.filter(req => req.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Richieste Recupero Ore</h3>
        <Button icon={Plus} onClick={onCreateRequest}>
          Nuova Richiesta
        </Button>
      </div>

      {pendingRequests.length > 0 ? (
        <div className="space-y-3">
          {pendingRequests.map(request => {
            const employee = employeeMap.get(request.employeeId);
            
            return (
              <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {employee ? `${employee.firstName} ${employee.lastName}` : 'Dipendente Sconosciuto'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Richieste: {request.requestedHours}h • Tipo: {request.requestType}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {request.reason}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button size="sm" variant="success">
                      Approva
                    </Button>
                    <Button size="sm" variant="danger">
                      Rifiuta
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna Richiesta Pending</h3>
          <p className="text-gray-500">Non ci sono richieste di recupero ore in attesa di approvazione</p>
        </div>
      )}
    </div>
  );
};

// Calculation Options Modal
interface CalculationOptionsModalProps {
  onQuickCalc: () => void;
  onFullRecalc: () => void;
  onExport: () => void;
  onClose: () => void;
  isCalculating: boolean;
  calculationLog: string[];
  stores: Store[];
  resetStoreHourBank: (storeId: string, storeName: string) => any;
  resetAllHourBankData: () => any;
  calculationPeriod: 'week' | 'month' | 'quarter' | 'custom';
  setCalculationPeriod: (period: 'week' | 'month' | 'quarter' | 'custom') => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
}

const CalculationOptionsModal: React.FC<CalculationOptionsModalProps> = ({
  onQuickCalc,
  onFullRecalc,
  onExport,
  onClose,
  isCalculating,
  calculationLog,
  stores,
  resetStoreHourBank,
  resetAllHourBankData,
  calculationPeriod,
  setCalculationPeriod,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate
}) => {
  const { hasPermission } = useAuth();
  const { renderIfPermission } = usePermissionGuard();
  const [selectedStoreForReset, setSelectedStoreForReset] = useState<string>('');
  
  const handleStoreReset = () => {
    if (!selectedStoreForReset) {
      alert('Seleziona un negozio da resettare');
      return;
    }
    
    const store = stores.find(s => s.id === selectedStoreForReset);
    if (!store) {
      alert('Negozio non trovato');
      return;
    }
    
    if (!confirm(`⚠️ ATTENZIONE!\n\nStai per cancellare TUTTI i dati della banca ore per:\n\n📍 ${store.name}\n\nQuesto include:\n• Account dipendenti\n• Storico ore accumulate\n• Richieste di recupero\n\nL'operazione è IRREVERSIBILE!\n\nContinuare?`)) {
      return;
    }
    
    const result = resetStoreHourBank(selectedStoreForReset, store.name);
    
    if (result.success) {
      alert(`✅ Reset completato per ${store.name}!\n\n📊 Dati rimossi:\n• ${result.removedAccounts} account dipendenti\n• ${result.removedEntries} entries storiche\n• ${result.removedRequests} richieste recupero`);
      setSelectedStoreForReset('');
    }
  };
  
  const handleCompleteReset = () => {
    if (!confirm('🚨 RESET TOTALE BANCA ORE\n\nStai per cancellare TUTTI i dati della banca ore di TUTTI i negozi.\n\nQuesto include:\n• Tutti gli account dipendenti\n• Tutto lo storico ore\n• Tutte le richieste di recupero\n\nL\'operazione è COMPLETAMENTE IRREVERSIBILE!\n\nDigita "CONFERMA" per procedere:')) {
      return;
    }
    
    const confirmation = prompt('Digita "CONFERMA" (tutto maiuscolo) per procedere con il reset totale:');
    if (confirmation !== 'CONFERMA') {
      alert('Reset annullato - testo di conferma non corretto');
      return;
    }
    
    const result = resetAllHourBankData();
    
    if (result.success) {
      alert(`✅ Reset totale completato!\n\n🗑️ Dati cancellati:\n• ${result.removedAccounts} account totali\n• ${result.removedEntries} entries storiche\n• ${result.removedRequests} richieste recupero\n\nTutti i dati della banca ore sono stati azzerati.`);
    }
  };

  const { startDate, endDate } = calculatePeriodDates(calculationPeriod, customStartDate, customEndDate);
  const periodText = getPeriodText(calculationPeriod, startDate, endDate);

  const handlePeriodCalculation = () => {
    onQuickCalc();
  };

  return (
    <div className="space-y-6">
      {/* Selettore Periodo di Calcolo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">📅 Periodo di Calcolo</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo Periodo
            </label>
            <select
              value={calculationPeriod}
              onChange={(e) => setCalculationPeriod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Ultima Settimana</option>
              <option value="month">Ultimo Mese</option>
              <option value="quarter">Ultimo Trimestre</option>
              <option value="custom">Periodo Personalizzato</option>
            </select>
          </div>
          
          {calculationPeriod === 'custom' && (
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Inizio
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Fine
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-3 text-sm text-blue-800">
          📊 Il calcolo elaborerà solo i turni del periodo selezionato
        </div>
        
        <div className="mt-3 bg-blue-100 border border-blue-300 rounded-lg p-3">
          <div className="text-sm text-blue-800 mb-3">
            📅 Dal {startDate.toLocaleDateString('it-IT')} al {endDate.toLocaleDateString('it-IT')}
            ({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} giorni)
          </div>
          
          <Button
            onClick={handlePeriodCalculation}
            disabled={isCalculating}
            icon={isCalculating ? RefreshCw : Calculator}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isCalculating ? 'Calcolando...' : `Calcola ${periodText}`}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Calcolo Rapido</h4>
              <p className="text-sm text-gray-600 mt-1">
                Calcola solo i nuovi dati dall'ultima esecuzione
              </p>
            </div>
            <Button
              onClick={onQuickCalc}
              disabled={isCalculating}
              icon={Calculator}
              className="bg-green-600 hover:bg-green-700"
            >
              Esegui
            </Button>
          </div>
        </div>

        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-red-900">Ricalcolo Completo</h4>
              <p className="text-sm text-red-700 mt-1">
                Ricalcola tutto da zero - cancella dati esistenti
              </p>
            </div>
            <Button
              onClick={onFullRecalc}
              disabled={isCalculating}
              icon={RefreshCw}
              variant="danger"
            >
              Ricalcola
            </Button>
          </div>
        </div>

        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Esporta Dati</h4>
              <p className="text-sm text-blue-700 mt-1">
                Scarica report completo in formato JSON
              </p>
            </div>
            {renderIfPermission('export_data', (
              <Button
                onClick={onExport}
                icon={Download}
                variant="outline"
              >
                Esporta
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Reset Options - Admin Only */}
      {hasPermission('reset_data') && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 mb-3">🗑️ Opzioni Reset</h4>
          
          {/* Reset per Negozio */}
          <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
            <div className="space-y-3">
              <div>
                <h5 className="font-medium text-orange-900">Reset per Negozio Specifico</h5>
                <p className="text-sm text-orange-700 mt-1">
                  Cancella tutti i dati della banca ore per un negozio specifico
                </p>
              </div>
              
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seleziona Negozio
                  </label>
                  <select
                    value={selectedStoreForReset}
                    onChange={(e) => setSelectedStoreForReset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Seleziona negozio...</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <Button
                  onClick={handleStoreReset}
                  disabled={!selectedStoreForReset || isCalculating}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Reset Negozio
                </Button>
              </div>
            </div>
          </div>
          
          {/* Reset Completo */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-medium text-red-900">Reset Completo Sistema</h5>
                <p className="text-sm text-red-700 mt-1">
                  Cancella TUTTI i dati della banca ore di TUTTI i negozi
                </p>
                <div className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ OPERAZIONE IRREVERSIBILE - Richiede doppia conferma
                </div>
              </div>
              <Button
                onClick={handleCompleteReset}
                disabled={isCalculating}
                variant="danger"
                className="bg-red-600 hover:bg-red-700"
              >
                Reset Totale
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasPermission('reset_data') && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              Le opzioni di reset sono disponibili solo per gli amministratori
            </span>
          </div>
        </div>
      )}

      {calculationLog.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Log Ultimo Calcolo</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {calculationLog.map((log, index) => (
              <div key={index} className="text-xs text-gray-600 font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Chiudi
        </Button>
      </div>
    </div>
  );
};