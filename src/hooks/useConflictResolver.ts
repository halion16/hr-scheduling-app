import { useState, useCallback, useMemo } from 'react';
import { Employee, Store, Shift } from '../types';

export interface SchedulingConflict {
  id: string;
  type: 'overlap' | 'rest_violation' | 'skill_mismatch' | 'overtime' | 'understaffing' | 'availability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedShifts: string[];
  affectedEmployees: string[];
  affectedStores: string[];
  detectedAt: Date;
  autoResolvable: boolean;
  resolutionStrategies: ConflictResolutionStrategy[];
}

export interface ConflictResolutionStrategy {
  id: string;
  name: string;
  description: string;
  confidence: number;
  impact: {
    employeeSatisfaction: number;
    operationalEfficiency: number;
    complianceRisk: number;
  };
  steps: ResolutionStep[];
  estimatedTime: number; // minutes
  cost: number; // estimated cost impact
}

export interface ResolutionStep {
  id: string;
  action: 'move_shift' | 'swap_shifts' | 'modify_hours' | 'add_break' | 'notify_manager' | 'request_approval';
  description: string;
  target: {
    shiftId?: string;
    employeeId?: string;
    storeId?: string;
    parameters?: Record<string, any>;
  };
  required: boolean;
}

export interface ConflictResolutionResult {
  success: boolean;
  conflictId: string;
  strategyUsed: string;
  modifiedShifts: Shift[];
  errors: string[];
  warnings: string[];
  summary: {
    conflictsResolved: number;
    shiftsModified: number;
    employeesAffected: string[];
    timeSaved: number;
  };
}

interface UseConflictResolverProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  onUpdateShifts: (updates: { id: string; data: Partial<Shift> }[]) => void;
  onNotifyManager?: (message: string, severity: 'info' | 'warning' | 'error') => void;
}

export const useConflictResolver = ({
  employees,
  shifts,
  stores,
  onUpdateShifts,
  onNotifyManager
}: UseConflictResolverProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolutionHistory, setResolutionHistory] = useState<ConflictResolutionResult[]>([]);

  // 🔍 CONFLICT DETECTION ENGINE
  const detectConflicts = useCallback((): SchedulingConflict[] => {
    console.log('🔍 Detecting scheduling conflicts...');
    const conflicts: SchedulingConflict[] = [];

    // 1. OVERLAP CONFLICTS
    employees.forEach(employee => {
      const employeeShifts = shifts
        .filter(s => s.employeeId === employee.id)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      for (let i = 0; i < employeeShifts.length - 1; i++) {
        const current = employeeShifts[i];
        const next = employeeShifts[i + 1];

        // Check for same day overlaps
        if (current.date.toDateString() === next.date.toDateString()) {
          const currentEnd = new Date(`2000-01-01T${current.endTime}`);
          const nextStart = new Date(`2000-01-01T${next.startTime}`);

          if (currentEnd > nextStart) {
            conflicts.push({
              id: `overlap-${current.id}-${next.id}`,
              type: 'overlap',
              severity: 'critical',
              title: 'Sovrapposizione Turni',
              description: `${employee.firstName} ${employee.lastName} ha turni sovrapposti il ${current.date.toLocaleDateString()}`,
              affectedShifts: [current.id, next.id],
              affectedEmployees: [employee.id],
              affectedStores: [current.storeId],
              detectedAt: new Date(),
              autoResolvable: true,
              resolutionStrategies: [
                {
                  id: 'adjust-times',
                  name: 'Aggiusta Orari',
                  description: 'Modifica gli orari per eliminare la sovrapposizione',
                  confidence: 90,
                  impact: {
                    employeeSatisfaction: -5,
                    operationalEfficiency: 10,
                    complianceRisk: -20
                  },
                  steps: [
                    {
                      id: 'modify-end-time',
                      action: 'modify_hours',
                      description: `Modifica orario fine primo turno a ${nextStart.toTimeString().slice(0, 5)}`,
                      target: {
                        shiftId: current.id,
                        parameters: { endTime: nextStart.toTimeString().slice(0, 5) }
                      },
                      required: true
                    }
                  ],
                  estimatedTime: 5,
                  cost: 0
                },
                {
                  id: 'reassign-shift',
                  name: 'Riassegna Turno',
                  description: 'Assegna uno dei turni a un altro dipendente disponibile',
                  confidence: 75,
                  impact: {
                    employeeSatisfaction: 5,
                    operationalEfficiency: 5,
                    complianceRisk: -15
                  },
                  steps: [
                    {
                      id: 'find-alternative',
                      action: 'move_shift',
                      description: 'Trova dipendente alternativo per secondo turno',
                      target: {
                        shiftId: next.id,
                        storeId: current.storeId
                      },
                      required: true
                    }
                  ],
                  estimatedTime: 15,
                  cost: 0
                }
              ]
            });
          }
        }
      }
    });

    // 2. REST PERIOD VIOLATIONS
    employees.forEach(employee => {
      const employeeShifts = shifts
        .filter(s => s.employeeId === employee.id)
        .sort((a, b) => {
          const dateA = new Date(`${a.date.toDateString()} ${a.startTime}`);
          const dateB = new Date(`${b.date.toDateString()} ${b.startTime}`);
          return dateA.getTime() - dateB.getTime();
        });

      for (let i = 0; i < employeeShifts.length - 1; i++) {
        const current = employeeShifts[i];
        const next = employeeShifts[i + 1];

        const currentEnd = new Date(`${current.date.toDateString()} ${current.endTime}`);
        const nextStart = new Date(`${next.date.toDateString()} ${next.startTime}`);

        const restHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);

        if (restHours < 12 && restHours > 0) {
          conflicts.push({
            id: `rest-${current.id}-${next.id}`,
            type: 'rest_violation',
            severity: restHours < 8 ? 'critical' : 'high',
            title: 'Violazione Periodo di Riposo',
            description: `${employee.firstName} ${employee.lastName} ha solo ${restHours.toFixed(1)}h di riposo (minimo 12h)`,
            affectedShifts: [current.id, next.id],
            affectedEmployees: [employee.id],
            affectedStores: [current.storeId, next.storeId],
            detectedAt: new Date(),
            autoResolvable: true,
            resolutionStrategies: [
              {
                id: 'extend-rest',
                name: 'Estendi Riposo',
                description: 'Modifica gli orari per garantire 12h di riposo',
                confidence: 85,
                impact: {
                  employeeSatisfaction: 15,
                  operationalEfficiency: -5,
                  complianceRisk: -25
                },
                steps: [
                  {
                    id: 'delay-next-shift',
                    action: 'modify_hours',
                    description: 'Posticipa inizio secondo turno',
                    target: {
                      shiftId: next.id,
                      parameters: {
                        startTime: new Date(currentEnd.getTime() + 12 * 60 * 60 * 1000)
                          .toTimeString().slice(0, 5)
                      }
                    },
                    required: true
                  }
                ],
                estimatedTime: 10,
                cost: 0
              }
            ]
          });
        }
      }
    });

    // 3. OVERTIME CONFLICTS
    employees.forEach(employee => {
      const employeeShifts = shifts.filter(s => s.employeeId === employee.id);
      const totalHours = employeeShifts.reduce((sum, shift) => {
        return sum + (shift.actualHours || 8);
      }, 0);

      const contractHours = employee.contractHours || 40;
      if (totalHours > contractHours * 1.25) { // 25% overtime threshold
        conflicts.push({
          id: `overtime-${employee.id}`,
          type: 'overtime',
          severity: totalHours > contractHours * 1.5 ? 'critical' : 'high',
          title: 'Superamento Ore Contrattuali',
          description: `${employee.firstName} ${employee.lastName} supera le ore contrattuali (${totalHours}h vs ${contractHours}h)`,
          affectedShifts: employeeShifts.map(s => s.id),
          affectedEmployees: [employee.id],
          affectedStores: [...new Set(employeeShifts.map(s => s.storeId))],
          detectedAt: new Date(),
          autoResolvable: true,
          resolutionStrategies: [
            {
              id: 'redistribute-hours',
              name: 'Redistribuisci Ore',
              description: 'Trasferisci alcuni turni ad altri dipendenti',
              confidence: 80,
              impact: {
                employeeSatisfaction: 0,
                operationalEfficiency: 5,
                complianceRisk: -20
              },
              steps: [
                {
                  id: 'find-recipients',
                  action: 'move_shift',
                  description: 'Trova dipendenti con ore disponibili',
                  target: {
                    employeeId: employee.id,
                    storeId: employee.storeId
                  },
                  required: true
                }
              ],
              estimatedTime: 20,
              cost: 0
            }
          ]
        });
      }
    });

    // 4. UNDERSTAFFING CONFLICTS
    stores.forEach(store => {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        weekDays.push(date);
      }

      weekDays.forEach(date => {
        const dayShifts = shifts.filter(s =>
          s.storeId === store.id &&
          s.date.toDateString() === date.toDateString()
        );

        if (dayShifts.length < 2) { // Minimum staffing requirement
          conflicts.push({
            id: `understaffing-${store.id}-${date.toISOString().split('T')[0]}`,
            type: 'understaffing',
            severity: dayShifts.length === 0 ? 'critical' : 'high',
            title: 'Carenza di Personale',
            description: `${store.name} ha solo ${dayShifts.length} dipendenti il ${date.toLocaleDateString()}`,
            affectedShifts: dayShifts.map(s => s.id),
            affectedEmployees: dayShifts.map(s => s.employeeId),
            affectedStores: [store.id],
            detectedAt: new Date(),
            autoResolvable: true,
            resolutionStrategies: [
              {
                id: 'add-staff',
                name: 'Aggiungi Personale',
                description: 'Assegna dipendenti disponibili al negozio',
                confidence: 70,
                impact: {
                  employeeSatisfaction: -5,
                  operationalEfficiency: 20,
                  complianceRisk: -10
                },
                steps: [
                  {
                    id: 'request-volunteers',
                    action: 'notify_manager',
                    description: 'Notifica manager per turni volontari',
                    target: {
                      storeId: store.id,
                      parameters: { date: date.toISOString(), requiredStaff: 2 - dayShifts.length }
                    },
                    required: false
                  }
                ],
                estimatedTime: 30,
                cost: 100
              }
            ]
          });
        }
      });
    });

    console.log(`🔍 Detected ${conflicts.length} conflicts`);
    return conflicts;
  }, [employees, shifts, stores]);

  // 🛠️ AUTOMATIC CONFLICT RESOLUTION ENGINE
  const resolveConflict = useCallback(async (
    conflict: SchedulingConflict,
    strategyId?: string
  ): Promise<ConflictResolutionResult> => {
    console.log(`🛠️ Resolving conflict: ${conflict.title}`);
    setIsProcessing(true);

    try {
      const strategy = strategyId
        ? conflict.resolutionStrategies.find(s => s.id === strategyId)
        : conflict.resolutionStrategies[0]; // Use best strategy

      if (!strategy) {
        throw new Error('No resolution strategy available');
      }

      const modifiedShifts: Shift[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      // Execute resolution steps
      for (const step of strategy.steps) {
        try {
          switch (step.action) {
            case 'modify_hours':
              if (step.target.shiftId && step.target.parameters) {
                const shiftToModify = shifts.find(s => s.id === step.target.shiftId);
                if (shiftToModify) {
                  const updates = [{
                    id: step.target.shiftId,
                    data: {
                      ...step.target.parameters,
                      updatedAt: new Date()
                    }
                  }];
                  onUpdateShifts(updates);
                  modifiedShifts.push({ ...shiftToModify, ...step.target.parameters });
                }
              }
              break;

            case 'move_shift':
              if (step.target.shiftId) {
                // Find alternative employee
                const availableEmployees = employees.filter(emp =>
                  emp.storeId === step.target.storeId &&
                  !conflict.affectedEmployees.includes(emp.id)
                );

                if (availableEmployees.length > 0) {
                  const alternativeEmployee = availableEmployees[0];
                  const updates = [{
                    id: step.target.shiftId,
                    data: {
                      employeeId: alternativeEmployee.id,
                      updatedAt: new Date()
                    }
                  }];
                  onUpdateShifts(updates);

                  const originalShift = shifts.find(s => s.id === step.target.shiftId);
                  if (originalShift) {
                    modifiedShifts.push({
                      ...originalShift,
                      employeeId: alternativeEmployee.id
                    });
                  }
                } else {
                  warnings.push('Nessun dipendente alternativo disponibile');
                }
              }
              break;

            case 'notify_manager':
              if (onNotifyManager) {
                const message = `Conflitto rilevato: ${conflict.title}. ${step.description}`;
                onNotifyManager(message, conflict.severity === 'critical' ? 'error' : 'warning');
              }
              break;

            default:
              warnings.push(`Azione non implementata: ${step.action}`);
          }
        } catch (stepError) {
          errors.push(`Errore nel passo "${step.description}": ${stepError instanceof Error ? stepError.message : 'Unknown error'}`);
        }
      }

      const result: ConflictResolutionResult = {
        success: errors.length === 0,
        conflictId: conflict.id,
        strategyUsed: strategy.id,
        modifiedShifts,
        errors,
        warnings,
        summary: {
          conflictsResolved: errors.length === 0 ? 1 : 0,
          shiftsModified: modifiedShifts.length,
          employeesAffected: [...new Set(modifiedShifts.map(s => s.employeeId))],
          timeSaved: strategy.estimatedTime
        }
      };

      setResolutionHistory(prev => [...prev, result]);
      console.log(`🛠️ Conflict resolution ${result.success ? 'successful' : 'failed'}`);
      return result;

    } catch (error) {
      const errorResult: ConflictResolutionResult = {
        success: false,
        conflictId: conflict.id,
        strategyUsed: 'unknown',
        modifiedShifts: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        summary: {
          conflictsResolved: 0,
          shiftsModified: 0,
          employeesAffected: [],
          timeSaved: 0
        }
      };

      setResolutionHistory(prev => [...prev, errorResult]);
      return errorResult;
    } finally {
      setIsProcessing(false);
    }
  }, [shifts, employees, onUpdateShifts, onNotifyManager]);

  // 🤖 BATCH CONFLICT RESOLUTION
  const resolveAllConflicts = useCallback(async (conflicts: SchedulingConflict[]): Promise<{
    successful: ConflictResolutionResult[];
    failed: ConflictResolutionResult[];
    summary: {
      totalConflicts: number;
      resolved: number;
      failed: number;
      totalTimeSaved: number;
      shiftsModified: number;
    };
  }> => {
    console.log(`🤖 Batch resolving ${conflicts.length} conflicts...`);
    setIsProcessing(true);

    const successful: ConflictResolutionResult[] = [];
    const failed: ConflictResolutionResult[] = [];

    // Sort by severity and auto-resolvability
    const sortedConflicts = conflicts
      .filter(c => c.autoResolvable)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

    for (const conflict of sortedConflicts) {
      try {
        const result = await resolveConflict(conflict);
        if (result.success) {
          successful.push(result);
        } else {
          failed.push(result);
        }
      } catch (error) {
        failed.push({
          success: false,
          conflictId: conflict.id,
          strategyUsed: 'unknown',
          modifiedShifts: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          summary: {
            conflictsResolved: 0,
            shiftsModified: 0,
            employeesAffected: [],
            timeSaved: 0
          }
        });
      }
    }

    setIsProcessing(false);

    const summary = {
      totalConflicts: conflicts.length,
      resolved: successful.length,
      failed: failed.length,
      totalTimeSaved: successful.reduce((sum, r) => sum + r.summary.timeSaved, 0),
      shiftsModified: successful.reduce((sum, r) => sum + r.summary.shiftsModified, 0)
    };

    console.log(`🤖 Batch resolution completed: ${summary.resolved}/${summary.totalConflicts} resolved`);

    return { successful, failed, summary };
  }, [resolveConflict]);

  // Current conflicts
  const currentConflicts = useMemo(() => detectConflicts(), [detectConflicts]);

  // Auto-resolvable conflicts
  const autoResolvableConflicts = useMemo(() =>
    currentConflicts.filter(c => c.autoResolvable),
    [currentConflicts]
  );

  return {
    // Conflict Detection
    detectConflicts,
    currentConflicts,
    autoResolvableConflicts,

    // Resolution Functions
    resolveConflict,
    resolveAllConflicts,

    // State
    isProcessing,
    resolutionHistory,

    // Statistics
    conflictStats: {
      total: currentConflicts.length,
      critical: currentConflicts.filter(c => c.severity === 'critical').length,
      high: currentConflicts.filter(c => c.severity === 'high').length,
      autoResolvable: autoResolvableConflicts.length
    }
  };
};