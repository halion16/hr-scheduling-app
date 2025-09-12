import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Employee, Store, Shift, WeeklySchedule, Preferences, EmployeeUnavailability } from '../../types';
import { ValidationAdminSettings } from '../../types/validation';
import { ShiftCell } from './ShiftCell';
import { ValidationPanel } from './ValidationPanel';
import { formatDate, getWeekDays, getDayOfWeek, getStartOfWeek } from '../../utils/timeUtils';
import { validateShiftComplete, validateEmployeeWorkHours, calculateWorkHourStats } from '../../utils/validationUtils';
import { CCNLCompliancePanel } from './CCNLCompliancePanel';
import { useShiftClipboard } from '../../hooks/useShiftClipboard';
import { useShiftTemplates } from '../../hooks/useShiftTemplates';
import { useStaffPlanning } from '../../hooks/useStaffPlanning';
import { Clock, Users, AlertTriangle, CheckCircle, Calendar, Shield, BarChart3, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Scale } from 'lucide-react';
import { Button } from '../common/Button';

interface ScheduleGridProps {
  schedule: WeeklySchedule & { preferences: Preferences };
  unavailabilities: EmployeeUnavailability[];
  onShiftUpdate: (id: string, updates: Partial<Shift>) => void;
  onShiftCreate: (shiftData: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onShiftDelete: (shiftId: string) => void;
  adminSettings?: ValidationAdminSettings;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  schedule,
  unavailabilities,
  onShiftUpdate,
  onShiftCreate,
  onShiftDelete,
  adminSettings
}) => {
  const { weekStart, shifts, employees, store, preferences } = schedule;
  
  const weekDays = getWeekDays(weekStart);
  const activeEmployees = employees.filter(emp => emp.isActive);

  // Filter unavailabilities for current week and active employees
  const weeklyUnavailabilities = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    return unavailabilities.filter(unavail => {
      // Check if unavailability overlaps with current week
      const unavailStart = new Date(unavail.startDate);
      unavailStart.setHours(0, 0, 0, 0);
      const unavailEnd = new Date(unavail.endDate);
      unavailEnd.setHours(23, 59, 59, 999);
      
      const weekStartNorm = new Date(weekStart);
      weekStartNorm.setHours(0, 0, 0, 0);
      const weekEndNorm = new Date(weekEnd);
      weekEndNorm.setHours(23, 59, 59, 999);
      
      return unavailStart <= weekEndNorm && unavailEnd >= weekStartNorm;
    });
  }, [unavailabilities, weekStart]);

  // 🔄 STATO PER FORZARE AGGIORNAMENTI VISUALI
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const [lastShiftsCount, setLastShiftsCount] = useState(shifts.length);
  const [isGridUpdating, setIsGridUpdating] = useState(false);
  const [showCCNLPanel, setShowCCNLPanel] = useState(false);
  const [ccnlPanelCollapsed, setCCNLPanelCollapsed] = useState(true);

  // 🆕 Hook per requisiti personale e eventi di ponderazione
  const { calculateStaffNeeds, getEventsInRange } = useStaffPlanning();

  // 🎯 RILEVA CAMBIAMENTI NEI TURNI E FORZA AGGIORNAMENTO
  useEffect(() => {
    if (shifts.length !== lastShiftsCount) {
      console.log('🔄 RILEVATO CAMBIAMENTO TURNI:', {
        precedenti: lastShiftsCount,
        attuali: shifts.length,
        differenza: shifts.length - lastShiftsCount
      });

      setIsGridUpdating(true);
      setForceUpdateKey(prev => prev + 1);
      setLastShiftsCount(shifts.length);

      // Mostra indicatore di aggiornamento per un breve periodo
      const timer = setTimeout(() => {
        setIsGridUpdating(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [shifts.length, lastShiftsCount]);

  // 🔄 AGGIORNAMENTO FORZATO QUANDO CAMBIANO I TURNI DELLA SETTIMANA CORRENTE
  const weeklyShiftsSignature = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weeklyShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= weekStart && shiftDate <= weekEnd && shift.storeId === store.id;
    });

    // Crea una signature unica basata sui turni della settimana
    return weeklyShifts.map(shift => 
      `${shift.id}-${shift.date.toISOString()}-${shift.startTime}-${shift.endTime}-${shift.employeeId}`
    ).sort().join('|');
  }, [shifts, weekStart, store.id]);

  // 📊 MEMOIZED WEEKLY SCHEDULE CON AGGIORNAMENTO AUTOMATICO
  const optimizedWeeklyShifts = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const filteredShifts = shifts.filter(shift => {
      if (!shift.date || !(shift.date instanceof Date) || isNaN(shift.date.getTime())) {
        console.warn('⚠️ Turno con data non valida filtrato:', shift.id);
        return false;
      }
      
      const shiftDate = new Date(shift.date);
      const isInWeek = shiftDate >= weekStart && shiftDate <= weekEnd;
      const isForStore = shift.storeId === store.id;
      
      return isInWeek && isForStore;
    });


    return filteredShifts;
  }, [shifts, weekStart, store.id, weeklyShiftsSignature, forceUpdateKey]);

  // Stato per il pannello di validazione
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [validationCollapsed, setValidationCollapsed] = useState(false);

  const { 
    copyShift, 
    pasteShift, 
    isSourceCell, 
    hasClipboard 
  } = useShiftClipboard();

  const { 
    templates, 
    incrementUsage, 
    analyzeShiftsForTemplates 
  } = useShiftTemplates();

  // Analizza i turni esistenti per pattern ricorrenti
  useEffect(() => {
    if (optimizedWeeklyShifts.length > 10) {
      analyzeShiftsForTemplates(optimizedWeeklyShifts);
    }
  }, [optimizedWeeklyShifts.length]);

  // 🔧 FUNZIONE GET SHIFT OTTIMIZZATA CON MEMOIZATION
  const getShiftForEmployeeAndDate = useCallback((employeeId: string, date: Date): Shift | undefined => {
    return optimizedWeeklyShifts.find(shift => 
      shift.employeeId === employeeId && 
      shift.date.toDateString() === date.toDateString()
    );
  }, [optimizedWeeklyShifts]);

  // 🔧 FIXED: Robust handleShiftChange with comprehensive validation
  const handleShiftChange = useCallback((employee: Employee, date: Date, shiftData: Partial<Shift>) => {
    console.log('🔄 HANDLESHIFTCHANGE called with:', {
      employee: employee?.id,
      date: date?.toISOString(),
      shiftData: shiftData
    });

    // 🛡️ CRITICAL VALIDATION: Check all inputs
    if (!employee) {
      console.error('❌ Employee is undefined');
      return;
    }

    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.error('❌ Date is invalid:', date);
      return;
    }

    if (!shiftData || typeof shiftData !== 'object') {
      console.error('❌ shiftData is invalid:', shiftData);
      return;
    }

    // Validate required fields in shiftData
    if (!shiftData.startTime || !shiftData.endTime) {
      console.error('❌ Missing required time fields in shiftData:', shiftData);
      return;
    }

    const existingShift = getShiftForEmployeeAndDate(employee.id, date);
    
    console.log('🔍 Existing shift found:', existingShift?.id || 'none');
    
    if (existingShift) {
      // 🔒 Check lock permissions
      if (existingShift.isLocked && preferences.userRole !== 'admin') {
        console.warn('⛔ Cannot modify locked shift');
        return;
      }
      
      // 🔧 CRITICAL FIX: Ensure both objects are valid before spreading
      if (!existingShift || typeof existingShift !== 'object') {
        console.error('❌ Existing shift is corrupted:', existingShift);
        return;
      }

      // Create update object with safe spreading
      const updateData: Shift = {
        ...existingShift, // Safe because we validated existingShift
        ...shiftData,     // Safe because we validated shiftData
        updatedAt: new Date()
      };

      // 🛡️ Final validation of update object
      if (!updateData || typeof updateData !== 'object') {
        console.error('❌ CRITICAL: Generated updateData is invalid');
        return;
      }

      // Ensure required fields are still present after spreading
      if (!updateData.id || !updateData.employeeId || !updateData.storeId) {
        console.error('❌ CRITICAL: Required fields missing after spreading:', updateData);
        return;
      }

      console.log('✅ CALLING onShiftUpdate with validated data:', updateData);
      
      try {
        onShiftUpdate(existingShift.id, shiftData);
        console.log('✅ onShiftUpdate completed successfully');
      } catch (error) {
        console.error('❌ Error in onShiftUpdate:', error);
      }
      
    } else {
      // 🆕 Creating new shift
      console.log('🆕 Creating new shift...');

      // Validate required fields for new shift
      if (!shiftData.startTime || !shiftData.endTime) {
        console.error('❌ Cannot create shift: missing required fields');
        return;
      }

      // 🔧 Safe new shift creation
      const newShiftData: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'> = {
        employeeId: employee.id,
        storeId: store.id,
        date: new Date(date), // Ensure we create a new Date object
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        breakDuration: shiftData.breakDuration || preferences.defaultBreakDuration,
        actualHours: shiftData.actualHours || 0,
        status: 'scheduled',
        isLocked: false,
        notes: shiftData.notes
      };

      // 🛡️ Validate new shift data
      if (!newShiftData.employeeId || !newShiftData.storeId || !newShiftData.date) {
        console.error('❌ CRITICAL: Invalid new shift data:', newShiftData);
        return;
      }

      console.log('✅ CALLING onShiftCreate with validated data:', newShiftData);
      
      try {
        onShiftCreate(newShiftData);
        console.log('✅ onShiftCreate completed successfully');
      } catch (error) {
        console.error('❌ Error in onShiftCreate:', error);
      }
    }
  }, [getShiftForEmployeeAndDate, preferences.userRole, preferences.defaultBreakDuration, store.id, onShiftUpdate, onShiftCreate]);

  const handleCopyShift = useCallback((employee: Employee, date: Date, shift: Shift) => {
    copyShift({
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakDuration: shift.breakDuration,
      notes: shift.notes
    }, employee.id, date);
  }, [copyShift]);

  const handlePasteShift = useCallback((employee: Employee, date: Date) => {
    const copiedShift = pasteShift();
    if (copiedShift) {
      const breakMinutes = copiedShift.breakDuration || preferences.defaultBreakDuration;
      const actualHours = calculateWorkingHours(copiedShift.startTime, copiedShift.endTime, breakMinutes);
      
      handleShiftChange(employee, date, {
        startTime: copiedShift.startTime,
        endTime: copiedShift.endTime,
        breakDuration: breakMinutes,
        actualHours,
        status: 'scheduled',
        notes: copiedShift.notes
      });
    }
    return copiedShift;
  }, [pasteShift, preferences.defaultBreakDuration, handleShiftChange]);

  const handleApplyTemplate = useCallback((employee: Employee, date: Date, templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const actualHours = calculateWorkingHours(template.startTime, template.endTime, template.breakDuration);
      
      handleShiftChange(employee, date, {
        startTime: template.startTime,
        endTime: template.endTime,
        breakDuration: template.breakDuration,
        actualHours,
        status: 'scheduled'
      });

      incrementUsage(templateId);
    }
  }, [templates, handleShiftChange, incrementUsage]);

  // 🔧 FIXED CALCULATION: Improved working hours calculation
  const calculateWorkingHours = useCallback((start: string, end: string, breakMinutes: number): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    
    // CRITICAL: Ensure break minutes is treated as number
    const breakMins = Number(breakMinutes) || 0;
    const workingMinutes = Math.max(0, endTotalMin - startTotalMin - breakMins);
    
    console.log('🧮 Calculating hours:', {
      start: `${startHour}:${startMin}`,
      end: `${endHour}:${endMin}`,
      startMin: startTotalMin,
      endMin: endTotalMin,
      breakMins,
      workingMinutes,
      hours: workingMinutes / 60
    });
    
    return workingMinutes / 60;
  }, []);

  const getStoreHoursForDay = useCallback((date: Date) => {
    const dayOfWeek = getDayOfWeek(date);
    
    // 🆕 VERIFICA CHIUSURE STRAORDINARIE
    const closureDay = store.closureDays?.find(closure => 
      closure.date.toDateString() === date.toDateString()
    );
    
    if (closureDay) {
      if (closureDay.isFullDay) {
        return null; // Negozio completamente chiuso
      } else if (closureDay.customHours) {
        return closureDay.customHours; // Orari modificati
      }
    }
    
    // 🆕 VERIFICA ORARI SETTIMANALI PERSONALIZZATI
    const weekStart = getStartOfWeek(date);
    const weeklySchedule = store.weeklySchedules?.find(schedule => 
      schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
    );
    
    if (weeklySchedule) {
      return weeklySchedule.openingHours[dayOfWeek];
    }
    
    // Fallback agli orari standard - con controllo sicurezza
    return store.openingHours ? store.openingHours[dayOfWeek] : null;
  }, [store.openingHours]);

  // Calcolo avanzato delle ore settimanali con validazione
  const calculateWeeklyHours = useCallback((employee: Employee) => {
    const employeeShifts = weekDays.map(date => getShiftForEmployeeAndDate(employee.id, date)).filter(Boolean) as Shift[];
    
    const weeklyHours = employeeShifts.reduce((total, shift) => total + shift.actualHours, 0);
    const totalShifts = employeeShifts.length;
    const lockedShifts = employeeShifts.filter(shift => shift.isLocked).length;

    // 🆕 CALCOLA REQUISITI PERSONALE PER LA SETTIMANA
    const weekStaffNeeds = weekDays.map(date => {
      const staffNeed = calculateStaffNeeds(store.id, date);
      return {
        date,
        staffNeed,
        dayShifts: optimizedWeeklyShifts.filter(s => s.date.toDateString() === date.toDateString())
      };
    });
    
    // Calcola statistiche ore lavorative
    const workStats = calculateWorkHourStats(employee, weeklyHours);
    
    // Valida ore lavorative
    const workHourConflicts = validateEmployeeWorkHours(employee, weeklyHours, employeeShifts);

    return {
      total: Number(weeklyHours.toFixed(1)),
      shifts: totalShifts,
      locked: lockedShifts,
      workStats,
      conflicts: workHourConflicts,
      isOvertime: workStats.isEccedente,
      isUnderMinimum: workStats.isSottoMinimo,
      isInRange: workStats.isNelRange,
      weekStaffNeeds // 🆕 Aggiunto per future implementazioni
    };
  }, [weekDays, getShiftForEmployeeAndDate]);

  // Statistiche generali della settimana
  const weekStats = useMemo(() => {
    const totalShifts = optimizedWeeklyShifts.length;
    const lockedShifts = optimizedWeeklyShifts.filter(s => s.isLocked).length;
    const totalHours = optimizedWeeklyShifts.reduce((sum, s) => sum + s.actualHours, 0);
    const avgHoursPerEmployee = activeEmployees.length > 0 
      ? totalHours / activeEmployees.length 
      : 0;

    return {
      totalShifts,
      lockedShifts,
      totalHours: Number(totalHours.toFixed(1)),
      avgHoursPerEmployee: Number(avgHoursPerEmployee.toFixed(1)),
      completionRate: totalShifts > 0 ? (lockedShifts / totalShifts * 100) : 0
    };
  }, [optimizedWeeklyShifts, activeEmployees]);

  const handleValidationToggle = useCallback(() => {
    setShowValidationPanel(!showValidationPanel);
    if (!showValidationPanel) {
      console.log('🔍 Avvio validazione griglia turni...');
    }
  }, [showValidationPanel]);

  // 🔄 FUNZIONE AGGIORNAMENTO MANUALE
  const handleManualRefresh = useCallback(() => {
    console.log('🔄 AGGIORNAMENTO MANUALE GRIGLIA RICHIESTO');
    setForceUpdateKey(prev => prev + 1);
    setIsGridUpdating(true);
    
    setTimeout(() => {
      setIsGridUpdating(false);
    }, 500);
  }, []);

  return (
    <div className="space-y-4">
      {/* Pannello di Validazione */}
      {showValidationPanel && (
        <ValidationPanel
          store={store}
          shifts={optimizedWeeklyShifts}
          employees={activeEmployees}
          weekStart={weekStart}
          adminSettings={adminSettings}
          isCollapsed={validationCollapsed}
          onToggleCollapse={() => setValidationCollapsed(!validationCollapsed)}
        />
      )}

      {/* Griglia principale con ID specifico per PDF */}
      <div id="schedule-grid-container" className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print-optimized transition-all duration-300 ${isGridUpdating ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`} key={forceUpdateKey} style={{maxWidth: '100%'}}>
        {/* Header compatto */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 leading-tight">{store.name}</h3>
                <p className="text-sm text-gray-600 leading-tight">Settimana {weekStart.toLocaleDateString('it-IT')}</p>
                {isGridUpdating && (
                  <p className="text-xs text-blue-600 font-medium">🔄 Aggiornamento in corso...</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Statistiche compatte inline */}
              <div className="flex items-center gap-3 text-sm no-print">
                <span className="flex items-center gap-1 bg-white rounded px-2 py-1">
                  <span className="font-bold text-blue-600">{weekStats.totalShifts}</span>
                  <span className="text-gray-600">turni</span>
                </span>
                <span className="flex items-center gap-1 bg-white rounded px-2 py-1">
                  <span className="font-bold text-green-600">{weekStats.lockedShifts}</span>
                  <span className="text-gray-600">confermati</span>
                </span>
                <span className="flex items-center gap-1 bg-white rounded px-2 py-1">
                  <span className="font-bold text-purple-600">{weekStats.totalHours}h</span>
                  <span className="text-gray-600">totali</span>
                </span>
              </div>

              {/* Pulsante Aggiornamento Manuale */}
              <Button
                onClick={handleManualRefresh}
                variant="outline"
                icon={RefreshCw}
                size="sm"
                className={`!px-3 !py-2 !text-sm transition-all duration-200 no-print ${
                  isGridUpdating ? 'animate-spin' : 'hover:bg-blue-50'
                }`}
                title="Aggiorna griglia manualmente"
              >
                Aggiorna
              </Button>

              {/* Pulsante Validazione */}
              <Button
                onClick={handleValidationToggle}
                variant={showValidationPanel ? "primary" : "outline"}
                icon={Shield}
                size="sm"
                className={`!px-3 !py-2 !text-sm transition-all duration-200 no-print ${
                  showValidationPanel 
                    ? 'bg-blue-600 text-white' 
                    : 'text-blue-600 border-blue-600 hover:bg-blue-50'
                }`}
              >
                Validazione
              </Button>
              
              {/* Pulsante CCNL Compliance */}
              <Button
                onClick={() => setShowCCNLPanel(!showCCNLPanel)}
                variant={showCCNLPanel ? "primary" : "outline"}
                icon={Scale}
                size="sm"
                className={`!px-3 !py-2 !text-sm transition-all duration-200 no-print ${
                  showCCNLPanel 
                    ? 'bg-purple-600 text-white' 
                    : 'text-purple-600 border-purple-600 hover:bg-purple-50'
                }`}
              >
                CCNL
              </Button>
            </div>
          </div>

          {/* Indicatore aggiornamento */}
          {isGridUpdating && (
            <div className="mt-3 flex items-center justify-center no-print">
              <div className="bg-blue-100 border border-blue-200 rounded px-3 py-1 flex items-center space-x-2">
                <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-blue-800">Sincronizzazione turni...</span>
              </div>
            </div>
          )}

          {/* Indicatore validazione */}
          {showValidationPanel && !isGridUpdating && (
            <div className="mt-3 flex items-center justify-center no-print">
              <div className="bg-blue-100 border border-blue-200 rounded px-3 py-1 flex items-center space-x-2">
                <BarChart3 className="h-3 w-3 text-blue-600 animate-pulse" />
                <span className="text-sm font-medium text-blue-800">Controllo qualità attivo</span>
              </div>
            </div>
          )}
        </div>

        {/* Griglia turni */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            {/* Header giorni */}
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 min-w-[160px]">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>Dipendente</span>
                  </div>
                </th>
                {weekDays.map((date) => {
                  const storeHours = getStoreHoursForDay(date);
                  const dayShifts = optimizedWeeklyShifts.filter(s => s.date.toDateString() === date.toDateString());
                  
                  // 🆕 CALCOLA REQUISITI PERSONALE E EVENTI
                  const staffNeed = calculateStaffNeeds(store.id, date);
                  const eventsForDay = getEventsInRange(date, date, store.id);
                  const closureDay = store.closureDays?.find(closure => 
                    closure.date.toDateString() === date.toDateString()
                  );
                  
                  return (
                    <th key={date.toISOString()} className="px-3 py-3 text-center text-sm font-semibold text-gray-900 min-w-[120px] border-r border-gray-200">
                      <div className="h-20 flex flex-col">
                        <div className="font-bold h-6 flex items-center justify-center">{formatDate(date)}</div>
                        
                        {/* Layout compatto orizzontale - contenuto variabile */}
                        <div className="flex-1 space-y-1 mt-2">
                          {/* Riga 1: Orari negozio */}
                          {closureDay ? (
                            closureDay.isFullDay ? (
                              <div 
                                className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 cursor-help"
                                title={`🚫 Chiusura: ${closureDay.reason}${closureDay.notes ? `\nNote: ${closureDay.notes}` : ''}`}
                              >
                                🚫 CHIUSO
                              </div>
                            ) : (
                              <div 
                                className="text-xs text-orange-700 bg-orange-100 rounded px-2 py-1 cursor-help"
                                title={`🕐 Orari modificati: ${closureDay.reason}${closureDay.notes ? `\nNote: ${closureDay.notes}` : ''}`}
                              >
                                🕐 {closureDay.customHours?.open}-{closureDay.customHours?.close}
                              </div>
                            )
                          ) : storeHours ? (
                            <div 
                              className="text-xs text-green-700 bg-green-100 rounded px-2 py-1 cursor-help"
                              title={`🏪 Orari standard negozio: ${storeHours.open} - ${storeHours.close}`}
                            >
                              🏪 {storeHours.open}-{storeHours.close}
                            </div>
                          ) : (
                            <div 
                              className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 no-print cursor-help"
                              title="🚫 Negozio chiuso in questo giorno"
                            >
                              🚫 Chiuso
                            </div>
                          )}
                          
                          {/* Riga 2: Indicatori compatti in flex */}
                          <div className="flex items-center justify-center space-x-1 flex-wrap">
                            {/* Eventi di ponderazione */}
                            {eventsForDay.length > 0 && (
                              <div 
                                className="text-xs bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5 cursor-help flex items-center"
                                title={`📅 Eventi di ponderazione attivi: ${eventsForDay.map(e => e.name).join(', ')}`}
                              >
                                📅 {eventsForDay.length}
                              </div>
                            )}
                            
                            {/* Requisiti personale */}
                            {staffNeed && (
                              <div 
                                className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 cursor-help flex items-center"
                                title={`👥 Personale richiesto: ${staffNeed.calculatedStaff.reduce((sum, role) => sum + role.weightedMin, 0)} - ${staffNeed.calculatedStaff.reduce((sum, role) => sum + role.weightedMax, 0)} dipendenti`}
                              >
                                👥 {staffNeed.calculatedStaff.reduce((sum, role) => sum + role.weightedMin, 0)}-{staffNeed.calculatedStaff.reduce((sum, role) => sum + role.weightedMax, 0)}
                              </div>
                            )}
                            
                            {/* Moltiplicatore attivo */}
                            {staffNeed && staffNeed.finalMultiplier !== 1 && (
                              <div 
                                className={`text-xs rounded px-1.5 py-0.5 cursor-help flex items-center ${
                                  staffNeed.finalMultiplier > 1 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}
                                title={`⚡ Moltiplicatore personale attivo: ${staffNeed.finalMultiplier}x${staffNeed.finalMultiplier > 1 ? ' (aumenta personale richiesto)' : ' (riduce personale richiesto)'}`}
                              >
                                ⚡ {staffNeed.finalMultiplier}x
                              </div>
                            )}
                            
                            {/* Turni programmati */}
                            {dayShifts.length > 0 && (
                              <div 
                                className="text-xs text-blue-600 font-medium no-print bg-blue-50 rounded px-1.5 py-0.5 cursor-help"
                                title={`📋 Turni programmati: ${dayShifts.length} turni assegnati per questo giorno`}
                              >
                                📋 {dayShifts.length}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[100px]">
                  <div className="flex items-center justify-center space-x-1">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Ore Totali</span>
                  </div>
                </th>
              </tr>
            </thead>
            
            {/* Righe dipendenti */}
            <tbody className="bg-white">
              {activeEmployees.map((employee, index) => {
                const weekHours = calculateWeeklyHours(employee);
                const hasWorkHourIssues = weekHours.conflicts.length > 0;
                
                return (
                  <tr key={`${employee.id}-${forceUpdateKey}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                    {/* Colonna dipendente */}
                    <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-200">
                      <div className="space-y-2">
                        <div>
                          <div className="font-semibold text-sm text-gray-900 leading-tight">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-xs text-gray-600 leading-tight no-print">
                            Contratto: {employee.contractHours}h • Minimo: {employee.fixedHours}h
                          </div>
                        </div>
                        
                        {/* Status badges */}
                        <div className="flex flex-wrap gap-1 no-print">
                          {weekHours.shifts > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {weekHours.shifts} turni
                            </span>
                          )}
                          {weekHours.locked > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              {weekHours.locked} confermati
                            </span>
                          )}
                          {hasWorkHourIssues && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                              ⚠️ Conflitti
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    
                    {/* Celle turni */}
                    {weekDays.map((date) => {
                      const shift = getShiftForEmployeeAndDate(employee.id, date);
                      const conflicts = shift ? validateShiftComplete(shift, store, employee, optimizedWeeklyShifts, weeklyUnavailabilities) : [];
                      
                      return (
                        <td key={`${employee.id}-${date.toISOString()}-${forceUpdateKey}`} className="p-2 border-r border-gray-100">
                          <ShiftCell
                            shift={shift}
                            employee={employee}
                            date={date}
                            store={store}
                            conflicts={conflicts}
                            employeeUnavailabilities={weeklyUnavailabilities}
                            defaultBreakDuration={preferences.defaultBreakDuration}
                            userRole={preferences.userRole}
                            onShiftChange={(data) => handleShiftChange(employee, date, data)}
                            onShiftDelete={() => shift && onShiftDelete(shift.id)}
                            onCopyShift={() => shift && handleCopyShift(employee, date, shift)}
                            onPasteShift={() => handlePasteShift(employee, date)}
                            onApplyTemplate={(templateId) => handleApplyTemplate(employee, date, templateId)}
                            isSourceCell={isSourceCell(employee.id, date)}
                            hasClipboard={hasClipboard}
                          />
                        </td>
                      );
                    })}
                    
                    {/* Colonna monte ore */}
                    <td className="px-4 py-3 text-center">
                      <div className="space-y-2">
                        <div className="text-lg font-bold text-gray-900">
                          {weekHours.total}h
                        </div>
                        
                        {/* Indicatore stato ore */}
                        <div className={`text-xs flex items-center justify-center space-x-1 no-print ${
                          weekHours.isOvertime ? 'text-red-600' :
                          weekHours.isUnderMinimum ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {weekHours.isOvertime && <TrendingUp className="h-3 w-3" />}
                          {weekHours.isUnderMinimum && <TrendingDown className="h-3 w-3" />}
                          {weekHours.isInRange && <CheckCircle className="h-3 w-3" />}
                          <span>
                            {weekHours.isOvertime ? `+${weekHours.workStats.eccedenza.toFixed(1)}h` :
                             weekHours.isUnderMinimum ? `-${weekHours.workStats.deficit.toFixed(1)}h` :
                             'OK'}
                          </span>
                        </div>

                        {/* Warnings tooltip */}
                        {hasWorkHourIssues && (
                          <div className="group relative no-print">
                            <AlertTriangle className="h-4 w-4 text-red-500 mx-auto cursor-help" />
                            <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-red-900 text-white text-xs rounded shadow-lg w-64 max-h-24 overflow-y-auto opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <div className="space-y-1">
                                {weekHours.conflicts.map((conflict, index) => (
                                  <div key={index} className="text-xs leading-tight">
                                    • {conflict.message}
                                  </div>
                                ))}
                              </div>
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-900 rotate-45"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer compatto */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 no-print">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-gray-700">⌨️ Controlli:</span>
            <span className="text-gray-600">Ctrl+C/V = Copia/Incolla</span>
            <span className="text-gray-600">Ctrl+T = Template</span>
            <span className="text-gray-600">Click destro = Menu</span>
            {showValidationPanel && (
              <span className="text-blue-600 font-medium">🛡️ Validazione attiva</span>
            )}
            {isGridUpdating && (
              <span className="text-blue-600 font-medium">🔄 Aggiornamento in corso</span>
            )}
          </div>
        </div>
      </div>

      {/* CCNL Compliance Panel */}
      {showCCNLPanel && (
        <CCNLCompliancePanel
          employees={activeEmployees}
          shifts={optimizedWeeklyShifts}
          stores={[store]}
          weekStart={weekStart}
          selectedStoreId={store.id}
          isCollapsed={ccnlPanelCollapsed}
          onToggleCollapse={() => setCCNLPanelCollapsed(!ccnlPanelCollapsed)}
        />
      )}
    </div>
  );
};