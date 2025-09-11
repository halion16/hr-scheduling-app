import { Shift, Employee } from '../types';
import { CCNLRestPeriodRule, CCNLViolation, CCNLComplianceReport, CCNL_STANDARD_RULES } from '../types/ccnl';
import { getDayOfWeek, addDays } from './timeUtils';

/**
 * CCNL del commercio compliance validation utilities
 * Ensures all shift scheduling complies with Italian labor law
 */

export class CCNLValidator {
  private rules: CCNLRestPeriodRule[];

  constructor(customRules: CCNLRestPeriodRule[] = []) {
    this.rules = [...CCNL_STANDARD_RULES, ...customRules].filter(rule => rule.isActive);
  }

  /**
   * Validates a single shift against CCNL requirements
   */
  validateShift(
    shift: Shift, 
    employee: Employee, 
    allEmployeeShifts: Shift[], 
    proposedDate?: Date,
    store?: Store
  ): CCNLViolation[] {
    const violations: CCNLViolation[] = [];
    const shiftDate = proposedDate || shift.date;
    

    // 🏪 VERIFICA PREREQUISITI NEGOZIO
    if (store) {
      const storeValidation = this.validateStoreConstraints(shift, shiftDate, store, employee);
      if (storeValidation) violations.push(storeValidation);
    }

    // Ordina tutti i turni del dipendente per data
    const sortedShifts = allEmployeeShifts
      .filter(s => s.employeeId === employee.id)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // 1. VERIFICA RIPOSO GIORNALIERO (11 ore)
    const dailyRestViolation = this.checkDailyRestPeriod(shift, shiftDate, sortedShifts, employee);
    if (dailyRestViolation) violations.push(dailyRestViolation);

    // 2. VERIFICA INTERVALLO TRA TURNI
    const shiftGapViolation = this.checkShiftGapCompliance(shift, shiftDate, sortedShifts, employee);
    if (shiftGapViolation) violations.push(shiftGapViolation);

    // 3. VERIFICA GIORNI CONSECUTIVI
    const consecutiveDaysViolation = this.checkConsecutiveDaysLimit(shift, shiftDate, sortedShifts, employee);
    if (consecutiveDaysViolation) violations.push(consecutiveDaysViolation);


    return violations;
  }

  /**
   * 🏪 VALIDA VINCOLI SPECIFICI DEL NEGOZIO
   */
  private validateStoreConstraints(
    shift: Shift,
    shiftDate: Date,
    store: Store,
    employee: Employee
  ): CCNLViolation | null {
    const dayOfWeek = getDayOfWeek(shiftDate);
    
    // 1. VERIFICA CHIUSURE STRAORDINARIE
    const closureDay = store.closureDays?.find(closure => 
      closure.date.toDateString() === shiftDate.toDateString()
    );
    
    if (closureDay?.isFullDay) {
      return {
        id: `store-closed-${shift.id || 'new'}`,
        type: 'daily_rest',
        employeeId: employee.id,
        shiftIds: [shift.id || 'new-shift'],
        violationDate: shiftDate,
        description: `Negozio chiuso per ${closureDay.reason} - Impossibile assegnare turni`,
        articleReference: 'Art. 2103 Codice Civile - Organizzazione del lavoro',
        severity: 'critical',
        suggestedResolution: 'Rimuovere il turno dal giorno di chiusura o modificare la data',
        currentValue: 0,
        requiredValue: 1,
        isResolved: false
      };
    }
    
    // 2. VERIFICA ORARI DI APERTURA NEGOZIO
    const effectiveStoreHours = this.getEffectiveStoreHours(shiftDate, store);
    
    if (!effectiveStoreHours) {
      return {
        id: `store-not-open-${shift.id || 'new'}`,
        type: 'daily_rest',
        employeeId: employee.id,
        shiftIds: [shift.id || 'new-shift'],
        violationDate: shiftDate,
        description: `Negozio chiuso di ${dayOfWeek} - Impossibile assegnare turni`,
        articleReference: 'Art. 2103 Codice Civile - Organizzazione del lavoro',
        severity: 'critical',
        suggestedResolution: 'Assegnare il turno in un giorno di apertura o modificare gli orari del negozio',
        currentValue: 0,
        requiredValue: 1,
        isResolved: false
      };
    }
    
    // 3. VERIFICA COMPATIBILITÀ ORARI TURNO CON NEGOZIO
    const shiftStartMinutes = this.timeToMinutes(shift.startTime);
    const shiftEndMinutes = this.timeToMinutes(shift.endTime);
    const storeOpenMinutes = this.timeToMinutes(effectiveStoreHours.open);
    const storeCloseMinutes = this.timeToMinutes(effectiveStoreHours.close);
    
    // Controlla che il turno sia almeno parzialmente dentro gli orari del negozio
    const overlapStart = Math.max(shiftStartMinutes, storeOpenMinutes);
    const overlapEnd = Math.min(shiftEndMinutes, storeCloseMinutes);
    const overlapMinutes = Math.max(0, overlapEnd - overlapStart);
    
    if (overlapMinutes < 60) { // Almeno 1 ora di sovrapposizione
      return {
        id: `shift-outside-hours-${shift.id || 'new'}`,
        type: 'daily_rest',
        employeeId: employee.id,
        shiftIds: [shift.id || 'new-shift'],
        violationDate: shiftDate,
        description: `Turno ${shift.startTime}-${shift.endTime} non compatibile con orari negozio ${effectiveStoreHours.open}-${effectiveStoreHours.close}`,
        articleReference: 'Art. 2103 Codice Civile - Organizzazione del lavoro',
        severity: 'warning',
        suggestedResolution: 'Modificare gli orari del turno per essere compatibili con l\'apertura del negozio',
        currentValue: overlapMinutes / 60,
        requiredValue: 1,
        isResolved: false
      };
    }
    
    return null;
  }
  
  /**
   * 🕐 DETERMINA ORARI EFFETTIVI DEL NEGOZIO PER UNA DATA
   */
  private getEffectiveStoreHours(
    date: Date, 
    store: Store
  ): { open: string; close: string } | null {
    const dayOfWeek = getDayOfWeek(date);
    
    // 1. VERIFICA CHIUSURE STRAORDINARIE
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
    
    // 2. VERIFICA ORARI SETTIMANALI PERSONALIZZATI
    const weekStart = this.getStartOfWeek(date);
    const weeklySchedule = store.weeklySchedules?.find(schedule => 
      schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
    );
    
    if (weeklySchedule && weeklySchedule.openingHours[dayOfWeek]) {
      return weeklySchedule.openingHours[dayOfWeek];
    }
    
    // 3. FALLBACK AGLI ORARI STANDARD
    return store.openingHours[dayOfWeek] || null;
  }
  
  /**
   * 📅 OTTIENI INIZIO SETTIMANA (LUNEDÌ)
   */
  private getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }
  
  /**
   * 🕐 CONVERTE ORARIO IN MINUTI
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Verifica riposo giornaliero di 11 ore
   */
  private checkDailyRestPeriod(
    shift: Shift, 
    shiftDate: Date, 
    allShifts: Shift[], 
    employee: Employee
  ): CCNLViolation | null {
    const rule = this.rules.find(r => r.type === 'daily_rest');
    if (!rule) return null;

    // Trova turno precedente e successivo
    const dayBefore = new Date(shiftDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    
    const dayAfter = new Date(shiftDate);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const previousShift = allShifts.find(s => 
      s.date.toDateString() === dayBefore.toDateString()
    );
    
    const nextShift = allShifts.find(s => 
      s.date.toDateString() === dayAfter.toDateString()
    );

    // Controlla riposo prima del turno
    if (previousShift) {
      const restHours = this.calculateRestHoursBetweenShifts(previousShift, shift, shiftDate);
      if (restHours < rule.minimumHours) {
        return {
          id: `daily-rest-before-${shift.id || 'new'}`,
          type: 'daily_rest',
          employeeId: employee.id,
          shiftIds: [previousShift.id, shift.id || 'new-shift'],
          violationDate: shiftDate,
          description: `Riposo insufficiente: solo ${restHours.toFixed(1)}h invece di ${rule.minimumHours}h richieste`,
          articleReference: rule.articleReference,
          severity: rule.severity,
          suggestedResolution: `Spostare il turno per garantire ${rule.minimumHours}h di riposo`,
          currentValue: restHours,
          requiredValue: rule.minimumHours,
          isResolved: false
        };
      }
    }

    // Controlla riposo dopo il turno
    if (nextShift) {
      const restHours = this.calculateRestHoursBetweenShifts(shift, nextShift, dayAfter);
      if (restHours < rule.minimumHours) {
        return {
          id: `daily-rest-after-${shift.id || 'new'}`,
          type: 'daily_rest',
          employeeId: employee.id,
          shiftIds: [shift.id || 'new-shift', nextShift.id],
          violationDate: dayAfter,
          description: `Riposo insufficiente: solo ${restHours.toFixed(1)}h invece di ${rule.minimumHours}h richieste`,
          articleReference: rule.articleReference,
          severity: rule.severity,
          suggestedResolution: `Modificare gli orari per garantire ${rule.minimumHours}h di riposo`,
          currentValue: restHours,
          requiredValue: rule.minimumHours,
          isResolved: false
        };
      }
    }

    return null;
  }

  /**
   * Verifica intervallo minimo tra turni
   */
  private checkShiftGapCompliance(
    shift: Shift,
    shiftDate: Date,
    allShifts: Shift[],
    employee: Employee
  ): CCNLViolation | null {
    const rule = this.rules.find(r => r.type === 'shift_gap');
    if (!rule) return null;

    // Trova tutti i turni adiacenti
    const adjacentShifts = this.findAdjacentShifts(shift, shiftDate, allShifts);
    
    for (const adjacent of adjacentShifts) {
      const gapHours = this.calculateShiftGap(shift, shiftDate, adjacent.shift, adjacent.date);
      
      if (gapHours < rule.minimumHours) {
        return {
          id: `shift-gap-${shift.id || 'new'}-${adjacent.shift.id}`,
          type: 'shift_gap',
          employeeId: employee.id,
          shiftIds: [shift.id || 'new-shift', adjacent.shift.id],
          violationDate: adjacent.isBefore ? shiftDate : adjacent.date,
          description: `Intervallo tra turni insufficiente: ${gapHours.toFixed(1)}h invece di ${rule.minimumHours}h richieste`,
          articleReference: rule.articleReference,
          severity: rule.severity,
          suggestedResolution: `Aumentare l'intervallo tra i turni a minimum ${rule.minimumHours}h`,
          currentValue: gapHours,
          requiredValue: rule.minimumHours,
          isResolved: false
        };
      }
    }

    return null;
  }

  /**
   * Verifica limite giorni consecutivi
   */
  private checkConsecutiveDaysLimit(
    shift: Shift,
    shiftDate: Date,
    allShifts: Shift[],
    employee: Employee
  ): CCNLViolation | null {
    const rule = this.rules.find(r => r.type === 'consecutive_days');
    if (!rule || !rule.maximumConsecutiveDays) return null;

    const consecutiveDays = this.calculateConsecutiveDaysAtDate(shiftDate, allShifts);
    
    if (consecutiveDays > rule.maximumConsecutiveDays) {
      return {
        id: `consecutive-days-${shift.id || 'new'}`,
        type: 'consecutive_days',
        employeeId: employee.id,
        shiftIds: [shift.id || 'new-shift'],
        violationDate: shiftDate,
        description: `Troppi giorni consecutivi: ${consecutiveDays} invece di max ${rule.maximumConsecutiveDays}`,
        articleReference: rule.articleReference,
        severity: rule.severity,
        suggestedResolution: `Inserire un giorno di riposo dopo max ${rule.maximumConsecutiveDays} giorni`,
        currentValue: consecutiveDays,
        requiredValue: rule.maximumConsecutiveDays,
        isResolved: false
      };
    }

    return null;
  }

  /**
   * Genera report di compliance per un dipendente in una settimana
   */
  generateWeeklyComplianceReport(
    employee: Employee,
    weekStart: Date,
    shifts: Shift[]
  ): CCNLComplianceReport {
    const weekEnd = addDays(weekStart, 6);
    const employeeShifts = shifts.filter(s => s.employeeId === employee.id);
    const weekShifts = employeeShifts.filter(s => s.date >= weekStart && s.date <= weekEnd);
    
    console.log(`📊 Generating CCNL compliance report for ${employee.firstName} ${employee.lastName}`);

    // Raccogli tutte le violazioni della settimana
    const allViolations: CCNLViolation[] = [];
    
    weekShifts.forEach(shift => {
      const violations = this.validateShift(shift, employee, employeeShifts);
      allViolations.push(...violations);
    });

    // Analizza compliance riposo giornaliero
    const dailyRestCompliance = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dayShift = weekShifts.find(s => s.date.toDateString() === date.toDateString());
      
      if (dayShift) {
        const restAnalysis = this.analyzeDailyRest(dayShift, date, employeeShifts);
        dailyRestCompliance.push({
          date,
          hasMinimumRest: restAnalysis.compliant,
          restHours: restAnalysis.actualRest,
          requiredHours: 11
        });
      }
    }

    // Analizza compliance riposo settimanale
    const weeklyRestAnalysis = this.analyzeWeeklyRest(weekShifts, weekStart);
    
    // Calcola giorni consecutivi
    const consecutiveDays = this.calculateMaxConsecutiveDaysInWeek(weekShifts, employeeShifts);

    // Calcola score di compliance (0-100)
    const complianceScore = this.calculateComplianceScore(allViolations, dailyRestCompliance, weeklyRestAnalysis);

    return {
      employeeId: employee.id,
      weekStart,
      weekEnd,
      violations: allViolations,
      dailyRestCompliance,
      weeklyRestCompliance: weeklyRestAnalysis,
      consecutiveDaysWorked: consecutiveDays,
      maxAllowedConsecutiveDays: 6,
      complianceScore,
      overallStatus: this.determineComplianceStatus(allViolations, complianceScore)
    };
  }

  // === UTILITY METHODS ===

  private calculateRestHoursBetweenShifts(
    firstShift: Shift, 
    secondShift: Shift, 
    secondShiftDate: Date
  ): number {
    // Calcola fine primo turno
    const [endHour, endMin] = firstShift.endTime.split(':').map(Number);
    const firstEnd = new Date(firstShift.date);
    firstEnd.setHours(endHour, endMin, 0, 0);

    // Calcola inizio secondo turno
    const [startHour, startMin] = secondShift.startTime.split(':').map(Number);
    const secondStart = new Date(secondShiftDate);
    secondStart.setHours(startHour, startMin, 0, 0);

    // Calcola differenza in ore
    const diffMs = secondStart.getTime() - firstEnd.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  private findAdjacentShifts(
    shift: Shift, 
    shiftDate: Date, 
    allShifts: Shift[]
  ): Array<{ shift: Shift; date: Date; isBefore: boolean }> {
    const adjacent = [];
    
    // Turno del giorno precedente
    const dayBefore = new Date(shiftDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const previousShift = allShifts.find(s => 
      s.date.toDateString() === dayBefore.toDateString()
    );
    if (previousShift) {
      adjacent.push({ shift: previousShift, date: dayBefore, isBefore: true });
    }

    // Turno del giorno successivo
    const dayAfter = new Date(shiftDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const nextShift = allShifts.find(s => 
      s.date.toDateString() === dayAfter.toDateString()
    );
    if (nextShift) {
      adjacent.push({ shift: nextShift, date: dayAfter, isBefore: false });
    }

    return adjacent;
  }

  private calculateShiftGap(
    shift1: Shift, 
    date1: Date, 
    shift2: Shift, 
    date2: Date
  ): number {
    const earlier = date1 <= date2 ? { shift: shift1, date: date1 } : { shift: shift2, date: date2 };
    const later = date1 <= date2 ? { shift: shift2, date: date2 } : { shift: shift1, date: date1 };

    return this.calculateRestHoursBetweenShifts(earlier.shift, later.shift, later.date);
  }

  private calculateConsecutiveDaysAtDate(date: Date, allShifts: Shift[]): number {
    let consecutive = 1; // Il giorno corrente
    
    // Conta indietro
    let checkDate = new Date(date);
    checkDate.setDate(checkDate.getDate() - 1);
    
    while (true) {
      const hasShift = allShifts.some(s => s.date.toDateString() === checkDate.toDateString());
      if (!hasShift) break;
      
      consecutive++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Conta avanti
    checkDate = new Date(date);
    checkDate.setDate(checkDate.getDate() + 1);
    
    while (true) {
      const hasShift = allShifts.some(s => s.date.toDateString() === checkDate.toDateString());
      if (!hasShift) break;
      
      consecutive++;
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    return consecutive;
  }

  private analyzeDailyRest(shift: Shift, date: Date, allShifts: Shift[]): { compliant: boolean; actualRest: number } {
    const adjacent = this.findAdjacentShifts(shift, date, allShifts);
    let minRest = 24; // Default se non ci sono turni adiacenti

    for (const adj of adjacent) {
      const restHours = this.calculateShiftGap(shift, date, adj.shift, adj.date);
      minRest = Math.min(minRest, restHours);
    }

    return {
      compliant: minRest >= 11,
      actualRest: minRest
    };
  }

  private analyzeWeeklyRest(weekShifts: Shift[], weekStart: Date): { hasWeeklyRest: boolean; weeklyRestHours: number; requiredWeeklyRest: number } {
    if (weekShifts.length === 0) {
      return {
        hasWeeklyRest: true,
        weeklyRestHours: 168, // 7 giorni * 24 ore
        requiredWeeklyRest: 35
      };
    }

    // Trova il periodo più lungo senza turni
    const workDays = weekShifts.map(s => s.date.getDay()).sort((a, b) => a - b);
    let maxRestPeriod = 0;

    // Calcola periodi di riposo tra giorni lavorativi
    for (let i = 0; i < workDays.length - 1; i++) {
      const gap = workDays[i + 1] - workDays[i];
      if (gap > 1) {
        maxRestPeriod = Math.max(maxRestPeriod, (gap - 1) * 24);
      }
    }

    // Controlla periodo weekend (da domenica a lunedì)
    const hasWeekendRest = !workDays.includes(0) || !workDays.includes(6);
    if (hasWeekendRest) {
      maxRestPeriod = Math.max(maxRestPeriod, 35);
    }

    return {
      hasWeeklyRest: maxRestPeriod >= 35,
      weeklyRestHours: maxRestPeriod,
      requiredWeeklyRest: 35
    };
  }

  private calculateMaxConsecutiveDaysInWeek(weekShifts: Shift[], allShifts: Shift[]): number {
    if (weekShifts.length === 0) return 0;

    let maxConsecutive = 0;
    
    weekShifts.forEach(shift => {
      const consecutive = this.calculateConsecutiveDaysAtDate(shift.date, allShifts);
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    });

    return maxConsecutive;
  }

  private calculateComplianceScore(
    violations: CCNLViolation[], 
    dailyCompliance: any[], 
    weeklyCompliance: any
  ): number {
    let score = 100;
    
    // Penalità per violazioni critiche
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    score -= criticalViolations * 25;
    
    // Penalità per violazioni warning
    const warningViolations = violations.filter(v => v.severity === 'warning').length;
    score -= warningViolations * 10;
    
    // Penalità per non conformità riposo giornaliero
    const dailyNonCompliant = dailyCompliance.filter(d => !d.hasMinimumRest).length;
    score -= dailyNonCompliant * 15;
    
    // Penalità per non conformità riposo settimanale
    if (!weeklyCompliance.hasWeeklyRest) {
      score -= 30;
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineComplianceStatus(
    violations: CCNLViolation[], 
    score: number
  ): 'compliant' | 'minor_violations' | 'major_violations' {
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    
    if (criticalViolations > 0 || score < 60) {
      return 'major_violations';
    } else if (violations.length > 0 || score < 80) {
      return 'minor_violations';
    } else {
      return 'compliant';
    }
  }

  /**
   * Verifica se è possibile assegnare un turno senza violare CCNL
   */
  canAssignShiftSafely(
    proposedShift: Partial<Shift>,
    employee: Employee,
    allShifts: Shift[],
    store?: Store
  ): { canAssign: boolean; violations: CCNLViolation[] } {
    if (!proposedShift.date || !proposedShift.startTime || !proposedShift.endTime) {
      return { canAssign: false, violations: [] };
    }

    const tempShift: Shift = {
      id: 'temp-validation',
      employeeId: employee.id,
      storeId: proposedShift.storeId || '',
      date: proposedShift.date,
      startTime: proposedShift.startTime,
      endTime: proposedShift.endTime,
      breakDuration: proposedShift.breakDuration || 30,
      actualHours: proposedShift.actualHours || 8,
      status: 'scheduled',
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const violations = this.validateShift(tempShift, employee, allShifts, proposedShift.date, store);
    const criticalViolations = violations.filter(v => v.severity === 'critical');

    return {
      canAssign: criticalViolations.length === 0,
      violations
    };
  }
}

// Singleton instance
export const ccnlValidator = new CCNLValidator();