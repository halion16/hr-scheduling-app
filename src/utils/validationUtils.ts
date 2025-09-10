import { Shift, Store, ShiftConflict, Employee } from '../types';
import { EmployeeUnavailability } from '../types';
import { CCNLViolation } from '../types/ccnl';
import { ccnlValidator } from './ccnlValidation';
import { getDayOfWeek, isTimeInRange, parseTime, getStartOfWeek } from './timeUtils';

export const validateShift = (shift: Shift, store: Store, existingShifts: Shift[] = []): ShiftConflict[] => {
  const conflicts: ShiftConflict[] = [];
  const dayOfWeek = getDayOfWeek(shift.date);
  
  // 🆕 VERIFICA CHIUSURE STRAORDINARIE
  const closureDay = store.closureDays?.find(closure => 
    closure.date.toDateString() === shift.date.toDateString()
  );
  
  if (closureDay?.isFullDay) {
    conflicts.push({
      type: 'outside_hours',
      message: `Negozio chiuso per ${closureDay.reason}`,
      severity: 'error'
    });
    return conflicts;
  }
  
  // 🆕 DETERMINA ORARI EFFETTIVI (considera chiusure e orari settimanali)
  let storeHours = store.openingHours[dayOfWeek];
  
  // Verifica orari settimanali personalizzati
  const weekStart = getStartOfWeek(shift.date);
  const weeklySchedule = store.weeklySchedules?.find(schedule => 
    schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
  );
  
  if (weeklySchedule) {
    storeHours = weeklySchedule.openingHours[dayOfWeek];
  }
  
  // Verifica orari modificati per chiusure parziali
  if (closureDay?.customHours) {
    storeHours = closureDay.customHours;
    conflicts.push({
      type: 'outside_hours',
      message: `Orari modificati per ${closureDay.reason} (${storeHours.open}-${storeHours.close})`,
      severity: 'warning'
    });
  }

  if (!storeHours) {
    conflicts.push({
      type: 'outside_hours',
      message: `Il negozio è chiuso di ${dayOfWeek}`,
      severity: 'error'
    });
    return conflicts;
  }

  // Controlla se il turno è entro gli orari di apertura del negozio
  if (!isTimeInRange(shift.startTime, storeHours.open, storeHours.close)) {
    conflicts.push({
      type: 'outside_hours',
      message: `Orario di inizio ${shift.startTime} fuori dagli orari del negozio (${storeHours.open} - ${storeHours.close})`,
      severity: 'error'
    });
  }

  if (!isTimeInRange(shift.endTime, storeHours.open, storeHours.close)) {
    conflicts.push({
      type: 'outside_hours',
      message: `Orario di fine ${shift.endTime} fuori dagli orari del negozio (${storeHours.open} - ${storeHours.close})`,
      severity: 'error'
    });
  }

  // Controlla sovrapposizioni di turni per lo stesso dipendente
  const employeeShifts = existingShifts.filter(
    s => s.employeeId === shift.employeeId && 
         s.date.toDateString() === shift.date.toDateString() &&
         s.id !== shift.id
  );

  for (const existingShift of employeeShifts) {
    if (shiftsOverlap(shift, existingShift)) {
      conflicts.push({
        type: 'overlap',
        message: `Si sovrappone con turno esistente (${existingShift.startTime} - ${existingShift.endTime})`,
        severity: 'error'
      });
    }
  }

  // Controlla durata minima della pausa
  const shiftDuration = getShiftDurationMinutes(shift.startTime, shift.endTime);
  if (shiftDuration > 6 * 60 && shift.breakDuration < 30) {
    conflicts.push({
      type: 'insufficient_break',
      message: 'I turni superiori a 6 ore richiedono almeno 30 minuti di pausa',
      severity: 'warning'
    });
  }

  return conflicts;
};

/**
 * Validates shift against employee unavailability periods
 */
export const validateUnavailability = (
  shift: Shift, 
  employee: Employee,
  unavailabilities: EmployeeUnavailability[] = []
): ShiftConflict[] => {
  const conflicts: ShiftConflict[] = [];
  
  // Filter unavailabilities for this specific employee
  const employeeUnavailabilities = unavailabilities.filter(unavail => 
    unavail.employeeId === employee.id && unavail.isApproved
  );
  
  // Check if shift date falls within any unavailability period
  for (const unavail of employeeUnavailabilities) {
    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const unavailStart = new Date(unavail.startDate);
    unavailStart.setHours(0, 0, 0, 0);
    
    const unavailEnd = new Date(unavail.endDate);
    unavailEnd.setHours(23, 59, 59, 999); // End of day
    
    if (shiftDate >= unavailStart && shiftDate <= unavailEnd) {
      const typeLabels = {
        holiday: 'Ferie',
        sick: 'Malattia',
        personal: 'Motivi Personali',
        training: 'Formazione',
        other: 'Altro'
      };
      
      conflicts.push({
        type: 'overlap',
        message: `🚫 Dipendente non disponibile (${typeLabels[unavail.type]}: ${unavail.startDate.toLocaleDateString()} - ${unavail.endDate.toLocaleDateString()})`,
        severity: 'error'
      });
      
      console.log('⚠️ Unavailability conflict detected:', {
        employee: `${employee.firstName} ${employee.lastName}`,
        shiftDate: shiftDate.toLocaleDateString(),
        unavailabilityPeriod: `${unavail.startDate.toLocaleDateString()} - ${unavail.endDate.toLocaleDateString()}`,
        type: unavail.type
      });
    }
  }
  
  return conflicts;
};

/**
 * Validates shift against CCNL del commercio requirements and converts to ShiftConflict format
 */
export const validateShiftCCNL = (
  shift: Shift, 
  employee: Employee, 
  existingShifts: Shift[] = []
): ShiftConflict[] => {
  const ccnlViolations = ccnlValidator.validateShift(shift, employee, existingShifts);
  
  // Convert CCNL violations to ShiftConflict format for compatibility
  return ccnlViolations.map((violation: CCNLViolation): ShiftConflict => ({
    type: violation.type === 'daily_rest' || violation.type === 'shift_gap' ? 'insufficient_break' : 'overlap',
    message: `🏛️ CCNL: ${violation.description}`,
    severity: violation.severity === 'critical' ? 'error' : 'warning'
  }));
};

/**
 * Combined validation including both standard and CCNL checks
 */
export const validateShiftComplete = (
  shift: Shift, 
  store: Store, 
  employee: Employee,
  existingShifts: Shift[] = [],
  unavailabilities: EmployeeUnavailability[] = []
): ShiftConflict[] => {
  const standardConflicts = validateShift(shift, store, existingShifts);
  const ccnlConflicts = validateShiftCCNL(shift, employee, existingShifts, store);
  const unavailabilityConflicts = validateUnavailability(shift, employee, unavailabilities);
  
  return [...standardConflicts, ...ccnlConflicts, ...unavailabilityConflicts];
};

/**
 * Valida le ore lavorative di un dipendente per una settimana
 * @param employee - Il dipendente
 * @param weeklyHours - Ore totali della settimana
 * @param shifts - Turni della settimana per il dipendente
 * @returns Array di conflitti relativi alle ore lavorative
 */
export const validateEmployeeWorkHours = (
  employee: Employee, 
  weeklyHours: number, 
  shifts: Shift[]
): ShiftConflict[] => {
  const conflicts: ShiftConflict[] = [];
  
  // 1. Calcola il monte ore totale disponibile
  const monteOreTotale = employee.contractHours + employee.fixedHours;
  const oreContrattualiBase = employee.contractHours;
  
  // 2. Analizza confronto con monte ore totale
  if (weeklyHours > monteOreTotale) {
    conflicts.push({
      type: 'insufficient_break', // Riuso tipo esistente per ora
      message: `ATTENZIONE: Turno eccede il monte ore disponibile (${weeklyHours.toFixed(1)}h > ${monteOreTotale}h)`,
      severity: 'warning'
    });
  }
  
  // 3. Analizza confronto con ore contrattuali base
  if (weeklyHours < oreContrattualiBase) {
    conflicts.push({
      type: 'insufficient_break', // Riuso tipo esistente per ora
      message: `ATTENZIONE: Turno inferiore alle ore contrattuali minime (${weeklyHours.toFixed(1)}h < ${oreContrattualiBase}h)`,
      severity: 'warning'
    });
  }
  
  return conflicts;
};

/**
 * Calcola le statistiche delle ore lavorative per un dipendente
 * @param employee - Il dipendente
 * @param weeklyHours - Ore totali della settimana
 * @returns Statistiche dettagliate
 */
export const calculateWorkHourStats = (employee: Employee, weeklyHours: number) => {
  const monteOreTotale = employee.contractHours + employee.fixedHours;
  const oreContrattualiBase = employee.contractHours;
  const oreFisse = employee.fixedHours;
  
  return {
    monteOreTotale,
    oreContrattualiBase,
    oreFisse,
    oreSettimanali: weeklyHours,
    eccedenza: Math.max(0, weeklyHours - monteOreTotale),
    deficit: Math.max(0, oreContrattualiBase - weeklyHours),
    isEccedente: weeklyHours > monteOreTotale,
    isSottoMinimo: weeklyHours < oreContrattualiBase,
    isNelRange: weeklyHours >= oreContrattualiBase && weeklyHours <= monteOreTotale,
    percentualeUtilizzo: (weeklyHours / monteOreTotale) * 100
  };
};

const shiftsOverlap = (shift1: Shift, shift2: Shift): boolean => {
  const start1 = parseTime(shift1.startTime);
  const end1 = parseTime(shift1.endTime);
  const start2 = parseTime(shift2.startTime);
  const end2 = parseTime(shift2.endTime);

  const start1Minutes = start1.hours * 60 + start1.minutes;
  const end1Minutes = end1.hours * 60 + end1.minutes;
  const start2Minutes = start2.hours * 60 + start2.minutes;
  const end2Minutes = end2.hours * 60 + end2.minutes;

  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
};

const getShiftDurationMinutes = (startTime: string, endTime: string): number => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  return endMinutes - startMinutes;
};