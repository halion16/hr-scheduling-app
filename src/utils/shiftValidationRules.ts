import { Shift, Employee, Store } from '../types';

/**
 * 🔍 STEP 1: SHIFT VALIDATION RULES
 * 
 * Regole di business complete per la validazione dei turni
 * Implementa controlli automatici per garantire coerenza e compliance.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface ValidationRule {
  name: string;
  category: 'critical' | 'warning' | 'info';
  weight: number; // Impact on score
  validator: (shift: Shift, context: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  employees: Employee[];
  stores: Store[];
  allShifts: Shift[];
  selectedDate?: Date;
  bulkOperation?: boolean;
}

// 🎯 VALIDATION RULES DEFINITIONS
export const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'Dipendente Valido',
    category: 'critical',
    weight: 20,
    validator: (shift, context) => {
      const employee = context.employees.find(emp => emp.id === shift.employeeId);
      if (!employee) {
        return { isValid: false, errors: ['Dipendente non trovato'], warnings: [], score: 0 };
      }
      if (!employee.isActive) {
        return { isValid: false, errors: ['Dipendente non attivo'], warnings: [], score: 0 };
      }
      return { isValid: true, errors: [], warnings: [], score: 100 };
    }
  },
  {
    name: 'Negozio Valido',
    category: 'critical',
    weight: 20,
    validator: (shift, context) => {
      const store = context.stores.find(s => s.id === shift.storeId);
      if (!store) {
        return { isValid: false, errors: ['Negozio non trovato'], warnings: [], score: 0 };
      }
      if (!store.isActive) {
        return { isValid: false, errors: ['Negozio non attivo'], warnings: [], score: 0 };
      }
      return { isValid: true, errors: [], warnings: [], score: 100 };
    }
  },
  {
    name: 'Orari Validi',
    category: 'critical',
    weight: 15,
    validator: (shift) => {
      if (!shift.startTime || !shift.endTime) {
        return { isValid: false, errors: ['Orari di inizio e fine obbligatori'], warnings: [], score: 0 };
      }
      
      const start = new Date(`2000-01-01T${shift.startTime}:00`);
      const end = new Date(`2000-01-01T${shift.endTime}:00`);
      
      if (start >= end) {
        return { isValid: false, errors: ['Orario di fine deve essere successivo all\'inizio'], warnings: [], score: 0 };
      }
      
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (duration > 12) {
        return { isValid: false, errors: ['Turno non può superare le 12 ore'], warnings: [], score: 20 };
      }
      
      if (duration < 1) {
        return { isValid: false, errors: ['Turno deve essere di almeno 1 ora'], warnings: [], score: 10 };
      }
      
      return { isValid: true, errors: [], warnings: [], score: 100 };
    }
  },
  {
    name: 'Sovrapposizioni',
    category: 'critical',
    weight: 25,
    validator: (shift, context) => {
      const sameEmployeeShifts = context.allShifts.filter(s => 
        s.id !== shift.id && 
        s.employeeId === shift.employeeId &&
        s.date.toDateString() === shift.date.toDateString()
      );
      
      const shiftStart = new Date(`${shift.date.toDateString()} ${shift.startTime}`);
      const shiftEnd = new Date(`${shift.date.toDateString()} ${shift.endTime}`);
      
      for (const otherShift of sameEmployeeShifts) {
        const otherStart = new Date(`${otherShift.date.toDateString()} ${otherShift.startTime}`);
        const otherEnd = new Date(`${otherShift.date.toDateString()} ${otherShift.endTime}`);
        
        if (shiftStart < otherEnd && shiftEnd > otherStart) {
          return { 
            isValid: false, 
            errors: [`Sovrapposizione con turno ${otherShift.startTime}-${otherShift.endTime}`], 
            warnings: [], 
            score: 0 
          };
        }
      }
      
      return { isValid: true, errors: [], warnings: [], score: 100 };
    }
  },
  {
    name: 'Ore Settimanali',
    category: 'warning',
    weight: 10,
    validator: (shift, context) => {
      const weekStart = new Date(shift.date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekShifts = context.allShifts.filter(s => 
        s.employeeId === shift.employeeId &&
        s.date >= weekStart && s.date <= weekEnd &&
        s.id !== shift.id
      );
      
      const currentWeekHours = weekShifts.reduce((sum, s) => sum + s.actualHours, 0);
      const totalWithNewShift = currentWeekHours + shift.actualHours;
      
      if (totalWithNewShift > 48) {
        return { 
          isValid: false, 
          errors: [`Supera 48 ore settimanali (attuale: ${totalWithNewShift.toFixed(1)}h)`], 
          warnings: [], 
          score: 30 
        };
      }
      
      if (totalWithNewShift > 40) {
        return { 
          isValid: true, 
          errors: [], 
          warnings: [`Vicino al limite settimanale (${totalWithNewShift.toFixed(1)}h)`], 
          score: 80 
        };
      }
      
      return { isValid: true, errors: [], warnings: [], score: 100 };
    }
  },
  {
    name: 'Riposo Tra Turni',
    category: 'warning',
    weight: 10,
    validator: (shift, context) => {
      const shiftDate = new Date(shift.date);
      const dayBefore = new Date(shiftDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(shiftDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      
      const adjacentShifts = context.allShifts.filter(s => 
        s.employeeId === shift.employeeId &&
        (s.date.toDateString() === dayBefore.toDateString() || 
         s.date.toDateString() === dayAfter.toDateString())
      );
      
      const warnings: string[] = [];
      const shiftStart = new Date(`${shift.date.toDateString()} ${shift.startTime}`);
      const shiftEnd = new Date(`${shift.date.toDateString()} ${shift.endTime}`);
      
      for (const adjacentShift of adjacentShifts) {
        const adjStart = new Date(`${adjacentShift.date.toDateString()} ${adjacentShift.startTime}`);
        const adjEnd = new Date(`${adjacentShift.date.toDateString()} ${adjacentShift.endTime}`);
        
        const restHours = Math.abs(shiftStart.getTime() - adjEnd.getTime()) / (1000 * 60 * 60);
        const restHours2 = Math.abs(adjStart.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60);
        const minRest = Math.min(restHours, restHours2);
        
        if (minRest < 11) {
          warnings.push(`Riposo insufficiente tra turni (${minRest.toFixed(1)}h)`);
        }
      }
      
      return { 
        isValid: warnings.length === 0, 
        errors: [], 
        warnings, 
        score: warnings.length > 0 ? 70 : 100 
      };
    }
  }
];

// 🔍 MAIN VALIDATION FUNCTIONS
export function validateShiftForLocking(
  shift: Shift, 
  context: ValidationContext
): ValidationResult {
  const results = VALIDATION_RULES.map(rule => ({
    rule,
    result: rule.validator(shift, context)
  }));
  
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalScore = 0;
  let totalWeight = 0;
  
  results.forEach(({ rule, result }) => {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    totalScore += result.score * rule.weight;
    totalWeight += rule.weight;
  });
  
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  
  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    score: finalScore
  };
}

export function validateShiftsForBulkLocking(
  shifts: Shift[], 
  context: ValidationContext
): { 
  validShifts: Shift[]; 
  invalidShifts: { shift: Shift; errors: string[] }[];
  summary: { total: number; valid: number; invalid: number; avgScore: number };
} {
  const validShifts: Shift[] = [];
  const invalidShifts: { shift: Shift; errors: string[] }[] = [];
  let totalScore = 0;
  
  const bulkContext = { ...context, bulkOperation: true };
  
  shifts.forEach(shift => {
    const result = validateShiftForLocking(shift, bulkContext);
    totalScore += result.score;
    
    if (result.isValid) {
      validShifts.push(shift);
    } else {
      invalidShifts.push({ shift, errors: result.errors });
    }
  });
  
  return {
    validShifts,
    invalidShifts,
    summary: {
      total: shifts.length,
      valid: validShifts.length,
      invalid: invalidShifts.length,
      avgScore: shifts.length > 0 ? Math.round(totalScore / shifts.length) : 0
    }
  };
}

// 🎯 UTILITY FUNCTIONS
export function getValidationSeverity(score: number): 'critical' | 'warning' | 'success' {
  if (score < 50) return 'critical';
  if (score < 80) return 'warning';
  return 'success';
}

export function formatValidationMessage(result: ValidationResult): string {
  if (result.isValid) {
    return `✅ Turno valido (Score: ${result.score}/100)`;
  }
  
  const errorMsg = result.errors.join(', ');
  const warningMsg = result.warnings.length > 0 ? ` | Avvisi: ${result.warnings.join(', ')}` : '';
  
  return `❌ ${errorMsg}${warningMsg} (Score: ${result.score}/100)`;
}