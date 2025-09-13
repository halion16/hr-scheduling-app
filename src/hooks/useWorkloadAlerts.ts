import { useMemo } from 'react';
import { Employee, Store, Shift } from '../types';
import { ValidationAdminSettings } from '../types/validation';

export interface WorkloadAlert {
  id: string;
  type: 'overloaded' | 'underloaded' | 'equity_critical' | 'store_imbalance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  employeeId?: string;
  employeeName?: string;
  storeId?: string;
  storeName?: string;
  currentValue: number;
  thresholdValue: number;
  timestamp: Date;
  actionRequired: boolean;
  // 🆕 Campi aggiuntivi per gestione migliorata
  excessHours?: number;      // Ore in eccesso (per sovraccarichi)
  deficitHours?: number;     // Ore in difetto (per sottoutilizzati)
  canJustify?: boolean;      // Se può essere giustificato (malattie, permessi)
  canMoveToHourBank?: boolean; // Se può essere spostato in banca ore
  contractHours?: number;    // Ore contrattuali per reference
  minHours?: number;         // Ore minime per reference
}

export interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byType: {
    overloaded: number;
    underloaded: number;
    equity_critical: number;
    store_imbalance: number;
  };
}

interface UseWorkloadAlertsProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  weekStart: Date;
  adminSettings?: ValidationAdminSettings;
  enabled?: boolean;
  storeFilter?: string; // 🆕 Filtro per negozio specifico
}

export const useWorkloadAlerts = ({
  employees,
  shifts,
  stores,
  weekStart,
  adminSettings,
  enabled = true,
  storeFilter
}: UseWorkloadAlertsProps) => {
  const alerts = useMemo<WorkloadAlert[]>(() => {
    if (!enabled || !employees.length || !shifts.length) return [];

    const alertList: WorkloadAlert[] = [];
    const now = new Date();
    
    // 🔍 DEBUG: Log filtro negozio
    console.log('🔍 useWorkloadAlerts DEBUG:', {
      storeFilter,
      totalEmployees: employees.length,
      totalShifts: shifts.length,
      stores: stores.map(s => ({ id: s.id, name: s.name }))
    });

    // Calcola range del periodo corrente (settimana)
    const periodStart = new Date(weekStart);
    const periodEnd = new Date(weekStart);
    periodEnd.setDate(periodEnd.getDate() + 6);

    // Filtra shifts per periodo corrente e negozio (se specificato)
    const currentWeekShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      const dateMatch = shiftDate >= periodStart && shiftDate <= periodEnd;
      const storeMatch = !storeFilter || shift.storeId === storeFilter;
      return dateMatch && storeMatch;
    });

    // Soglie configurabili dall'admin (con fallback)
    const maxHoursThreshold = adminSettings?.dynamicStaffRequirements?.maxHoursVariation || 40;
    const minHoursThreshold = 8; // Minimo settimanale
    const equityCriticalThreshold = 60; // Score sotto 60% è critico
    const overloadWarningThreshold = maxHoursThreshold * 0.8; // 80% del limite
    
    // 🔍 DEBUG: Log soglie per verificare i valori
    console.log('🔍 Soglie alert:', {
      maxHoursThreshold,
      minHoursThreshold,
      equityCriticalThreshold,
      overloadWarningThreshold,
      adminSettings: adminSettings?.dynamicStaffRequirements
    });

    // Filtra dipendenti attivi e per negozio (se specificato)
    const activeEmployees = employees.filter(emp => {
      const activeMatch = emp.isActive;
      const storeMatch = !storeFilter || emp.storeId === storeFilter;
      return activeMatch && storeMatch;
    });
    
    // 🔍 DEBUG: Log risultati filtro
    console.log('🔍 Filtro risultati:', {
      currentWeekShifts: currentWeekShifts.length,
      activeEmployees: activeEmployees.length,
      filteredEmployeeStores: activeEmployees.map(e => ({ id: e.id, name: e.firstName, storeId: e.storeId }))
    });

    // Calcola statistiche per dipendente
    const employeeStats = activeEmployees.map(employee => {
      const employeeShifts = currentWeekShifts.filter(shift => shift.employeeId === employee.id);
      
      // 🔍 DEBUG: Log shift data per capire il formato
      console.log(`🔍 Shifts per ${employee.firstName}:`, employeeShifts.map(s => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        actualHours: s.actualHours,
        breakDuration: s.breakDuration
      })));
      
      // 🔧 USA actualHours se disponibile, altrimenti calcola
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

      const consecutiveDays = calculateConsecutiveDays(employeeShifts);
      
      return {
        employee,
        totalHours: Number(totalHours.toFixed(1)),
        shiftsCount: employeeShifts.length,
        consecutiveDays,
        shifts: employeeShifts
      };
    });

    // 1. ALERT DIPENDENTI SOVRACCARICHI/SOTTOUTILIZZATI (usando limiti individuali)
    employeeStats.forEach(stat => {
      const { employee, totalHours } = stat;

      // 🔧 USA LIMITI INDIVIDUALI del dipendente (nomi campi corretti!)
      const employeeMaxHours = employee.contractHours || maxHoursThreshold; // contractHours = Ore Massime Contratto
      const employeeMinHours = employee.fixedHours || Math.max(employeeMaxHours * 0.5, 8); // fixedHours = Ore Minime Garantite
      const warningThreshold = employeeMaxHours * 0.9; // 90% del limite individuale

      // 🔍 DEBUG: Log limiti individuali
      console.log(`🔍 Limiti ${employee.firstName}:`, {
        totalHours,
        employeeMaxHours,
        employeeMinHours,
        contractHours: employee.contractHours, // Ore Massime Contratto
        fixedHours: employee.fixedHours // Ore Minime Garantite
      });

      // Alert Critico: Superato limite massimo INDIVIDUALE
      if (totalHours > employeeMaxHours) {
        const excessHours = totalHours - employeeMaxHours;
        alertList.push({
          id: `overload-critical-${employee.id}`,
          type: 'overloaded',
          severity: 'critical',
          title: 'Sovraccarico Critico',
          message: `${employee.firstName} ${employee.lastName} ha ${totalHours}h questa settimana (limite: ${employeeMaxHours}h)`,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          currentValue: totalHours,
          thresholdValue: employeeMaxHours,
          timestamp: now,
          actionRequired: true,
          // 🆕 Dati aggiuntivi
          excessHours: Number(excessHours.toFixed(1)),
          contractHours: employeeMaxHours,
          minHours: employeeMinHours,
          canJustify: false, // Sovraccarico non si giustifica
          canMoveToHourBank: false // Eccesso non va in banca ore
        });
      }
      // Alert Warning: Vicino al limite INDIVIDUALE
      else if (totalHours > warningThreshold) {
        const excessHours = totalHours - employeeMaxHours;
        alertList.push({
          id: `overload-warning-${employee.id}`,
          type: 'overloaded',
          severity: 'high',
          title: 'Rischio Sovraccarico',
          message: `${employee.firstName} ${employee.lastName} ha ${totalHours}h (${((totalHours/employeeMaxHours)*100).toFixed(0)}% del limite)`,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          currentValue: totalHours,
          thresholdValue: warningThreshold,
          timestamp: now,
          actionRequired: false,
          // 🆕 Dati aggiuntivi
          excessHours: excessHours > 0 ? Number(excessHours.toFixed(1)) : 0,
          contractHours: employeeMaxHours,
          minHours: employeeMinHours,
          canJustify: false,
          canMoveToHourBank: false
        });
      }

      // 2. ALERT DIPENDENTI SOTTOUTILIZZATI (usando minimo INDIVIDUALE)
      if (totalHours > 0 && totalHours < employeeMinHours) {
        const deficitHours = employeeMinHours - totalHours;
        alertList.push({
          id: `underload-${employee.id}`,
          type: 'underloaded',
          severity: totalHours < employeeMinHours * 0.5 ? 'high' : 'medium',
          title: 'Dipendente Sottoutilizzato',
          message: `${employee.firstName} ${employee.lastName} ha solo ${totalHours}h questa settimana (minimo: ${employeeMinHours}h)`,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          currentValue: totalHours,
          thresholdValue: employeeMinHours,
          timestamp: now,
          actionRequired: true, // 🆕 Richiede azione per risoluzione
          // 🆕 Dati aggiuntivi per gestione sottoutilizzo
          deficitHours: Number(deficitHours.toFixed(1)),
          contractHours: employeeMaxHours,
          minHours: employeeMinHours,
          canJustify: true, // Può essere giustificato (malattie, permessi, ferie)
          canMoveToHourBank: deficitHours >= 2 // Solo se deficit significativo (≥2h)
        });
      }
    });

    // 3. ALERT EQUITÀ CRITICA (analisi globale)
    const totalHours = employeeStats.reduce((sum, stat) => sum + stat.totalHours, 0);
    const averageHours = totalHours / Math.max(employeeStats.length, 1);
    const variance = employeeStats.reduce((sum, stat) => 
      sum + Math.pow(stat.totalHours - averageHours, 2), 0) / Math.max(employeeStats.length, 1);
    const standardDeviation = Math.sqrt(variance);
    const equityScore = averageHours > 0 ? 100 - (standardDeviation / averageHours) * 100 : 100;

    if (equityScore < equityCriticalThreshold && employeeStats.length > 2) {
      alertList.push({
        id: 'equity-critical',
        type: 'equity_critical',
        severity: equityScore < 40 ? 'critical' : 'high',
        title: 'Squilibrio Critico nella Distribuzione',
        message: `Score equità attuale: ${equityScore.toFixed(0)}% (soglia critica: ${equityCriticalThreshold}%)`,
        currentValue: Number(equityScore.toFixed(1)),
        thresholdValue: equityCriticalThreshold,
        timestamp: now,
        actionRequired: true
      });
    }

    // 4. ALERT SBILANCIAMENTO TRA NEGOZI (solo se non si sta filtrando per singolo negozio)
    if (stores.length > 1 && !storeFilter) {
      const storeStats = stores.map(store => {
        const storeShifts = currentWeekShifts.filter(shift => shift.storeId === store.id);
        const storeHours = storeShifts.reduce((sum, shift) => {
          const start = new Date(`2000-01-01T${shift.startTime}`);
          const end = new Date(`2000-01-01T${shift.endTime}`);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }, 0);
        
        return { store, totalHours: storeHours, shiftsCount: storeShifts.length };
      });

      const avgStoreHours = storeStats.reduce((sum, stat) => sum + stat.totalHours, 0) / storeStats.length;
      
      storeStats.forEach(stat => {
        const deviation = Math.abs(stat.totalHours - avgStoreHours);
        const deviationPercent = avgStoreHours > 0 ? (deviation / avgStoreHours) * 100 : 0;
        
        if (deviationPercent > 30 && stat.totalHours < avgStoreHours) { // Negozio sotto-staffato
          alertList.push({
            id: `store-understaffed-${stat.store.id}`,
            type: 'store_imbalance',
            severity: deviationPercent > 50 ? 'high' : 'medium',
            title: 'Negozio Sotto-staffato',
            message: `${stat.store.name} ha ${stat.totalHours.toFixed(1)}h vs media ${avgStoreHours.toFixed(1)}h`,
            storeId: stat.store.id,
            storeName: stat.store.name,
            currentValue: Number(stat.totalHours.toFixed(1)),
            thresholdValue: Number(avgStoreHours.toFixed(1)),
            timestamp: now,
            actionRequired: false
          });
        }
      });
    }

    return alertList.sort((a, b) => {
      // Ordina per severità e timestamp
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [employees, shifts, stores, weekStart, adminSettings, enabled, storeFilter]); // 🔧 Aggiunto storeFilter

  // Calcola summary degli alert
  const alertSummary = useMemo<AlertSummary>(() => {
    const summary: AlertSummary = {
      total: alerts.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byType: {
        overloaded: 0,
        underloaded: 0,
        equity_critical: 0,
        store_imbalance: 0
      }
    };

    alerts.forEach(alert => {
      summary[alert.severity]++;
      summary.byType[alert.type]++;
    });

    return summary;
  }, [alerts]);

  // Funzioni di utilità
  const getAlertsByType = (type: WorkloadAlert['type']) => 
    alerts.filter(alert => alert.type === type);

  const getAlertsBySeverity = (severity: WorkloadAlert['severity']) => 
    alerts.filter(alert => alert.severity === severity);

  const getCriticalAlerts = () => 
    alerts.filter(alert => alert.severity === 'critical' || alert.actionRequired);

  return {
    alerts,
    alertSummary,
    getAlertsByType,
    getAlertsBySeverity,
    getCriticalAlerts,
    hasAlerts: alerts.length > 0,
    hasCriticalAlerts: alertSummary.critical > 0 || alerts.some(a => a.actionRequired)
  };
};

// Funzione helper per calcolare giorni consecutivi
function calculateConsecutiveDays(shifts: Shift[]): number {
  if (!shifts.length) return 0;

  const sortedDates = shifts
    .map(shift => shift.date.toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort();

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  return maxConsecutive;
}