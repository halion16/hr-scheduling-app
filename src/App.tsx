import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { UserManagement } from './components/auth/UserManagement';
import { ProtectedRoute, usePermissionGuard } from './components/auth/ProtectedRoute';
import { Employee, Store } from './types';
import { useScheduleData } from './hooks/useScheduleData';
import { usePreferences } from './hooks/usePreferences';
import { useDataLoadingIndicator } from './hooks/useDataLoadingIndicator';
import { useNotifications } from './hooks/useNotifications';
import { useNavigation, View } from './hooks/useNavigation';
import { Sidebar } from './components/navigation/Sidebar';

import { EmployeeList } from './components/employees/EmployeeList';
import { EmployeeForm } from './components/employees/EmployeeForm';
import { StoreList } from './components/stores/StoreList';
import { StoreForm } from './components/stores/StoreForm';
import { ScheduleGrid } from './components/schedule/ScheduleGrid';
import { ScheduleHeader } from './components/schedule/ScheduleHeader';
import { TimelineView } from './components/schedule/TimelineView';
import { ShiftValidationPanel } from './components/schedule/ShiftValidationPanel';
import { WeekendRestReport } from './components/reports/WeekendRestReport';
import { UnavailabilityManager } from './components/unavailability/UnavailabilityManager';
import { HourBankDashboard } from './components/hourBank/HourBankDashboard';
import { PreferencesModal } from './components/preferences/PreferencesModal';
import { Modal } from './components/common/Modal';
import { Button } from './components/common/Button';
import { RefreshDataButton } from './components/common/RefreshDataButton';
import { ApiSettings } from './components/settings/ApiSettings';
import { EmployeeSyncModal } from './components/employees/EmployeeSyncModal';
import { EmployeeDebugModal } from './components/debug/EmployeeDebugModal';
import { ValidationConfigPanel } from './components/admin/ValidationConfigPanel';
import { WorkloadDashboard } from './components/workload/WorkloadDashboard';
import { AlertPanel } from './components/alerts/AlertPanel';
import { BalancingPanel } from './components/BalancingPanel';
import { useWorkloadAlerts } from './hooks/useWorkloadAlerts';
import { Users, Calendar, CalendarX } from 'lucide-react';
import { exportScheduleToExcel, exportEmployeesToExcel } from './utils/exportUtils';
import { getStartOfWeek, getEndOfWeek } from './utils/timeUtils';
import { ValidationAdminSettings } from './types/validation';
import { ShiftValidationStatus, createWorkflowEngine } from './utils/workflowEngine';
import { Shift } from './types';

type ModalType = 'employee' | 'store' | 'preferences' | 'api-settings' | 'employee-sync' | 'debug' | 'validation-config' | null;

// Main App Component with Authentication
function App() {
  return <AppContent />;
}

// App Content Component (authenticated)
function AppContent() {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL LOGIC
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { renderIfPermission, renderIfRole, hasPermission } = usePermissionGuard();
  const { isLoading, dataLoaded } = useDataLoadingIndicator();
  const { showSuccessNotification, showErrorNotification } = useNotifications();
  const { currentView, navigation, setCurrentView } = useNavigation({ profile, hasPermission });
  
  const {
    employees,
    stores,
    shifts,
    unavailabilities,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addStore,
    updateStore,
    deleteStore,
    addShift,
    updateShift,
    updateShifts,
    deleteShift,
    addUnavailability,
    updateUnavailability,
    deleteUnavailability
  } = useScheduleData();

  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    return getStartOfWeek(today);
  });
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  
  // 🆕 Stato per filtro negozio workload alerts
  const [workloadStoreFilter, setWorkloadStoreFilter] = useState<string>('');
  
  // 🔍 DEBUG: Log dati principali
  console.log('🔍 App.tsx DEBUG:', {
    workloadStoreFilter,
    storesCount: stores.length,
    employeesCount: employees.length,
    shiftsCount: shifts.length,
    storesList: stores.map(s => ({ id: s.id, name: s.name })),
    employeeStores: [...new Set(employees.map(e => e.storeId))],
    currentView
  });
  
  // 🆕 CONFIGURAZIONI VALIDAZIONE AMMINISTRATORE
  const [validationSettings, setValidationSettings] = useState<ValidationAdminSettings>({
    enabled: true,
    enableRealTimeValidation: true,
    dynamicStaffRequirements: {
      enabled: true,
      useHourlyRequirements: false,
      equityThreshold: 20,
      maxHoursVariation: 45 // 🔧 CORRETTO: limite settimanale realistico (non 8!)
    },
    coverageSettings: {
      minimumStaffPerHour: 1,
      minimumOverlapMinutes: 15,
      allowSinglePersonCoverage: false,
      criticalGapThresholdMinutes: 60
    },
    complianceSettings: {
      enforceRestPeriods: true,
      minimumRestHours: 11,
      maxConsecutiveWorkDays: 6,
      weeklyHourLimits: {
        enabled: true,
        maxWeeklyHours: 40,
        overtimeThreshold: 38
      }
    },
    alertSettings: {
      scoreThreshold: 80,
      enableWorkloadAlerts: true,
      enableCoverageAlerts: true,
      enableComplianceAlerts: true
    },
    storeSpecificSettings: {
      enabled: false,
      overrideGlobalSettings: false
    }
  });

  // 🆕 SISTEMA ALERT WORKLOAD
  const workloadAlerts = useWorkloadAlerts({
    employees,
    shifts,
    stores,
    weekStart: currentWeek,
    adminSettings: validationSettings,
    enabled: validationSettings.alertSettings.enableWorkloadAlerts,
    storeFilter: workloadStoreFilter
  });

  // 🆕 Aggiungi contatori alert alla navigazione
  const navigationWithAlerts = React.useMemo(() => {
    return navigation.map(navItem => {
      if (navItem.id === 'workload-dashboard') {
        return {
          ...navItem,
          alertCount: workloadAlerts.alertSummary.total
        };
      }
      return navItem;
    });
  }, [navigation, workloadAlerts.alertSummary.total]);

  // 🆕 Forza refresh dati da localStorage
  const handleManualDataRefresh = () => {
    // Trigghera gli eventi di storage per forzare il refresh
    ['hr-employees', 'hr-stores', 'hr-shifts'].forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        window.dispatchEvent(new StorageEvent('storage', {
          key: key,
          newValue: data,
          oldValue: null,
          storageArea: localStorage,
          url: window.location.href
        }));
      }
    });
  };

  // 🆕 HANDLER CONFIGURAZIONI VALIDAZIONE
  const handleSaveValidationSettings = (newSettings: ValidationAdminSettings) => {
    setValidationSettings(newSettings);
    
    // Salva in localStorage per persistenza
    localStorage.setItem('hr-validation-settings', JSON.stringify(newSettings));
    
    showSuccessNotification('Configurazioni validazione salvate con successo!');
    console.log('🔧 Nuove configurazioni validazione salvate:', newSettings);
  };

  // Carica configurazioni salvate al mount
  React.useEffect(() => {
    const savedSettings = localStorage.getItem('hr-validation-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setValidationSettings(parsedSettings);
        console.log('🔧 Configurazioni validazione caricate dal localStorage:', parsedSettings);
      } catch (error) {
        console.warn('⚠️ Errore caricamento configurazioni validazione:', error);
      }
    }
  }, []);

  // 🆕 DEBUG: Check localStorage on mount
  useEffect(() => {
    // Check what's actually in localStorage
    const storageData = {
      employees: localStorage.getItem('hr-employees'),
      stores: localStorage.getItem('hr-stores'),
      shifts: localStorage.getItem('hr-shifts')
    };
    
    // If localStorage has data but React state is empty, force refresh
    if (storageData.employees && employees.length === 0) {
      handleManualDataRefresh();
    }
  }, []);

  if (!user || !profile) {
    return <LoginPage />;
  }

  const selectedStore = stores.find(store => store.id === selectedStoreId) || null;

  const handleEmployeeSubmit = (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingEmployee) {
      // 🔧 AUTO-FIX: Se il dipendente non ha ID, generane uno nuovo
      if (!editingEmployee.id || editingEmployee.id === 'undefined') {
        console.warn('⚠️ Employee missing ID, generating new one:', editingEmployee);
        const newId = crypto.randomUUID();
        editingEmployee.id = newId;
        console.log('🔧 Generated new ID:', newId);
      }
      console.log('🔄 Updating employee with ID:', editingEmployee.id);
      updateEmployee(editingEmployee.id, data);
    } else {
      addEmployee(data);
    }
    setModalType(null);
    setEditingEmployee(null);
  };

  const handleStoreSubmit = (data: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingStore) {
      updateStore(editingStore.id, data);
    } else {
      addStore(data);
    }
    setModalType(null);
    setEditingStore(null);
  };

  const handleShiftToggleLock = (shiftId: string, reason?: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      updateShift(shiftId, {
        isLocked: !shift.isLocked,
        lockedAt: !shift.isLocked ? new Date() : undefined,
        lockedBy: !shift.isLocked ? 'admin' : undefined
      });
    }
  };

  // NEW: Workflow transition handler using bulk updates to avoid race conditions
  const handleWorkflowTransition = async (shiftsToUpdate: Shift[], targetStatus: ShiftValidationStatus, reason?: string) => {
    console.log(`🔄 Starting workflow transition to ${targetStatus} for ${shiftsToUpdate.length} shifts`);

    try {
      // Create workflow engine
      const workflowEngine = createWorkflowEngine({
        employees,
        stores,
        allShifts: shifts,
        bulkOperation: true
      });

      // Execute bulk workflow transition
      const result = await workflowEngine.executeBulkTransition(
        shiftsToUpdate,
        targetStatus,
        profile?.role || 'user',
        profile?.displayName || 'Utente',
        reason
      );

      console.log(`🎯 Workflow bulk transition result:`, result);

      if (result.successful.length > 0) {
        // Use the new updateShifts function for atomic bulk updates
        const updates = result.successful.map(shift => ({
          id: shift.id,
          data: {
            validationStatus: shift.validationStatus,
            isLocked: targetStatus === 'locked_final',
            lockedAt: targetStatus === 'locked_final' ? new Date() : undefined,
            lockedBy: targetStatus === 'locked_final' ? profile?.displayName : undefined,
            notes: reason ? `${shift.notes || ''}\n[${targetStatus}: ${reason}]`.trim() : shift.notes
          } as Partial<Shift>
        }));

        updateShifts(updates);

        showSuccessNotification(
          `✅ Transizione workflow completata: ${result.successful.length}/${shiftsToUpdate.length} turni aggiornati a "${targetStatus}"`
        );
      }

      if (result.failed.length > 0) {
        const failedMessages = result.failed.map(f => f.error).join(', ');
        showErrorNotification(
          `⚠️ ${result.failed.length} turni non sono stati aggiornati: ${failedMessages}`
        );
      }

      console.log(`📊 Workflow Summary:`, result.summary);

    } catch (error) {
      console.error('❌ Workflow transition failed:', error);
      showErrorNotification('❌ Errore durante la transizione workflow');
    }
  };

  // LEGACY: Keep old function for backward compatibility
  const handleBulkShiftLock = (shiftIds: string[], reason?: string) => {
    const shiftsToUpdate = shifts.filter(shift => shiftIds.includes(shift.id));
    handleWorkflowTransition(shiftsToUpdate, 'locked_final', reason);
  };

  const handleExportSchedule = () => {
    if (!selectedStore) return;
    
    const weekEnd = getEndOfWeek(currentWeek);
    const weekShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= currentWeek && shiftDate <= weekEnd && shift.storeId === selectedStore.id;
    });

    exportScheduleToExcel(weekShifts, employees, stores, currentWeek);
  };

  const handleExportEmployees = () => {
    exportEmployeesToExcel(employees, stores);
  };

  // Handler per sincronizzazione dipendenti da API aziendale (semplice)
  const handleApiEmployeeSync = (apiEmployees: any[]) => {
    apiEmployees.forEach(emp => {
      const existingEmployee = employees.find(existing => existing.id === emp.id);
      if (!existingEmployee) {
        addEmployee({
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone || '',
          position: emp.position,
          department: emp.department,
          hireDate: emp.hireDate,
          isActive: emp.isActive,
          storeId: emp.storeId,
          skills: emp.skills || [],
          maxWeeklyHours: emp.maxWeeklyHours || 40,
          minRestHours: emp.minRestHours || 12,
          preferredShifts: emp.preferredShifts || [],
          contractType: emp.contractType || 'full-time'
        });
      }
    });
    
    showSuccessNotification(`✅ Sincronizzati ${apiEmployees.length} dipendenti da API aziendale!`);
  };

  // 🆕 HANDLERS PER BILANCIAMENTO AUTOMATICO
  const handleApplyBalancingSuggestion = async (suggestion: any) => {
    try {
      console.log('🔄 Applicando suggerimento di bilanciamento:', suggestion);
      
      // Simula l'applicazione del suggerimento (qui implementeresti la logica reale)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showSuccessNotification(`✅ Suggerimento applicato: ${suggestion.title}`);
    } catch (error) {
      console.error('❌ Errore applicazione suggerimento:', error);
      showErrorNotification('❌ Errore durante l\'applicazione del suggerimento');
    }
  };

  const handleApplyAllAutoSuggestions = async (suggestions: any[]) => {
    try {
      console.log('🔄 Applicando tutti i suggerimenti automatici:', suggestions.length);
      
      // Simula l'applicazione di tutti i suggerimenti
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showSuccessNotification(`✅ Applicati ${suggestions.length} suggerimenti automatici con successo!`);
    } catch (error) {
      console.error('❌ Errore applicazione suggerimenti:', error);
      showErrorNotification('❌ Errore durante l\'applicazione dei suggerimenti');
    }
  };

  // Handler per sincronizzazione intelligente con preview
  const handleIntelligentEmployeeSync = (employeesFromModal: Employee[], keepModalOpen = false) => {
    
    let addedCount = 0;
    let updatedCount = 0;
    
    employeesFromModal.forEach(emp => {
      const existingEmployee = employees.find(existing => existing.id === emp.id || existing.email === emp.email);
      
      if (existingEmployee) {
        console.log(`🔄 Aggiornando dipendente esistente: ${emp.firstName} ${emp.lastName} (${emp.email})`);
        // Aggiorna dipendente esistente
        updateEmployee(existingEmployee.id, {
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          position: emp.position,
          department: emp.department,
          isActive: emp.isActive,
          storeId: emp.storeId
          // updatedAt viene aggiunto automaticamente da updateEmployee
        });
        updatedCount++;
      } else {
        // Aggiungi nuovo dipendente - PRESERVA L'ID!
        addEmployee({
          id: emp.id, // 🔧 FIX CRITICO: Preserva l'ID dall'importazione!
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          position: emp.position,
          department: emp.department,
          hireDate: emp.hireDate,
          isActive: emp.isActive,
          storeId: emp.storeId,
          skills: emp.skills || [],
          maxWeeklyHours: emp.maxWeeklyHours || 40,
          minRestHours: emp.minRestHours || 12,
          preferredShifts: emp.preferredShifts || [],
          contractType: emp.contractType || 'full-time'
        });
        addedCount++;
      }
    });

    console.log(`✅ Importazione completata - Aggiunti: ${addedCount}, Aggiornati: ${updatedCount}`);
    
    // Solo chiudi la modale se non è un'importazione singola
    if (!keepModalOpen) {
      setModalType(null);
    }
    
    showSuccessNotification(
      keepModalOpen 
        ? `✅ Dipendente importato: ${employeesFromModal[0]?.firstName} ${employeesFromModal[0]?.lastName}`
        : `✅ Importazione completata: ${addedCount} nuovi, ${updatedCount} aggiornati (${addedCount + updatedCount} totali)`
    );
  };

  const weeklySchedule = {
    weekStart: currentWeek,
    shifts: shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      const weekEnd = getEndOfWeek(currentWeek);
      return shiftDate >= currentWeek && shiftDate <= weekEnd && shift.storeId === selectedStoreId;
    }),
    employees: employees.filter(emp => emp.isActive && emp.storeId === selectedStoreId),
    store: selectedStore!,
    preferences
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🆕 LOADING SCREEN per caricamento iniziale dati */}
      {isLoading && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Caricamento Dati...</h2>
            <p className="text-gray-600">Sincronizzazione con il database locale in corso</p>
          </div>
        </div>
      )}

      <div className="flex h-screen">
        <Sidebar
          profile={profile}
          currentView={currentView}
          navigation={navigationWithAlerts}
          onViewChange={setCurrentView}
          onSignOut={signOut}
          onOpenPreferences={() => setModalType('preferences')}
          onOpenApiSettings={() => setModalType('api-settings')}
          onOpenDebug={() => setModalType('debug')}
          onOpenValidationConfig={() => setModalType('validation-config')}
          onRefreshData={handleManualDataRefresh}
          dataStats={{
            employees: employees.length,
            stores: stores.length,
            shifts: shifts.length
          }}
          dataLoaded={dataLoaded}
        />

        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(currentView === 'schedule' || currentView === 'timeline' || currentView === 'validation' || currentView === 'workload-dashboard') && (
          <ProtectedRoute requiredPermission="manage_shifts">
          <div className="space-y-6">
            <ScheduleHeader
              currentWeek={currentWeek}
              selectedStore={selectedStore}
              stores={stores}
              onWeekChange={setCurrentWeek}
              onStoreChange={setSelectedStoreId}
              onExport={handleExportSchedule}
              // Pass import functionality props
              employees={employees}
              existingShifts={shifts}
              onAddShift={addShift}
              onAddEmployee={addEmployee}
              onUpdateShift={updateShift}
            />
            
            {selectedStore ? (
              <>
                {currentView === 'schedule' && (
                  <ProtectedRoute requiredPermission="manage_shifts" storeId={selectedStore.id}>
                    <ScheduleGrid
                      schedule={weeklySchedule}
                      unavailabilities={unavailabilities}
                      onShiftUpdate={updateShift}
                      onShiftCreate={addShift}
                      onShiftDelete={deleteShift}
                      adminSettings={validationSettings}
                    />
                  </ProtectedRoute>
                )}

                {currentView === 'timeline' && (
                  <ProtectedRoute requiredPermission="view_analytics">
                    <TimelineView
                      schedule={weeklySchedule}
                      onToggleLock={handleShiftToggleLock}
                      onShiftClick={(shiftId) => console.log('Shift clicked:', shiftId)}
                    />
                  </ProtectedRoute>
                )}

                {currentView === 'validation' && (
                  <ProtectedRoute requiredPermission="approve_requests">
                    <ShiftValidationPanel
                      shifts={weeklySchedule.shifts}
                      employees={weeklySchedule.employees}
                      stores={stores}
                      userRole={profile.role}
                      userName={profile?.displayName || 'Utente'}
                      onWorkflowTransition={handleWorkflowTransition}
                    />
                  </ProtectedRoute>
                )}

                {currentView === 'workload-dashboard' && (
                  <ProtectedRoute requiredPermission="view_analytics">
                    <div className="space-y-6">
                      {/* Alert Panel */}
                      {workloadAlerts.hasAlerts && (
                        <AlertPanel
                          alerts={workloadAlerts.alerts}
                          alertSummary={workloadAlerts.alertSummary}
                          stores={stores}
                          selectedStoreId={workloadStoreFilter}
                          onAlertDismiss={(alertId) => {
                            console.log('Alert dismissed:', alertId);
                          }}
                          onAlertAction={(alert) => {
                            console.log('Alert action:', alert);
                            showSuccessNotification(`Azione richiesta per: ${alert.title}`);
                          }}
                          onStoreFilterChange={setWorkloadStoreFilter}
                          onJustifyUnderload={(alert, reason) => {
                            console.log('🔵 Giustificazione sottoutilizzo:', { alert: alert.employeeName, reason });
                            showSuccessNotification(`Sottoutilizzo giustificato per ${alert.employeeName}: ${reason}`);
                            // TODO: Implementare logica di persistenza giustificazione
                          }}
                          onMoveToHourBank={(alert, hours) => {
                            console.log('🟢 Spostamento in banca ore:', { alert: alert.employeeName, hours });
                            showSuccessNotification(`${hours}h spostate in banca ore per ${alert.employeeName}`);
                            // TODO: Implementare logica di persistenza banca ore
                          }}
                        />
                      )}

                      {/* Balancing Panel */}
                      <BalancingPanel
                        employees={employees}
                        shifts={shifts}
                        stores={stores}
                        weekStart={currentWeek}
                        adminSettings={validationSettings}
                        selectedStoreId={workloadStoreFilter}
                        onApplySuggestion={handleApplyBalancingSuggestion}
                        onApplyAllAutoSuggestions={handleApplyAllAutoSuggestions}
                        onStoreFilterChange={setWorkloadStoreFilter}
                      />
                      
                      {/* Workload Dashboard */}
                      <WorkloadDashboard
                        employees={employees}
                        shifts={shifts}
                        stores={stores}
                        weekStart={currentWeek}
                        adminSettings={validationSettings}
                        storeFilter={workloadStoreFilter}
                      />
                    </div>
                  </ProtectedRoute>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Seleziona un Negozio</h3>
                <p className="text-gray-500">Scegli un negozio dal menu a discesa per visualizzare e modificare i turni</p>
              </div>
            )}
          </div>
          </ProtectedRoute>
        )}
        
        {/* Report Weekend */}
        {currentView === 'weekend-report' && (
          <ProtectedRoute requiredPermission="view_analytics">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-semibold text-gray-900">Report Riposi Weekend</h2>
                  <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">✓ Dati turni pianificati</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeek(getStartOfWeek(new Date()))}
                  icon={Calendar}
                >
                  Aggiorna Periodo
                </Button>
              </div>
            </div>
            
            <WeekendRestReport
              employees={employees}
              stores={stores}
              shifts={shifts}
            />
          </div>
          </ProtectedRoute>
        )}

        {currentView === 'unavailability' && (
          <ProtectedRoute requiredPermission="approve_requests" fallback={
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center">
                <CalendarX className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Vista Limitata</h3>
                <p className="text-gray-500 mb-4">Puoi solo visualizzare le indisponibilità ma non approvarle o gestirle.</p>
                <UnavailabilityManager 
                  employees={employees}
                  unavailabilities={unavailabilities}
                  onAddUnavailability={addUnavailability}
                  onUpdateUnavailability={updateUnavailability}
                  onDeleteUnavailability={deleteUnavailability}
                />
              </div>
            </div>
          }>
            <UnavailabilityManager 
              employees={employees}
              unavailabilities={unavailabilities}
              onAddUnavailability={addUnavailability}
              onUpdateUnavailability={updateUnavailability}
              onDeleteUnavailability={deleteUnavailability}
            />
          </ProtectedRoute>
        )}

        {currentView === 'hour-bank' && (
          <ProtectedRoute requiredPermission="manage_hour_bank">
            <HourBankDashboard employees={employees} />
          </ProtectedRoute>
        )}

        {currentView === 'employees' && (
          <ProtectedRoute requiredPermission="manage_employees">
          <div>
            {renderIfPermission('export_data', (
              <div className="flex justify-end mb-4">
                <Button onClick={handleExportEmployees} variant="outline" icon={Users}>
                  Esporta Dipendenti
                </Button>
              </div>
            ))}
            <EmployeeList
              employees={employees}
              stores={stores}
              onEdit={(employee) => {
                setEditingEmployee(employee);
                setModalType('employee');
              }}
              onDelete={deleteEmployee}
              onAdd={() => setModalType('employee')}
              onSync={() => setModalType('employee-sync')}
            />
          </div>
          </ProtectedRoute>
        )}

        {currentView === 'stores' && (
          <ProtectedRoute requiredPermission="manage_stores">
            <StoreList
              stores={stores}
              onEdit={(store) => {
                setEditingStore(store);
                setModalType('store');
              }}
              onDelete={deleteStore}
              onAdd={() => setModalType('store')}
              onDuplicate={(storeData) => {
                const newStore = addStore(storeData);
                
                // Mostra notifica di successo
                showSuccessNotification(
                  `✅ Negozio "${newStore.name}" creato come copia con tutti gli orari!`
                );
              }}
            />
          </ProtectedRoute>
        )}

        {currentView === 'users' && (
          <ProtectedRoute requiredPermission="manage_users">
            <UserManagement stores={stores} />
          </ProtectedRoute>
        )}
          </div>

          <Modal
        isOpen={modalType === 'employee'}
        onClose={() => {
          setModalType(null);
          setEditingEmployee(null);
        }}
        title={editingEmployee ? 'Modifica Dipendente' : 'Aggiungi Dipendente'}
      >
        <ProtectedRoute requiredPermission="manage_employees">
        <EmployeeForm
          employee={editingEmployee || undefined}
          stores={stores}
          onSubmit={handleEmployeeSubmit}
          onCancel={() => {
            setModalType(null);
            setEditingEmployee(null);
          }}
        />
        </ProtectedRoute>
      </Modal>

      <Modal
        isOpen={modalType === 'store'}
        onClose={() => {
          setModalType(null);
          setEditingStore(null);
        }}
        title={editingStore ? 'Modifica Negozio' : 'Aggiungi Negozio'}
        size="xl"
      >
        <ProtectedRoute requiredPermission="manage_stores">
        <StoreForm
          store={editingStore || undefined}
          onSubmit={handleStoreSubmit}
          onCancel={() => {
            setModalType(null);
            setEditingStore(null);
          }}
          onUpdateStore={editingStore ? updateStore : undefined}
        />
        </ProtectedRoute>
      </Modal>

      <PreferencesModal
        isOpen={modalType === 'preferences'}
        onClose={() => setModalType(null)}
        preferences={preferences}
        onSave={updatePreferences}
        onReset={() => {
          resetPreferences();
          setModalType(null);
        }}
      />

      {/* Modal API Settings */}
      <ApiSettings
        isOpen={modalType === 'api-settings'}
        onClose={() => setModalType(null)}
        onEmployeeSync={handleApiEmployeeSync}
      />

      {/* Modal Employee Sync */}
      <EmployeeSyncModal
        isOpen={modalType === 'employee-sync'}
        onClose={() => setModalType(null)}
        onEmployeesImport={handleIntelligentEmployeeSync}
        stores={stores}
        existingEmployees={employees}
      />

      {/* Modal Debug Dipendenti */}
      <EmployeeDebugModal
        isOpen={modalType === 'debug'}
        onClose={() => setModalType(null)}
      />

      {/* Modal Configurazione Validazione (Solo Admin) */}
      {profile?.role === 'admin' && (
        <ValidationConfigPanel
          isOpen={modalType === 'validation-config'}
          onClose={() => setModalType(null)}
          currentSettings={validationSettings}
          onSave={handleSaveValidationSettings}
        />
      )}
        </main>
      </div>
    </div>
  );
}

export default App;