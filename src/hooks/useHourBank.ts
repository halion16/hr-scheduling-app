import { useState, useEffect, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useScheduleData } from './useScheduleData';
import { 
  HourBankAccount, 
  HourBankEntry, 
  HourRecoveryRequest, 
  HourBankSummary,
  EmployeeHourBankReport,
  HourBankCalculationOptions,
  HourBankStatistics
} from '../types/hourBank';
import { Employee, Store, Shift } from '../types';
import { getStartOfWeek, addDays } from '../utils/timeUtils';

export const useHourBank = () => {
  const [hourBankAccounts, setHourBankAccounts] = useLocalStorage<HourBankAccount[]>('hr-hour-bank-accounts', []);
  const [hourBankEntries, setHourBankEntries] = useLocalStorage<HourBankEntry[]>('hr-hour-bank-entries', []);
  const [recoveryRequests, setRecoveryRequests] = useLocalStorage<HourRecoveryRequest[]>('hr-recovery-requests', []);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculation, setLastCalculation] = useState<Date | null>(null);
  const [calculationLog, setCalculationLog] = useState<string[]>([]);

  // 📊 CALCOLO AUTOMATICO BANCA ORE
  const calculateHourBank = async (
    employees: Employee[],
    stores: Store[],
    shifts: Shift[],
    options: HourBankCalculationOptions = {
      includeLockedShifts: true,
      includeCompletedShifts: true,
      recalculateFromStart: false
    }
  ) => {
    console.log('🏦 AVVIO CALCOLO BANCA ORE');
    console.log('📊 Parametri:', {
      employees: employees.length,
      stores: stores.length,
      shifts: shifts.length,
      options
    });

    setIsCalculating(true);
    const startTime = performance.now();
    const logs: string[] = [`🚀 Avvio calcolo: ${new Date().toLocaleTimeString()}`];

    try {
      // 1. FILTRA TURNI VALIDI
      const validShifts = shifts.filter(shift => {
        if (!shift.date || !(shift.date instanceof Date) || isNaN(shift.date.getTime())) {
          return false;
        }
        
        if (!options.includeLockedShifts && shift.isLocked) return false;
        if (!options.includeCompletedShifts && shift.status !== 'completed') return false;
        
        // Filtra per periodo se specificato
        if (options.startDate && shift.date < options.startDate) return false;
        if (options.endDate && shift.date > options.endDate) return false;
        
        return true;
      });

      logs.push(`📋 Turni validi per calcolo: ${validShifts.length}/${shifts.length}`);

      // 2. RAGGRUPPA TURNI PER DIPENDENTE E SETTIMANA
      const employeeWeeklyData = new Map<string, Map<string, Shift[]>>();
      
      validShifts.forEach(shift => {
        const weekStart = getStartOfWeek(shift.date);
        const weekKey = weekStart.toISOString();
        
        if (!employeeWeeklyData.has(shift.employeeId)) {
          employeeWeeklyData.set(shift.employeeId, new Map());
        }
        
        const employeeWeeks = employeeWeeklyData.get(shift.employeeId)!;
        if (!employeeWeeks.has(weekKey)) {
          employeeWeeks.set(weekKey, []);
        }
        
        employeeWeeks.get(weekKey)!.push(shift);
      });

      logs.push(`👥 Dipendenti analizzati: ${employeeWeeklyData.size}`);

      // 3. CALCOLA ENTRIES PER OGNI DIPENDENTE/SETTIMANA
      const newEntries: HourBankEntry[] = [];
      const accountUpdates = new Map<string, { totalDifference: number; lastDate: Date }>();

      for (const [employeeId, employeeWeeks] of employeeWeeklyData) {
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee || !employee.isActive) continue;

        logs.push(`📊 Elaborazione ${employee.firstName} ${employee.lastName}:`);

        for (const [weekKey, weekShifts] of employeeWeeks) {
          const weekStart = new Date(weekKey);
          const weekEnd = addDays(weekStart, 6);
          
          // Calcola ore effettive della settimana
          const actualHours = weekShifts.reduce((sum, shift) => sum + shift.actualHours, 0);
          const contractHours = employee.contractHours;
          const difference = actualHours - contractHours;
          
          // Crea entry solo se c'è una differenza significativa (>= 0.5h)
          if (Math.abs(difference) >= 0.5) {
            const entry: HourBankEntry = {
              id: crypto.randomUUID(),
              employeeId,
              storeId: employee.storeId || '',
              weekStartDate: weekStart,
              weekEndDate: weekEnd,
              contractHours,
              actualHours: Number(actualHours.toFixed(1)),
              difference: Number(difference.toFixed(1)),
              type: difference > 0 ? 'excess' : 'deficit',
              description: `Settimana ${weekStart.toLocaleDateString()}: ${actualHours.toFixed(1)}h lavorate vs ${contractHours}h contratto`,
              isProcessed: false,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            newEntries.push(entry);
            
            // Accumula per aggiornamento account
            const current = accountUpdates.get(employeeId) || { totalDifference: 0, lastDate: new Date(0) };
            accountUpdates.set(employeeId, {
              totalDifference: current.totalDifference + difference,
              lastDate: weekEnd > current.lastDate ? weekEnd : current.lastDate
            });

            logs.push(`   📅 ${weekStart.toLocaleDateString()}: ${difference > 0 ? '+' : ''}${difference.toFixed(1)}h`);
          }
        }
      }

      logs.push(`📝 Nuove entries create: ${newEntries.length}`);

      // 4. AGGIORNA O CREA ACCOUNTS
      const updatedAccounts = new Map(hourBankAccounts.map(acc => [acc.employeeId, acc]));

      for (const [employeeId, updateData] of accountUpdates) {
        const employee = employees.find(emp => emp.id === employeeId)!;
        const existingAccount = updatedAccounts.get(employeeId);
        
        if (existingAccount) {
          // Aggiorna account esistente
          existingAccount.currentBalance = Number((existingAccount.currentBalance + updateData.totalDifference).toFixed(1));
          existingAccount.totalAccumulated += updateData.totalDifference > 0 ? updateData.totalDifference : 0;
          existingAccount.lastCalculationDate = updateData.lastDate;
          existingAccount.updatedAt = new Date();
        } else {
          // Crea nuovo account
          const newAccount: HourBankAccount = {
            id: crypto.randomUUID(),
            employeeId,
            storeId: employee.storeId || '',
            currentBalance: Number(updateData.totalDifference.toFixed(1)),
            totalAccumulated: updateData.totalDifference > 0 ? updateData.totalDifference : 0,
            totalRecovered: 0,
            lastCalculationDate: updateData.lastDate,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          updatedAccounts.set(employeeId, newAccount);
          logs.push(`🆕 Nuovo account: ${employee.firstName} ${employee.lastName}`);
        }
      }

      // 5. AGGIORNA STATO
      if (options.recalculateFromStart) {
        setHourBankEntries(newEntries);
      } else {
        setHourBankEntries(prev => [...prev, ...newEntries]);
      }
      
      setHourBankAccounts(Array.from(updatedAccounts.values()));
      setLastCalculation(new Date());

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      logs.push(`✅ Calcolo completato in ${duration.toFixed(0)}ms`);
      setCalculationLog(logs);

      console.log('🏦 CALCOLO BANCA ORE COMPLETATO');
      console.log('📈 Risultati:', {
        entriesCreate: newEntries.length,
        accountsUpdated: accountUpdates.size,
        duration: `${duration.toFixed(0)}ms`
      });

      return {
        success: true,
        entriesCreated: newEntries.length,
        accountsUpdated: accountUpdates.size,
        duration
      };

    } catch (error) {
      console.error('❌ Errore durante calcolo banca ore:', error);
      logs.push(`❌ Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
      setCalculationLog(logs);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    } finally {
      setIsCalculating(false);
    }
  };

  // 📊 STATISTICHE BANCA ORE PER NEGOZIO
  const getStoreHourBankSummary = (storeId: string, storeName: string): HourBankSummary => {
    const storeAccounts = hourBankAccounts.filter(acc => acc.storeId === storeId);
    const storePendingRecoveries = recoveryRequests.filter(req => 
      req.status === 'pending' && 
      storeAccounts.some(acc => acc.employeeId === req.employeeId)
    );

    const totalCredit = storeAccounts.filter(acc => acc.currentBalance > 0).reduce((sum, acc) => sum + acc.currentBalance, 0);
    const totalDebt = storeAccounts.filter(acc => acc.currentBalance < 0).reduce((sum, acc) => sum + Math.abs(acc.currentBalance), 0);
    const netBalance = totalCredit - totalDebt;

    return {
      storeId,
      storeName,
      totalEmployees: storeAccounts.length,
      employeesWithCredit: storeAccounts.filter(acc => acc.currentBalance > 0).length,
      employeesWithDebt: storeAccounts.filter(acc => acc.currentBalance < 0).length,
      totalCredit: Number(totalCredit.toFixed(1)),
      totalDebt: Number(totalDebt.toFixed(1)),
      netBalance: Number(netBalance.toFixed(1)),
      pendingRecoveries: storePendingRecoveries.length,
      averageBalance: storeAccounts.length > 0 ? Number((storeAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0) / storeAccounts.length).toFixed(1)) : 0,
      lastUpdated: lastCalculation || new Date()
    };
  };

  // 📋 REPORT DETTAGLIATO DIPENDENTE
  const getEmployeeHourBankReport = (employeeId: string, employees: Employee[]): EmployeeHourBankReport | null => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return null;

    const account = hourBankAccounts.find(acc => acc.employeeId === employeeId);
    if (!account) return null;

    const recentEntries = hourBankEntries
      .filter(entry => entry.employeeId === employeeId)
      .sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime())
      .slice(0, 8); // Ultime 8 settimane

    const pendingRecoveries = recoveryRequests.filter(req => 
      req.employeeId === employeeId && req.status === 'pending'
    );

    const weeklyBreakdown = recentEntries.map(entry => ({
      weekStart: entry.weekStartDate,
      contractHours: entry.contractHours,
      actualHours: entry.actualHours,
      difference: entry.difference,
      isProcessed: entry.isProcessed
    }));

    const pendingRecoveryHours = pendingRecoveries.reduce((sum, req) => sum + req.requestedHours, 0);
    const projectedBalance = account.currentBalance - pendingRecoveryHours;

    // Genera raccomandazioni
    const recommendations: string[] = [];
    if (account.currentBalance > 20) {
      recommendations.push('💡 Considera di richiedere recupero ore o riduzione orari');
    }
    if (account.currentBalance < -10) {
      recommendations.push('⚠️ Deficit ore elevato - considera turni aggiuntivi');
    }
    if (pendingRecoveries.length > 0) {
      recommendations.push(`📋 ${pendingRecoveries.length} richieste di recupero in attesa`);
    }

    return {
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        contractHours: employee.contractHours
      },
      account,
      recentEntries,
      pendingRecoveries,
      weeklyBreakdown,
      projectedBalance: Number(projectedBalance.toFixed(1)),
      recommendations
    };
  };

  // 🆕 RICHIESTA RECUPERO ORE
  const createRecoveryRequest = (request: Omit<HourRecoveryRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    const account = hourBankAccounts.find(acc => acc.employeeId === request.employeeId);
    
    if (!account) {
      throw new Error('Account banca ore non trovato per questo dipendente');
    }

    if (account.currentBalance < request.requestedHours) {
      throw new Error(`Credito insufficiente: disponibili ${account.currentBalance.toFixed(1)}h, richieste ${request.requestedHours}h`);
    }

    const newRequest: HourRecoveryRequest = {
      ...request,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setRecoveryRequests(prev => [...prev, newRequest]);
    
    console.log('📝 Richiesta recupero creata:', {
      employee: request.employeeId,
      hours: request.requestedHours,
      type: request.requestType
    });

    return newRequest;
  };

  // ✅ APPROVA RICHIESTA RECUPERO
  const approveRecoveryRequest = (requestId: string, approvedBy: string, scheduledDate?: Date) => {
    setRecoveryRequests(prev => prev.map(req => 
      req.id === requestId 
        ? { 
            ...req, 
            status: 'approved', 
            approvedBy, 
            approvedAt: new Date(),
            scheduledDate: scheduledDate || req.scheduledDate,
            updatedAt: new Date()
          }
        : req
    ));

    console.log('✅ Richiesta recupero approvata:', requestId);
  };

  // 🚫 RIFIUTA RICHIESTA RECUPERO
  const rejectRecoveryRequest = (requestId: string, reason?: string) => {
    setRecoveryRequests(prev => prev.map(req => 
      req.id === requestId 
        ? { 
            ...req, 
            status: 'rejected', 
            notes: reason,
            updatedAt: new Date()
          }
        : req
    ));

    console.log('❌ Richiesta recupero rifiutata:', requestId, reason);
  };

  // 💰 UTILIZZA RECUPERO ORE
  const useRecoveryHours = (requestId: string, actualUsedHours: number) => {
    const request = recoveryRequests.find(req => req.id === requestId);
    if (!request || request.status !== 'approved') {
      throw new Error('Richiesta non trovata o non approvata');
    }

    // Aggiorna richiesta
    setRecoveryRequests(prev => prev.map(req => 
      req.id === requestId 
        ? { 
            ...req, 
            status: 'used', 
            actualUsedHours,
            usedAt: new Date(),
            updatedAt: new Date()
          }
        : req
    ));

    // Aggiorna account
    setHourBankAccounts(prev => prev.map(acc => 
      acc.employeeId === request.employeeId 
        ? {
            ...acc,
            currentBalance: Number((acc.currentBalance - actualUsedHours).toFixed(1)),
            totalRecovered: Number((acc.totalRecovered + actualUsedHours).toFixed(1)),
            updatedAt: new Date()
          }
        : acc
    ));

    console.log('💰 Ore recupero utilizzate:', {
      request: requestId,
      hours: actualUsedHours,
      employee: request.employeeId
    });
  };

  // 📊 STATISTICHE GENERALI
  const getHourBankStatistics = (): HourBankStatistics => {
    const accountsWithCredit = hourBankAccounts.filter(acc => acc.currentBalance > 0);
    const accountsWithDebt = hourBankAccounts.filter(acc => acc.currentBalance < 0);
    const pendingRecoveries = recoveryRequests.filter(req => req.status === 'pending');
    
    return {
      totalAccounts: hourBankAccounts.length,
      accountsWithCredit: accountsWithCredit.length,
      accountsWithDebt: accountsWithDebt.length,
      largestCredit: accountsWithCredit.length > 0 ? Math.max(...accountsWithCredit.map(acc => acc.currentBalance)) : 0,
      largestDebt: accountsWithDebt.length > 0 ? Math.max(...accountsWithDebt.map(acc => Math.abs(acc.currentBalance))) : 0,
      averageBalance: hourBankAccounts.length > 0 ? 
        Number((hourBankAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0) / hourBankAccounts.length).toFixed(1)) : 0,
      totalPendingRecoveries: pendingRecoveries.length,
      pendingRecoveryHours: Number(pendingRecoveries.reduce((sum, req) => sum + req.requestedHours, 0).toFixed(1)),
      lastCalculationRun: lastCalculation || new Date(0),
      calculationDuration: 0 // Verrà aggiornato durante il calcolo
    };
  };

  // 🧹 PULIZIA DATI OBSOLETI
  const cleanupOldData = (olderThanDays: number = 365) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const filteredEntries = hourBankEntries.filter(entry => entry.weekStartDate >= cutoffDate);
    const filteredRequests = recoveryRequests.filter(req => req.createdAt >= cutoffDate);

    setHourBankEntries(filteredEntries);
    setRecoveryRequests(filteredRequests);

    console.log('🧹 Pulizia dati completata:', {
      entriesRemoved: hourBankEntries.length - filteredEntries.length,
      requestsRemoved: recoveryRequests.length - filteredRequests.length
    });
  };

  // 🔄 RICALCOLO COMPLETO
  const recalculateAllAccounts = async (employees: Employee[], stores: Store[], shifts: Shift[]) => {
    console.log('🔄 Avvio ricalcolo completo banca ore...');
    
    // Reset tutti gli account
    setHourBankAccounts([]);
    setHourBankEntries([]);
    
    // Ricalcola tutto
    return await calculateHourBank(employees, stores, shifts, {
      includeLockedShifts: true,
      includeCompletedShifts: true,
      recalculateFromStart: true
    });
  };

  // 🗑️ RESET CALCOLI PER NEGOZIO SPECIFICO
  const resetStoreHourBank = (storeId: string, storeName: string) => {
    console.log('🗑️ Avvio reset banca ore per negozio:', storeName, storeId);
    
    // Rimuovi tutti gli account del negozio
    const filteredAccounts = hourBankAccounts.filter(acc => acc.storeId !== storeId);
    const removedAccounts = hourBankAccounts.length - filteredAccounts.length;
    
    // Rimuovi tutte le entries del negozio
    const filteredEntries = hourBankEntries.filter(entry => entry.storeId !== storeId);
    const removedEntries = hourBankEntries.length - filteredEntries.length;
    
    // Rimuovi tutte le richieste di recupero per dipendenti del negozio
    const storeEmployeeIds = hourBankAccounts
      .filter(acc => acc.storeId === storeId)
      .map(acc => acc.employeeId);
    
    const filteredRequests = recoveryRequests.filter(req => !storeEmployeeIds.includes(req.employeeId));
    const removedRequests = recoveryRequests.length - filteredRequests.length;
    
    // Aggiorna stato
    setHourBankAccounts(filteredAccounts);
    setHourBankEntries(filteredEntries);
    setRecoveryRequests(filteredRequests);
    
    console.log('✅ Reset completato per negozio:', storeName, {
      accountRimossi: removedAccounts,
      entriesRimosse: removedEntries,
      richiesteRimosse: removedRequests
    });
    
    return {
      success: true,
      storeName,
      removedAccounts,
      removedEntries,
      removedRequests
    };
  };

  // 🗑️ RESET COMPLETO TUTTI I DATI
  const resetAllHourBankData = () => {
    console.log('🗑️ Reset completo di tutti i dati banca ore...');
    
    const totalAccounts = hourBankAccounts.length;
    const totalEntries = hourBankEntries.length;
    const totalRequests = recoveryRequests.length;
    
    setHourBankAccounts([]);
    setHourBankEntries([]);
    setRecoveryRequests([]);
    setLastCalculation(null);
    setCalculationLog([]);
    
    console.log('✅ Reset completo terminato:', {
      accountRimossi: totalAccounts,
      entriesRimosse: totalEntries,
      richiesteRimosse: totalRequests
    });
    
    return {
      success: true,
      removedAccounts: totalAccounts,
      removedEntries: totalEntries,
      removedRequests: totalRequests
    };
  };
  // 📊 EXPORT DATI
  const exportHourBankData = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      statistics: getHourBankStatistics(),
      accounts: hourBankAccounts,
      entries: hourBankEntries.slice(-100), // Ultime 100 entries
      pendingRecoveries: recoveryRequests.filter(req => req.status === 'pending'),
      calculationLog: calculationLog
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Banca_Ore_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('📁 Export banca ore completato');
  };

  return {
    // Data
    hourBankAccounts,
    hourBankEntries,
    recoveryRequests,
    
    // State
    isCalculating,
    lastCalculation,
    calculationLog,
    
    // Core Functions
    calculateHourBank,
    recalculateAllAccounts,
    
    // Recovery Management
    createRecoveryRequest,
    approveRecoveryRequest,
    rejectRecoveryRequest,
    useRecoveryHours,
    
    // Reports and Analysis
    getStoreHourBankSummary,
    getEmployeeHourBankReport,
    getHourBankStatistics,
    
    // Utility
    cleanupOldData,
    exportHourBankData,
    
    // Reset Functions
    resetStoreHourBank,
    resetAllHourBankData
  };
};