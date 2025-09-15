import { useMemo, useCallback, useRef } from 'react';
import { Employee, Store, Shift } from '../types';

// Performance optimization: Cache for expensive computations
interface AICache {
  suggestions: { key: string; data: AISchedulingSuggestion[]; timestamp: number };
  predictions: { key: string; data: WorkloadPrediction[]; timestamp: number };
  metrics: { key: string; data: SchedulingMetrics; timestamp: number };
  optimizedSchedule: { key: string; data: Shift[]; timestamp: number };
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface SchedulingConstraint {
  id: string;
  type: 'hard' | 'soft';
  weight: number;
  description: string;
  validate: (shift: Shift, employee: Employee, allShifts: Shift[]) => {
    valid: boolean;
    score: number;
    reason?: string;
  };
}

export interface AISchedulingSuggestion {
  id: string;
  type: 'optimization' | 'prediction' | 'anomaly';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: {
    efficiency: number;
    satisfaction: number;
    compliance: number;
  };
  automatable: boolean;
  estimatedSavings: {
    hours: number;
    cost: number;
  };
  actionRequired: string;
}

export interface WorkloadPrediction {
  storeId: string;
  date: Date;
  predictedDemand: number;
  requiredStaff: number;
  confidence: number;
  factors: Array<{
    factor: string;
    weight: number;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface SchedulingMetrics {
  efficiency: number;
  fairness: number;
  compliance: number;
  satisfaction: number;
  adaptability: number;
  overallScore: number;
}

interface UseSchedulingAIProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  weekStart: Date;
  enabled: boolean;
}

export const useSchedulingAI = ({
  employees,
  shifts,
  stores,
  weekStart,
  enabled
}: UseSchedulingAIProps) => {
  // Performance optimization: Cache expensive AI computations
  const cacheRef = useRef<Partial<AICache>>({});

  // Helper function to generate cache keys
  const generateCacheKey = useCallback((type: string, additionalData?: any) => {
    const baseData = {
      employees: employees.length,
      shifts: shifts.length,
      stores: stores.length,
      weekStart: weekStart.toISOString(),
      enabled
    };
    return `${type}-${JSON.stringify({ ...baseData, ...additionalData })}`;
  }, [employees.length, shifts.length, stores.length, weekStart, enabled]);

  // Cache helper functions
  const getCachedData = useCallback(<T>(type: keyof AICache, key: string): T | null => {
    const cached = cacheRef.current[type];
    if (cached && cached.key === key && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }, []);

  const setCachedData = useCallback(<T>(type: keyof AICache, key: string, data: T) => {
    cacheRef.current[type] = { key, data, timestamp: Date.now() } as any;
  }, []);

  // 🧠 ADVANCED CONSTRAINT SYSTEM
  const constraints = useMemo<SchedulingConstraint[]>(() => [
    {
      id: 'rest-period',
      type: 'hard',
      weight: 100,
      description: 'Minimo 12 ore di riposo tra turni',
      validate: (shift, employee, allShifts) => {
        const employeeShifts = allShifts
          .filter(s => s.employeeId === employee.id)
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        for (let i = 0; i < employeeShifts.length - 1; i++) {
          const current = employeeShifts[i];
          const next = employeeShifts[i + 1];

          const currentEnd = new Date(`${current.date.toDateString()} ${current.endTime}`);
          const nextStart = new Date(`${next.date.toDateString()} ${next.startTime}`);

          const restHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);

          if (restHours < 12) {
            return {
              valid: false,
              score: Math.max(0, (restHours / 12) * 100),
              reason: `Solo ${restHours.toFixed(1)}h di riposo`
            };
          }
        }

        return { valid: true, score: 100 };
      }
    },
    {
      id: 'workload-balance',
      type: 'soft',
      weight: 80,
      description: 'Bilanciamento equo del carico di lavoro',
      validate: (shift, employee, allShifts) => {
        const avgHours = allShifts.reduce((sum, s) => sum + (s.actualHours || 8), 0) / allShifts.length;
        const employeeHours = allShifts
          .filter(s => s.employeeId === employee.id)
          .reduce((sum, s) => sum + (s.actualHours || 8), 0);

        const deviation = Math.abs(employeeHours - avgHours) / avgHours;
        const score = Math.max(0, 100 - (deviation * 100));

        return {
          valid: deviation <= 0.2,
          score,
          reason: deviation > 0.2 ? `Sbilanciamento del ${(deviation * 100).toFixed(1)}%` : undefined
        };
      }
    },
    {
      id: 'skill-matching',
      type: 'soft',
      weight: 70,
      description: 'Corrispondenza competenze-ruolo',
      validate: (shift, employee, allShifts) => {
        // Simulate skill matching logic
        const isSkillMatch = employee.role !== 'junior' || (shift.actualHours || 8) <= 8;
        const score = isSkillMatch ? 100 : 60;

        return {
          valid: isSkillMatch,
          score,
          reason: !isSkillMatch ? 'Dipendente junior per turno complesso' : undefined
        };
      }
    },
    {
      id: 'preference-alignment',
      type: 'soft',
      weight: 50,
      description: 'Allineamento con preferenze dipendente',
      validate: (shift, employee, allShifts) => {
        // Simulate preference checking
        const preferenceScore = Math.random() * 100; // In real app, check actual preferences

        return {
          valid: preferenceScore > 40,
          score: preferenceScore,
          reason: preferenceScore <= 40 ? 'Non allineato con preferenze' : undefined
        };
      }
    }
  ], []);

  // 🤖 AI SCHEDULING OPTIMIZER
  const generateOptimizedSchedule = useCallback((baseShifts: Shift[]): Shift[] => {
    const cacheKey = generateCacheKey('optimization', { baseShifts: baseShifts.length });

    // Check cache first
    const cached = getCachedData<Shift[]>('optimizedSchedule', cacheKey);
    if (cached) {
      console.log('🤖 AI: Using cached optimized schedule');
      return cached;
    }

    console.log('🤖 AI: Generating optimized schedule...');

    // Clone shifts for optimization
    let optimizedShifts = baseShifts.map(shift => ({ ...shift }));

    // Apply genetic algorithm simulation
    for (let generation = 0; generation < 10; generation++) {
      optimizedShifts = optimizedShifts.map(shift => {
        const employee = employees.find(e => e.id === shift.employeeId);
        if (!employee) return shift;

        // Evaluate current assignment
        const currentScore = constraints.reduce((score, constraint) => {
          const result = constraint.validate(shift, employee, optimizedShifts);
          return score + (result.score * constraint.weight / 100);
        }, 0);

        // Try alternative assignments with probability
        if (Math.random() > 0.8 && currentScore < 80) {
          const alternativeEmployees = employees.filter(e =>
            e.storeId === employee.storeId &&
            e.id !== employee.id
          );

          if (alternativeEmployees.length > 0) {
            const bestAlternative = alternativeEmployees.reduce((best, alt) => {
              const altScore = constraints.reduce((score, constraint) => {
                const result = constraint.validate(shift, alt, optimizedShifts);
                return score + (result.score * constraint.weight / 100);
              }, 0);

              return altScore > best.score ? { employee: alt, score: altScore } : best;
            }, { employee: employee, score: currentScore });

            if (bestAlternative.score > currentScore + 10) {
              return { ...shift, employeeId: bestAlternative.employee.id };
            }
          }
        }

        return shift;
      });
    }

    console.log('🤖 AI: Schedule optimization completed');

    // Cache the result
    setCachedData('optimizedSchedule', cacheKey, optimizedShifts);

    return optimizedShifts;
  }, [employees, constraints, generateCacheKey, getCachedData, setCachedData]);

  // 📊 PREDICTIVE ANALYTICS
  const generateWorkloadPredictions = useCallback((): WorkloadPrediction[] => {
    const cacheKey = generateCacheKey('predictions');

    // Check cache first
    const cached = getCachedData<WorkloadPrediction[]>('predictions', cacheKey);
    if (cached) {
      console.log('📊 AI: Using cached workload predictions');
      return cached;
    }

    console.log('📊 AI: Generating workload predictions...');

    const predictions: WorkloadPrediction[] = [];
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);

    stores.forEach(store => {
      for (let i = 0; i < 7; i++) {
        const date = new Date(nextWeek);
        date.setDate(date.getDate() + i);

        // Simulate demand prediction based on historical patterns
        const dayOfWeek = date.getDay();
        const baseDemand = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1.0; // Lower on weekends
        const seasonalFactor = 1 + (Math.sin(date.getDate() / 30 * Math.PI) * 0.2);
        const randomVariation = 0.8 + (Math.random() * 0.4);

        const predictedDemand = baseDemand * seasonalFactor * randomVariation;
        const requiredStaff = Math.ceil(predictedDemand * 5); // Base staffing of 5

        predictions.push({
          storeId: store.id,
          date,
          predictedDemand,
          requiredStaff,
          confidence: 75 + Math.random() * 20,
          factors: [
            { factor: 'Storico giorno settimana', weight: 0.4, impact: dayOfWeek === 0 || dayOfWeek === 6 ? 'negative' : 'positive' },
            { factor: 'Tendenza stagionale', weight: 0.3, impact: seasonalFactor > 1 ? 'positive' : 'negative' },
            { factor: 'Variabilità locale', weight: 0.3, impact: 'neutral' }
          ]
        });
      }
    });

    console.log('📊 AI: Generated', predictions.length, 'predictions');

    // Cache the result
    setCachedData('predictions', cacheKey, predictions);

    return predictions;
  }, [stores, weekStart, generateCacheKey, getCachedData, setCachedData]);

  // 🔍 ANOMALY DETECTION
  const detectSchedulingAnomalies = useCallback((): AISchedulingSuggestion[] => {
    console.log('🔍 AI: Detecting scheduling anomalies...');

    const anomalies: AISchedulingSuggestion[] = [];

    // Detect overtime patterns
    const overtimeEmployees = employees.filter(employee => {
      const employeeShifts = shifts.filter(s => s.employeeId === employee.id);
      const totalHours = employeeShifts.reduce((sum, s) => sum + (s.actualHours || 8), 0);
      return totalHours > (employee.contractHours || 40) * 1.2;
    });

    if (overtimeEmployees.length > 0) {
      anomalies.push({
        id: 'overtime-anomaly',
        type: 'anomaly',
        priority: 'high',
        title: 'Pattern Straordinari Anomalo',
        description: `${overtimeEmployees.length} dipendenti superano le ore contrattuali del 20%`,
        confidence: 85,
        impact: {
          efficiency: -15,
          satisfaction: -20,
          compliance: -30
        },
        automatable: false,
        estimatedSavings: {
          hours: overtimeEmployees.length * 4,
          cost: overtimeEmployees.length * 4 * 25 // €25/hour overtime
        },
        actionRequired: 'Redistribuire carico di lavoro e verificare pianificazione'
      });
    }

    // Detect understaffing patterns
    const understaffedDays = stores.map(store => {
      const storeDays = [];
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(weekStart);
        checkDate.setDate(checkDate.getDate() + i);

        const dayShifts = shifts.filter(s =>
          s.storeId === store.id &&
          s.date.toDateString() === checkDate.toDateString()
        );

        if (dayShifts.length < 3) { // Minimum 3 staff per day
          storeDays.push(checkDate);
        }
      }
      return { store, understaffedDays: storeDays };
    }).filter(item => item.understaffedDays.length > 0);

    if (understaffedDays.length > 0) {
      anomalies.push({
        id: 'understaffing-anomaly',
        type: 'anomaly',
        priority: 'critical',
        title: 'Carenza di Personale Rilevata',
        description: `${understaffedDays.length} negozi con giorni sotto-staffed`,
        confidence: 90,
        impact: {
          efficiency: -25,
          satisfaction: -30,
          compliance: -10
        },
        automatable: true,
        estimatedSavings: {
          hours: 0,
          cost: -500 // Cost of poor service
        },
        actionRequired: 'Aggiungere turni o redistribuire personale disponibile'
      });
    }

    console.log('🔍 AI: Detected', anomalies.length, 'anomalies');
    return anomalies;
  }, [employees, shifts, stores, weekStart]);

  // 📈 PERFORMANCE METRICS
  const calculateSchedulingMetrics = useCallback((): SchedulingMetrics => {
    const cacheKey = generateCacheKey('metrics');

    // Check cache first
    const cached = getCachedData<SchedulingMetrics>('metrics', cacheKey);
    if (cached) {
      console.log('📈 AI: Using cached scheduling metrics');
      return cached;
    }

    console.log('📈 AI: Calculating scheduling metrics...');

    // Efficiency metric (workload distribution)
    const avgHours = shifts.reduce((sum, s) => sum + (s.actualHours || 8), 0) / Math.max(shifts.length, 1);
    const hourVariance = shifts.reduce((sum, s) => {
      const deviation = (s.actualHours || 8) - avgHours;
      return sum + (deviation * deviation);
    }, 0) / Math.max(shifts.length, 1);
    const efficiency = Math.max(0, 100 - Math.sqrt(hourVariance) * 10);

    // Fairness metric (employee hour distribution)
    const employeeHours = employees.map(emp => {
      return shifts.filter(s => s.employeeId === emp.id)
        .reduce((sum, s) => sum + (s.actualHours || 8), 0);
    });
    const avgEmployeeHours = employeeHours.reduce((sum, h) => sum + h, 0) / Math.max(employeeHours.length, 1);
    const fairnessVariance = employeeHours.reduce((sum, h) => {
      const deviation = h - avgEmployeeHours;
      return sum + (deviation * deviation);
    }, 0) / Math.max(employeeHours.length, 1);
    const fairness = Math.max(0, 100 - Math.sqrt(fairnessVariance) * 2);

    // Compliance metric (constraint satisfaction)
    let totalConstraintScore = 0;
    let constraintCount = 0;

    shifts.forEach(shift => {
      const employee = employees.find(e => e.id === shift.employeeId);
      if (employee) {
        constraints.forEach(constraint => {
          const result = constraint.validate(shift, employee, shifts);
          totalConstraintScore += result.score;
          constraintCount++;
        });
      }
    });

    const compliance = constraintCount > 0 ? totalConstraintScore / constraintCount : 100;

    // Satisfaction metric (simulated based on preferences and workload)
    const satisfaction = (fairness + efficiency) / 2 * 0.9 + Math.random() * 20;

    // Adaptability metric (flexibility for changes)
    const lockedShifts = shifts.filter(s => s.isLocked).length;
    const adaptability = Math.max(0, 100 - (lockedShifts / Math.max(shifts.length, 1)) * 100);

    const overallScore = (efficiency * 0.25 + fairness * 0.25 + compliance * 0.25 + satisfaction * 0.15 + adaptability * 0.1);

    console.log('📈 AI: Metrics calculated - Overall score:', overallScore.toFixed(1));

    const result = {
      efficiency: Math.round(efficiency),
      fairness: Math.round(fairness),
      compliance: Math.round(compliance),
      satisfaction: Math.round(satisfaction),
      adaptability: Math.round(adaptability),
      overallScore: Math.round(overallScore)
    };

    // Cache the result
    setCachedData('metrics', cacheKey, result);

    return result;
  }, [shifts, employees, constraints, generateCacheKey, getCachedData, setCachedData]);

  // 🎯 INTELLIGENT SUGGESTIONS
  const generateIntelligentSuggestions = useCallback((): AISchedulingSuggestion[] => {
    if (!enabled) return [];

    const cacheKey = generateCacheKey('suggestions');

    // Check cache first
    const cached = getCachedData<AISchedulingSuggestion[]>('suggestions', cacheKey);
    if (cached) {
      console.log('🎯 AI: Using cached intelligent suggestions');
      return cached;
    }

    console.log('🎯 AI: Generating intelligent suggestions...');

    const suggestions: AISchedulingSuggestion[] = [];

    // Add anomaly-based suggestions
    suggestions.push(...detectSchedulingAnomalies());

    // Add optimization suggestions
    const metrics = calculateSchedulingMetrics();

    if (metrics.efficiency < 70) {
      suggestions.push({
        id: 'efficiency-optimization',
        type: 'optimization',
        priority: 'high',
        title: 'Ottimizzazione Efficienza Pianificazione',
        description: 'L\'algoritmo AI ha identificato opportunità per migliorare l\'efficienza del 15-25%',
        confidence: 88,
        impact: {
          efficiency: 20,
          satisfaction: 10,
          compliance: 5
        },
        automatable: true,
        estimatedSavings: {
          hours: shifts.length * 0.1,
          cost: shifts.length * 0.1 * 20
        },
        actionRequired: 'Applicare ottimizzazione AI automatica'
      });
    }

    if (metrics.fairness < 75) {
      suggestions.push({
        id: 'fairness-improvement',
        type: 'optimization',
        priority: 'medium',
        title: 'Miglioramento Equità Distribuzione',
        description: 'Rilevato sbilanciamento nella distribuzione del carico di lavoro tra dipendenti',
        confidence: 92,
        impact: {
          efficiency: 5,
          satisfaction: 25,
          compliance: 10
        },
        automatable: true,
        estimatedSavings: {
          hours: 0,
          cost: 300 // Improved satisfaction
        },
        actionRequired: 'Riequilibrare automaticamente i carichi di lavoro'
      });
    }

    console.log('🎯 AI: Generated', suggestions.length, 'intelligent suggestions');

    // Cache the result
    setCachedData('suggestions', cacheKey, suggestions);

    return suggestions;
  }, [enabled, detectSchedulingAnomalies, calculateSchedulingMetrics, shifts, generateCacheKey, getCachedData, setCachedData]);

  return {
    // AI Functions
    generateOptimizedSchedule,
    generateWorkloadPredictions,
    detectSchedulingAnomalies,
    generateIntelligentSuggestions,
    calculateSchedulingMetrics,

    // Configuration
    constraints,

    // Status
    enabled
  };
};