import React, { useState, useMemo } from 'react';
import { Employee, Store } from '../../types';
import { useShiftRotation } from '../../hooks/useShiftRotation';
import { useScheduleData } from '../../hooks/useScheduleData';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { RotationCalendar } from './RotationCalendar';
import { RotationStatistics } from './RotationStatistics';
import { EmployeePreferencesForm } from './EmployeePreferencesForm';
import { SubstitutionManager } from './SubstitutionManager';
import { AlgorithmConfigPanel } from './AlgorithmConfigPanel';
import { Rotate3D as RotateRight, Calendar, BarChart3, Settings, Users, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, Store as StoreIcon, Wrench, Trash2, Download, Zap } from 'lucide-react';
import { addDays, getStartOfWeek } from '../../utils/timeUtils';

interface RotationDashboardProps {
  employees: Employee[];
}

export const RotationDashboard: React.FC<RotationDashboardProps> = ({ employees }) => {
  const { stores, clearAllData } = useScheduleData();
  const {
    shiftAssignments,
    shiftTypes,
    employeePreferences,
    substitutionRequests,
    algorithmConfig,
    generateRotationSchedule,
    getRotationStatistics,
    getTeamRotationSummary,
    setAlgorithmConfig
  } = useShiftRotation();

  const [currentWeek, setCurrentWeek] = useState(() => getStartOfWeek(new Date()));
  const [selectedView, setSelectedView] = useState<'calendar' | 'statistics' | 'preferences' | 'substitutions' | 'config'>('calendar');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDataManagementModal, setShowDataManagementModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [generationReport, setGenerationReport] = useState<any>(null);

  // Calcola statistiche per il periodo corrente
  const weekEnd = addDays(currentWeek, 6);
  const teamSummary = useMemo(() => 
    getTeamRotationSummary(currentWeek, weekEnd), 
    [currentWeek, shiftAssignments]
  );

  // Filtra dipendenti per negozio selezionato
  const activeEmployees = employees.filter(emp => {
    if (!emp.isActive) return false;
    if (!selectedStoreId) return true;
    return emp.storeId === selectedStoreId;
  });

  // Filtra assegnazioni per negozio selezionato
  const weekAssignments = shiftAssignments.filter(assignment => {
    const isInWeek = assignment.date >= currentWeek && assignment.date <= weekEnd;
    if (!isInWeek) return false;
    
    if (!selectedStoreId) return true;
    
    const employee = employees.find(emp => emp.id === assignment.employeeId);
    return employee?.storeId === selectedStoreId;
  });

  const pendingSubstitutions = substitutionRequests.filter(req => req.status === 'pending').length;
  const selectedStore = stores.find(store => store.id === selectedStoreId);

  const storeOptions = [
    { value: '', label: 'Tutti i Negozi' },
    ...stores
      .filter(store => store.isActive)
      .map(store => ({
        value: store.id,
        label: store.name
      }))
  ];

  // 🔧 FUNZIONE DI GENERAZIONE V2.0 - COMPLETAMENTE NUOVA
  const handleGenerateScheduleV2 = async (weeks: number) => {
    console.log('🚀 AVVIO GENERAZIONE TURNI V2.0');
    console.log('📊 Parametri:', {
      weeks,
      selectedStoreId: selectedStoreId || 'tutti',
      activeEmployees: activeEmployees.length,
      stores: stores.length
    });

    // VERIFICA PREREQUISITI
    if (!selectedStoreId) {
      alert('❌ Devi selezionare un negozio specifico per generare i turni');
      return;
    }

    setIsGenerating(true);
    const startTime = performance.now();
    
    try {
      const endDate = addDays(currentWeek, weeks * 7 - 1);
      
      console.log('📅 Periodo generazione:', {
        start: currentWeek.toLocaleDateString(),
        end: endDate.toLocaleDateString(),
        days: Math.ceil((endDate.getTime() - currentWeek.getTime()) / (1000 * 60 * 60 * 24))
      });

      // Verifica prerequisiti
      if (activeEmployees.length === 0) {
        alert('❌ Nessun dipendente attivo trovato per il negozio selezionato');
        return;
      }

      if (stores.length === 0) {
        alert('❌ Nessun negozio configurato');
        return;
      }

      // Chiama la funzione di generazione V2.0
      console.log('⚙️ Chiamata generateRotationSchedule V2.0...');
      const newAssignments = await generateRotationSchedule(
        activeEmployees, 
        currentWeek, 
        endDate, 
        stores,
        selectedStoreId
      );
      
      const endTime = performance.now();
      const generationTime = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log('✅ Generazione V2.0 completata:', newAssignments.length, 'turni in', generationTime, 'secondi');
      
      // Calcola statistiche per il report
      const employeeStats = activeEmployees.map(emp => {
        const empAssignments = newAssignments.filter(a => a.employeeId === emp.id);
        const totalHours = empAssignments.reduce((sum, a) => {
          const start = new Date(`2000-01-01T${a.shiftType.startTime}`);
          const end = new Date(`2000-01-01T${a.shiftType.endTime}`);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }, 0);
        const utilizationPercent = (totalHours / emp.contractHours) * 100;
        
        return {
          name: `${emp.firstName} ${emp.lastName}`,
          shifts: empAssignments.length,
          hours: totalHours,
          contractHours: emp.contractHours,
          utilization: utilizationPercent,
          inOptimalRange: utilizationPercent >= 90 && utilizationPercent <= 105
        };
      });

      const avgUtilization = employeeStats.reduce((sum, emp) => sum + emp.utilization, 0) / employeeStats.length;
      const employeesInRange = employeeStats.filter(emp => emp.inOptimalRange).length;

      // Crea report dettagliato
      const report = {
        totalShifts: newAssignments.length,
        totalHours: employeeStats.reduce((sum, emp) => sum + emp.hours, 0),
        avgUtilization: avgUtilization.toFixed(1),
        employeesInRange,
        totalEmployees: activeEmployees.length,
        generationTime,
        employeeStats,
        success: true
      };

      setGenerationReport(report);
      
      if (newAssignments.length === 0) {
        alert('⚠️ Nessun turno generato. Verifica la configurazione degli orari del negozio e dei tipi di turno.');
      } else {
        // Mostra notifica di successo
        console.log(`🎉 SUCCESSO! Generati ${newAssignments.length} turni con utilizzo medio ${avgUtilization.toFixed(1)}%`);
        
        // Notifica utente
        alert(`✅ Generati ${newAssignments.length} turni con successo! Vai alla vista "Griglia" per visualizzarli.`);
      }
      
      setShowGenerateModal(false);
    } catch (error) {
      console.error('❌ Errore nella generazione V2.0:', error);
      setGenerationReport({
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
        generationTime: ((performance.now() - startTime) / 1000).toFixed(2)
      });
      
      // Notifica errore
      alert(`❌ Errore durante la generazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 🛠️ FUNZIONE RIPARAZIONE DATI
  const handleRepairData = () => {
    console.log('🔧 Avvio riparazione dati...');
    
    // Qui implementeremo la logica di riparazione
    // Per ora mostra solo un messaggio
    alert('🔧 Funzione di riparazione dati in sviluppo. Verrà implementata nella prossima versione.');
  };

  // 🗑️ FUNZIONE CANCELLAZIONE DATI
  const handleClearAllData = () => {
    if (confirm('⚠️ ATTENZIONE: Questa operazione cancellerà TUTTI i dati (dipendenti, negozi, turni). Sei sicuro?')) {
      if (confirm('🚨 ULTIMA CONFERMA: I dati verranno persi per sempre. Continuare?')) {
        clearAllData();
        setGenerationReport(null);
        alert('✅ Tutti i dati sono stati cancellati.');
      }
    }
  };

  // 📊 FUNZIONE DOWNLOAD REPORT
  const handleDownloadReport = () => {
    if (!generationReport) return;
    
    const reportData = {
      timestamp: new Date().toISOString(),
      store: selectedStore?.name || 'Tutti i negozi',
      period: `${currentWeek.toLocaleDateString()} - ${addDays(currentWeek, 6).toLocaleDateString()}`,
      ...generationReport
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_Generazione_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navigationTabs = [
    { id: 'calendar' as const, name: 'Calendario', icon: Calendar },
    { id: 'statistics' as const, name: 'Statistiche', icon: BarChart3 },
    { id: 'preferences' as const, name: 'Preferenze', icon: Users },
    { id: 'substitutions' as const, name: 'Sostituzioni', icon: RefreshCw },
    { id: 'config' as const, name: 'Configurazione', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header con statistiche rapide */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 rounded-lg p-3">
              <RotateRight className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sistema di Rotazione Turni v2.0</h1>
              <p className="text-gray-600">Algoritmo ottimizzato per massimizzazione ore contrattuali</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Select
              value={selectedStoreId}
              onChange={setSelectedStoreId}
              options={storeOptions}
              className="min-w-[200px]"
            />
            
            {/* 🆕 PULSANTE GENERA TURNI V2.0 */}
            <Button
              variant="success"
              icon={Zap}
              onClick={() => setShowGenerateModal(true)}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {isGenerating ? 'Generando v2.0...' : 'Genera Turni v2.0'}
            </Button>
            
            {/* 🆕 PULSANTE GESTIONE DATI */}
            <Button
              variant="outline"
              icon={Wrench}
              onClick={() => setShowDataManagementModal(true)}
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              Gestione Dati
            </Button>
          </div>
        </div>

        {/* Informazioni negozio selezionato */}
        {selectedStore && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <StoreIcon className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">Negozio Selezionato: {selectedStore.name}</span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs">
              {Object.entries(selectedStore.openingHours).map(([day, hours]) => {
                const dayLabels = {
                  lunedì: 'Lun',
                  martedì: 'Mar',
                  mercoledì: 'Mer',
                  giovedì: 'Gio',
                  venerdì: 'Ven',
                  sabato: 'Sab',
                  domenica: 'Dom'
                };
                return (
                  <div key={day} className="text-center bg-white rounded p-2">
                    <div className="font-medium text-blue-700">
                      {dayLabels[day as keyof typeof dayLabels]}
                    </div>
                    <div className="text-blue-600 font-mono">
                      {hours ? `${hours.open}-${hours.close}` : 'Chiuso'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🆕 REPORT GENERAZIONE (se disponibile) */}
        {generationReport && (
          <div className={`mb-4 p-4 rounded-lg border-2 ${
            generationReport.success 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {generationReport.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-semibold ${
                  generationReport.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {generationReport.success ? '✅ Generazione Completata!' : '❌ Errore Generazione'}
                </span>
              </div>
              
              {generationReport.success && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={Download}
                  onClick={handleDownloadReport}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  Scarica Report
                </Button>
              )}
            </div>
            
            {generationReport.success ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{generationReport.totalShifts}</div>
                  <div className="text-green-600">Turni Generati</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{generationReport.avgUtilization}%</div>
                  <div className="text-green-600">Utilizzo Medio</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {generationReport.employeesInRange}/{generationReport.totalEmployees}
                  </div>
                  <div className="text-green-600">Nel Range Ottimale</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{generationReport.generationTime}s</div>
                  <div className="text-green-600">Tempo Generazione</div>
                </div>
              </div>
            ) : (
              <div className="text-red-800">
                <strong>Errore:</strong> {generationReport.error}
                <br />
                <small>Tempo: {generationReport.generationTime}s</small>
              </div>
            )}
          </div>
        )}

        {/* Statistiche rapide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-blue-900">{weekAssignments.length}</div>
                <div className="text-sm text-blue-700">
                  Turni Settimana{selectedStore ? ` - ${selectedStore.name}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-green-900">{teamSummary.equityScore}</div>
                <div className="text-sm text-green-700">Score Equità</div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-yellow-900">{pendingSubstitutions}</div>
                <div className="text-sm text-yellow-700">Sostituzioni Pending</div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-purple-900">{activeEmployees.length}</div>
                <div className="text-sm text-purple-700">
                  Dipendenti{selectedStore ? ` - ${selectedStore.name}` : ' Attivi'}
                </div>
              </div>
            </div>
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
                  {tab.id === 'substitutions' && pendingSubstitutions > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {pendingSubstitutions}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {selectedView === 'calendar' && (
            <RotationCalendar
              employees={activeEmployees}
              assignments={weekAssignments}
              shiftTypes={shiftTypes}
              currentWeek={currentWeek}
              onWeekChange={setCurrentWeek}
              onEmployeeSelect={setSelectedEmployee}
              selectedStore={selectedStore}
            />
          )}

          {selectedView === 'statistics' && (
            <RotationStatistics
              employees={activeEmployees}
              assignments={shiftAssignments}
              currentWeek={currentWeek}
              getRotationStatistics={getRotationStatistics}
              teamSummary={teamSummary}
            />
          )}

          {selectedView === 'preferences' && (
            <EmployeePreferencesForm
              employees={activeEmployees}
              shiftTypes={shiftTypes}
              selectedEmployee={selectedEmployee}
              onEmployeeSelect={setSelectedEmployee}
            />
          )}

          {selectedView === 'substitutions' && (
            <SubstitutionManager
              employees={activeEmployees}
              assignments={shiftAssignments}
              requests={substitutionRequests}
            />
          )}

          {selectedView === 'config' && (
            <AlgorithmConfigPanel
              config={algorithmConfig}
              onConfigChange={setAlgorithmConfig}
              shiftTypes={shiftTypes}
              stores={stores}
            />
          )}
        </div>
      </div>

      {/* 🆕 MODAL GENERAZIONE V2.0 */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="🚀 Genera Turni con Algoritmo v2.0"
        size="lg"
      >
        <GenerateScheduleModalV2
          onGenerate={handleGenerateScheduleV2}
          onCancel={() => setShowGenerateModal(false)}
          isGenerating={isGenerating}
          currentWeek={currentWeek}
          employeeCount={activeEmployees.length}
          selectedStore={selectedStore}
          employees={activeEmployees}
        />
      </Modal>

      {/* 🆕 MODAL GESTIONE DATI */}
      <Modal
        isOpen={showDataManagementModal}
        onClose={() => setShowDataManagementModal(false)}
        title="🛠️ Gestione Dati Sistema"
        size="md"
      >
        <DataManagementModal
          onRepairData={handleRepairData}
          onClearAllData={handleClearAllData}
          onClose={() => setShowDataManagementModal(false)}
          employees={employees}
          stores={stores}
          shifts={shiftAssignments}
        />
      </Modal>
    </div>
  );
};

// 🆕 COMPONENTE MODAL GENERAZIONE V2.0
interface GenerateScheduleModalV2Props {
  onGenerate: (weeks: number) => void;
  onCancel: () => void;
  isGenerating: boolean;
  currentWeek: Date;
  employeeCount: number;
  selectedStore?: Store;
  employees: Employee[];
}

const GenerateScheduleModalV2: React.FC<GenerateScheduleModalV2Props> = ({
  onGenerate,
  onCancel,
  isGenerating,
  currentWeek,
  employeeCount,
  selectedStore,
  employees
}) => {
  const [weeks, setWeeks] = useState(2);

  const endDate = addDays(currentWeek, weeks * 7 - 1);

  // Calcola ore obiettivo per dipendente
  const employeeTargets = employees.map(emp => ({
    name: `${emp.firstName} ${emp.lastName}`,
    contractHours: emp.contractHours,
    targetHours: emp.contractHours * 0.97, // 97% delle ore contrattuali
    fixedHours: emp.fixedHours
  }));

  const totalTargetHours = employeeTargets.reduce((sum, emp) => sum + emp.targetHours, 0);

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Zap className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-900">Algoritmo v2.0 - Ottimizzazione Ore Contrattuali</span>
        </div>
        <p className="text-sm text-green-800">
          Il nuovo algoritmo massimizza l'utilizzo delle ore contrattuali (obiettivo 97%) 
          garantendo rotazione equa e rispetto degli orari del negozio.
        </p>
      </div>

      {selectedStore && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <StoreIcon className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Analisi Negozio: {selectedStore.name}</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mt-2">
            {Object.entries(selectedStore.openingHours).map(([day, hours]) => {
              const dayLabels = {
                lunedì: 'L', martedì: 'M', mercoledì: 'M', giovedì: 'G', 
                venerdì: 'V', sabato: 'S', domenica: 'D'
              };
              return (
                <div key={day} className="text-center bg-white rounded p-1">
                  <div className="font-medium text-xs">{dayLabels[day as keyof typeof dayLabels]}</div>
                  <div className="text-xs">
                    {hours ? `${hours.open}-${hours.close}` : 'Chiuso'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Numero di settimane da generare
          </label>
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 settimana</option>
            <option value={2}>2 settimane (Raccomandato)</option>
            <option value={3}>3 settimane</option>
            <option value={4}>4 settimane (1 mese)</option>
          </select>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">📊 Previsioni Algoritmo v2.0</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Periodo:</span>
              <div className="font-medium">
                {currentWeek.toLocaleDateString('it-IT')} - {endDate.toLocaleDateString('it-IT')}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Dipendenti:</span>
              <div className="font-medium">{employeeCount}</div>
            </div>
            <div>
              <span className="text-gray-600">Ore Obiettivo Totali:</span>
              <div className="font-medium">{totalTargetHours.toFixed(1)}h</div>
            </div>
            <div>
              <span className="text-gray-600">Strategia:</span>
              <div className="font-medium">Massimizzazione + Rotazione</div>
            </div>
          </div>
        </div>

        {/* Lista dipendenti con obiettivi */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">👥 Obiettivi per Dipendente</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {employeeTargets.map((emp, index) => (
              <div key={index} className="flex justify-between items-center text-sm bg-white rounded p-2">
                <span className="font-medium">{emp.name}</span>
                <div className="text-right">
                  <div className="text-blue-600 font-bold">{emp.targetHours.toFixed(1)}h</div>
                  <div className="text-xs text-gray-500">
                    {emp.contractHours}h contratto × 97%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel} disabled={isGenerating}>
          Annulla
        </Button>
        <Button 
          onClick={() => onGenerate(weeks)} 
          disabled={isGenerating || !selectedStore}
          icon={isGenerating ? RefreshCw : Zap}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isGenerating ? 'Generando v2.0...' : 'Avvia Algoritmo v2.0'}
        </Button>
      </div>
    </div>
  );
};

// 🆕 COMPONENTE MODAL GESTIONE DATI
interface DataManagementModalProps {
  onRepairData: () => void;
  onClearAllData: () => void;
  onClose: () => void;
  employees: Employee[];
  stores: Store[];
  shifts: any[];
}

const DataManagementModal: React.FC<DataManagementModalProps> = ({
  onRepairData,
  onClearAllData,
  onClose,
  employees,
  stores,
  shifts
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Wrench className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">Stato Database Attuale</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-700">{employees.length}</div>
            <div className="text-blue-600">Dipendenti</div>
            <div className="text-xs text-gray-500">
              {employees.filter(e => e.isActive).length} attivi
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-700">{stores.length}</div>
            <div className="text-blue-600">Negozi</div>
            <div className="text-xs text-gray-500">
              {stores.filter(s => s.isActive).length} attivi
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-700">{shifts.length}</div>
            <div className="text-blue-600">Turni</div>
            <div className="text-xs text-gray-500">
              {shifts.filter((s: any) => s.isLocked).length} bloccati
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">🔧 Ripara Dati Corrotti</h4>
              <p className="text-sm text-gray-600 mt-1">
                Corregge automaticamente date invalide, campi mancanti e inconsistenze nei dati.
                Operazione sicura che non cancella dati.
              </p>
            </div>
            <Button
              variant="outline"
              icon={Wrench}
              onClick={onRepairData}
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              Ripara
            </Button>
          </div>
        </div>

        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-red-900">🗑️ Cancella Tutti i Dati</h4>
              <p className="text-sm text-red-700 mt-1">
                Rimuove completamente tutti i dipendenti, negozi e turni dal database.
                <strong> Operazione irreversibile!</strong>
              </p>
            </div>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={onClearAllData}
            >
              Cancella Tutto
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Chiudi
        </Button>
      </div>
    </div>
  );
};