import { useMemo } from 'react';
import { Employee, Store, Shift } from '../types';
import { ValidationAdminSettings } from '../types/validation';

export interface BalancingSuggestion {
  id: string;
  type: 'redistribute' | 'add_shift' | 'remove_shift' | 'swap_shifts' | 'adjust_hours';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sourceEmployeeId?: string;
  targetEmployeeId?: string;
  sourceEmployeeName?: string;
  targetEmployeeName?: string;
  storeId?: string;
  storeName?: string;
  shiftId?: string;
  proposedChanges: {
    action: string;
    from?: any;
    to?: any;
    impact: {
      hoursChange: number;
      equityImprovement: number;
      workloadBalance: number;
    };
  };
  autoApplicable: boolean;
  estimatedDuration: number; // minuti per applicare
}

export interface BalancingMetrics {
  currentEquityScore: number;
  potentialEquityScore: number;
  workloadDistribution: {
    employeeId: string;
    employeeName: string;
    currentHours: number;
    idealHours: number;
    deviation: number;
    deviationPercent: number;
  }[];
  storeBalance: {
    storeId: string;
    storeName: string;
    currentHours: number;
    idealHours: number;
    deviation: number;
    staffingLevel: 'understaffed' | 'optimal' | 'overstaffed';
  }[];
  overallBalance: 'poor' | 'fair' | 'good' | 'excellent';
}

interface UseWorkloadBalancerProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  weekStart: Date;
  adminSettings?: ValidationAdminSettings;
  enabled?: boolean;
  storeFilter?: string; // 🆕 Filtro per negozio specifico
}

export const useWorkloadBalancer = ({
  employees,
  shifts,
  stores,
  weekStart,
  adminSettings,
  enabled = true,
  storeFilter
}: UseWorkloadBalancerProps) => {
  
  const balancingData = useMemo(() => {
    if (!enabled || !employees.length || !shifts.length) {
      return {
        suggestions: [],
        metrics: null,
        canBalance: false
      };
    }

    // Calcola range del periodo corrente (settimana)
    const periodStart = new Date(weekStart);
    const periodEnd = new Date(weekStart);
    periodEnd.setDate(periodEnd.getDate() + 6);

    // Filtra shifts per periodo corrente e negozio (se specificato)
    const currentWeekShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      const dateMatch = shiftDate >= periodStart && shiftDate <= periodEnd && !shift.isLocked;
      const storeMatch = !storeFilter || shift.storeId === storeFilter;
      return dateMatch && storeMatch;
    });

    // Filtra dipendenti attivi e per negozio (se specificato)
    const activeEmployees = employees.filter(emp => {
      const activeMatch = emp.isActive;
      const storeMatch = !storeFilter || emp.storeId === storeFilter;
      return activeMatch && storeMatch;
    });
    
    // Soglie configurabili
    const targetHoursPerWeek = adminSettings?.dynamicStaffRequirements?.targetHoursPerWeek || 32;
    const maxDeviationPercent = 20; // 20% di deviazione massima dal target
    const minShiftHours = 4;
    const maxShiftHours = 10;

    // Calcola statistiche attuali per dipendente (🔧 ALLINEATO CON ALERT SYSTEM)
    const employeeStats = activeEmployees.map(employee => {
      const employeeShifts = currentWeekShifts.filter(shift => shift.employeeId === employee.id);
      
      // 🔧 USA actualHours se disponibile, altrimenti calcola (STESSO CODICE ALERT SYSTEM)
      const totalHours = employeeShifts.reduce((sum, shift) => {
        if (shift.actualHours && shift.actualHours > 0) {
          return sum + shift.actualHours;
        } else {
          // Fallback al calcolo manuale
          const start = new Date(`2000-01-01T${shift.startTime}`);
          const end = new Date(`2000-01-01T${shift.endTime}`);
          const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const hoursMinusBreak = calculatedHours - (shift.breakDuration || 0) / 60;
          return sum + Math.max(0, hoursMinusBreak);
        }
      }, 0);

      // 🔧 USA LIMITI INDIVIDUALI del dipendente (STESSO CODICE ALERT SYSTEM)
      const employeeMaxHours = employee.contractHours || targetHoursPerWeek; // contractHours = Ore Massime Contratto
      const employeeMinHours = employee.fixedHours || Math.max(employeeMaxHours * 0.5, 8); // fixedHours = Ore Minime Garantite

      const storeDistribution = employeeShifts.reduce((acc, shift) => {
        const shiftHours = shift.actualHours && shift.actualHours > 0 
          ? shift.actualHours 
          : Math.max(0, calculateShiftHours(shift.startTime, shift.endTime) - (shift.breakDuration || 0) / 60);
        acc[shift.storeId] = (acc[shift.storeId] || 0) + shiftHours;
        return acc;
      }, {} as Record<string, number>);

      return {
        employee,
        totalHours: Number(totalHours.toFixed(1)),
        idealHours: employeeMaxHours, // 🔧 Usa limite individuale massimo
        minHours: employeeMinHours,   // 🆕 Aggiunto limite minimo individuale
        shiftsCount: employeeShifts.length,
        shifts: employeeShifts,
        storeDistribution,
        deviation: Number((totalHours - employeeMaxHours).toFixed(1)), // 🔧 Usa limite individuale
        deviationPercent: Number(((totalHours - employeeMaxHours) / employeeMaxHours * 100).toFixed(1)), // 🔧 Usa limite individuale
        // 🆕 Aggiungi informazioni per sottoutilizzo
        underutilized: totalHours < employeeMinHours,
        underutilizationHours: totalHours < employeeMinHours ? Number((employeeMinHours - totalHours).toFixed(1)) : 0
      };
    });

    // Calcola statistiche per negozio (filtra se specificato)
    const filteredStores = storeFilter ? stores.filter(s => s.id === storeFilter) : stores;
    const storeStats = filteredStores.map(store => {
      const storeShifts = currentWeekShifts.filter(shift => shift.storeId === store.id);
      // 🔧 USA actualHours se disponibile, altrimenti calcola (COERENTE CON ALERT SYSTEM)
      const totalHours = storeShifts.reduce((sum, shift) => {
        if (shift.actualHours && shift.actualHours > 0) {
          return sum + shift.actualHours;
        } else {
          // Fallback al calcolo manuale con break
          const shiftHours = calculateShiftHours(shift.startTime, shift.endTime);
          const hoursMinusBreak = shiftHours - (shift.breakDuration || 0) / 60;
          return sum + Math.max(0, hoursMinusBreak);
        }
      }, 0);
      
      return {
        store,
        totalHours: Number(totalHours.toFixed(1)),
        shiftsCount: storeShifts.length,
        shifts: storeShifts
      };
    });

    // Calcola metriche di equità
    const metrics = calculateBalancingMetrics(employeeStats, storeStats, targetHoursPerWeek);
    
    // Genera suggerimenti di bilanciamento
    const suggestions = generateBalancingSuggestions(
      employeeStats, 
      storeStats, 
      metrics, 
      maxDeviationPercent,
      minShiftHours,
      maxShiftHours,
      filteredStores // 🔧 Passa gli stores filtrati
    );

    return {
      suggestions: suggestions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      metrics,
      canBalance: suggestions.length > 0,
      employeeStats,
      storeStats
    };
  }, [employees, shifts, stores, weekStart, adminSettings, enabled, storeFilter]); // 🔧 Aggiunto storeFilter

  // Funzioni di utilità
  const getSuggestionsByType = (type: BalancingSuggestion['type']) =>
    balancingData.suggestions.filter(s => s.type === type);

  const getHighPrioritySuggestions = () =>
    balancingData.suggestions.filter(s => s.priority === 'high');

  const getAutoApplicableSuggestions = () =>
    balancingData.suggestions.filter(s => s.autoApplicable);

  const estimateTotalBalancingTime = () =>
    balancingData.suggestions.reduce((sum, s) => sum + s.estimatedDuration, 0);

  return {
    ...balancingData,
    getSuggestionsByType,
    getHighPrioritySuggestions,
    getAutoApplicableSuggestions,
    estimateTotalBalancingTime,
    hasBalancingOpportunities: balancingData.suggestions.length > 0,
    needsUrgentBalancing: balancingData.suggestions.some(s => s.priority === 'high')
  };
};

// Funzioni helper

function calculateShiftHours(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  
  // Gestisce i turni che attraversano la mezzanotte
  if (end < start) {
    end.setDate(end.getDate() + 1);
  }
  
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

function calculateBalancingMetrics(employeeStats: any[], storeStats: any[], targetHours: number): BalancingMetrics {
  // Calcola equity score attuale
  const totalHours = employeeStats.reduce((sum, stat) => sum + stat.totalHours, 0);
  const averageHours = totalHours / Math.max(employeeStats.length, 1);
  const variance = employeeStats.reduce((sum, stat) => 
    sum + Math.pow(stat.totalHours - averageHours, 2), 0) / Math.max(employeeStats.length, 1);
  const standardDeviation = Math.sqrt(variance);
  const currentEquityScore = averageHours > 0 ? Math.max(0, 100 - (standardDeviation / averageHours) * 100) : 100;

  // Simula miglioramento potenziale (algoritmo di ottimizzazione teorico)
  const potentialImprovement = Math.min(currentEquityScore + 15, 100);

  // Calcola distribuzione del carico di lavoro
  const workloadDistribution = employeeStats.map(stat => ({
    employeeId: stat.employee.id,
    employeeName: `${stat.employee.firstName} ${stat.employee.lastName}`,
    currentHours: stat.totalHours,
    idealHours: stat.idealHours,
    deviation: stat.deviation,
    deviationPercent: stat.deviationPercent
  }));

  // Calcola bilanciamento negozi
  const avgStoreHours = storeStats.reduce((sum, stat) => sum + stat.totalHours, 0) / Math.max(storeStats.length, 1);
  const storeBalance = storeStats.map(stat => {
    const deviation = stat.totalHours - avgStoreHours;
    const deviationPercent = avgStoreHours > 0 ? (Math.abs(deviation) / avgStoreHours) * 100 : 0;
    
    let staffingLevel: 'understaffed' | 'optimal' | 'overstaffed' = 'optimal';
    if (deviationPercent > 25) {
      staffingLevel = deviation < 0 ? 'understaffed' : 'overstaffed';
    }

    return {
      storeId: stat.store.id,
      storeName: stat.store.name,
      currentHours: stat.totalHours,
      idealHours: Number(avgStoreHours.toFixed(1)),
      deviation: Number(deviation.toFixed(1)),
      staffingLevel
    };
  });

  // Determina livello generale di bilanciamento
  let overallBalance: 'poor' | 'fair' | 'good' | 'excellent' = 'excellent';
  if (currentEquityScore < 60) overallBalance = 'poor';
  else if (currentEquityScore < 75) overallBalance = 'fair';
  else if (currentEquityScore < 90) overallBalance = 'good';

  return {
    currentEquityScore: Number(currentEquityScore.toFixed(1)),
    potentialEquityScore: Number(potentialImprovement.toFixed(1)),
    workloadDistribution,
    storeBalance,
    overallBalance
  };
}

function generateBalancingSuggestions(
  employeeStats: any[], 
  storeStats: any[], 
  metrics: BalancingMetrics,
  maxDeviationPercent: number,
  minShiftHours: number,
  maxShiftHours: number,
  stores: Store[] // 🔧 Aggiunto parametro stores
): BalancingSuggestion[] {
  const suggestions: BalancingSuggestion[] = [];
  let suggestionId = 1;

  // 1. SUGGERIMENTI PER REDISTRIBUZIONE ORE
  const overloadedEmployees = employeeStats.filter(stat => stat.deviationPercent > maxDeviationPercent);
  const underloadedEmployees = employeeStats.filter(stat => stat.deviationPercent < -maxDeviationPercent);

  overloadedEmployees.forEach(overloaded => {
    // Trova il dipendente sottoutilizzato più compatibile DELLO STESSO NEGOZIO
    const bestMatch = underloadedEmployees
      .filter(under => 
        under.employee.id !== overloaded.employee.id &&
        under.employee.storeId === overloaded.employee.storeId // 🔧 STESSO NEGOZIO!
      )
      .sort((a, b) => Math.abs(a.deviationPercent) - Math.abs(b.deviationPercent))[0];

    if (bestMatch) {
      const hoursToRedistribute = Math.min(
        Math.abs(overloaded.deviation / 2),
        Math.abs(bestMatch.deviation / 2),
        8 // Max 8 ore per redistribuzione
      );

      suggestions.push({
        id: `redistribute-${suggestionId++}`,
        type: 'redistribute',
        priority: overloaded.deviationPercent > 50 ? 'high' : 'medium',
        title: 'Redistribuzione Ore',
        description: `Sposta ${hoursToRedistribute.toFixed(1)}h da ${overloaded.employee.firstName} a ${bestMatch.employee.firstName}`,
        sourceEmployeeId: overloaded.employee.id,
        targetEmployeeId: bestMatch.employee.id,
        sourceEmployeeName: `${overloaded.employee.firstName} ${overloaded.employee.lastName}`,
        targetEmployeeName: `${bestMatch.employee.firstName} ${bestMatch.employee.lastName}`,
        proposedChanges: {
          action: `Redistribuisci ${hoursToRedistribute.toFixed(1)} ore`,
          from: `${overloaded.totalHours}h`,
          to: `${(overloaded.totalHours - hoursToRedistribute).toFixed(1)}h → ${(bestMatch.totalHours + hoursToRedistribute).toFixed(1)}h`,
          impact: {
            hoursChange: hoursToRedistribute,
            equityImprovement: 8.5,
            workloadBalance: 12.3
          }
        },
        autoApplicable: hoursToRedistribute >= minShiftHours && hoursToRedistribute <= maxShiftHours,
        estimatedDuration: 15
      });
    }
  });

  // 2. SUGGERIMENTI PER SCAMBIO TURNI (SOLO STESSO NEGOZIO)
  employeeStats.forEach(emp1 => {
    if (Math.abs(emp1.deviationPercent) > 15) {
      employeeStats.forEach(emp2 => {
        if (emp1.employee.id !== emp2.employee.id && 
            emp1.employee.storeId === emp2.employee.storeId && // 🔧 STESSO NEGOZIO!
            emp1.deviationPercent * emp2.deviationPercent < 0) { // Segni opposti
          
          // Trova turni compatibili per lo scambio
          const compatibleSwaps = findCompatibleShiftSwaps(emp1.shifts, emp2.shifts);
          
          if (compatibleSwaps.length > 0) {
            const bestSwap = compatibleSwaps[0];
            
            suggestions.push({
              id: `swap-${suggestionId++}`,
              type: 'swap_shifts',
              priority: Math.max(Math.abs(emp1.deviationPercent), Math.abs(emp2.deviationPercent)) > 30 ? 'high' : 'medium',
              title: 'Scambio Turni Ottimale',
              description: `Scambia turni tra ${emp1.employee.firstName} e ${emp2.employee.firstName}`,
              sourceEmployeeId: emp1.employee.id,
              targetEmployeeId: emp2.employee.id,
              sourceEmployeeName: `${emp1.employee.firstName} ${emp1.employee.lastName}`,
              targetEmployeeName: `${emp2.employee.firstName} ${emp2.employee.lastName}`,
              shiftId: bestSwap.shift1.id,
              proposedChanges: {
                action: 'Scambia turni',
                from: `${bestSwap.shift1.startTime}-${bestSwap.shift1.endTime}`,
                to: `${bestSwap.shift2.startTime}-${bestSwap.shift2.endTime}`,
                impact: {
                  hoursChange: Math.abs(bestSwap.hoursDiff),
                  equityImprovement: 6.8,
                  workloadBalance: 9.2
                }
              },
              autoApplicable: true,
              estimatedDuration: 10
            });
          }
        }
      });
    }
  });

  // 3. SUGGERIMENTI PER OTTIMIZZAZIONE INTRA-NEGOZIO
  // Analizza ogni negozio individualmente per miglioramenti interni
  const storeGroups = employeeStats.reduce((groups, stat) => {
    const storeId = stat.employee.storeId;
    if (!groups[storeId]) groups[storeId] = [];
    groups[storeId].push(stat);
    return groups;
  }, {} as Record<string, any[]>);

  Object.entries(storeGroups).forEach(([storeId, storeEmployees]) => {
    if (storeEmployees.length < 2) return; // Serve almeno 2 dipendenti per ottimizzazioni interne
    
    const storeAvgHours = storeEmployees.reduce((sum, emp) => sum + emp.totalHours, 0) / storeEmployees.length;
    const storeVariance = storeEmployees.reduce((sum, emp) => sum + Math.pow(emp.totalHours - storeAvgHours, 2), 0) / storeEmployees.length;
    
    if (storeVariance > 15) { // Alta variabilità interna
      const storeName = storeEmployees[0]?.employee?.storeId ? 
        (stores.find(s => s.id === storeEmployees[0].employee.storeId)?.name || 'Negozio') : 'Negozio';
        
      suggestions.push({
        id: `intra-store-balance-${suggestionId++}`,
        type: 'redistribute',
        priority: storeVariance > 25 ? 'high' : 'medium',
        title: 'Ottimizzazione Interna Negozio',
        description: `Riequilibra le ore tra i dipendenti di ${storeName} per migliorare l'equità interna`,
        storeId: storeId,
        storeName: storeName,
        proposedChanges: {
          action: 'Redistribuisci ore internamente',
          from: `Varianza attuale: ${storeVariance.toFixed(1)}h²`,
          to: 'Distribuzione più equa interna',
          impact: {
            hoursChange: Math.sqrt(storeVariance) * 0.5,
            equityImprovement: 8.2,
            workloadBalance: 12.1
          }
        },
        autoApplicable: false,
        estimatedDuration: 20
      });
    }
  });

  // 4. SUGGERIMENTI PER AGGIUSTAMENTI ORARI
  employeeStats.forEach(stat => {
    if (Math.abs(stat.deviation) > 2 && Math.abs(stat.deviation) < 6) {
      // Suggerisci piccoli aggiustamenti agli orari esistenti
      suggestions.push({
        id: `adjust-hours-${suggestionId++}`,
        type: 'adjust_hours',
        priority: 'low',
        title: 'Aggiustamento Orari',
        description: `Aggiusta gli orari di ${stat.employee.firstName} per ottimizzare il carico`,
        sourceEmployeeId: stat.employee.id,
        sourceEmployeeName: `${stat.employee.firstName} ${stat.employee.lastName}`,
        proposedChanges: {
          action: stat.deviation > 0 ? 'Riduci ore' : 'Aumenta ore',
          from: `${stat.totalHours}h`,
          to: `${(stat.totalHours - stat.deviation).toFixed(1)}h`,
          impact: {
            hoursChange: Math.abs(stat.deviation),
            equityImprovement: 3.2,
            workloadBalance: 4.1
          }
        },
        autoApplicable: Math.abs(stat.deviation) < 4,
        estimatedDuration: 8
      });
    }
  });

  return suggestions;
}

function findCompatibleShiftSwaps(shifts1: Shift[], shifts2: Shift[]): Array<{shift1: Shift, shift2: Shift, hoursDiff: number}> {
  const swaps: Array<{shift1: Shift, shift2: Shift, hoursDiff: number}> = [];
  
  shifts1.forEach(shift1 => {
    shifts2.forEach(shift2 => {
      // Verifica che i turni siano in giorni diversi o negozi diversi
      const isSameDay = shift1.date.toDateString() === shift2.date.toDateString();
      const isSameStore = shift1.storeId === shift2.storeId;
      
      if (!isSameDay || !isSameStore) {
        const hours1 = calculateShiftHours(shift1.startTime, shift1.endTime);
        const hours2 = calculateShiftHours(shift2.startTime, shift2.endTime);
        const hoursDiff = Math.abs(hours1 - hours2);
        
        // Considera solo scambi con differenza ragionevole
        if (hoursDiff <= 2) {
          swaps.push({ shift1, shift2, hoursDiff });
        }
      }
    });
  });
  
  return swaps.sort((a, b) => a.hoursDiff - b.hoursDiff);
}