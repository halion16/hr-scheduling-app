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

    // 🆕 5. ADVANCED VALIDATIONS - Validate shift spacing and rest periods
    employeeShifts.forEach((empShifts, employeeId) => {
      const employee = findEmployeeById(employeeId);
      if (!employee) return;

      // Sort shifts by date and time
      const sortedShifts = empShifts.sort((a, b) => {
        const dateA = new Date(`${a.date.toDateString()} ${a.startTime}`);
        const dateB = new Date(`${b.date.toDateString()} ${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });

      // Check for insufficient rest between shifts (minimum 12 hours)
      for (let i = 0; i < sortedShifts.length - 1; i++) {
        const current = sortedShifts[i];
        const next = sortedShifts[i + 1];

        const currentEnd = new Date(`${current.date.toDateString()} ${current.endTime}`);
        const nextStart = new Date(`${next.date.toDateString()} ${next.startTime}`);

        const restHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);

        if (restHours < 12) {
          conflicts.push({
            type: 'availability',
            message: `${employee.firstName} ${employee.lastName} ha solo ${restHours.toFixed(1)}h di riposo tra turni (minimo 12h)`,
            employeeId: employeeId,
            shiftId: next.id
          });
        }
      }

      // Check for excessive consecutive working days
      const workingDays = new Set(empShifts.map(shift => shift.date.toDateString()));
      if (workingDays.size > 6) {
        warnings.push(`${employee.firstName} ${employee.lastName} lavora ${workingDays.size} giorni consecutivi (massimo raccomandato: 6)`);
      }

      // Check for shifts exceeding 10 hours (legal limit)
      empShifts.forEach(shift => {
        const shiftHours = shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration);
        if (shiftHours > 10) {
          conflicts.push({
            type: 'contract',
            message: `Turno di ${employee.firstName} ${employee.lastName} supera il limite legale (${shiftHours.toFixed(1)}h > 10h)`,
            employeeId: employeeId,
            shiftId: shift.id
          });
        }
      });
    });

    // 🆕 6. Store capacity validation
    if (suggestion.storeId) {
      const store = findStoreById(suggestion.storeId);
      if (store) {
        // Count total employees that would be in this store after the change
        const storeEmployeeCount = affectedShifts.filter(shift =>
          shift.storeId === suggestion.storeId
        ).length;

        // Add existing employees in the store not affected by this change
        const existingStoreEmployees = shifts.filter(shift =>
          shift.storeId === suggestion.storeId &&
          !affectedShifts.some(affected => affected.id === shift.id)
        ).length;

        const totalStoreEmployees = storeEmployeeCount + existingStoreEmployees;

        // Check if store has capacity (assuming max 10 employees per store)
        if (totalStoreEmployees > 10) {
          warnings.push(`Il negozio ${store.name} potrebbe essere sovra-popolato (${totalStoreEmployees} dipendenti)`);
        }
      }
    }

    // 🆕 7. Skill and competency validation
    affectedShifts.forEach(shift => {
      const employee = findEmployeeById(shift.employeeId);
      const store = findStoreById(shift.storeId);

      if (employee && store) {
        // Check if employee has required skills for the store/shift
        // This would be enhanced with actual skill data from employee/store models
        if (employee.role === 'junior' && shift.actualHours && shift.actualHours > 8) {
          warnings.push(`${employee.firstName} ${employee.lastName} (junior) assegnato a turno lungo (${shift.actualHours}h) - potrebbe necessitare supervisione`);
        }

        // Check for cross-store competency
        if (suggestion.type === 'redistribute' && suggestion.storeId !== employee.storeId) {
          warnings.push(`${employee.firstName} ${employee.lastName} viene trasferito in un negozio diverso - verificare competenze specifiche`);
        }
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

  // 🆕 ADD SHIFT ENGINE
  const applyAddShift = useCallback(async (suggestion: BalancingSuggestion): Promise<BalancingResult> => {
    console.log('🆕 Applying add shift:', suggestion);

    if (!suggestion.sourceEmployeeId || !onAddShift) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Informazioni insufficienti per aggiungere turno'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    const employee = findEmployeeById(suggestion.sourceEmployeeId);
    if (!employee) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Dipendente non trovato'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Crea un nuovo turno di default (8 ore)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const newShiftData = {
      employeeId: suggestion.sourceEmployeeId,
      storeId: suggestion.storeId || employee.storeId,
      date: tomorrow,
      startTime: '09:00',
      endTime: '17:00',
      breakDuration: 60,
      actualHours: 8,
      isLocked: false
    };

    try {
      const newShiftId = onAddShift(newShiftData);
      if (!newShiftId) {
        return {
          success: false,
          modifiedShifts: [],
          errors: ['Errore nella creazione del turno'],
          summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
        };
      }

      return {
        success: true,
        modifiedShifts: [],
        errors: [],
        summary: {
          shiftsModified: 1,
          employeesAffected: [suggestion.sourceEmployeeId],
          hoursRedistributed: 8
        }
      };
    } catch (error) {
      return {
        success: false,
        modifiedShifts: [],
        errors: [`Errore durante la creazione: ${error instanceof Error ? error.message : 'Unknown error'}`],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }
  }, [findEmployeeById, onAddShift]);

  // 🗑️ REMOVE SHIFT ENGINE
  const applyRemoveShift = useCallback(async (suggestion: BalancingSuggestion): Promise<BalancingResult> => {
    console.log('🗑️ Applying remove shift:', suggestion);

    if (!suggestion.sourceEmployeeId || !onDeleteShift) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Informazioni insufficienti per rimuovere turno'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Trova i turni del dipendente che possono essere rimossi
    const employeeShifts = shifts.filter(shift =>
      shift.employeeId === suggestion.sourceEmployeeId &&
      !shift.isLocked
    );

    if (employeeShifts.length === 0) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno rimuovibile trovato'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Rimuovi il turno con meno ore (meno impattante)
    const shiftToRemove = employeeShifts
      .map(shift => ({
        shift,
        hours: shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration)
      }))
      .sort((a, b) => a.hours - b.hours)[0];

    try {
      onDeleteShift(shiftToRemove.shift.id);

      return {
        success: true,
        modifiedShifts: [shiftToRemove.shift],
        errors: [],
        summary: {
          shiftsModified: 1,
          employeesAffected: [suggestion.sourceEmployeeId],
          hoursRedistributed: shiftToRemove.hours
        }
      };
    } catch (error) {
      return {
        success: false,
        modifiedShifts: [],
        errors: [`Errore durante la rimozione: ${error instanceof Error ? error.message : 'Unknown error'}`],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }
  }, [shifts, findEmployeeById, calculateShiftHours, onDeleteShift]);

  // ⏰ ADJUST HOURS ENGINE
  const applyAdjustHours = useCallback(async (suggestion: BalancingSuggestion): Promise<BalancingResult> => {
    console.log('⏰ Applying adjust hours:', suggestion);

    if (!suggestion.sourceEmployeeId) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['ID dipendente mancante'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Trova turni modificabili del dipendente
    const employeeShifts = shifts.filter(shift =>
      shift.employeeId === suggestion.sourceEmployeeId &&
      !shift.isLocked
    );

    if (employeeShifts.length === 0) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno modificabile trovato'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    const hoursChange = suggestion.proposedChanges.impact.hoursChange;
    const isReduction = suggestion.proposedChanges.action.includes('Riduci');

    // Applica aggiustamento al turno più lungo (più flessibile)
    const targetShift = employeeShifts
      .map(shift => ({
        shift,
        hours: shift.actualHours || calculateShiftHours(shift.startTime, shift.endTime, shift.breakDuration)
      }))
      .sort((a, b) => b.hours - a.hours)[0]; // Turno più lungo

    if (!targetShift) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Nessun turno target trovato'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Calcola nuovo orario di fine
    const currentHours = targetShift.hours;
    const newHours = isReduction ?
      Math.max(4, currentHours - hoursChange) : // Minimo 4 ore
      Math.min(12, currentHours + hoursChange); // Massimo 12 ore

    const actualAdjustment = Math.abs(newHours - currentHours);

    if (actualAdjustment < 0.5) {
      return {
        success: false,
        modifiedShifts: [],
        errors: ['Aggiustamento troppo piccolo per essere applicato'],
        summary: { shiftsModified: 0, employeesAffected: [], hoursRedistributed: 0 }
      };
    }

    // Calcola nuovo orario di fine basato sulla durata desiderata
    const startTime = new Date(`2000-01-01T${targetShift.shift.startTime}`);
    const breakMinutes = targetShift.shift.breakDuration || 0;
    const totalMinutes = (newHours * 60) + breakMinutes;
    const endTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);

    const newEndTime = endTime.toTimeString().substring(0, 5);

    // Applica la modifica
    const updates = [{
      id: targetShift.shift.id,
      data: {
        endTime: newEndTime,
        actualHours: newHours,
        updatedAt: new Date()
      }
    }];

    onUpdateShifts(updates);

    return {
      success: true,
      modifiedShifts: [targetShift.shift],
      errors: [],
      summary: {
        shiftsModified: 1,
        employeesAffected: [suggestion.sourceEmployeeId],
        hoursRedistributed: actualAdjustment
      }
    };
  }, [shifts, findEmployeeById, calculateShiftHours, onUpdateShifts]);

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

        case 'add_shift':
          result = await applyAddShift(suggestion);
          break;

        case 'remove_shift':
          result = await applyRemoveShift(suggestion);
          break;

        case 'adjust_hours':
          result = await applyAdjustHours(suggestion);
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