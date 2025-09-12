import { Store, Shift, Employee } from '../types';
import { 
  ShiftGridValidationResult, 
  DailyValidationResult, 
  CoverageAnalysis,
  StaffingAnalysis,
  ValidationIssue,
  TimeGap,
  HourlyStaffCount,
  UnderstaffedPeriod,
  EmployeeShiftDetail,
  EmployeeWorkload,
  WorkloadDistribution,
  ValidationAdminSettings
} from '../types/validation';
import { getDayOfWeek, getWeekDays, formatDate, addDays, getStartOfWeek, formatWeekNumber } from './timeUtils';

/**
 * Algoritmo principale di validazione della griglia turni
 * 
 * @param store - Configurazione del negozio con orari di apertura
 * @param shifts - Lista di tutti i turni assegnati per la settimana
 * @param employees - Lista dei dipendenti
 * @param weekStart - Data di inizio settimana (lunedì)
 * @param adminSettings - Configurazioni amministratore per la validazione
 */
export function validateShiftGrid(
  store: Store,
  shifts: Shift[],
  employees: Employee[],
  weekStart: Date,
  adminSettings?: ValidationAdminSettings
): ShiftGridValidationResult {
  
  console.log('🔍 Avvio validazione griglia turni per settimana:', weekStart.toISOString());
  console.log('🏪 Store preferences:', {
    name: store.name,
    standardHours: Object.keys(store.openingHours).length,
    weeklySchedules: store.weeklySchedules?.length || 0,
    closureDays: store.closureDays?.length || 0,
    staffRequirements: store.staffRequirements?.length || 0
  });
  
  // 🆕 Estrai configurazioni dalle impostazioni amministratore
  const settings = adminSettings || {
    enabled: true,
    enableRealTimeValidation: true,
    dynamicStaffRequirements: { enabled: true, useHourlyRequirements: false, equityThreshold: 20, maxHoursVariation: 8 },
    coverageSettings: { minimumStaffPerHour: 1, minimumOverlapMinutes: 15, allowSinglePersonCoverage: false, criticalGapThresholdMinutes: 60 },
    complianceSettings: { enforceRestPeriods: true, minimumRestHours: 11, maxConsecutiveWorkDays: 6, weeklyHourLimits: { enabled: true, maxWeeklyHours: 40, overtimeThreshold: 38 } },
    alertSettings: { scoreThreshold: 80, enableWorkloadAlerts: true, enableCoverageAlerts: true, enableComplianceAlerts: true },
    storeSpecificSettings: { enabled: false, overrideGlobalSettings: false }
  };

  // Se la validazione è disabilitata, restituisci risultato di base
  if (!settings.enabled) {
    console.log('⚠️ Validazione disabilitata dalle configurazioni amministratore');
    return {
      isValid: true,
      score: 100,
      summary: { totalDays: 7, validDays: 7, daysWithIssues: 0, daysWithoutShifts: 0, totalAnomalies: 0, criticalIssues: 0, warnings: 0 },
      dailyResults: [],
      overallIssues: [],
      workloadDistribution: { employees: [], maxHours: 0, minHours: 0, averageHours: 0, standardDeviation: 0, isEquitable: true, inequityScore: 0 }
    };
  }

  const minimumStaffPerHour = settings.coverageSettings.minimumStaffPerHour;
  const minimumOverlapMinutes = settings.coverageSettings.minimumOverlapMinutes;
  const allowSinglePersonCoverage = settings.coverageSettings.allowSinglePersonCoverage;

  // Genera i 7 giorni della settimana
  const weekDays = getWeekDays(weekStart);
  const dailyResults: DailyValidationResult[] = [];
  const overallIssues: ValidationIssue[] = [];

  // Analizza ogni giorno della settimana
  for (const date of weekDays) {
    const dayResult = validateSingleDay(
      date, 
      store, 
      shifts, 
      employees, 
      weekStart,
      { minimumStaffPerHour, minimumOverlapMinutes, allowSinglePersonCoverage }
    );
    dailyResults.push(dayResult);
  }

  // Analisi cross-giornaliera e distribuzione carico
  const workloadDistribution = analyzeCrossDay(dailyResults, overallIssues, employees, shifts);

  // Calcola statistiche generali
  const summary = calculateSummary(dailyResults);
  const score = calculateValidationScore(dailyResults, summary);

  const result: ShiftGridValidationResult = {
    isValid: score >= 80 && summary.criticalIssues === 0,
    score,
    summary,
    dailyResults,
    overallIssues,
    workloadDistribution
  };

  console.log('✅ Validazione completata. Score:', score, 'Valid:', result.isValid);
  
  return result;
}

/**
 * Valida un singolo giorno
 */
function validateSingleDay(
  date: Date,
  store: Store,
  allShifts: Shift[],
  employees: Employee[],
  weekStart: Date,
  options: { minimumStaffPerHour: number; minimumOverlapMinutes: number; allowSinglePersonCoverage: boolean }
): DailyValidationResult {
  
  const dayOfWeek = getDayOfWeek(date);
  
  // 🆕 DETERMINA ORARI EFFETTIVI CONSIDERANDO TUTTE LE PREFERENZE NEGOZIO
  const effectiveStoreHours = getEffectiveStoreHours(date, store, weekStart);
  const isStoreOpen = !!effectiveStoreHours;
  
  console.log(`📅 Validazione ${dayOfWeek} ${date.toLocaleDateString('it-IT')} - Aperto: ${isStoreOpen}`, {
    effectiveHours: effectiveStoreHours ? `${effectiveStoreHours.open}-${effectiveStoreHours.close}` : 'CHIUSO',
    reason: !effectiveStoreHours ? getClosureReason(date, store, weekStart) : 'Aperto'
  });
  

  const dayShifts = allShifts.filter(shift => 
    shift.date.toDateString() === date.toDateString()
  );

  const issues: ValidationIssue[] = [];
  
  // Risultato base per giorni di chiusura
  if (!isStoreOpen) {
    const closureReason = getClosureReason(date, store, weekStart);
    
    return {
      date,
      dayOfWeek,
      isStoreOpen: false,
      isValid: true,
      hasShifts: dayShifts.length > 0,
      coverage: createEmptyCoverage(),
      staffing: createEmptyStaffing(),
      issues: dayShifts.length > 0 ? [{
        type: 'invalid_shift',
        severity: 'warning',
        message: `Turni programmati in giorno di chiusura (${dayShifts.length} turni)`,
        description: `${closureReason} ma sono stati programmati dei turni`,
        suggestedAction: 'Rimuovere i turni dal giorno di chiusura',
        date,
        affectedShifts: dayShifts.map(s => s.id)
      }] : []
    };
  }

  const hasShifts = dayShifts.length > 0;

  // 1. VERIFICA PRESENZA TURNI
  if (!hasShifts) {
    issues.push({
      type: 'no_shifts',
      severity: 'critical',
      message: 'Nessun turno assegnato',
      description: `Il negozio è aperto ${effectiveStoreHours.open}-${effectiveStoreHours.close} ma non ci sono turni programmati`,
      suggestedAction: 'Assegnare almeno un turno per coprire gli orari di apertura',
      date
    });

    return {
      date,
      dayOfWeek,
      isStoreOpen: true,
      isValid: false,
      hasShifts: false,
      storeHours: effectiveStoreHours,
      coverage: createEmptyCoverage(),
      staffing: createEmptyStaffing(),
      issues
    };
  }

  // 2. ANALISI COPERTURA ORARIA
  const coverage = analyzeCoverage(dayShifts, effectiveStoreHours, date, issues);
  
  // 3. ANALISI PERSONALE
  const staffing = analyzeStaffing(dayShifts, effectiveStoreHours, employees, options, issues, store, date);

  // 4. VERIFICHE SPECIFICHE
  checkOpeningClosingCoverage(dayShifts, effectiveStoreHours, issues, date);
  checkContinuousCoverage(dayShifts, effectiveStoreHours, issues, date, options.minimumOverlapMinutes);

  const isValid = !issues.some(issue => issue.severity === 'critical');

  return {
    date,
    dayOfWeek,
    isStoreOpen: true,
    isValid,
    hasShifts: true,
    storeHours: effectiveStoreHours,
    coverage,
    staffing,
    issues
  };
}

/**
 * 🆕 DETERMINA ORARI EFFETTIVI DEL NEGOZIO CONSIDERANDO TUTTE LE PREFERENZE
 * Include: orari standard, orari settimanali personalizzati, giorni di chiusura
 */
function getEffectiveStoreHours(
  date: Date, 
  store: Store, 
  weekStart: Date
): { open: string; close: string } | null {
  const dayOfWeek = getDayOfWeek(date);
  
  // 1. VERIFICA CHIUSURE STRAORDINARIE (priorità massima)
  const closureDay = store.closureDays?.find(closure => 
    closure.date.toDateString() === date.toDateString()
  );
  
  if (closureDay) {
    if (closureDay.isFullDay) {
      console.log(`🚫 Negozio chiuso per ${closureDay.reason}`);
      return null; // Negozio completamente chiuso
    } else if (closureDay.customHours) {
      console.log(`🕐 Orari modificati per ${closureDay.reason}:`, closureDay.customHours);
      return closureDay.customHours; // Orari modificati
    }
  }
  
  // 2. VERIFICA ORARI SETTIMANALI PERSONALIZZATI
  const weeklySchedule = store.weeklySchedules?.find(schedule => 
    schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
  );
  
  if (weeklySchedule && weeklySchedule.openingHours[dayOfWeek]) {
    console.log(`📅 Orari settimanali personalizzati per ${dayOfWeek}:`, weeklySchedule.openingHours[dayOfWeek]);
    return weeklySchedule.openingHours[dayOfWeek];
  }
  
  // 3. FALLBACK AGLI ORARI STANDARD
  const standardHours = store.openingHours[dayOfWeek];
  if (standardHours) {
    console.log(`🏪 Orari standard per ${dayOfWeek}:`, standardHours);
    return standardHours;
  }
  
  console.log(`🚫 Negozio chiuso di ${dayOfWeek} (orari standard)`);
  return null;
}

/**
 * 🆕 OTTIENI MOTIVO DELLA CHIUSURA
 */
function getClosureReason(date: Date, store: Store, weekStart: Date): string {
  const dayOfWeek = getDayOfWeek(date);
  
  // Verifica chiusure straordinarie
  const closureDay = store.closureDays?.find(closure => 
    closure.date.toDateString() === date.toDateString()
  );
  
  if (closureDay) {
    return `Chiusura straordinaria: ${closureDay.reason}`;
  }
  
  // Verifica orari settimanali
  const weeklySchedule = store.weeklySchedules?.find(schedule => 
    schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
  );
  
  if (weeklySchedule && !weeklySchedule.openingHours[dayOfWeek]) {
    return `Chiuso secondo orari settimanali personalizzati`;
  }
  
  // Orari standard
  if (!store.openingHours[dayOfWeek]) {
    return `Chiuso di ${dayOfWeek} (orari standard)`;
  }
  
  return `Negozio chiuso`;
}
/**
 * Analizza la copertura oraria del giorno
 */
function analyzeCoverage(
  shifts: Shift[], 
  storeHours: { open: string; close: string },
  date: Date,
  issues: ValidationIssue[]
): CoverageAnalysis {
  
  const storeOpenMinutes = timeToMinutes(storeHours.open);
  const storeCloseMinutes = timeToMinutes(storeHours.close);
  const totalOperatingMinutes = storeCloseMinutes - storeOpenMinutes;

  // Crea array di copertura minute per minute
  const coverageArray = new Array(totalOperatingMinutes).fill(0);
  
  // Segna i minuti coperti da ogni turno
  shifts.forEach(shift => {
    const shiftStart = Math.max(timeToMinutes(shift.startTime), storeOpenMinutes);
    const shiftEnd = Math.min(timeToMinutes(shift.endTime), storeCloseMinutes);
    
    for (let minute = shiftStart; minute < shiftEnd; minute++) {
      const index = minute - storeOpenMinutes;
      if (index >= 0 && index < coverageArray.length) {
        coverageArray[index]++;
      }
    }
  });

  // Analizza gap di copertura
  const coverageGaps: TimeGap[] = [];
  let gapStart = -1;
  
  for (let i = 0; i < coverageArray.length; i++) {
    if (coverageArray[i] === 0 && gapStart === -1) {
      gapStart = i;
    } else if (coverageArray[i] > 0 && gapStart !== -1) {
      const gapStartTime = minutesToTime(storeOpenMinutes + gapStart);
      const gapEndTime = minutesToTime(storeOpenMinutes + i);
      const durationMinutes = i - gapStart;
      
      coverageGaps.push({
        startTime: gapStartTime,
        endTime: gapEndTime,
        durationMinutes,
        severity: durationMinutes > 60 ? 'critical' : 'warning',
        description: `Nessuna copertura per ${durationMinutes} minuti`
      });
      
      gapStart = -1;
    }
  }

  // Gap finale se necessario
  if (gapStart !== -1) {
    const gapStartTime = minutesToTime(storeOpenMinutes + gapStart);
    const gapEndTime = storeHours.close;
    const durationMinutes = coverageArray.length - gapStart;
    
    coverageGaps.push({
      startTime: gapStartTime,
      endTime: gapEndTime,
      durationMinutes,
      severity: durationMinutes > 60 ? 'critical' : 'warning',
      description: `Nessuna copertura per ${durationMinutes} minuti`
    });
  }

  // Aggiungi gap agli issues
  coverageGaps.forEach(gap => {
    issues.push({
      type: 'coverage_gap',
      severity: gap.severity,
      message: `Gap di copertura: ${gap.startTime}-${gap.endTime}`,
      description: gap.description,
      suggestedAction: 'Aggiungere un turno per coprire questo periodo',
      timeRange: {
        start: gap.startTime,
        end: gap.endTime
      },
      date
    });
  });

  const coveredMinutes = coverageArray.filter(count => count > 0).length;
  const coveragePercentage = (coveredMinutes / totalOperatingMinutes) * 100;

  const hasOpeningCoverage = coverageArray[0] > 0;
  const hasClosingCoverage = coverageArray[coverageArray.length - 1] > 0;

  return {
    hasOpeningCoverage,
    hasClosingCoverage,
    hasContinuousCoverage: coverageGaps.length === 0,
    coverageGaps,
    coveredMinutes,
    totalOperatingMinutes,
    coveragePercentage
  };
}

/**
 * Analizza il personale presente per fascia oraria
 */
function analyzeStaffing(
  shifts: Shift[], 
  storeHours: { open: string; close: string },
  employees: Employee[],
  options: { minimumStaffPerHour: number; allowSinglePersonCoverage: boolean },
  issues: ValidationIssue[],
  store: Store,
  date: Date
): StaffingAnalysis {
  
  const storeOpenMinutes = timeToMinutes(storeHours.open);
  const storeCloseMinutes = timeToMinutes(storeHours.close);
  const totalHours = Math.ceil((storeCloseMinutes - storeOpenMinutes) / 60);

  const hourlyStaffCount: HourlyStaffCount[] = [];
  const understaffedPeriods: UnderstaffedPeriod[] = [];
  
  let maxStaff = 0;
  let minStaff = Infinity;
  let totalStaffHours = 0;
  
  // 🆕 CALCOLA REQUISITI PERSONALE DAL NEGOZIO
  const dayOfWeek = getDayOfWeek(date);
  const storeStaffRequirement = store.staffRequirements?.find(req => req.dayOfWeek === dayOfWeek);
  
  // Calcola requisiti minimi e massimi basati su preferenze negozio
  let dynamicMinStaff = options.minimumStaffPerHour;
  let dynamicMaxStaff = employees.length;
  
  if (storeStaffRequirement) {
    const totalMinStaff = storeStaffRequirement.roles.reduce((sum, role) => sum + role.minStaff, 0);
    const totalMaxStaff = storeStaffRequirement.roles.reduce((sum, role) => sum + role.maxStaff, 0);
    
    dynamicMinStaff = Math.max(totalMinStaff, options.minimumStaffPerHour);
    dynamicMaxStaff = Math.min(totalMaxStaff, employees.length);
    
    console.log(`👥 Requisiti staff da configurazione negozio: ${totalMinStaff}-${totalMaxStaff} persone`);
  }

  // Analizza ogni ora
  for (let hour = 0; hour < totalHours; hour++) {
    const hourStartMinutes = storeOpenMinutes + (hour * 60);
    const hourEndMinutes = Math.min(hourStartMinutes + 60, storeCloseMinutes);
    const hourStart = minutesToTime(hourStartMinutes);
    
    // Conta staff presente in questa ora
    const activeShifts = shifts.filter(shift => {
      const shiftStart = timeToMinutes(shift.startTime);
      const shiftEnd = timeToMinutes(shift.endTime);
      
      // Verifica sovrapposizione con questa ora
      return shiftStart < hourEndMinutes && shiftEnd > hourStartMinutes;
    });

    const staffCount = activeShifts.length;
    const recommendedMin = Math.max(dynamicMinStaff, 1);
    const isAdequate = staffCount >= recommendedMin;

    // 🆕 CREA DETTAGLI DIPENDENTI PER QUESTA FASCIA ORARIA
    const employeeShiftDetails: EmployeeShiftDetail[] = activeShifts.map(shift => {
      const employee = employees.find(emp => emp.id === shift.employeeId);
      const shiftStart = timeToMinutes(shift.startTime);
      const shiftEnd = timeToMinutes(shift.endTime);
      const hoursWorked = (Math.min(shiftEnd, hourEndMinutes) - Math.max(shiftStart, hourStartMinutes)) / 60;
      
      return {
        employeeId: shift.employeeId,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Dipendente sconosciuto',
        shiftId: shift.id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        hoursWorked: Math.max(0, hoursWorked)
      };
    });

    hourlyStaffCount.push({
      hour: hourStart,
      staffCount,
      activeShifts: activeShifts.map(s => s.id),
      activeEmployees: activeShifts.map(s => s.employeeId),
      employeeShiftDetails,
      isAdequate,
      recommendedMin
    });

    // Aggiorna statistiche
    maxStaff = Math.max(maxStaff, staffCount);
    minStaff = Math.min(minStaff, staffCount);
    totalStaffHours += staffCount;

    // Identifica periodi sotto organico
    if (!isAdequate) {
      const hourEnd = minutesToTime(hourEndMinutes);
      understaffedPeriods.push({
        startTime: hourStart,
        endTime: hourEnd,
        currentStaff: staffCount,
        recommendedStaff: recommendedMin,
        severity: staffCount === 0 ? 'critical' : 'warning'
      });
    }
  }

  // Aggiungi sotto organico agli issues
  understaffedPeriods.forEach(period => {
    const hasStoreRequirements = storeStaffRequirement ? ' (basato su configurazione negozio)' : '';
    
    issues.push({
      type: 'understaffed',
      severity: period.severity,
      message: `Personale insufficiente: ${period.startTime}-${period.endTime}${hasStoreRequirements}`,
      description: `Presenti ${period.currentStaff} dipendenti, richiesti ${period.recommendedStaff}${hasStoreRequirements}`,
      suggestedAction: `Aggiungere ${period.recommendedStaff - period.currentStaff} dipendenti in questa fascia${hasStoreRequirements}`,
      timeRange: {
        start: period.startTime,
        end: period.endTime
      }
    });
  });

  const averageStaffCount = totalHours > 0 ? totalStaffHours / totalHours : 0;
  
  // Calcola personale minimo raccomandato
  const recommendedMinimumStaff = Math.max(
    dynamicMinStaff,
    options.allowSinglePersonCoverage ? 1 : 2
  );

  return {
    hourlyStaffCount,
    peakStaffCount: maxStaff,
    minimumStaffCount: minStaff === Infinity ? 0 : minStaff,
    averageStaffCount: Number(averageStaffCount.toFixed(1)),
    understaffedPeriods,
    recommendedMinimumStaff
  };
}

/**
 * Verifica copertura specifica di apertura e chiusura
 */
function checkOpeningClosingCoverage(
  shifts: Shift[],
  storeHours: { open: string; close: string },
  issues: ValidationIssue[],
  date: Date
): void {
  
  const openTime = timeToMinutes(storeHours.open);
  const closeTime = timeToMinutes(storeHours.close);

  // Verifica copertura apertura (± 15 minuti)
  const hasOpeningStaff = shifts.some(shift => {
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    return shiftStart <= openTime + 15 && shiftEnd > openTime;
  });

  if (!hasOpeningStaff) {
    issues.push({
      type: 'no_opening_coverage',
      severity: 'critical',
      message: 'Nessuna copertura all\'apertura',
      description: `Nessun dipendente presente all'orario di apertura ${storeHours.open}`,
      suggestedAction: 'Assicurarsi che almeno un dipendente sia presente all\'apertura',
      timeRange: {
        start: storeHours.open,
        end: minutesToTime(openTime + 15)
      },
      date
    });
  }

  // Verifica copertura chiusura (± 15 minuti)
  const hasClosingStaff = shifts.some(shift => {
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    return shiftStart < closeTime && shiftEnd >= closeTime - 15;
  });

  if (!hasClosingStaff) {
    issues.push({
      type: 'no_closing_coverage',
      severity: 'critical',
      message: 'Nessuna copertura alla chiusura',
      description: `Nessun dipendente presente all'orario di chiusura ${storeHours.close}`,
      suggestedAction: 'Assicurarsi che almeno un dipendente sia presente alla chiusura',
      timeRange: {
        start: minutesToTime(closeTime - 15),
        end: storeHours.close
      },
      date
    });
  }
}

/**
 * 🆕 VERIFICA COPERTURA CONTINUA MIGLIORATA - Considera sovrapposizioni multiple
 */
function checkContinuousCoverage(
  shifts: Shift[],
  storeHours: { open: string; close: string },
  issues: ValidationIssue[],
  date: Date,
  minimumOverlapMinutes: number
): void {
  
  if (shifts.length === 0) return;

  const storeOpenMinutes = timeToMinutes(storeHours.open);
  const storeCloseMinutes = timeToMinutes(storeHours.close);
  const totalOperatingMinutes = storeCloseMinutes - storeOpenMinutes;

  // 🆕 CREA ARRAY BINARIO DI COPERTURA MINUTO-PER-MINUTO
  const coverageArray = new Array(totalOperatingMinutes).fill(0);
  
  // Marca tutti i minuti coperti da ogni turno
  shifts.forEach(shift => {
    const shiftStart = Math.max(timeToMinutes(shift.startTime), storeOpenMinutes);
    const shiftEnd = Math.min(timeToMinutes(shift.endTime), storeCloseMinutes);
    
    for (let minute = shiftStart; minute < shiftEnd; minute++) {
      const index = minute - storeOpenMinutes;
      if (index >= 0 && index < coverageArray.length) {
        coverageArray[index] = 1; // Coperto
      }
    }
  });

  // 🆕 TROVA TUTTI I GAP REALI NELLA COPERTURA
  const gaps = [];
  let gapStart = -1;
  
  for (let i = 0; i < coverageArray.length; i++) {
    if (coverageArray[i] === 0 && gapStart === -1) {
      // Inizio nuovo gap
      gapStart = i;
    } else if (coverageArray[i] === 1 && gapStart !== -1) {
      // Fine gap
      const gapStartTime = minutesToTime(storeOpenMinutes + gapStart);
      const gapEndTime = minutesToTime(storeOpenMinutes + i);
      const durationMinutes = i - gapStart;
      
      if (durationMinutes > minimumOverlapMinutes) {
        gaps.push({
          startTime: gapStartTime,
          endTime: gapEndTime,
          durationMinutes,
          severity: durationMinutes > 60 ? 'critical' as const : 'warning' as const
        });
      }
      
      gapStart = -1;
    }
  }

  // Gap finale se termina senza copertura
  if (gapStart !== -1) {
    const gapStartTime = minutesToTime(storeOpenMinutes + gapStart);
    const gapEndTime = storeHours.close;
    const durationMinutes = coverageArray.length - gapStart;
    
    if (durationMinutes > minimumOverlapMinutes) {
      gaps.push({
        startTime: gapStartTime,
        endTime: gapEndTime,
        durationMinutes,
        severity: durationMinutes > 60 ? 'critical' as const : 'warning' as const
      });
    }
  }

  // 🆕 CREA ISSUES PER OGNI GAP REALE TROVATO
  gaps.forEach(gap => {
    // Trova turni coinvolti nel gap
    const affectedShifts = shifts.filter(shift => {
      const shiftStart = timeToMinutes(shift.startTime);
      const shiftEnd = timeToMinutes(shift.endTime);
      const gapStart = timeToMinutes(gap.startTime);
      const gapEnd = timeToMinutes(gap.endTime);
      
      // Turno finisce poco prima del gap o inizia poco dopo
      return (shiftEnd <= gapStart + 30) || (shiftStart >= gapEnd - 30);
    }).map(s => s.id);

    issues.push({
      type: 'coverage_gap',
      severity: gap.severity,
      message: `Gap di copertura reale: ${gap.startTime}-${gap.endTime}`,
      description: `Nessun dipendente presente per ${gap.durationMinutes} minuti`,
      suggestedAction: gap.durationMinutes > 60 
        ? 'Aggiungere un turno per coprire completamente il gap' 
        : 'Estendere turni esistenti o ridurre il gap',
      timeRange: {
        start: gap.startTime,
        end: gap.endTime
      },
      affectedShifts,
      date
    });
  });

  console.log(`🔍 Analisi copertura continua: ${gaps.length} gap trovati su ${totalOperatingMinutes} minuti totali`);
}

/**
 * 🆕 ANALISI CROSS-DAY COMPLETA CON DISTRIBUZIONE CARICO LAVORO
 */
function analyzeCrossDay(
  dailyResults: DailyValidationResult[],
  overallIssues: ValidationIssue[],
  employees: Employee[],
  allShifts: Shift[]
): WorkloadDistribution {
  
  console.log('🔍 Inizio analisi cross-day con distribuzione carico lavoro...');
  
  // Verifica pattern di giorni senza turni
  const daysWithoutShifts = dailyResults.filter(day => 
    day.isStoreOpen && !day.hasShifts
  );

  if (daysWithoutShifts.length > 1) {
    overallIssues.push({
      type: 'no_shifts',
      severity: 'critical',
      message: `${daysWithoutShifts.length} giorni senza turni`,
      description: 'Più giorni nella settimana non hanno turni programmati',
      suggestedAction: 'Rivedere la pianificazione settimanale'
    });
  }

  // 🆕 CALCOLA DISTRIBUZIONE CARICO LAVORO PER DIPENDENTE
  const employeeWorkloadMap = new Map<string, EmployeeWorkload>();
  
  // Inizializza tutti i dipendenti
  employees.forEach(emp => {
    employeeWorkloadMap.set(emp.id, {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      totalHours: 0,
      daysWorked: 0,
      shifts: [],
      dailyHours: {},
      averageHoursPerDay: 0
    });
  });

  // Calcola ore per dipendente usando i nuovi dati dettagliati
  dailyResults.forEach(day => {
    const dateKey = day.date.toISOString().split('T')[0];
    
    if (day.staffing.hourlyStaffCount) {
      // Traccia dipendenti che hanno lavorato oggi
      const dailyEmployeeHours = new Map<string, number>();
      
      day.staffing.hourlyStaffCount.forEach(hourData => {
        hourData.employeeShiftDetails?.forEach(detail => {
          const current = dailyEmployeeHours.get(detail.employeeId) || 0;
          dailyEmployeeHours.set(detail.employeeId, current + detail.hoursWorked);
        });
      });

      // Aggiorna workload totali
      dailyEmployeeHours.forEach((hours, employeeId) => {
        const workload = employeeWorkloadMap.get(employeeId);
        if (workload) {
          workload.totalHours += hours;
          workload.dailyHours[dateKey] = hours;
          if (hours > 0) {
            workload.daysWorked++;
          }
        }
      });
    }
  });

  // Aggiorna turni e medie
  allShifts.forEach(shift => {
    const workload = employeeWorkloadMap.get(shift.employeeId);
    if (workload) {
      workload.shifts.push(shift.id);
    }
  });

  // Calcola medie
  employeeWorkloadMap.forEach(workload => {
    workload.averageHoursPerDay = workload.daysWorked > 0 
      ? workload.totalHours / workload.daysWorked 
      : 0;
  });

  const employeeWorkloads = Array.from(employeeWorkloadMap.values());
  const workingEmployees = employeeWorkloads.filter(emp => emp.totalHours > 0);

  // Statistiche distribuzione
  const totalHours = workingEmployees.map(emp => emp.totalHours);
  const maxHours = Math.max(...totalHours, 0);
  const minHours = Math.min(...totalHours, maxHours);
  const averageHours = totalHours.length > 0 
    ? totalHours.reduce((sum, h) => sum + h, 0) / totalHours.length 
    : 0;

  // Calcola deviazione standard
  const variance = totalHours.length > 0
    ? totalHours.reduce((sum, h) => sum + Math.pow(h - averageHours, 2), 0) / totalHours.length
    : 0;
  const standardDeviation = Math.sqrt(variance);

  // Calcola equità (soglia: deviazione standard < 20% della media)
  const equityThreshold = averageHours * 0.2;
  const isEquitable = standardDeviation <= equityThreshold;
  const inequityScore = Math.min(100, (standardDeviation / Math.max(averageHours, 1)) * 100);

  console.log(`📊 Analisi distribuzione: ${workingEmployees.length} dipendenti attivi, ore ${minHours}-${maxHours} (media: ${averageHours.toFixed(1)}, σ: ${standardDeviation.toFixed(1)})`);

  // Issues per distribuzione non equa
  if (!isEquitable && workingEmployees.length > 1) {
    const maxWorker = workingEmployees.find(emp => emp.totalHours === maxHours);
    const minWorker = workingEmployees.find(emp => emp.totalHours === minHours);
    
    overallIssues.push({
      type: 'understaffed', // Riusiamo questo tipo
      severity: inequityScore > 50 ? 'warning' : 'info',
      message: 'Distribuzione carico lavoro non equa',
      description: `${maxWorker?.employeeName} (${maxHours}h) vs ${minWorker?.employeeName} (${minHours}h). Differenza: ${(maxHours - minHours).toFixed(1)}h`,
      suggestedAction: 'Rivedere assegnazione turni per distribuzione più equa'
    });
  }

  // Verifica pattern di sotto organico ricorrenti
  const recurringUnderstaffing = dailyResults.filter(day => 
    day.staffing.understaffedPeriods.length > 0
  );

  if (recurringUnderstaffing.length >= 3) {
    overallIssues.push({
      type: 'understaffed',
      severity: 'warning',
      message: 'Sotto organico ricorrente',
      description: `${recurringUnderstaffing.length} giorni con personale insufficiente`,
      suggestedAction: 'Considerare di assumere personale aggiuntivo o rivedere i requisiti minimi'
    });
  }

  return {
    employees: employeeWorkloads,
    maxHours,
    minHours,
    averageHours: Number(averageHours.toFixed(1)),
    standardDeviation: Number(standardDeviation.toFixed(1)),
    isEquitable,
    inequityScore: Number(inequityScore.toFixed(1))
  };
}

/**
 * Calcola le statistiche riassuntive
 */
function calculateSummary(dailyResults: DailyValidationResult[]) {
  const openDays = dailyResults.filter(day => day.isStoreOpen);
  const validDays = openDays.filter(day => day.isValid);
  const daysWithIssues = openDays.filter(day => day.issues.length > 0);
  const daysWithoutShifts = openDays.filter(day => !day.hasShifts);

  const allIssues = dailyResults.flatMap(day => day.issues);
  const criticalIssues = allIssues.filter(issue => issue.severity === 'critical').length;
  const warnings = allIssues.filter(issue => issue.severity === 'warning').length;

  return {
    totalDays: openDays.length,
    validDays: validDays.length,
    daysWithIssues: daysWithIssues.length,
    daysWithoutShifts: daysWithoutShifts.length,
    totalAnomalies: allIssues.length,
    criticalIssues,
    warnings
  };
}

/**
 * Calcola un score di validità 0-100
 */
function calculateValidationScore(
  dailyResults: DailyValidationResult[],
  summary: ReturnType<typeof calculateSummary>
): number {
  if (summary.totalDays === 0) return 100;

  let score = 100;
  
  // Penalità per giorni non validi
  score -= (summary.totalDays - summary.validDays) * 15;
  
  // Penalità per giorni senza turni
  score -= summary.daysWithoutShifts * 20;
  
  // Penalità per issues critici
  score -= summary.criticalIssues * 10;
  
  // Penalità per warnings
  score -= summary.warnings * 3;

  // Bonus per copertura alta
  const avgCoverage = dailyResults
    .filter(day => day.isStoreOpen && day.hasShifts)
    .reduce((acc, day) => acc + day.coverage.coveragePercentage, 0) / 
    Math.max(1, dailyResults.filter(day => day.isStoreOpen && day.hasShifts).length);
  
  if (avgCoverage > 95) score += 5;
  if (avgCoverage > 90) score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// Utility functions
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function createEmptyCoverage(): CoverageAnalysis {
  return {
    hasOpeningCoverage: false,
    hasClosingCoverage: false,
    hasContinuousCoverage: false,
    coverageGaps: [],
    coveredMinutes: 0,
    totalOperatingMinutes: 0,
    coveragePercentage: 0
  };
}

function createEmptyStaffing(): StaffingAnalysis {
  return {
    hourlyStaffCount: [],
    peakStaffCount: 0,
    minimumStaffCount: 0,
    averageStaffCount: 0,
    understaffedPeriods: [],
    recommendedMinimumStaff: 1
  };
}

// 🆕 CREA DISTRIBUZIONE WORKLOAD VUOTA
function createEmptyWorkloadDistribution(): WorkloadDistribution {
  return {
    employees: [],
    maxHours: 0,
    minHours: 0,
    averageHours: 0,
    standardDeviation: 0,
    isEquitable: true,
    inequityScore: 0
  };
}