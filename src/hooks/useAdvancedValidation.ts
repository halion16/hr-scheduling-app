import { useState, useCallback, useRef } from 'react';
import { Shift, Employee, Store } from '../types';
import { BalancingSuggestion } from './useWorkloadBalancer';

// FASE 3.1: Advanced Validation Interfaces
export interface ValidationCheck {
  id: string;
  name: string;
  type: 'availability' | 'contract' | 'overlap' | 'competency' | 'legal' | 'operational';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  affectedEmployeeId?: string;
  affectedShiftId?: string;
  suggestion?: string;
}

export interface AdvancedValidationResult {
  isValid: boolean;
  canProceed: boolean; // True if only warnings, false if errors
  checks: ValidationCheck[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  estimatedSuccess: number; // 0-100 percentage
}

// FASE 3.2: Rollback System Interfaces
export interface StateSnapshot {
  id: string;
  timestamp: Date;
  description: string;
  shifts: Shift[];
  operation: string;
  metadata: {
    suggestion?: BalancingSuggestion;
    userAction: string;
  };
}

export interface RollbackOperation {
  snapshotId: string;
  restoredShifts: Shift[];
  success: boolean;
  errors: string[];
  timestamp: Date;
}

interface UseAdvancedValidationProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
  onUpdateShifts?: (updates: { id: string; data: Partial<Shift> }[]) => void;
}

export const useAdvancedValidation = ({
  shifts,
  employees,
  stores,
  onUpdateShifts
}: UseAdvancedValidationProps) => {

  // State management
  const [snapshots, setSnapshots] = useState<StateSnapshot[]>([]);
  const [lastValidation, setLastValidation] = useState<AdvancedValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Refs for tracking
  const maxSnapshots = 10; // Keep last 10 snapshots
  const validationCache = useRef<Map<string, AdvancedValidationResult>>(new Map());

  // 🔍 FASE 3.1: ADVANCED VALIDATION ENGINE
  const validateAvailability = useCallback((targetShifts: Shift[], employeeIds: string[]): ValidationCheck[] => {
    const checks: ValidationCheck[] = [];

    employeeIds.forEach(employeeId => {
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;

      const employeeShifts = targetShifts.filter(s => s.employeeId === employeeId);

      // Check for overlapping shifts
      for (let i = 0; i < employeeShifts.length; i++) {
        for (let j = i + 1; j < employeeShifts.length; j++) {
          const shift1 = employeeShifts[i];
          const shift2 = employeeShifts[j];

          if (shift1.date.toDateString() === shift2.date.toDateString()) {
            const start1 = new Date(`${shift1.date.toDateString()} ${shift1.startTime}`);
            const end1 = new Date(`${shift1.date.toDateString()} ${shift1.endTime}`);
            const start2 = new Date(`${shift2.date.toDateString()} ${shift2.startTime}`);
            const end2 = new Date(`${shift2.date.toDateString()} ${shift2.endTime}`);

            if ((start1 < end2 && end1 > start2)) {
              checks.push({
                id: `overlap-${shift1.id}-${shift2.id}`,
                name: 'Sovrapposizione Turni',
                type: 'overlap',
                severity: 'error',
                message: `${employee.firstName} ${employee.lastName} ha turni sovrapposti`,
                details: `Turno 1: ${shift1.startTime}-${shift1.endTime}, Turno 2: ${shift2.startTime}-${shift2.endTime}`,
                affectedEmployeeId: employeeId,
                affectedShiftId: shift1.id,
                suggestion: 'Modificare gli orari o riassegnare uno dei turni'
              });
            }
          }
        }
      }

      // Check for consecutive day limits
      const shiftsByDate = employeeShifts
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(s => ({ shift: s, date: new Date(s.date) }));

      let consecutiveDays = 1;
      for (let i = 1; i < shiftsByDate.length; i++) {
        const prevDate = shiftsByDate[i - 1].date;
        const currDate = shiftsByDate[i].date;

        const diffTime = currDate.getTime() - prevDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          consecutiveDays++;
        } else {
          consecutiveDays = 1;
        }

        if (consecutiveDays > 6) {
          checks.push({
            id: `consecutive-${employeeId}-${i}`,
            name: 'Giorni Consecutivi Eccessivi',
            type: 'legal',
            severity: 'warning',
            message: `${employee.firstName} ${employee.lastName} ha più di 6 giorni consecutivi`,
            details: `${consecutiveDays} giorni consecutivi rilevati`,
            affectedEmployeeId: employeeId,
            suggestion: 'Aggiungere almeno un giorno di riposo'
          });
        }
      }
    });

    return checks;
  }, [shifts, employees]);

  const validateContracts = useCallback((targetShifts: Shift[], employeeIds: string[]): ValidationCheck[] => {
    const checks: ValidationCheck[] = [];

    employeeIds.forEach(employeeId => {
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;

      const employeeShifts = targetShifts.filter(s => s.employeeId === employeeId);

      // Calculate total hours for the week
      const totalHours = employeeShifts.reduce((sum, shift) => {
        return sum + (shift.actualHours || 8); // Default 8 hours if not specified
      }, 0);

      const contractHours = employee.contractHours || 40;

      // Check contract limits
      if (totalHours > contractHours * 1.25) { // 25% overtime limit
        checks.push({
          id: `contract-excess-${employeeId}`,
          name: 'Superamento Limite Contrattuale',
          type: 'contract',
          severity: 'error',
          message: `${employee.firstName} ${employee.lastName} supera il limite contrattuale`,
          details: `Ore totali: ${totalHours}h, Limite: ${contractHours * 1.25}h`,
          affectedEmployeeId: employeeId,
          suggestion: 'Ridurre le ore o distribuire il carico'
        });
      } else if (totalHours > contractHours * 1.1) { // 10% warning threshold
        checks.push({
          id: `contract-warning-${employeeId}`,
          name: 'Avvicinamento Limite Contrattuale',
          type: 'contract',
          severity: 'warning',
          message: `${employee.firstName} ${employee.lastName} si avvicina al limite contrattuale`,
          details: `Ore totali: ${totalHours}h, Contratto: ${contractHours}h`,
          affectedEmployeeId: employeeId,
          suggestion: 'Monitorare il carico di lavoro'
        });
      }

      // Check minimum hours
      if (totalHours < contractHours * 0.5) {
        checks.push({
          id: `contract-minimum-${employeeId}`,
          name: 'Ore Insufficienti',
          type: 'contract',
          severity: 'warning',
          message: `${employee.firstName} ${employee.lastName} ha ore insufficienti`,
          details: `Ore totali: ${totalHours}h, Minimo atteso: ${contractHours * 0.5}h`,
          affectedEmployeeId: employeeId,
          suggestion: 'Considerare aggiunta di turni'
        });
      }
    });

    return checks;
  }, [employees]);

  const validateCompetencies = useCallback((targetShifts: Shift[], employeeIds: string[]): ValidationCheck[] => {
    const checks: ValidationCheck[] = [];

    employeeIds.forEach(employeeId => {
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;

      const employeeShifts = targetShifts.filter(s => s.employeeId === employeeId);

      employeeShifts.forEach(shift => {
        const store = stores.find(s => s.id === shift.storeId);
        if (!store) return;

        const shiftHours = shift.actualHours || 8;

        // Check role-based competencies
        if (employee.role === 'junior') {
          if (shiftHours > 6) {
            checks.push({
              id: `competency-junior-hours-${shift.id}`,
              name: 'Competenze Insufficienti',
              type: 'competency',
              severity: 'warning',
              message: `Dipendente junior assegnato a turno lungo`,
              details: `${employee.firstName} ${employee.lastName} (junior) - ${shiftHours}h`,
              affectedEmployeeId: employeeId,
              affectedShiftId: shift.id,
              suggestion: 'Assegnare supervisione o ridurre ore'
            });
          }

          // Check if it's a complex shift (evening/weekend)
          const shiftDate = new Date(shift.date);
          const isWeekend = shiftDate.getDay() === 0 || shiftDate.getDay() === 6;
          const startHour = parseInt(shift.startTime.split(':')[0]);
          const isEvening = startHour >= 18;

          if (isWeekend || isEvening) {
            checks.push({
              id: `competency-junior-complex-${shift.id}`,
              name: 'Turno Complesso per Junior',
              type: 'competency',
              severity: 'warning',
              message: `Junior assegnato a turno complesso`,
              details: `${employee.firstName} ${employee.lastName} - ${isWeekend ? 'Weekend' : 'Serale'}`,
              affectedEmployeeId: employeeId,
              affectedShiftId: shift.id,
              suggestion: 'Assegnare supervisione o preferire dipendente senior'
            });
          }
        }

        // Check store compatibility
        if (employee.storeId !== 'all' && employee.storeId !== shift.storeId) {
          checks.push({
            id: `competency-store-${shift.id}`,
            name: 'Incompatibilità Negozio',
            type: 'competency',
            severity: 'error',
            message: `Dipendente assegnato a negozio incompatibile`,
            details: `${employee.firstName} ${employee.lastName} non autorizzato per ${store.name}`,
            affectedEmployeeId: employeeId,
            affectedShiftId: shift.id,
            suggestion: 'Riassegnare a dipendente autorizzato per questo negozio'
          });
        }
      });
    });

    return checks;
  }, [employees, stores]);

  const performAdvancedValidation = useCallback(async (
    suggestion: BalancingSuggestion,
    affectedShifts: Shift[]
  ): Promise<AdvancedValidationResult> => {
    setIsValidating(true);

    // Generate cache key
    const cacheKey = `${suggestion.id}-${affectedShifts.map(s => s.id).join(',')}-${affectedShifts.map(s => s.employeeId).join(',')}`;

    // Check cache first
    const cached = validationCache.current.get(cacheKey);
    if (cached) {
      setIsValidating(false);
      return cached;
    }

    console.log('🔍 Performing advanced validation for suggestion:', suggestion.type);

    try {
      // Simulate all shifts after applying the suggestion
      const allShiftsAfterChange = shifts.map(shift => {
        const affectedShift = affectedShifts.find(as => as.id === shift.id);
        return affectedShift || shift;
      });

      // Get affected employee IDs
      const affectedEmployeeIds = Array.from(new Set([
        suggestion.sourceEmployeeId,
        suggestion.targetEmployeeId,
        ...affectedShifts.map(s => s.employeeId)
      ].filter(Boolean) as string[]));

      // Perform all validation checks
      const checks: ValidationCheck[] = [];

      // 1. Availability validation
      checks.push(...validateAvailability(allShiftsAfterChange, affectedEmployeeIds));

      // 2. Contract validation
      checks.push(...validateContracts(allShiftsAfterChange, affectedEmployeeIds));

      // 3. Competency validation
      checks.push(...validateCompetencies(allShiftsAfterChange, affectedEmployeeIds));

      // 4. Additional operational checks
      affectedShifts.forEach(shift => {
        const employee = employees.find(e => e.id === shift.employeeId);
        if (!employee) {
          checks.push({
            id: `missing-employee-${shift.id}`,
            name: 'Dipendente Non Trovato',
            type: 'operational',
            severity: 'error',
            message: 'Turno assegnato a dipendente inesistente',
            details: `Shift ID: ${shift.id}, Employee ID: ${shift.employeeId}`,
            affectedShiftId: shift.id,
            suggestion: 'Verificare l\'integrità dei dati'
          });
        }

        const store = stores.find(s => s.id === shift.storeId);
        if (!store) {
          checks.push({
            id: `missing-store-${shift.id}`,
            name: 'Negozio Non Trovato',
            type: 'operational',
            severity: 'error',
            message: 'Turno assegnato a negozio inesistente',
            details: `Shift ID: ${shift.id}, Store ID: ${shift.storeId}`,
            affectedShiftId: shift.id,
            suggestion: 'Verificare l\'integrità dei dati'
          });
        }
      });

      // Calculate summary
      const summary = {
        errors: checks.filter(c => c.severity === 'error').length,
        warnings: checks.filter(c => c.severity === 'warning').length,
        infos: checks.filter(c => c.severity === 'info').length
      };

      // Calculate success estimation
      let estimatedSuccess = 100;
      estimatedSuccess -= summary.errors * 30; // Each error reduces success by 30%
      estimatedSuccess -= summary.warnings * 10; // Each warning reduces success by 10%
      estimatedSuccess = Math.max(0, estimatedSuccess);

      const result: AdvancedValidationResult = {
        isValid: summary.errors === 0,
        canProceed: summary.errors === 0, // Can proceed only if no errors
        checks,
        summary,
        estimatedSuccess
      };

      // Cache result
      validationCache.current.set(cacheKey, result);

      // Cleanup cache if too large
      if (validationCache.current.size > 50) {
        const firstKey = validationCache.current.keys().next().value;
        validationCache.current.delete(firstKey);
      }

      setLastValidation(result);
      return result;

    } catch (error) {
      console.error('❌ Error during advanced validation:', error);

      const errorResult: AdvancedValidationResult = {
        isValid: false,
        canProceed: false,
        checks: [{
          id: 'validation-error',
          name: 'Errore di Validazione',
          type: 'operational',
          severity: 'error',
          message: 'Errore interno durante la validazione',
          details: error instanceof Error ? error.message : 'Unknown error',
          suggestion: 'Contattare il supporto tecnico'
        }],
        summary: { errors: 1, warnings: 0, infos: 0 },
        estimatedSuccess: 0
      };

      setLastValidation(errorResult);
      return errorResult;

    } finally {
      setIsValidating(false);
    }
  }, [shifts, employees, stores, validateAvailability, validateContracts, validateCompetencies]);

  // 💾 FASE 3.2: ROLLBACK SYSTEM
  const createSnapshot = useCallback((
    description: string,
    operation: string,
    suggestion?: BalancingSuggestion
  ): string => {
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      description,
      shifts: [...shifts], // Deep copy of current shifts
      operation,
      metadata: {
        suggestion,
        userAction: operation
      }
    };

    setSnapshots(prev => {
      const newSnapshots = [snapshot, ...prev.slice(0, maxSnapshots - 1)];
      console.log('📸 Created snapshot:', snapshot.id, '-', description);
      return newSnapshots;
    });

    return snapshot.id;
  }, [shifts]);

  const rollbackToSnapshot = useCallback(async (snapshotId: string): Promise<RollbackOperation> => {
    console.log('🔄 Attempting rollback to snapshot:', snapshotId);

    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      return {
        snapshotId,
        restoredShifts: [],
        success: false,
        errors: ['Snapshot non trovato'],
        timestamp: new Date()
      };
    }

    try {
      if (!onUpdateShifts) {
        return {
          snapshotId,
          restoredShifts: [],
          success: false,
          errors: ['Funzione di aggiornamento non disponibile'],
          timestamp: new Date()
        };
      }

      // Calculate updates needed to restore to snapshot state
      const currentShiftIds = new Set(shifts.map(s => s.id));
      const snapshotShiftIds = new Set(snapshot.shifts.map(s => s.id));

      // Find shifts that need to be updated
      const updates: { id: string; data: Partial<Shift> }[] = [];

      snapshot.shifts.forEach(snapshotShift => {
        if (currentShiftIds.has(snapshotShift.id)) {
          const currentShift = shifts.find(s => s.id === snapshotShift.id);
          if (currentShift) {
            // Check if shift needs updating
            const needsUpdate =
              currentShift.employeeId !== snapshotShift.employeeId ||
              currentShift.storeId !== snapshotShift.storeId ||
              currentShift.startTime !== snapshotShift.startTime ||
              currentShift.endTime !== snapshotShift.endTime ||
              currentShift.actualHours !== snapshotShift.actualHours;

            if (needsUpdate) {
              updates.push({
                id: snapshotShift.id,
                data: {
                  employeeId: snapshotShift.employeeId,
                  storeId: snapshotShift.storeId,
                  startTime: snapshotShift.startTime,
                  endTime: snapshotShift.endTime,
                  actualHours: snapshotShift.actualHours,
                  breakDuration: snapshotShift.breakDuration
                }
              });
            }
          }
        }
      });

      // Apply updates
      if (updates.length > 0) {
        onUpdateShifts(updates);
      }

      console.log('✅ Rollback completed successfully, restored', updates.length, 'shifts');

      return {
        snapshotId,
        restoredShifts: snapshot.shifts,
        success: true,
        errors: [],
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Error during rollback:', error);

      return {
        snapshotId,
        restoredShifts: [],
        success: false,
        errors: [`Errore durante il rollback: ${error instanceof Error ? error.message : 'Unknown error'}`],
        timestamp: new Date()
      };
    }
  }, [snapshots, shifts, onUpdateShifts]);

  const clearSnapshots = useCallback(() => {
    setSnapshots([]);
    validationCache.current.clear();
    console.log('🧹 Cleared all snapshots and validation cache');
  }, []);

  const getSnapshotSummary = useCallback(() => {
    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: snapshots[snapshots.length - 1]?.timestamp,
      newestSnapshot: snapshots[0]?.timestamp,
      cacheSize: validationCache.current.size
    };
  }, [snapshots]);

  return {
    // FASE 3.1: Advanced Validation
    performAdvancedValidation,
    lastValidation,
    isValidating,

    // FASE 3.2: Rollback System
    createSnapshot,
    rollbackToSnapshot,
    snapshots,
    clearSnapshots,
    getSnapshotSummary,

    // Utilities
    validateAvailability,
    validateContracts,
    validateCompetencies
  };
};