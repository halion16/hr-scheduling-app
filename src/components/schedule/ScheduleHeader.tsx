import React, { useCallback } from 'react';
import { Store } from '../../types';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { ChevronLeft, ChevronRight, Download, Calendar, FileText, Clock } from 'lucide-react';
import { Scale } from 'lucide-react';
import { getDayOfWeek, getWeekDays, formatDate, addDays, getStartOfWeek, formatWeekNumber } from '../../utils/timeUtils';
import { exportScheduleGridToPDF } from '../../utils/pdfExportUtils';
import { ImportButton } from '../imports/ImportButton';
import { Employee, Shift } from '../../types';

interface ScheduleHeaderProps {
  currentWeek: Date;
  selectedStore: Store | null;
  stores: Store[];
  onWeekChange: (date: Date) => void;
  onStoreChange: (storeId: string) => void;
  onExport: () => void;
  // New props for import functionality
  employees?: Employee[];
  existingShifts?: Shift[];
  onAddShift?: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => Shift | null;
  onAddEmployee?: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Employee;
  onUpdateShift?: (id: string, updates: Partial<Shift>) => void;
}

export const ScheduleHeader: React.FC<ScheduleHeaderProps> = ({
  currentWeek,
  selectedStore,
  stores,
  onWeekChange,
  onStoreChange,
  onExport,
  // New props for import functionality
  employees = [],
  existingShifts = [],
  onAddShift,
  onAddEmployee,
  onUpdateShift
}) => {
  const weekEnd = addDays(currentWeek, 6);
  const weekDays = getWeekDays(currentWeek);
  
  const storeOptions = stores
    .filter(store => store.isActive)
    .map(store => ({
      value: store.id,
      label: store.name
    }));

  const goToPreviousWeek = () => {
    onWeekChange(addDays(currentWeek, -7));
  };

  const goToNextWeek = () => {
    onWeekChange(addDays(currentWeek, 7));
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    onWeekChange(startOfWeek);
  };

  const handlePDFExport = async () => {
    if (!selectedStore) {
      alert('Seleziona un negozio prima di esportare il PDF');
      return;
    }

    console.log('🖨️ Avvio export PDF per negozio:', selectedStore.name);

    try {
      // 🆕 Mostra un messaggio di processo in corso
      const processingMessage = document.createElement('div');
      processingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 18px;
        display: flex;
        align-items: center;
        gap: 15px;
      `;
      
      // Aggiungi un'animazione di caricamento
      const spinner = document.createElement('div');
      spinner.style.cssText = `
        width: 25px;
        height: 25px;
        border: 3px solid rgba(255,255,255,0.3);
        border-top: 3px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      `;
      
      // Aggiungi keyframes per l'animazione
      const style = document.createElement('style');
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
      
      processingMessage.appendChild(spinner);
      processingMessage.appendChild(document.createTextNode('Generazione PDF in corso...'));
      document.body.appendChild(processingMessage);
      
      // Attendi un ciclo di rendering prima di iniziare la generazione
      await new Promise(resolve => setTimeout(resolve, 100));

      await exportScheduleGridToPDF('schedule-grid-container', selectedStore, currentWeek);
      
      // Rimuovi il messaggio di elaborazione
      if (processingMessage.parentNode) {
        processingMessage.parentNode.removeChild(processingMessage);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
      
    } catch (error) {
      console.error('Errore durante l\'export PDF:', error);
      alert('Si è verificato un errore durante la generazione del PDF: ' + error.message);
      
      // Rimuovi il messaggio di elaborazione in caso di errore
      const processingMessage = document.querySelector('div[style*="position: fixed"][style*="top: 50%"]');
      if (processingMessage && processingMessage.parentNode) {
        processingMessage.parentNode.removeChild(processingMessage);
      }
    }
  };

  const formatWeekRange = (start: Date, end: Date) => {
    return `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  // 🎯 CALCOLO ORE TOTALI SETTIMANALI NECESSARIE
  const calculateWeeklyRequiredHours = (store: Store | null): number => {
    if (!store || !store.openingHours) return 0;

    let totalHours = 0;
    
    Object.entries(store.openingHours).forEach(([day, hours]) => {
      if (hours) {
        // Converte orario in minuti per calcolo preciso
        const [openHour, openMin] = hours.open.split(':').map(Number);
        const [closeHour, closeMin] = hours.close.split(':').map(Number);
        
        const openMinutes = openHour * 60 + openMin;
        const closeMinutes = closeHour * 60 + closeMin;
        
        // Calcola ore giornaliere e aggiunge al totale
        const dailyHours = (closeMinutes - openMinutes) / 60;
        totalHours += dailyHours;
      }
    });

    return totalHours;
  };

  const weeklyRequiredHours = calculateWeeklyRequiredHours(selectedStore);
  const openDays = selectedStore?.openingHours ? Object.values(selectedStore.openingHours).filter(h => h).length : 0;
  const avgDailyHours = openDays > 0 ? weeklyRequiredHours / openDays : 0;

  // Function to get store hours for a specific day considering closures and weekly schedules
  const getStoreHoursForDay = useCallback((date: Date) => {
    if (!selectedStore) return null;
    
    const dayOfWeek = getDayOfWeek(date);
    
    // Check for extraordinary closures
    const closureDay = selectedStore.closureDays?.find(closure => 
      closure.date.toDateString() === date.toDateString()
    );
    
    if (closureDay) {
      if (closureDay.isFullDay) {
        return null; // Store completely closed
      } else if (closureDay.customHours) {
        return closureDay.customHours; // Modified hours
      }
    }
    
    // Check for custom weekly schedules
    const weekStart = getStartOfWeek(date);
    const weeklySchedule = selectedStore.weeklySchedules?.find(schedule => 
      schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
    );
    
    if (weeklySchedule) {
      return weeklySchedule.openingHours[dayOfWeek];
    }
    
    // Fallback to standard hours
    return selectedStore.openingHours?.[dayOfWeek];
  }, [selectedStore]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-bold text-gray-900">Pianificazione</h1>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              onClick={goToPreviousWeek}
              className="!p-1.5"
            />
            <div className="flex flex-col items-center min-w-[180px]">
              <div className="text-sm font-medium text-gray-700">
                {formatWeekRange(currentWeek, weekEnd)}
              </div>
              <div className="text-xs text-blue-600 font-medium">
                {formatWeekNumber(currentWeek)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={ChevronRight}
              onClick={goToNextWeek}
              className="!p-1.5"
            />
            <Button
              variant="outline"
              size="sm"
              icon={Calendar}
              onClick={goToCurrentWeek}
              className="!px-2 !py-1.5"
            >
              Oggi
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Select
            value={selectedStore?.id || ''}
            onChange={onStoreChange}
            options={storeOptions}
            placeholder="Seleziona un negozio"
            className="min-w-[160px]"
          />
          
          <div className="flex space-x-1">
            {/* Import Button - solo se le funzioni di callback sono fornite */}
            {onAddShift && onAddEmployee && onUpdateShift && employees && (
              <ImportButton
                employees={employees}
                stores={stores}
                existingShifts={existingShifts || []}
                onAddShift={onAddShift}
                onAddEmployee={onAddEmployee}
                onUpdateShift={onUpdateShift}
                size="sm"
                className="mr-1"
              />
            )}
            
            <Button
              variant="outline"
              icon={Download}
              onClick={onExport}
              disabled={!selectedStore}
              size="sm"
              title="Esporta in Excel"
              className="!px-2 !py-1.5 !text-xs"
            >
              Excel
            </Button>
            <Button
              variant="primary"
              icon={FileText}
              onClick={handlePDFExport}
              disabled={!selectedStore}
              size="sm"
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500 !px-2 !py-1.5 !text-xs"
              title="Esporta PDF per stampa"
            >
              PDF
            </Button>
          </div>
        </div>
      </div>

      {selectedStore && (
        <div className="mt-2 space-y-2">
          {/* 🆕 VERIFICA CHIUSURE STRAORDINARIE PER LA SETTIMANA */}
          {(() => {
            const weekEnd = addDays(currentWeek, 6);
            const weekClosures = selectedStore.closureDays?.filter(closure => {
              const closureDate = new Date(closure.date);
              return closureDate >= currentWeek && closureDate <= weekEnd;
            }) || [];
            
            return weekClosures.length > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-red-700 font-medium">🚫 Chiusure Straordinarie questa settimana:</span>
                </div>
                <div className="space-y-0.5">
                  {weekClosures.map(closure => (
                    <div key={closure.id} className="text-xs text-red-700">
                      • <strong>{closure.date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>: 
                      {closure.isFullDay ? ' Chiuso tutto il giorno' : ` Orari modificati (${closure.customHours?.open}-${closure.customHours?.close})`}
                      <span className="text-red-600"> - {closure.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          
          {/* 🆕 VERIFICA ORARI SETTIMANALI PERSONALIZZATI */}
          {(() => {
            const weekStart = getStartOfWeek(currentWeek);
            const weeklySchedule = selectedStore.weeklySchedules?.find(schedule => 
              schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
            );
            
            return weeklySchedule && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-blue-700 font-medium">📅 Orari personalizzati per questa settimana</span>
                </div>
                {weeklySchedule.notes && (
                  <div className="text-xs text-blue-700 mb-1">
                    📝 <em>{weeklySchedule.notes}</em>
                  </div>
                )}
                <div className="text-xs text-blue-600">
                  Configurato il {weeklySchedule.createdAt.toLocaleDateString('it-IT')}
                </div>
              </div>
            );
          })()}
          
          {/* Sezione Orari di Apertura */}
          <div className="p-2 bg-gray-50 rounded">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-900">{selectedStore.name}</h3>
              <span className="text-xs text-gray-500">
                {(() => {
                  const weekStart = getStartOfWeek(currentWeek);
                  const hasWeeklySchedule = selectedStore.weeklySchedules?.some(schedule => 
                    schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
                  );
                  return hasWeeklySchedule ? 'Orari Settimanali' : 'Orari Standard';
                })()}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {weekDays.map(date => {
                const dayOfWeek = getDayOfWeek(date);
                const storeHours = getStoreHoursForDay(date);
                const closureDay = selectedStore.closureDays?.find(closure => 
                  closure.date.toDateString() === date.toDateString()
                );
                
                const dayNames = {
                  lunedì: 'Lun',
                  martedì: 'Mar',
                  mercoledì: 'Mer',
                  giovedì: 'Gio',
                  venerdì: 'Ven',
                  sabato: 'Sab',
                  domenica: 'Dom'
                };
                
                return (
                  <div key={date.toISOString()} className={`text-center rounded p-1 ${
                    closureDay 
                      ? closureDay.isFullDay 
                        ? 'bg-red-100 border border-red-200' 
                        : 'bg-orange-100 border border-orange-200'
                      : 'bg-white'
                  }`}>
                    <div className="font-medium text-gray-700 text-xs leading-tight">
                      {dayNames[dayOfWeek as keyof typeof dayNames]}
                    </div>
                    <div className={`text-xs font-mono leading-tight ${
                      closureDay 
                        ? closureDay.isFullDay 
                          ? 'text-red-700' 
                          : 'text-orange-700'
                        : 'text-gray-600'
                    }`}>
                      {closureDay 
                        ? closureDay.isFullDay 
                          ? 'CHIUSO' 
                          : `${closureDay.customHours?.open}-${closureDay.customHours?.close}`
                        : storeHours 
                          ? `${storeHours.open}-${storeHours.close}` 
                          : 'Chiuso'
                      }
                    </div>
                    {closureDay && (
                      <div className="text-xs text-red-600 leading-tight" title={closureDay.reason}>
                        {closureDay.reason.slice(0, 8)}...
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🆕 Sezione Ore Totali Necessarie */}
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-3 w-3 text-blue-600" title="Ore totali di copertura richieste per il negozio durante la settimana" />
                <span className="text-xs font-medium text-blue-900">Ore Totali Copertura Settimanale</span>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Ore Totali */}
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-900" title={`${weeklyRequiredHours.toFixed(1)} ore totali di apertura negozio`}>
                    {weeklyRequiredHours.toFixed(1)}h
                  </div>
                  <div className="text-xs text-blue-700 leading-tight">
                    Necessarie
                  </div>
                </div>

                {/* Separatore */}
                <div className="h-6 w-px bg-blue-300"></div>

                {/* Giorni Aperti */}
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-900" title={`${openDays} giorni su 7 in cui il negozio è aperto`}>
                    {openDays}/7
                  </div>
                  <div className="text-xs text-blue-700 leading-tight">
                    Giorni aperti
                  </div>
                </div>

                {/* Separatore */}
                <div className="h-6 w-px bg-blue-300"></div>

                {/* Media Giornaliera */}
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-900" title={`${avgDailyHours.toFixed(1)} ore medie di apertura per giorno`}>
                    {avgDailyHours.toFixed(1)}h
                  </div>
                  <div className="text-xs text-blue-700 leading-tight">
                    Media/giorno
                  </div>
                </div>
              </div>
            </div>

            {/* Info aggiuntiva */}
            <div className="mt-1 pt-1 border-t border-blue-200">
              <div className="text-xs text-blue-800" title="Spiegazione del calcolo delle ore di copertura necessarie">
                💡 <strong>Copertura necessaria:</strong> Queste sono le ore totali che devono essere coperte dai turni per garantire l'apertura del negozio durante tutti gli orari di servizio.
              </div>
            </div>
          </div>
          
          {/* 🏛️ CCNL Compliance Info */}
          <div className="p-2 bg-purple-50 rounded border border-purple-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Scale className="h-3 w-3 text-purple-600" title="Contratto Collettivo Nazionale del Lavoro per il settore commercio - normativa riposi obbligatori" />
                <span className="text-xs font-medium text-purple-900">CCNL del Commercio</span>
              </div>
              <div className="text-xs text-purple-700 bg-white rounded px-2 py-1">
                Compliance Attiva
              </div>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="font-bold text-purple-900" title="Riposo continuativo minimo di 11 ore tra due turni consecutivi">11h</div>
                <div className="text-purple-700 leading-tight">Riposo Giornaliero</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-900" title="Riposo settimanale continuativo minimo di 35 ore">35h</div>
                <div className="text-purple-700 leading-tight">Riposo Settimanale</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-purple-900" title="Massimo 6 giorni lavorativi consecutivi consentiti">Max 6</div>
                <div className="text-purple-700 leading-tight">Giorni Consecutivi</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};