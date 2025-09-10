import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { UserManagement } from './components/auth/UserManagement';
import { ProtectedRoute, usePermissionGuard } from './components/auth/ProtectedRoute';
import { Employee, Store } from './types';
import { useScheduleData } from './hooks/useScheduleData';
import { useShiftRotation } from './hooks/useShiftRotation';
import { usePreferences } from './hooks/usePreferences';
import { useDataLoadingIndicator } from './hooks/useDataLoadingIndicator';
import { useNotifications } from './hooks/useNotifications';
import { useNavigation, View } from './hooks/useNavigation';
import { NavigationBar } from './components/navigation/NavigationBar';


import { EmployeeList } from './components/employees/EmployeeList';
import { EmployeeForm } from './components/employees/EmployeeForm';
import { StoreList } from './components/stores/StoreList';
import { StoreForm } from './components/stores/StoreForm';
import { ScheduleGrid } from './components/schedule/ScheduleGrid';
import { ScheduleHeader } from './components/schedule/ScheduleHeader';
import { TimelineView } from './components/schedule/TimelineView';
import { ShiftValidationPanel } from './components/schedule/ShiftValidationPanel';
import { RotationDashboard } from './components/rotation/RotationDashboard';
import { WeekendRestReport } from './components/reports/WeekendRestReport';
import { UnavailabilityManager } from './components/unavailability/UnavailabilityManager';
import { HourBankDashboard } from './components/hourBank/HourBankDashboard';
import { PreferencesModal } from './components/preferences/PreferencesModal';
import { Modal } from './components/common/Modal';
import { Button } from './components/common/Button';
import { RefreshDataButton } from './components/common/RefreshDataButton';
import { Calendar } from 'lucide-react';
import { exportScheduleToExcel, exportEmployeesToExcel } from './utils/exportUtils';
import { getStartOfWeek, getEndOfWeek } from './utils/timeUtils';

type ModalType = 'employee' | 'store' | 'preferences' | null;

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
    deleteShift,
    addUnavailability,
    updateUnavailability,
    deleteUnavailability
  } = useScheduleData();

  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const { registerSyncCallback, registerCleanupCallback } = useShiftRotation();
  
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    return getStartOfWeek(today);
  });
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  // 🆕 STATO PER TRACKING RIGENERAZIONE
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 🆕 Forza refresh dati da localStorage
  const handleManualDataRefresh = () => {
    console.log('🔄 Manual data refresh requested');
    
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
    
    console.log('✅ Manual refresh completed');
  };
  

  // 🔍 Debug info per troubleshooting
  useEffect(() => {
    if (dataLoaded) {
      console.log('📊 APP STATE SUMMARY:', {
        employees: employees.length,
        stores: stores.length,
        shifts: shifts.length,
        currentView,
        selectedStoreId,
        localStorage: {
          employees: localStorage.getItem('hr-employees')?.length || 0,
          stores: localStorage.getItem('hr-stores')?.length || 0,
          shifts: localStorage.getItem('hr-shifts')?.length || 0
        }
      });
    }
  }, [dataLoaded, employees.length, stores.length, shifts.length]);
  

  // 🆕 DEBUG: Check localStorage on mount
  useEffect(() => {
    console.log('🔍 App mounted - checking localStorage...');
    
    // Check what's actually in localStorage
    const storageData = {
      employees: localStorage.getItem('hr-employees'),
      stores: localStorage.getItem('hr-stores'),
      shifts: localStorage.getItem('hr-shifts')
    };
    
    console.log('💾 localStorage content:', {
      employees: storageData.employees ? `${JSON.parse(storageData.employees).length} items` : 'empty',
      stores: storageData.stores ? `${JSON.parse(storageData.stores).length} items` : 'empty',
      shifts: storageData.shifts ? `${JSON.parse(storageData.shifts).length} items` : 'empty'
    });
    
    console.log('📊 React state:', {
      employees: employees.length,
      stores: stores.length,
      shifts: shifts.length
    });
    
    // If localStorage has data but React state is empty, force refresh
    if (storageData.employees && employees.length === 0) {
      console.log('🔄 Detected data mismatch - forcing refresh...');
      handleManualDataRefresh();
    }
  }, []);
  // 🧹 CALLBACK PULIZIA PREVENTIVA MIGLIORATO
  useEffect(() => {
    console.log('🧹 REGISTRAZIONE CALLBACK PULIZIA PREVENTIVA MIGLIORATO');
    
    registerCleanupCallback((startDate, endDate, storeId) => {
      console.log('🧹 PULIZIA PREVENTIVA AVVIATA:', {
        periodo: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        negozio: storeId,
        shiftsAttuali: shifts.length
      });
      
      setIsRegenerating(true); // Indica che è in corso una rigenerazione
      
      // Filtra i turni da rimuovere con logica più precisa
      const shiftsToRemove = shifts.filter(shift => {
        // Verifica che la data sia valida
        if (!shift.date || !(shift.date instanceof Date) || isNaN(shift.date.getTime())) {
          console.warn('🗑️ Turno con data non valida rimosso:', shift.id);
          return true; // Rimuovi turni con date corrotte
        }
        
        const shiftDate = new Date(shift.date);
        shiftDate.setHours(0, 0, 0, 0); // Normalizza a mezzanotte
        
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        const isInPeriod = shiftDate >= start && shiftDate <= end;
        const isForTargetStore = shift.storeId === storeId;
        
        const shouldRemove = isInPeriod && isForTargetStore;
        
        if (shouldRemove) {
          console.log(`   🎯 Turno da rimuovere: ${shift.id} - ${shiftDate.toLocaleDateString()} - ${shift.employeeId}`);
        }
        
        return shouldRemove;
      });
      
      console.log(`🧹 Trovati ${shiftsToRemove.length} turni da rimuovere su ${shifts.length} totali`);
      
      // RIMOZIONE BATCH OTTIMIZZATA
      if (shiftsToRemove.length > 0) {
        const idsToRemove = shiftsToRemove.map(shift => shift.id);
        console.log('🗑️ IDs da rimuovere:', idsToRemove);
        
        // Rimuovi tutti i turni in una volta
        idsToRemove.forEach(id => {
          try {
            deleteShift(id);
          } catch (error) {
            console.error(`❌ Errore rimozione turno ${id}:`, error);
          }
        });
        
        console.log(`✅ Rimossi ${idsToRemove.length} turni dal periodo selezionato`);
      } else {
        console.log('ℹ️ Nessun turno da rimuovere nel periodo specificato');
      }
      
      console.log('✅ PULIZIA PREVENTIVA COMPLETATA');
    });
  }, [registerCleanupCallback, shifts, deleteShift]);

  // 🔄 CALLBACK SINCRONIZZAZIONE IMMEDIATAMENTE RESPONSIVE
  useEffect(() => {
    console.log('🔗 REGISTRAZIONE CALLBACK SINCRONIZZAZIONE MIGLIORATO');
    
    registerSyncCallback((newShifts) => {
      console.log('🔄 SINCRONIZZAZIONE INIZIATA:', {
        nuoviTurni: newShifts.length,
        rigenerazione: isRegenerating
      });
      
      if (newShifts.length === 0) {
        console.warn('⚠️ Nessun turno da sincronizzare');
        setIsRegenerating(false);
        return;
      }

      // Valida e filtra turni
      const validShifts = newShifts.filter(shift => {
        const isValid = shift.employeeId && 
                       shift.storeId && 
                       shift.date && 
                       shift.date instanceof Date && 
                       !isNaN(shift.date.getTime()) &&
                       shift.startTime && 
                       shift.endTime;
        
        if (!isValid) {
          console.warn('⚠️ Turno non valido scartato:', shift);
        }
        
        return isValid;
      });

      console.log(`✅ Turni validi: ${validShifts.length}/${newShifts.length}`);

      // AGGIUNTA BATCH OTTIMIZZATA
      let addedCount = 0;
      const additionPromises = validShifts.map((newShift, index) => {
        return new Promise<void>((resolve) => {
          try {
            console.log(`   📝 Aggiunta turno ${index + 1}/${validShifts.length}:`, {
              employee: newShift.employeeId,
              store: newShift.storeId,
              date: newShift.date.toLocaleDateString(),
              time: `${newShift.startTime}-${newShift.endTime}`
            });

            addShift({
              employeeId: newShift.employeeId,
              storeId: newShift.storeId,
              date: new Date(newShift.date), // Assicura nuova istanza Date
              startTime: newShift.startTime,
              endTime: newShift.endTime,
              breakDuration: newShift.breakDuration || 30,
              actualHours: newShift.actualHours,
              status: newShift.status === 'assigned' ? 'scheduled' : 
                      newShift.status === 'confirmed' ? 'confirmed' : 'scheduled',
              isLocked: false, // Nuovi turni sempre sbloccati
              notes: newShift.notes || `Generato da rotazione v2.0 - ${new Date().toLocaleString()}`,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            addedCount++;
            resolve();
          } catch (error) {
            console.error(`❌ Errore aggiunta turno ${index + 1}:`, error);
            resolve(); // Non bloccare gli altri
          }
        });
      });

      // Aspetta che tutti i turni siano aggiunti
      Promise.all(additionPromises).then(() => {
        console.log(`🎉 SINCRONIZZAZIONE COMPLETATA! ${addedCount}/${validShifts.length} turni aggiunti`);
        
        setIsRegenerating(false); // Fine rigenerazione
        
        // Notifica utente del successo con dettagli
        if (addedCount > 0) {
          showSuccessNotification(
            `✅ Griglia aggiornata! ${addedCount} turni aggiunti alla settimana ${currentWeek.toLocaleDateString()}`
          );
        }
      });
    });
  }, [registerSyncCallback, addShift, isRegenerating, currentWeek]);


  if (!user || !profile) {
    return <LoginPage />;
  }

  const selectedStore = stores.find(store => store.id === selectedStoreId) || null;

  const handleEmployeeSubmit = (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingEmployee) {
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

  const handleBulkShiftLock = (shiftIds: string[], reason?: string) => {
    console.log(`🔒 Inizio operazione di blocco multiplo: ${shiftIds.length} turni`, reason ? `Motivo: ${reason}` : '');
    
    // Validazione preventiva
    if (!shiftIds.length) {
      console.warn('❌ Nessun turno selezionato per il blocco');
      return;
    }
    
    // Traccia successi e fallimenti
    let successCount = 0;
    let failCount = 0;
    
    shiftIds.forEach(shiftId => {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) {
        console.warn(`❌ Turno non trovato: ${shiftId}`);
        failCount++;
        return;
      }
      
      try {
        console.log(`🔒 Blocco turno: ${shiftId} (${shift.employeeId})`);
        
        const updateData = {
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: 'admin',
          notes: reason ? `${shift.notes || ''}\n[Blocco: ${reason}]`.trim() : shift.notes
        };
        
        updateShift(shiftId, updateData);
        successCount++;
      } catch (error) {
        console.error(`❌ Errore durante il blocco del turno ${shiftId}:`, error);
        failCount++;
      }
    });
    
    // Mostra notifica di completamento
    setTimeout(() => {
      const totalMessage = `✅ Operazione completata: ${successCount}/${shiftIds.length} turni bloccati con successo`;
      console.log(totalMessage);
      if (successCount > 0) {
        showSuccessNotification(totalMessage);
      }
    }, 500);
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

  // Funzione per assicurarsi che il report dei weekend utilizzi i dati corretti dei turni pianificati
  const getWeekendReportData = () => {
    // Utilizzare direttamente i dati dei turni pianificati invece dei dati di rotazione
    return {
      employees: employees,
      stores: stores,
      shifts: shifts // Usa i turni effettivamente pianificati invece dei dati di rotazione
    };
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
      
      {/* Loading overlay durante rigenerazione */}
      {isRegenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-lg font-medium text-gray-900">
                🔄 Rigenerazione turni in corso...
              </span>
            </div>
          </div>
        </div>
      )}

      <NavigationBar
        profile={profile}
        currentView={currentView}
        navigation={navigation}
        onViewChange={setCurrentView}
        onSignOut={signOut}
        onOpenPreferences={() => setModalType('preferences')}
        onRefreshData={handleManualDataRefresh}
        dataStats={{
          employees: employees.length,
          stores: stores.length,
          shifts: shifts.length
        }}
        dataLoaded={dataLoaded}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'rotation' && (
          <ProtectedRoute requiredPermission="generate_schedules">
            <RotationDashboard employees={employees} />
          </ProtectedRoute>
        )}
        
        {(currentView === 'schedule' || currentView === 'timeline' || currentView === 'validation') && (
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
                      onToggleLock={handleShiftToggleLock}
                      onBulkLock={handleBulkShiftLock}
                    />
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
        
        {/* Report Weekend ora sganciato dalla rotazione e collegato ai turni pianificati */}
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
              {...getWeekendReportData()}
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
                <UnavailabilityManager employees={employees} />
              </div>
            </div>
          }>
            <UnavailabilityManager employees={employees} />
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
                console.log('✅ Negozio duplicato:', newStore.name);
                
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
      </main>

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
    </div>
  );
}

export default App;