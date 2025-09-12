import { useMemo } from 'react';
import { Store, Shift, Employee } from '../types';
import { ShiftGridValidationResult, ValidationAdminSettings } from '../types/validation';
import { validateShiftGrid } from '../utils/shiftGridValidation';

interface UseShiftGridValidationProps {
  store: Store;
  shifts: Shift[];
  employees: Employee[];
  weekStart: Date;
  adminSettings?: ValidationAdminSettings;
}

export const useShiftGridValidation = ({
  store,
  shifts,
  employees,
  weekStart,
  adminSettings
}: UseShiftGridValidationProps) => {

  // Memoizza il risultato della validazione per evitare ricalcoli inutili
  const validationResult: ShiftGridValidationResult = useMemo(() => {
    // Se adminSettings è definito ma validazione è disabilitata
    if (adminSettings && (!adminSettings.enabled || !adminSettings.enableRealTimeValidation)) {
      return {
        isValid: true,
        score: 100,
        summary: {
          totalDays: 7,
          validDays: 7,
          daysWithIssues: 0,
          daysWithoutShifts: 0,
          totalAnomalies: 0,
          criticalIssues: 0,
          warnings: 0
        },
        dailyResults: [],
        overallIssues: [],
        workloadDistribution: { employees: [], maxHours: 0, minHours: 0, averageHours: 0, standardDeviation: 0, isEquitable: true, inequityScore: 0 }
      };
    }

    console.log('🔍 Esecuzione validazione griglia turni con configurazioni admin...');
    const startTime = performance.now();
    
    // Log configurazioni utilizzate
    console.log('🏪 Configurazioni utilizzate:', {
      storeName: store.name,
      adminSettingsEnabled: adminSettings?.enabled ?? true,
      realTimeValidation: adminSettings?.enableRealTimeValidation ?? true,
      minimumStaffPerHour: adminSettings?.coverageSettings.minimumStaffPerHour ?? 1,
      weeklySchedules: store.weeklySchedules?.length || 0,
      closureDays: store.closureDays?.filter(c => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return c.date >= weekStart && c.date <= weekEnd;
      }).length || 0,
      staffRequirements: store.staffRequirements?.length || 0
    });
    
    const result = validateShiftGrid(store, shifts, employees, weekStart, adminSettings);
    
    const endTime = performance.now();
    console.log(`⚡ Validazione completata in ${(endTime - startTime).toFixed(2)}ms`);
    
    return result;
  }, [
    store.id,
    store.openingHours,
    store.weeklySchedules,
    store.closureDays,
    store.staffRequirements,
    shifts.length,
    shifts.map(s => `${s.id}-${s.startTime}-${s.endTime}-${s.date.toISOString()}`).join(','),
    employees.length,
    weekStart.toISOString(),
    adminSettings?.enabled,
    adminSettings?.enableRealTimeValidation,
    adminSettings?.coverageSettings.minimumStaffPerHour,
    adminSettings?.coverageSettings.minimumOverlapMinutes,
    adminSettings?.coverageSettings.allowSinglePersonCoverage,
    adminSettings?.dynamicStaffRequirements.enabled,
    adminSettings?.alertSettings.scoreThreshold
  ]);

  // Funzioni helper per accesso rapido ai dati
  const getCriticalIssues = () => {
    return [
      ...validationResult.dailyResults.flatMap(day => 
        day.issues.filter(issue => issue.severity === 'critical')
      ),
      ...validationResult.overallIssues.filter(issue => issue.severity === 'critical')
    ];
  };

  const getWarnings = () => {
    return [
      ...validationResult.dailyResults.flatMap(day => 
        day.issues.filter(issue => issue.severity === 'warning')
      ),
      ...validationResult.overallIssues.filter(issue => issue.severity === 'warning')
    ];
  };

  const getDayValidation = (date: Date) => {
    return validationResult.dailyResults.find(day => 
      day.date.toDateString() === date.toDateString()
    );
  };

  const getValidationSummary = () => {
    return {
      ...validationResult.summary,
      scoreGrade: getScoreGrade(validationResult.score),
      needsAttention: validationResult.summary.criticalIssues > 0,
      hasWarnings: validationResult.summary.warnings > 0
    };
  };

  const getCoverageStats = () => {
    const openDays = validationResult.dailyResults.filter(day => day.isStoreOpen);
    const totalCoverage = openDays.reduce((sum, day) => sum + day.coverage.coveragePercentage, 0);
    const avgCoverage = openDays.length > 0 ? totalCoverage / openDays.length : 0;
    
    const bestDay = openDays.reduce((best, current) => 
      current.coverage.coveragePercentage > best.coverage.coveragePercentage ? current : best,
      openDays[0]
    );
    
    const worstDay = openDays.reduce((worst, current) => 
      current.coverage.coveragePercentage < worst.coverage.coveragePercentage ? current : worst,
      openDays[0]
    );

    return {
      averageCoverage: Number(avgCoverage.toFixed(1)),
      bestDay: bestDay ? {
        date: bestDay.date,
        coverage: bestDay.coverage.coveragePercentage
      } : null,
      worstDay: worstDay ? {
        date: worstDay.date,
        coverage: worstDay.coverage.coveragePercentage
      } : null,
      daysWithFullCoverage: openDays.filter(day => day.coverage.coveragePercentage === 100).length
    };
  };

  return {
    // Risultato completo
    validationResult,
    
    // Stato generale
    isValid: validationResult.isValid,
    score: validationResult.score,
    
    // Accesso facilitato ai dati
    summary: getValidationSummary(),
    criticalIssues: getCriticalIssues(),
    warnings: getWarnings(),
    coverageStats: getCoverageStats(),
    
    // Funzioni helper
    getDayValidation,
    
    // Controlli rapidi
    hasAnyIssues: validationResult.summary.totalAnomalies > 0,
    needsImmedateAttention: validationResult.summary.criticalIssues > 0,
    isHighQuality: validationResult.score >= 90,
    isAcceptable: validationResult.score >= 70
  };
};

function getScoreGrade(score: number): string {
  if (score >= 95) return 'Eccellente';
  if (score >= 85) return 'Ottimo';
  if (score >= 75) return 'Buono';
  if (score >= 60) return 'Sufficiente';
  if (score >= 40) return 'Insufficiente';
  return 'Critico';
}