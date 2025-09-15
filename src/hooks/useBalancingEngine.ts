import { useState, useCallback } from 'react';
import { Shift, Employee, Store } from '../types';
import { BalancingSuggestion } from './useWorkloadBalancer';

export interface BalancingResult {
  success: boolean;
  modifiedShifts: Shift[];
  errors: string[];
  summary: {
    shiftsModified: number;
    employeesAffected: string[];
    hoursRedistributed: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  conflicts: Array<{
    type: 'availability' | 'overlap' | 'competency' | 'contract';
    message: string;
    employeeId?: string;
    shiftId?: string;
  }>;
}

interface UseBalancingEngineProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
  onUpdateShifts: (updates: { id: string; data: Partial<Shift> }[]) => void;
  onAddShift?: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => string | null;
  onDeleteShift?: (id: string) => void;
}

export const useBalancingEngine = ({
  shifts,
  employees,
  stores,
  onUpdateShifts,
  onAddShift,
  onDeleteShift
}: UseBalancingEngineProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<BalancingResult | null>(null);

  // 🔍 UTILITY FUNCTIONS
  const findEmployeeById = useCallback((id: string) =>
    employees.find(emp => emp.id === id), [employees]);

  const findStoreById = useCallback((id: string) =>
    stores.find(store => store.id === id), [stores]);

  const findShiftById = useCallback((id: string) =>
    shifts.find(shift => shift.id === id), [shifts]);

  const calculateShiftHours = useCallback((startTime: string, endTime: string, breakDuration: number = 0): number => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return Math.max(0, (totalMinutes - breakDuration) / 60);
  }, []);

  // 🛡️ VALIDATION ENGINE
  const validateBalancingAction = useCallback((
    suggestion: BalancingSuggestion,
    affectedShifts: Shift[]
  ): ValidationResult => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const conflicts: ValidationResult['conflicts'] = [];

    // 1. Validate employees exist
    if (suggestion.sourceEmployeeId && !findEmployeeById(suggestion.sourceEmployeeId)) {
      errors.push(`Dipendente sorgente non trovato: ${suggestion.sourceEmployeeName}`);
    }

    if (suggestion.targetEmployeeId && !findEmployeeById(suggestion.targetEmployeeId)) {
      errors.push(`Dipendente destinazione non trovato: ${suggestion.targetEmployeeName}`);
    }

    // 2. Validate shifts exist
    affectedShifts.forEach(shift => {
      if (!findShiftById(shift.id)) {
        errors.push(`Turno non trovato: ${shift.id}`);
      }
    });

    // 3. Check for overlapping shifts (basic validation)
    const employeeShifts = new Map<string, Shift[]>();
    affectedShifts.forEach(shift => {
      const empId = shift.employeeId;
      if (!employeeShifts.has(empId)) {
        employeeShifts.set(empId, []);
      }
      employeeShifts.get(empId)!.push(shift);
    });

    employeeShifts.forEach((empShifts, employeeId) => {
      const employee = findEmployeeById(employeeId);
      if (!employee) return;

      const sameDay = empShifts.filter(shift =>
        empShifts.some(other =>
          other.id !== shift.id &&
          other.date.toDateString() === shift.date.toDateString()
        )
      );

      if (sameDay.length > 0) {
        conflicts.push({
          type: 'overlap',
          message: `${employee.firstName} ${employee.lastName} ha turni sovrapposti`,
          employeeId: employeeId
        });
      }
    });

    // 4. Validate working hours within limits
    employeeShifts.forEach((empShifts, employeeId) => {
      const employee = findEmployeeById(employeeId);
      if (!employee) return;

      const totalHours = empShifts.reduce((sum, shift) => {
        return sum + (shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration));
      }, 0);

      const maxHours = employee.contractHours || 40;
      if (totalHours > maxHours * 1.2) { // 20% tolerance
        warnings.push(`${employee.firstName} ${employee.lastName} supererà le ore contrattuali (${totalHours.toFixed(1)}h > ${maxHours}h)`);
      }
    });

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      conflicts
    };
  }, [findEmployeeById, findShiftById, calculateShiftHours]);

  // 🔄 REDISTRIBUTION ENGINE
  const applyRedistribution = useCallback(async (suggestion: BalancingSuggestion): Promise<BalancingResult> => {
    console.log('🔄 Applying redistribution:', suggestion);

    if (!suggestion.sourceEmployeeId || !suggestion.targetEmployeeId) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['IDs dipendenti mancanti per la redistribuzione'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    const sourceEmployee = findEmployeeById(suggestion.sourceEmployeeId);
    const targetEmployee = findEmployeeById(suggestion.targetEmployeeId);

    if (!sourceEmployee || !targetEmployee) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Dipendenti non trovati'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Find shifts to redistribute
    const sourceShifts = shifts.filter(shift =>
      shift.employeeId === suggestion.sourceEmployeeId &&
      !shift.isLocked
    );

    if (sourceShifts.length === 0) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno disponibile per la redistribuzione'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Sort by hours (smallest first) to redistribute gradually
    const sortedShifts = sourceShifts
      .map(shift => ({
        shift,
        hours: shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration)
      }))
      .sort((a, b) => a.hours - b.hours);

    const targetHours = suggestion.proposedChanges.impact.hoursChange;
    let accumulatedHours = 0;
    const shiftsToMove: Shift[] = [];

    // Select shifts to move
    for (const { shift, hours } of sortedShifts) {
      if (accumulatedHours + hours <= targetHours + 1) { // 1h tolerance
        shiftsToMove.push(shift);
        accumulatedHours += hours;

        if (accumulatedHours >= targetHours) break;
      }
    }

    if (shiftsToMove.length === 0) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno compatibile trovato per la redistribuzione'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Validate the redistribution
    const validation = validateBalancingAction(suggestion, shiftsToMove);
    if (!validation.isValid) {
      return {
        success: false,
        modifiedShifts: [],
        errors: validation.errors,
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Apply the changes
    const updates = shiftsToMove.map(shift => ({
      id: shift.id,
      data: {
        employeeId: suggestion.targetEmployeeId!,
        updatedAt: new Date()
      }
    }));

    onUpdateShifts(updates);

    return {
      success: true,
      modifiedShifts: shiftsToMove,
      errors: validation.warnings,
      summary: {
        shiftsModified: shiftsToMove.length,
        employeesAffected: [sourceEmployee.id, targetEmployee.id],
        hoursRedistributed: accumulatedHours
      }
    };
  }, [shifts, findEmployeeById, calculateShiftHours, validateBalancingAction, onUpdateShifts]);

  // 🔄 SWAP ENGINE
  const applySwapShifts = useCallback(async (suggestion: BalancingSuggestion): Promise<BalancingResult> => {
    console.log('🔄 Applying shift swap:', suggestion);

    if (!suggestion.sourceEmployeeId || !suggestion.targetEmployeeId || !suggestion.shiftId) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Dati insufficienti per lo scambio turni'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    const shift1 = findShiftById(suggestion.shiftId);
    if (!shift1) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Turno principale non trovato'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Find a compatible shift from target employee
    const targetShifts = shifts.filter(shift =>
      shift.employeeId === suggestion.targetEmployeeId &&
      !shift.isLocked &&
      shift.id !== suggestion.shiftId
    );

    if (targetShifts.length === 0) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno compatibile trovato per lo scambio'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Find best match (similar hours, different day/store)
    const shift1Hours = shift1.actualHours || calculateShiftHours(shift1.startTime, shift1.endTime, shift1.breakDuration);

    const bestMatch = targetShifts
      .map(shift => ({
        shift,
        hours: shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration),
        hoursDiff: Math.abs((shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration)) - shift1Hours)
      }))
      .filter(({ shift, hoursDiff }) =>
        hoursDiff <= 2 && // Max 2 hours difference
        (shift.date.toDateString() !== shift1.date.toDateString() || shift.storeId !== shift1.storeId)
      )
      .sort((a, b) => a.hoursDiff - b.hoursDiff)[0];

    if (!bestMatch) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno compatibile per lo scambio'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    const shift2 = bestMatch.shift;
    const affectedShifts = [shift1, shift2];

    // Validate the swap
    const validation = validateBalancingAction(suggestion, affectedShifts);
    if (!validation.isValid) {
      return {
        success: false,
        modifiedShifts: [],
        errors: validation.errors,
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Apply the swap
    const updates = [
      {
        id: shift1.id,
        data: {
          employeeId: suggestion.targetEmployeeId!,
          updatedAt: new Date()
        }
      },
      {
        id: shift2.id,
        data: {
          employeeId: suggestion.sourceEmployeeId!,
          updatedAt: new Date()
        }
      }
    ];

    onUpdateShifts(updates);

    return {
      success: true,
      modifiedShifts: affectedShifts,
      errors: validation.warnings,
      summary: {
        shiftsModified: 2,
        employeesAffected: [suggestion.sourceEmployeeId!, suggestion.targetEmployeeId!],
        hoursRedistributed: Math.abs(shift1Hours - bestMatch.hours)
      }
    };
  }, [shifts, findShiftById, calculateShiftHours, validateBalancingAction, onUpdateShifts]);

  // 🎯 MAIN APPLICATION FUNCTION
  const applySuggestion = useCallback(async (suggestion: BalancingSuggestion): Promise<BalancingResult> => {
    setIsProcessing(true);

    try {
      let result: BalancingResult;

      switch (suggestion.type) {
        case 'redistribute':
          result = await applyRedistribution(suggestion);
          break;

        case 'swap_shifts':
          result = await applySwapShifts(suggestion);
          break;

        case 'adjust_hours':
          // TODO: Implement in Phase 2
          result = {
            success: false,
            modifiedShifts: [],
            errors: ['Aggiustamento orari non ancora implementato'],
            summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
          };
          break;

        default:
          result = {
            success: false,
            modifiedShifts: [],
            errors: [`Tipo di suggerimento non supportato: ${suggestion.type}`],
            summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
          };
      }

      setLastResult(result);
      return result;

    } catch (error) {
      console.error('❌ Error applying balancing suggestion:', error);
      const errorResult: BalancingResult = {
        success: false,
        modifiedShifts: [],
        errors: [`Errore interno: ${error instanceof Error ? error.message : 'Unknown error'}`],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };

      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsProcessing(false);
    }
  }, [applyRedistribution, applySwapShifts]);

  // 📦 BATCH APPLICATION
  const applyMultipleSuggestions = useCallback(async (suggestions: BalancingSuggestion[]): Promise<{
    successful: BalancingResult[];
    failed: Array<{ suggestion: BalancingSuggestion; error: string }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalShiftsModified: number;
      totalHoursRedistributed: number;
    };
  }> => {
    setIsProcessing(true);

    const successful: BalancingResult[] = [];
    const failed: Array<{ suggestion: BalancingSuggestion; error: string }> = [];

    for (const suggestion of suggestions) {
      try {
        const result = await applySuggestion(suggestion);
        if (result.success) {
          successful.push(result);
        } else {
          failed.push({
            suggestion,
            error: result.errors.join(', ') || 'Unknown error'
          });
        }
      } catch (error) {
        failed.push({
          suggestion,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    setIsProcessing(false);

    return {
      successful,
      failed,
      summary: {
        total: suggestions.length,
        successful: successful.length,
        failed: failed.length,
        totalShiftsModified: successful.reduce((sum, r) => sum + r.summary.shiftsModified, 0),
        totalHoursRedistributed: successful.reduce((sum, r) => sum + r.summary.hoursRedistributed, 0)
      }
    };
  }, [applySuggestion]);

  return {
    // Core functions
    applySuggestion,
    applyMultipleSuggestions,
    validateBalancingAction,

    // State
    isProcessing,
    lastResult,

    // Utilities
    findEmployeeById,
    findStoreById,
    findShiftById,
    calculateShiftHours
  };
};