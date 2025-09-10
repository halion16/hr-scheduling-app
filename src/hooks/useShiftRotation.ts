import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { 
  ShiftRotationRule, 
  ShiftType, 
  EmployeePreference, 
  ShiftAssignment, 
  SubstitutionRequest,
  NotificationSettings,
  RotationAlgorithmConfig,
  RotationStatistics
} from '../types/rotation';
import { ShiftRotationEngine } from '../utils/rotationAlgorithm';
import { Employee, Store, Shift } from '../types';

const defaultShiftTypes: ShiftType[] = [
  {
    id: 'morning-early',
    name: 'Mattina Presto',
    startTime: '07:00',
    endTime: '15:00',
    category: 'morning',
    difficulty: 2,
    requiredStaff: 1
  },
  {
    id: 'morning-standard',
    name: 'Mattina Standard',
    startTime: '09:00',
    endTime: '17:00',
    category: 'morning',
    difficulty: 1,
    requiredStaff: 1
  },
  {
    id: 'afternoon',
    name: 'Pomeriggio',
    startTime: '13:00',
    endTime: '21:00',
    category: 'afternoon',
    difficulty: 2,
    requiredStaff: 1
  },
  {
    id: 'evening',
    name: 'Serale',
    startTime: '17:00',
    endTime: '22:00',
    category: 'evening',
    difficulty: 3,
    requiredStaff: 1
  }
];

const defaultAlgorithmConfig: RotationAlgorithmConfig = {
  algorithm: 'hybrid',
  parameters: {
    equityWeight: 0.4,
    preferenceWeight: 0.3,
    restWeight: 0.2,
    experienceWeight: 0.1,
    lookAheadDays: 14,
    maxIterations: 1000
  },
  constraints: {
    minRestBetweenShifts: 12,
    maxConsecutiveShifts: 5,
    maxWeeklyHours: 48,
    minWeeklyHours: 20,
    requireWeekendRotation: true,
    dailyStaffRequirements: {}
  }
};

export const useShiftRotation = () => {
  const [rotationRules, setRotationRules] = useLocalStorage<ShiftRotationRule[]>('hr-rotation-rules', []);
  const [shiftTypes, setShiftTypes] = useLocalStorage<ShiftType[]>('hr-shift-types', defaultShiftTypes);
  const [employeePreferences, setEmployeePreferences] = useLocalStorage<EmployeePreference[]>('hr-employee-preferences', []);
  const [shiftAssignments, setShiftAssignments] = useLocalStorage<ShiftAssignment[]>('hr-shift-assignments', []);
  const [substitutionRequests, setSubstitutionRequests] = useLocalStorage<SubstitutionRequest[]>('hr-substitution-requests', []);
  const [notificationSettings, setNotificationSettings] = useLocalStorage<NotificationSettings[]>('hr-notification-settings', []);
  const [algorithmConfig, setAlgorithmConfig] = useLocalStorage<RotationAlgorithmConfig>('hr-algorithm-config', defaultAlgorithmConfig);

  const [rotationEngine, setRotationEngine] = useState<ShiftRotationEngine | null>(null);

  // 🆕 CALLBACK PER SINCRONIZZAZIONE CON GRIGLIA TURNI - MIGLIORATO
  const [syncCallback, setSyncCallback] = useState<((shifts: Shift[]) => void) | null>(null);
  
  // 🆕 CALLBACK PER PULIZIA PREVENTIVA
  const [cleanupCallback, setCleanupCallback] = useState<((startDate: Date, endDate: Date, storeId: string) => void) | null>(null);

  // Inizializza il motore di rotazione quando cambiano le configurazioni
  const initializeRotationEngine = (stores: Store[] = []) => {
    console.log('🔧 Inizializzazione motore di rotazione con', stores.length, 'negozi');
    const engine = new ShiftRotationEngine(
      algorithmConfig,
      rotationRules,
      employeePreferences,
      stores
    );
    setRotationEngine(engine);
    return engine;
  };

  useEffect(() => {
    initializeRotationEngine([]);
  }, [algorithmConfig, rotationRules, employeePreferences]);

  // 🆕 FUNZIONE PER REGISTRARE CALLBACK DI SINCRONIZZAZIONE - SEMPLIFICATA
  const registerSyncCallback = (callback: (shifts: Shift[]) => void) => {
    console.log('🔗 Registrazione callback di sincronizzazione');
    setSyncCallback(() => callback);
  };

  // 🆕 FUNZIONE PER REGISTRARE CALLBACK DI PULIZIA
  const registerCleanupCallback = (callback: (startDate: Date, endDate: Date, storeId: string) => void) => {
    console.log('🧹 Registrazione callback di pulizia preventiva');
    setCleanupCallback(() => callback);
  };

  // 🆕 FUNZIONE ROBUSTA PER CONVERTIRE ASSIGNMENTS IN SHIFTS
  const convertAssignmentsToShifts = (assignments: ShiftAssignment[], targetStoreId: string): Shift[] => {
    console.log('🔄 Conversione', assignments.length, 'assignments in shifts per store:', targetStoreId);
    
    return assignments.map((assignment, index) => {
      // Calcola ore effettive dal tipo di turno
      const startTime = assignment.shiftType.startTime;
      const endTime = assignment.shiftType.endTime;
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const workingMinutes = endMinutes - startMinutes - 30; // 30 min pausa default
      const actualHours = Math.max(0, workingMinutes / 60);

      const shift: Shift = {
        id: `rotation-shift-${assignment.id}-${index}`,
        employeeId: assignment.employeeId,
        storeId: targetStoreId, // Usa il storeId passato esplicitamente
        date: new Date(assignment.date),
        startTime: assignment.shiftType.startTime,
        endTime: assignment.shiftType.endTime,
        breakDuration: 30, // Default break
        actualHours,
        status: assignment.status === 'assigned' ? 'scheduled' : 
                assignment.status === 'confirmed' ? 'confirmed' : 'scheduled',
        isLocked: false,
        notes: `Generato da algoritmo rotazione v2.0 - ${assignment.shiftType.name}`,
        createdAt: assignment.assignedAt,
        updatedAt: assignment.assignedAt
      };

      console.log(`   ✅ Convertito assignment ${assignment.id} → shift ${shift.id} per ${shift.employeeId}`);
      return shift;
    });
  };

  // CRUD Operations for Rotation Rules
  const addRotationRule = (rule: Omit<ShiftRotationRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRule: ShiftRotationRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setRotationRules(prev => [...prev, newRule]);
    return newRule;
  };

  const updateRotationRule = (id: string, updates: Partial<ShiftRotationRule>) => {
    setRotationRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, ...updates, updatedAt: new Date() } : rule
    ));
  };

  const deleteRotationRule = (id: string) => {
    setRotationRules(prev => prev.filter(rule => rule.id !== id));
  };

  // CRUD Operations for Shift Types
  const addShiftType = (shiftType: Omit<ShiftType, 'id'>) => {
    const newShiftType: ShiftType = {
      ...shiftType,
      id: crypto.randomUUID()
    };
    setShiftTypes(prev => [...prev, newShiftType]);
    return newShiftType;
  };

  const updateShiftType = (id: string, updates: Partial<ShiftType>) => {
    setShiftTypes(prev => prev.map(type => 
      type.id === id ? { ...type, ...updates } : type
    ));
  };

  const deleteShiftType = (id: string) => {
    setShiftTypes(prev => prev.filter(type => type.id !== id));
  };

  // CRUD Operations for Employee Preferences
  const addEmployeePreference = (preference: Omit<EmployeePreference, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newPreference: EmployeePreference = {
      ...preference,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setEmployeePreferences(prev => [...prev, newPreference]);
    return newPreference;
  };

  const updateEmployeePreference = (id: string, updates: Partial<EmployeePreference>) => {
    setEmployeePreferences(prev => prev.map(pref => 
      pref.id === id ? { ...pref, ...updates, updatedAt: new Date() } : pref
    ));
  };

  const deleteEmployeePreference = (id: string) => {
    setEmployeePreferences(prev => prev.filter(pref => pref.id !== id));
  };

  const getEmployeePreference = (employeeId: string): EmployeePreference | undefined => {
    return employeePreferences.find(pref => pref.employeeId === employeeId);
  };

  // CRUD Operations for Shift Assignments
  const addShiftAssignment = (assignment: Omit<ShiftAssignment, 'id'>) => {
    const newAssignment: ShiftAssignment = {
      ...assignment,
      id: crypto.randomUUID()
    };
    setShiftAssignments(prev => [...prev, newAssignment]);
    return newAssignment;
  };

  const updateShiftAssignment = (id: string, updates: Partial<ShiftAssignment>) => {
    setShiftAssignments(prev => prev.map(assignment => 
      assignment.id === id ? { ...assignment, ...updates } : assignment
    ));
  };

  const deleteShiftAssignment = (id: string) => {
    setShiftAssignments(prev => prev.filter(assignment => assignment.id !== id));
  };

  // CRUD Operations for Substitution Requests
  const createSubstitutionRequest = (request: Omit<SubstitutionRequest, 'id'>) => {
    const newRequest: SubstitutionRequest = {
      ...request,
      id: crypto.randomUUID()
    };
    setSubstitutionRequests(prev => [...prev, newRequest]);
    return newRequest;
  };

  const updateSubstitutionRequest = (id: string, updates: Partial<SubstitutionRequest>) => {
    setSubstitutionRequests(prev => prev.map(request => 
      request.id === id ? { ...request, ...updates } : request
    ));
  };

  const approveSubstitutionRequest = (requestId: string, approvedBy: string) => {
    const request = substitutionRequests.find(r => r.id === requestId);
    if (!request) return;

    updateSubstitutionRequest(requestId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date()
    });

    if (request.proposedSubstitute) {
      const originalAssignment = shiftAssignments.find(a => a.id === request.originalAssignmentId);
      if (originalAssignment) {
        updateShiftAssignment(originalAssignment.id, {
          employeeId: request.proposedSubstitute,
          status: 'substituted'
        });
      }
    }
  };

  // Notification Settings
  const updateNotificationSettings = (employeeId: string, settings: Partial<NotificationSettings>) => {
    const existing = notificationSettings.find(s => s.employeeId === employeeId);
    
    if (existing) {
      setNotificationSettings(prev => prev.map(setting => 
        setting.employeeId === employeeId ? { ...setting, ...settings } : setting
      ));
    } else {
      const newSettings: NotificationSettings = {
        id: crypto.randomUUID(),
        employeeId,
        emailNotifications: true,
        smsNotifications: false,
        advanceNoticeHours: 24,
        notifyOnAssignment: true,
        notifyOnChanges: true,
        notifyOnSubstitutions: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...settings
      };
      setNotificationSettings(prev => [...prev, newSettings]);
    }
  };

  // 🔧 ALGORITMO PRINCIPALE DI GENERAZIONE - CON PULIZIA PREVENTIVA E SINCRONIZZAZIONE ROBUSTA
  const generateRotationSchedule = (
    employees: Employee[],
    startDate: Date,
    endDate: Date,
    stores: Store[] = [],
    storeId?: string
  ): ShiftAssignment[] => {
    console.log('🚀 AVVIO GENERAZIONE TURNI V2.0 CON PULIZIA PREVENTIVA');
    console.log('📅 Periodo:', startDate.toLocaleDateString(), '-', endDate.toLocaleDateString());
    console.log('👥 Dipendenti:', employees.length);
    console.log('🏪 Negozi:', stores.length);
    console.log('🎯 Negozio selezionato:', storeId || 'Tutti');

    try {
      // 🧹 STEP 1: PULIZIA PREVENTIVA DEI TURNI ESISTENTI
      if (cleanupCallback && storeId) {
        console.log('🧹 PULIZIA PREVENTIVA: Rimozione turni esistenti nel periodo...');
        cleanupCallback(startDate, endDate, storeId);
        console.log('✅ Pulizia preventiva completata');
      } else {
        console.warn('⚠️ Callback di pulizia non disponibile - i turni esistenti potrebbero causare duplicati');
      }

      // 1. Validazione input
      if (employees.length === 0) {
        console.error('❌ Nessun dipendente fornito');
        return [];
      }

      if (stores.length === 0) {
        console.error('❌ Nessun negozio fornito');
        return [];
      }

      if (shiftTypes.length === 0) {
        console.error('❌ Nessun tipo di turno configurato');
        return [];
      }

      // 2. Inizializza il motore con i negozi aggiornati
      const engine = initializeRotationEngine(stores);
      
      if (!engine) {
        console.error('❌ Motore di rotazione non inizializzato');
        return [];
      }

      // 3. Filtra dipendenti per negozio se specificato
      const targetEmployees = storeId 
        ? employees.filter(emp => emp.isActive && emp.storeId === storeId)
        : employees.filter(emp => emp.isActive);

      console.log('👤 Dipendenti target:', targetEmployees.length);

      if (targetEmployees.length === 0) {
        console.warn('⚠️ Nessun dipendente attivo trovato per il negozio selezionato');
        return [];
      }

      // 4. Verifica che il negozio selezionato abbia orari configurati
      if (storeId) {
        const selectedStore = stores.find(s => s.id === storeId);
        if (!selectedStore) {
          console.error('❌ Negozio selezionato non trovato');
          return [];
        }

        const hasOpeningHours = Object.values(selectedStore.openingHours).some(hours => hours);
        if (!hasOpeningHours) {
          console.error('❌ Negozio selezionato non ha orari di apertura configurati');
          return [];
        }

        console.log('🏪 Negozio selezionato:', selectedStore.name);
        console.log('🕐 Orari configurati:', Object.entries(selectedStore.openingHours)
          .filter(([_, hours]) => hours)
          .map(([day, hours]) => `${day}: ${hours!.open}-${hours!.close}`)
          .join(', ')
        );
      }

      // 5. Genera turni con il motore
      console.log('⚙️ Chiamata al motore di rotazione...');
      const newAssignments = engine.assignShifts(
        targetEmployees,
        shiftTypes,
        startDate,
        endDate,
        shiftAssignments,
        storeId
      );

      console.log('✅ Motore completato. Turni generati:', newAssignments.length);

      if (newAssignments.length === 0) {
        console.warn('⚠️ Nessun turno generato dal motore');
        console.warn('🔍 Possibili cause:');
        console.warn('   - Orari negozio non compatibili con tipi di turno');
        console.warn('   - Vincoli troppo restrittivi');
        console.warn('   - Dipendenti non disponibili');
        return [];
      }

      // 6. Rimuovi assegnazioni esistenti nel periodo per evitare duplicati
      console.log('🧹 Pulizia turni esistenti nel periodo...');
      setShiftAssignments(prev => {
        const filtered = prev.filter(assignment => {
          const isInPeriod = assignment.date >= startDate && assignment.date <= endDate;
          const isForTargetStore = storeId ? 
            targetEmployees.some(emp => emp.id === assignment.employeeId) :
            true;
          
          // Mantieni solo i turni FUORI dal periodo o per altri negozi
          return !(isInPeriod && isForTargetStore);
        });

        console.log('📊 Turni rimossi:', prev.length - filtered.length);
        console.log('📊 Turni mantenuti:', filtered.length);
        console.log('📊 Nuovi turni da aggiungere:', newAssignments.length);

        const finalAssignments = [...filtered, ...newAssignments];
        console.log('📊 Totale finale:', finalAssignments.length);

        return finalAssignments;
      });

      // 🆕 7. SINCRONIZZAZIONE IMMEDIATA CON GRIGLIA TURNI
      if (syncCallback && storeId) {
        console.log('🔄 SINCRONIZZAZIONE IMMEDIATA con griglia turni...');
        
        // Converti assignments in shifts per la griglia
        const newShifts = convertAssignmentsToShifts(newAssignments, storeId);
        
        console.log('📋 Convertiti', newShifts.length, 'assignments in shifts per la griglia');
        console.log('🎯 Store ID utilizzato:', storeId);
        
        // Chiama il callback per sincronizzare IMMEDIATAMENTE
        try {
          syncCallback(newShifts);
          console.log('✅ SINCRONIZZAZIONE COMPLETATA CON SUCCESSO!');
        } catch (error) {
          console.error('❌ Errore durante la sincronizzazione:', error);
        }
      } else {
        if (!syncCallback) {
          console.warn('⚠️ Callback di sincronizzazione non registrato');
        }
        if (!storeId) {
          console.warn('⚠️ Store ID non fornito per la sincronizzazione');
        }
      }

      // 8. Log di riepilogo
      console.log('🎉 GENERAZIONE COMPLETATA CON SUCCESSO!');
      console.log('📈 Statistiche generazione:');
      
      const assignmentsByDay = new Map<string, number>();
      newAssignments.forEach(assignment => {
        const dayKey = assignment.date.toDateString();
        assignmentsByDay.set(dayKey, (assignmentsByDay.get(dayKey) || 0) + 1);
      });

      assignmentsByDay.forEach((count, day) => {
        console.log(`   ${new Date(day).toLocaleDateString()}: ${count} turni`);
      });

      const assignmentsByEmployee = new Map<string, number>();
      newAssignments.forEach(assignment => {
        assignmentsByEmployee.set(assignment.employeeId, (assignmentsByEmployee.get(assignment.employeeId) || 0) + 1);
      });

      console.log('👥 Distribuzione per dipendente:');
      assignmentsByEmployee.forEach((count, employeeId) => {
        const employee = targetEmployees.find(emp => emp.id === employeeId);
        console.log(`   ${employee?.firstName} ${employee?.lastName}: ${count} turni`);
      });

      return newAssignments;

    } catch (error) {
      console.error('❌ ERRORE DURANTE LA GENERAZIONE:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      return [];
    }
  };

  // Statistics and Analytics
  const getRotationStatistics = (employeeId: string, startDate: Date, endDate: Date): RotationStatistics | null => {
    const employeeAssignments = shiftAssignments.filter(assignment =>
      assignment.employeeId === employeeId &&
      assignment.date >= startDate &&
      assignment.date <= endDate
    );

    if (employeeAssignments.length === 0) return null;

    const shiftTypeDistribution = {
      morning: employeeAssignments.filter(a => a.shiftType.category === 'morning').length,
      afternoon: employeeAssignments.filter(a => a.shiftType.category === 'afternoon').length,
      evening: employeeAssignments.filter(a => a.shiftType.category === 'evening').length,
      night: employeeAssignments.filter(a => a.shiftType.category === 'night').length
    };

    const totalHours = employeeAssignments.reduce((sum, assignment) => {
      const start = parseTime(assignment.shiftType.startTime);
      const end = parseTime(assignment.shiftType.endTime);
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);

    const averageRotationScore = employeeAssignments.reduce((sum, a) => sum + a.rotationScore, 0) / employeeAssignments.length;

    return {
      employeeId,
      period: { start: startDate, end: endDate },
      totalShifts: employeeAssignments.length,
      shiftTypeDistribution,
      totalHours,
      averageRestHours: calculateAverageRestHours(employeeAssignments),
      consecutiveDaysWorked: calculateMaxConsecutiveDays(employeeAssignments),
      rotationScore: Math.round(averageRotationScore),
      lastRotationDate: employeeAssignments.length > 0 ? 
        employeeAssignments.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date : 
        new Date(0)
    };
  };

  const getTeamRotationSummary = (startDate: Date, endDate: Date) => {
    const periodAssignments = shiftAssignments.filter(assignment =>
      assignment.date >= startDate && assignment.date <= endDate
    );

    const employeeStats = new Map<string, number>();
    const shiftTypeStats = new Map<string, number>();

    periodAssignments.forEach(assignment => {
      const currentCount = employeeStats.get(assignment.employeeId) || 0;
      employeeStats.set(assignment.employeeId, currentCount + 1);

      const currentShiftCount = shiftTypeStats.get(assignment.shiftType.id) || 0;
      shiftTypeStats.set(assignment.shiftType.id, currentShiftCount + 1);
    });

    const totalAssignments = periodAssignments.length;
    const averageAssignmentsPerEmployee = employeeStats.size > 0 ? 
      totalAssignments / employeeStats.size : 0;

    const equityScore = calculateTeamEquityScore(Array.from(employeeStats.values()));

    return {
      totalAssignments,
      uniqueEmployees: employeeStats.size,
      averageAssignmentsPerEmployee: Number(averageAssignmentsPerEmployee.toFixed(1)),
      equityScore,
      employeeDistribution: Object.fromEntries(employeeStats),
      shiftTypeDistribution: Object.fromEntries(shiftTypeStats),
      period: { start: startDate, end: endDate }
    };
  };

  // Utility functions
  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const calculateAverageRestHours = (assignments: ShiftAssignment[]): number => {
    if (assignments.length <= 1) return 24;

    const sortedAssignments = assignments.sort((a, b) => a.date.getTime() - b.date.getTime());
    let totalRestHours = 0;
    let restPeriods = 0;

    for (let i = 1; i < sortedAssignments.length; i++) {
      const prevEnd = parseTime(sortedAssignments[i-1].shiftType.endTime);
      const currentStart = parseTime(sortedAssignments[i].shiftType.startTime);
      
      const restHours = (currentStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60);
      if (restHours > 0) {
        totalRestHours += restHours;
        restPeriods++;
      }
    }

    return restPeriods > 0 ? totalRestHours / restPeriods : 24;
  };

  const calculateMaxConsecutiveDays = (assignments: ShiftAssignment[]): number => {
    if (assignments.length === 0) return 0;

    const sortedDates = assignments
      .map(a => a.date.toDateString())
      .filter((date, index, array) => array.indexOf(date) === index)
      .sort();

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i-1]);
      const currentDate = new Date(sortedDates[i]);
      const dayDifference = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDifference === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    return maxConsecutive;
  };

  const calculateTeamEquityScore = (assignmentCounts: number[]): number => {
    if (assignmentCounts.length === 0) return 100;

    const average = assignmentCounts.reduce((sum, count) => sum + count, 0) / assignmentCounts.length;
    const variance = assignmentCounts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / assignmentCounts.length;
    const standardDeviation = Math.sqrt(variance);

    const equityScore = Math.max(0, 100 - (standardDeviation * 10));
    return Math.round(equityScore);
  };

  return {
    // Data
    rotationRules,
    shiftTypes,
    employeePreferences,
    shiftAssignments,
    substitutionRequests,
    notificationSettings,
    algorithmConfig,

    // Rotation Rules
    addRotationRule,
    updateRotationRule,
    deleteRotationRule,

    // Shift Types
    addShiftType,
    updateShiftType,
    deleteShiftType,

    // Employee Preferences
    addEmployeePreference,
    updateEmployeePreference,
    deleteEmployeePreference,
    getEmployeePreference,

    // Shift Assignments
    addShiftAssignment,
    updateShiftAssignment,
    deleteShiftAssignment,

    // Substitution Requests
    createSubstitutionRequest,
    updateSubstitutionRequest,
    approveSubstitutionRequest,

    // Notifications
    updateNotificationSettings,

    // Algorithm Configuration
    setAlgorithmConfig,

    // Main Functions
    generateRotationSchedule,
    getRotationStatistics,
    getTeamRotationSummary,
    initializeRotationEngine,

    // 🆕 Sincronizzazione ROBUSTA
    registerSyncCallback,
    registerCleanupCallback,
    convertAssignmentsToShifts
  };
};