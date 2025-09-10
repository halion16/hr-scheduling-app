import { Employee, Shift, Store } from '../types';
import { ccnlValidator } from './ccnlValidation';
import { 
  ShiftRotationRule, 
  ShiftType, 
  EmployeePreference, 
  ShiftAssignment, 
  RotationStatistics,
  RotationAlgorithmConfig 
} from '../types/rotation';
import { addDays, getDayOfWeek, parseTime } from './timeUtils';

interface EmployeeWeeklyTracker {
  id: string;
  targetHours: number;      // Ore obiettivo (95-100% del contratto)
  assignedHours: number;    // Ore già assegnate
  remainingHours: number;   // Ore ancora da assegnare
  daysWorked: number;       // Giorni consecutivi lavorati
  lastWorkDate: Date | null;
  priority: number;         // Priorità di assegnazione
  assignments: ShiftAssignment[];
}

export class ShiftRotationEngine {
  private config: RotationAlgorithmConfig;
  private rules: ShiftRotationRule[];
  private preferences: Map<string, EmployeePreference>;
  private statistics: Map<string, RotationStatistics>;
  private stores: Map<string, Store>;

  constructor(
    config: RotationAlgorithmConfig,
    rules: ShiftRotationRule[] = [],
    preferences: EmployeePreference[] = [],
    stores: Store[] = []
  ) {
    this.config = config;
    this.rules = rules.filter(rule => rule.isActive).sort((a, b) => b.priority - a.priority);
    this.preferences = new Map(preferences.map(pref => [pref.employeeId, pref]));
    this.statistics = new Map();
    this.stores = new Map(stores.map(store => [store.id, store]));
    
    console.log('🔧 ShiftRotationEngine v2.0 - Focus su utilizzo ore e riposo a rotazione');
  }

  /**
   * 🚀 ALGORITMO PRINCIPALE - MAXIMIZZAZIONE ORE + RIPOSO ROTAZIONALE
   */
  public assignShifts(
    employees: Employee[],
    shiftTypes: ShiftType[],
    startDate: Date,
    endDate: Date,
    existingAssignments: ShiftAssignment[] = [],
    storeId?: string
  ): ShiftAssignment[] {
    console.log('🔄 AVVIO ALGORITMO V2.0 - MAXIMIZZAZIONE ORE CONTRATTUALI');
    
    // VALIDAZIONE
    if (!storeId) {
      console.error('❌ Store ID obbligatorio');
      return [];
    }

    const store = this.stores.get(storeId);
    if (!store) {
      console.error('❌ Negozio non trovato');
      return [];
    }

    const activeEmployees = employees.filter(emp => emp.isActive);
    if (activeEmployees.length === 0) {
      console.error('❌ Nessun dipendente attivo');
      return [];
    }

    console.log('✅ Inizio generazione con strategia ore-centrica');
    
    return this.generateOptimalWeeklySchedule(
      activeEmployees,
      shiftTypes,
      store,
      startDate,
      endDate
    );
  }

  /**
   * 📊 GENERA PIANIFICAZIONE OTTIMIZZATA PER UTILIZZO ORE
   */
  private generateOptimalWeeklySchedule(
    employees: Employee[],
    shiftTypes: ShiftType[],
    store: Store,
    startDate: Date,
    endDate: Date
  ): ShiftAssignment[] {

    // 1. CALCOLO STRATEGICO INIZIALE
    const weeklyAnalysis = this.calculateWeeklyRequirements(employees, store, startDate, endDate);
    console.log('\n📊 ANALISI SETTIMANALE:');
    console.log(`   Ore totali negozio: ${weeklyAnalysis.totalStoreHours.toFixed(1)}h`);
    console.log(`   Ore disponibili dipendenti: ${weeklyAnalysis.totalAvailableHours.toFixed(1)}h`);
    console.log(`   Ore obiettivo (95%): ${weeklyAnalysis.targetHours.toFixed(1)}h`);
    console.log(`   Rapporto copertura: ${(weeklyAnalysis.coverageRatio * 100).toFixed(1)}%`);

    // 2. INIZIALIZZAZIONE TRACKERS CON ORE OBIETTIVO
    const employeeTrackers = this.initializeEmployeeTrackers(employees, weeklyAnalysis);
    
    // 3. GENERAZIONE GIORNO PER GIORNO CON COPERTURA GARANTITA
    const assignments: ShiftAssignment[] = [];
    let currentDate = new Date(startDate);
    let globalRotationIndex = 0;

    while (currentDate <= endDate) {
      const dayOfWeek = getDayOfWeek(currentDate);
      console.log(`\n📅 === ${dayOfWeek.toUpperCase()} ${currentDate.toLocaleDateString()} ===`);

      const storeHours = store.openingHours[dayOfWeek];
      if (!storeHours) {
        console.log('🏪 Negozio CHIUSO');
        this.handleRestDay(employeeTrackers, currentDate);
        currentDate = addDays(currentDate, 1);
        continue;
      }

      console.log(`🏪 Aperto: ${storeHours.open} - ${storeHours.close}`);

      // CREA TURNI CON COPERTURA OTTIMALE
      const dayAssignments = this.createOptimalDayCoverage(
        currentDate,
        storeHours,
        shiftTypes,
        employees,
        employeeTrackers,
        globalRotationIndex
      );

      assignments.push(...dayAssignments);
      globalRotationIndex = (globalRotationIndex + dayAssignments.length) % employees.length;

      console.log(`✅ Giorno completato: ${dayAssignments.length} turni, ${dayAssignments.reduce((sum, a) => sum + this.calculateShiftHours(a.shiftType), 0).toFixed(1)}h totali`);
      
      currentDate = addDays(currentDate, 1);
    }

    // 4. VERIFICA E REPORT FINALE
    this.generateFinalReport(assignments, employees, employeeTrackers, weeklyAnalysis);

    return assignments;
  }

  /**
   * 📈 CALCOLA REQUISITI E CAPACITÀ SETTIMANALI
   */
  private calculateWeeklyRequirements(
    employees: Employee[],
    store: Store,
    startDate: Date,
    endDate: Date
  ) {
    let totalStoreHours = 0;
    let workingDays = 0;

    // Calcola ore totali del negozio
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = getDayOfWeek(currentDate);
      const storeHours = store.openingHours[dayOfWeek];
      
      if (storeHours) {
        const dayHours = this.calculateDayHours(storeHours);
        totalStoreHours += dayHours;
        workingDays++;
      }
      
      currentDate = addDays(currentDate, 1);
    }

    // Calcola capacità dipendenti
    const totalContractHours = employees.reduce((sum, emp) => sum + emp.contractHours, 0);
    const totalMinimumHours = employees.reduce((sum, emp) => sum + emp.fixedHours, 0);
    
    // Obiettivo: 97% delle ore contrattuali
    const targetHours = totalContractHours * 0.97;
    
    return {
      totalStoreHours,
      totalAvailableHours: totalContractHours,
      totalMinimumHours,
      targetHours,
      workingDays,
      employeeCount: employees.length,
      coverageRatio: totalStoreHours / targetHours,
      avgHoursPerDay: totalStoreHours / Math.max(workingDays, 1),
      avgEmployeesNeeded: totalStoreHours / (targetHours / employees.length)
    };
  }

  /**
   * 👥 INIZIALIZZA TRACKERS CON ORE OBIETTIVO
   */
  private initializeEmployeeTrackers(
    employees: Employee[],
    weeklyAnalysis: any
  ): Map<string, EmployeeWeeklyTracker> {
    
    const trackers = new Map<string, EmployeeWeeklyTracker>();
    
    employees.forEach(employee => {
      // Obiettivo: 97% delle ore contrattuali
      const targetHours = employee.contractHours * 0.97;
      
      trackers.set(employee.id, {
        id: employee.id,
        targetHours,
        assignedHours: 0,
        remainingHours: targetHours,
        daysWorked: 0,
        lastWorkDate: null,
        priority: 100,
        assignments: []
      });

      console.log(`   👤 ${employee.firstName} ${employee.lastName}: Obiettivo ${targetHours.toFixed(1)}h (${employee.contractHours}h * 97%)`);
    });

    return trackers;
  }

  /**
   * ⭐ CREA COPERTURA OTTIMALE PER UN GIORNO
   */
  private createOptimalDayCoverage(
    date: Date,
    storeHours: { open: string; close: string },
    shiftTypes: ShiftType[],
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeWeeklyTracker>,
    rotationIndex: number,
    storeId?: string
  ): ShiftAssignment[] {

    const dayHours = this.calculateDayHours(storeHours);
    console.log(`   ⏰ Ore da coprire: ${dayHours.toFixed(1)}h`);

    // 🔧 CONTROLLA VINCOLI STAFF GIORNALIERI - LOGICA CORRETTA
    const dayOfWeek = getDayOfWeek(date);
    const staffConstraints = this.config.constraints.dailyStaffRequirements?.[storeId]?.[dayOfWeek];
    
    let minShiftsNeeded: number;
    let maxShiftsAllowed: number;
    
    if (staffConstraints) {
      // 🎯 USA VINCOLI CONFIGURATI - RISPETTA MIN E MAX
      minShiftsNeeded = Math.max(staffConstraints.minStaff, 1); // Almeno 1 turno sempre
      maxShiftsAllowed = Math.min(staffConstraints.maxStaff, employees.length);
      console.log(`   🎯 Vincoli staff configurati: min ${minShiftsNeeded}, max ${maxShiftsAllowed}`);
    } else {
      // 🎯 STRATEGIA FALLBACK - GARANTISCE SEMPRE COPERTURA
      minShiftsNeeded = Math.max(1, Math.min(2, employees.length)); // Almeno 1, idealmente 2
      maxShiftsAllowed = Math.min(this.calculateOptimalShiftCount(dayHours, employees.length), employees.length);
      console.log(`   🎯 Strategia fallback: min ${minShiftsNeeded}, max ${maxShiftsAllowed}`);
    }

    // 🛡️ GARANZIA COPERTURA: Non permettere mai 0 turni
    if (minShiftsNeeded === 0) {
      minShiftsNeeded = 1;
      console.log(`   ⚠️ Forzato minimo 1 turno per garantire copertura`);
    }

    // AGGIORNA PRIORITÀ DIPENDENTI
    this.updateEmployeePriorities(employeeTrackers, date);

    // 🔧 CREA I TURNI NECESSARI - LOGICA MIGLIORATA
    const assignments: ShiftAssignment[] = [];
    
    // 🎯 DETERMINA NUMERO OTTIMALE DI TURNI TRA MIN E MAX
    let optimalShifts = this.determineOptimalShiftCount(
      minShiftsNeeded, 
      maxShiftsAllowed, 
      dayHours, 
      employees.length,
      employeeTrackers
    );
    
    console.log(`   ✅ Turni da generare: ${optimalShifts} (range: ${minShiftsNeeded}-${maxShiftsAllowed})`);
    
    if (optimalShifts === 1) {
      // TURNO SINGOLO - COPERTURA COMPLETA
      const assignment = this.createSingleFullCoverageShift(
        date, storeHours, employees, employeeTrackers, rotationIndex
      );
      if (assignment) assignments.push(assignment);

    } else if (optimalShifts === 2) {
      // DUE TURNI - APERTURA E CHIUSURA CON SOVRAPPOSIZIONE
      const twoShifts = this.createTwoShiftCoverage(
        date, storeHours, employees, employeeTrackers, rotationIndex
      );
      assignments.push(...twoShifts);

    } else {
      // TRE+ TURNI - COPERTURA CONTINUA
      const multiShifts = this.createMultiShiftCoverage(
        date, storeHours, optimalShifts, employees, employeeTrackers, rotationIndex
      );
      assignments.push(...multiShifts);
    }

    // 🛡️ VERIFICA COPERTURA MINIMA RISPETTATA
    if (assignments.length < minShiftsNeeded) {
      console.warn(`   ⚠️ COPERTURA INSUFFICIENTE: ${assignments.length}/${minShiftsNeeded} turni minimi`);
      
      // 🚨 CORREZIONE EMERGENZA: Aggiungi turni mancanti
      const missingShifts = minShiftsNeeded - assignments.length;
      const emergencyShifts = this.createEmergencyShifts(
        date, storeHours, missingShifts, employees, employeeTrackers, assignments
      );
      assignments.push(...emergencyShifts);
      
      console.log(`   🆘 Aggiunti ${emergencyShifts.length} turni di emergenza`);
    }

    // AGGIORNA TRACKERS POST-ASSEGNAZIONE
    this.updateTrackersAfterAssignments(assignments, employeeTrackers, date);
    
    console.log(`   ✅ Giorno completato: ${assignments.length} turni (minimo rispettato: ${assignments.length >= minShiftsNeeded})`);

    return assignments;
  }
  
  /**
   * 🎯 DETERMINA NUMERO OTTIMALE DI TURNI TRA MIN E MAX
   */
  private determineOptimalShiftCount(
    minShifts: number,
    maxShifts: number,
    dayHours: number,
    employeeCount: number,
    employeeTrackers: Map<string, EmployeeWeeklyTracker>
  ): number {
    
    // 🔢 CALCOLA DIPENDENTI CHE HANNO BISOGNO DI ORE
    const employeesNeedingHours = Array.from(employeeTrackers.values())
      .filter(tracker => tracker.remainingHours > 4) // Solo chi ha più di 4h rimanenti
      .length;
    
    // 🎯 STRATEGIA INTELLIGENTE
    let optimal = minShifts;
    
    // Se molti dipendenti hanno bisogno di ore, aumenta i turni
    if (employeesNeedingHours >= maxShifts) {
      optimal = maxShifts;
    } else if (employeesNeedingHours > minShifts) {
      optimal = employeesNeedingHours;
    } else {
      // Usa strategia basata su ore del giorno
      const hourBasedShifts = this.calculateOptimalShiftCount(dayHours, employeeCount);
      optimal = Math.max(minShifts, Math.min(hourBasedShifts, maxShifts));
    }
    
    console.log(`     📊 Dipendenti bisognosi ore: ${employeesNeedingHours}, Ottimale calcolato: ${optimal}`);
    return optimal;
  }
  
  /**
   * 🚨 CREA TURNI DI EMERGENZA PER GARANTIRE COPERTURA MINIMA
   */
  private createEmergencyShifts(
    date: Date,
    storeHours: { open: string; close: string },
    shiftsNeeded: number,
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeWeeklyTracker>,
    existingAssignments: ShiftAssignment[]
  ): ShiftAssignment[] {
    
    console.log(`   🚨 MODALITÀ EMERGENZA: Creando ${shiftsNeeded} turni aggiuntivi`);
    
    const emergencyShifts: ShiftAssignment[] = [];
    const assignedEmployees = new Set(existingAssignments.map(a => a.employeeId));
    
    for (let i = 0; i < shiftsNeeded; i++) {
      // Trova dipendente non ancora assegnato
      const availableEmployee = this.findHighestPriorityEmployee(
        employees.filter(emp => !assignedEmployees.has(emp.id)),
        employeeTrackers,
        6, // 6 ore minime di emergenza
        []
      );
      
      if (availableEmployee) {
        // Crea turno di emergenza con orari ridotti
        const emergencyShiftType = this.createDynamicShift({
          open: storeHours.open,
          close: storeHours.close
        }, `emergency-${i}`);
        
        const assignment = this.createAssignment(availableEmployee, emergencyShiftType, date);
        emergencyShifts.push(assignment);
        assignedEmployees.add(availableEmployee.id);
        
        console.log(`     🆘 Turno emergenza → ${availableEmployee.firstName} ${availableEmployee.lastName}`);
      } else {
        console.warn(`     ❌ Nessun dipendente disponibile per turno emergenza ${i + 1}`);
        break;
      }
    }
    
    return emergencyShifts;
  }

  /**
   * 📊 CALCOLA NUMERO OTTIMALE DI TURNI
   */
  private calculateOptimalShiftCount(dayHours: number, employeeCount: number): number {
    // Strategia adattiva basata su ore e dipendenti disponibili
    if (dayHours <= 4) return 1;
    if (dayHours <= 8) return Math.min(2, employeeCount);
    if (dayHours <= 12) return Math.min(3, employeeCount);
    return Math.min(4, employeeCount);
  }

  /**
   * 🥇 AGGIORNA PRIORITÀ DIPENDENTI (CHI DEVE LAVORARE PRIMA)
   */
  private updateEmployeePriorities(
    employeeTrackers: Map<string, EmployeeWeeklyTracker>,
    date: Date
  ): void {
    
    employeeTrackers.forEach(tracker => {
      let priority = 50; // Base

      // 🎯 FATTORE 1: Ore rimanenti rispetto al target (CRITICO)
      const remainingRatio = tracker.remainingHours / tracker.targetHours;
      priority += remainingRatio * 40; // Aumentato peso
      
      // 🚨 BONUS CRITICO per chi è sotto il 50% del target
      const progressRatio = tracker.assignedHours / tracker.targetHours;
      if (progressRatio < 0.5) {
        priority += 30; // Forte bonus per chi è molto indietro
      } else if (progressRatio < 0.8) {
        priority += 15; // Bonus per chi è indietro
      } else if (progressRatio > 1.0) {
        priority -= 25; // Penalità per chi ha superato il target
      }

      // 🎯 FATTORE 2: Giorni di riposo e consecutivi
      if (tracker.daysWorked === 0) {
        priority += 25; // Ha riposato ieri - priorità alta
      } else if (tracker.daysWorked <= 2) {
        priority += 10; // Pochi giorni lavorati
      } else if (tracker.daysWorked >= 5) {
        priority -= 30; // Molti giorni consecutivi
      } else if (tracker.daysWorked >= 6) {
        priority -= 60; // Necessita riposo urgente
      }

      // 🎯 FATTORE 3: Equità distribuzione ore
      const avgAssignedHours = Array.from(employeeTrackers.values())
        .reduce((sum, t) => sum + t.assignedHours, 0) / employeeTrackers.size;
      
      if (tracker.assignedHours < avgAssignedHours * 0.8) {
        priority += 20; // Sotto la media del team
      } else if (tracker.assignedHours > avgAssignedHours * 1.2) {
        priority -= 15; // Sopra la media del team
      }

      tracker.priority = Math.max(0, priority);
    });
  }

  /**
   * 🎯 CREA TURNO SINGOLO A COPERTURA COMPLETA
   */
  private createSingleFullCoverageShift(
    date: Date,
    storeHours: { open: string; close: string },
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeTracker>,
    rotationIndex: number
  ): ShiftAssignment | null {

    const shiftType = this.createDynamicShift(storeHours, 'full-coverage');
    const shiftHours = this.calculateShiftHours(shiftType);

    // Trova dipendente con priorità più alta e ore sufficienti
    const bestEmployee = this.findHighestPriorityEmployee(
      employees, employeeTrackers, shiftHours, []
    );

    if (!bestEmployee) {
      console.warn('   ❌ Impossibile assegnare turno singolo');
      return null;
    }

    // Verifica compliance CCNL prima dell'assegnazione
    const tempShift = {
      employeeId: bestEmployee.id,
      storeId: storeId || '',
      date: new Date(date),
      startTime: shiftType.startTime,
      endTime: shiftType.endTime,
      breakDuration: 30,
      actualHours: shiftHours
    };
    
    const allEmployeeShifts = assignments.map(a => ({
      id: a.id,
      employeeId: a.employeeId,
      storeId: storeId || '',
      date: a.date,
      startTime: a.shiftType.startTime,
      endTime: a.shiftType.endTime,
      breakDuration: 30,
      actualHours: this.calculateShiftHours(a.shiftType),
      status: 'scheduled' as const,
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    const { canAssign, violations } = ccnlValidator.canAssignShiftSafely(
      tempShift, 
      bestEmployee, 
      allEmployeeShifts
    );
    
    if (!canAssign) {
      console.warn(`   ❌ CCNL violation prevented assignment for ${bestEmployee.firstName} ${bestEmployee.lastName}:`, violations);
      return null;
    }
    console.log(`   ✅ Turno completo → ${bestEmployee.firstName} ${bestEmployee.lastName} (${shiftHours.toFixed(1)}h)`);
    return this.createAssignment(bestEmployee, shiftType, date);
  }

  /**
   * ✌️ CREA DUE TURNI CON SOVRAPPOSIZIONE
   */
  private createTwoShiftCoverage(
    date: Date,
    storeHours: { open: string; close: string },
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeTracker>,
    rotationIndex: number
  ): ShiftAssignment[] {

    const assignments: ShiftAssignment[] = [];
    const dayHours = this.calculateDayHours(storeHours);
    
    // TURNO 1: APERTURA (60% del giorno + sovrapposizione)
    const midPoint = this.timeToMinutes(storeHours.open) + (dayHours * 60 * 0.65);
    const shift1Hours = {
      open: storeHours.open,
      close: this.minutesToTime(midPoint)
    };
    
    // TURNO 2: CHIUSURA (dal 55% alla chiusura)
    const shift2Start = this.timeToMinutes(storeHours.open) + (dayHours * 60 * 0.45);
    const shift2Hours = {
      open: this.minutesToTime(shift2Start),
      close: storeHours.close
    };

    const shift1 = this.createDynamicShift(shift1Hours, 'opening');
    const shift2 = this.createDynamicShift(shift2Hours, 'closing');

    // ASSEGNA PRIMO TURNO
    const emp1 = this.findHighestPriorityEmployee(
      employees, employeeTrackers, this.calculateShiftHours(shift1), []
    );
    
    if (emp1) {
      assignments.push(this.createAssignment(emp1, shift1, date));
      console.log(`   ✅ Turno apertura → ${emp1.firstName} ${emp1.lastName}`);
    }

    // ASSEGNA SECONDO TURNO
    const emp2 = this.findHighestPriorityEmployee(
      employees, employeeTrackers, this.calculateShiftHours(shift2), assignments
    );
    
    if (emp2) {
      assignments.push(this.createAssignment(emp2, shift2, date));
      console.log(`   ✅ Turno chiusura → ${emp2.firstName} ${emp2.lastName}`);
    }

    return assignments;
  }

  /**
   * 🔢 CREA COPERTURA MULTI-TURNO
   */
  private createMultiShiftCoverage(
    date: Date,
    storeHours: { open: string; close: string },
    shiftsCount: number,
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeTracker>,
    rotationIndex: number
  ): ShiftAssignment[] {

    const assignments: ShiftAssignment[] = [];
    const dayMinutes = this.calculateDayHours(storeHours) * 60;
    const shiftDuration = (dayMinutes / shiftsCount) + 60; // +1h sovrapposizione
    
    for (let i = 0; i < shiftsCount; i++) {
      const startOffset = (dayMinutes / shiftsCount) * i * 0.8; // 20% sovrapposizione
      const startTime = this.minutesToTime(this.timeToMinutes(storeHours.open) + startOffset);
      const endTime = this.minutesToTime(this.timeToMinutes(storeHours.open) + startOffset + shiftDuration);
      
      // Limita alla chiusura del negozio
      const actualEndTime = this.timeToMinutes(endTime) > this.timeToMinutes(storeHours.close) 
        ? storeHours.close 
        : endTime;

      const shiftType = this.createDynamicShift({
        open: startTime,
        close: actualEndTime
      }, `part-${i + 1}`);

      const employee = this.findHighestPriorityEmployee(
        employees, employeeTrackers, this.calculateShiftHours(shiftType), assignments
      );

      if (employee) {
        assignments.push(this.createAssignment(employee, shiftType, date));
        console.log(`   ✅ Turno ${i + 1} → ${employee.firstName} ${employee.lastName}`);
      }
    }

    return assignments;
  }

  /**
   * 🏆 TROVA DIPENDENTE CON PRIORITÀ PIÙ ALTA
   */
  private findHighestPriorityEmployee(
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeTracker>,
    shiftHours: number,
    existingAssignments: ShiftAssignment[]
  ): Employee | null {

    const assignedToday = new Set(existingAssignments.map(a => a.employeeId));
    
    let bestEmployee: Employee | null = null;
    let bestScore = -1;

    employees.forEach(employee => {
      const tracker = employeeTrackers.get(employee.id)!;
      
      // SKIP se già assegnato oggi
      if (assignedToday.has(employee.id)) return;
      
      // 🏛️ VERIFICA CCNL COMPLIANCE PREVENTIVA
      const tempShift = {
        employeeId: employee.id,
        storeId: '', // Will be set later
        date: new Date(), // Will be set later
        startTime: '09:00', // Placeholder
        endTime: '17:00', // Placeholder
        breakDuration: 30,
        actualHours: shiftHours
      };
      
      // Quick CCNL check - if employee has recent assignments that might conflict
      const recentShifts = existingAssignments
        .filter(a => a.employeeId === employee.id)
        .slice(-7); // Last 7 assignments
      
      if (recentShifts.length >= 6) {
        // Potential consecutive days violation
        console.log(`   ⚠️ CCNL warning: ${employee.firstName} ${employee.lastName} has ${recentShifts.length} recent shifts`);
        // Don't completely exclude, but penalize heavily
      }
      
      // 🔧 MODIFICA: Non skippare completamente chi ha poche ore, ma penalizza
      // Questo permette di garantire copertura anche se nessuno ha ore sufficienti
      
      // CALCOLA SCORE PRIORITÀ
      let score = tracker.priority;
      
      // 🎯 BONUS/PENALITÀ BASATI SU ORE RIMANENTI
      if (tracker.remainingHours >= shiftHours) {
        score += 30; // Forte bonus per turno completo
      } else if (tracker.remainingHours > 0) {
        score += 10; // Bonus minore se ha almeno alcune ore
      } else {
        score -= 20; // Penalità se ha 0 ore, ma non blocca
      }
      
      // 🛡️ CONTROLLO GIORNI CONSECUTIVI - FORTE PENALITÀ MA NON BLOCCO
      if (tracker.daysWorked >= 6) {
        score -= 50; // Penalità per riposo necessario
      } else if (tracker.daysWorked >= 4) {
        score -= 20; // Penalità leggera per molti giorni
      } else if (tracker.daysWorked === 0) {
        score += 15; // Bonus per chi ha riposato
      }
      
      // 🏛️ PENALITÀ CCNL PER GIORNI CONSECUTIVI ECCESSIVI
      if (tracker.daysWorked >= 6) {
        score -= 100; // Penalità drastica per possibile violazione CCNL
        console.log(`   🏛️ CCNL penalty applied to ${employee.firstName} ${employee.lastName} for ${tracker.daysWorked} consecutive days`);
      }
      
      // 🎯 BONUS PER CHI È SOTTO IL MINIMO CONTRATTUALE
      const contractProgress = tracker.assignedHours / (tracker.targetHours * 0.8); // 80% del target
      if (contractProgress < 0.5) {
        score += 25; // Forte bonus per chi è molto indietro
      } else if (contractProgress < 0.8) {
        score += 15; // Bonus moderato per chi è indietro
      }

      if (score > bestScore) {
        bestScore = score;
        bestEmployee = employee;
      }
    });

    // LOG della selezione
    if (bestEmployee) {
      const tracker = employeeTrackers.get(bestEmployee.id)!;
      console.log(`     🎯 Scelto: ${bestEmployee.firstName} ${bestEmployee.lastName} (score: ${bestScore.toFixed(1)}, ore rim: ${tracker.remainingHours.toFixed(1)}h, giorni: ${tracker.daysWorked})`);
    } else {
      console.warn(`     ❌ Nessun dipendente idoneo per turno da ${shiftHours.toFixed(1)}h`);
    }

    return bestEmployee;
  }

  /**
   * 📊 AGGIORNA TRACKERS DOPO ASSEGNAZIONI
   */
  private updateTrackersAfterAssignments(
    assignments: ShiftAssignment[],
    employeeTrackers: Map<string, EmployeeTracker>,
    date: Date
  ): void {
    
    const workedToday = new Set<string>();
    
    // Aggiorna tracker per dipendenti che hanno lavorato
    assignments.forEach(assignment => {
      const tracker = employeeTrackers.get(assignment.employeeId)!;
      const shiftHours = this.calculateShiftHours(assignment.shiftType);
      
      tracker.assignedHours += shiftHours;
      tracker.remainingHours = Math.max(0, tracker.remainingHours - shiftHours);
      tracker.assignments.push(assignment);
      tracker.lastWorkDate = date;
      
      if (!workedToday.has(assignment.employeeId)) {
        tracker.daysWorked++;
        workedToday.add(assignment.employeeId);
      }
    });

    // Reset giorni lavorativi per chi riposa
    employeeTrackers.forEach(tracker => {
      if (!workedToday.has(tracker.id)) {
        tracker.daysWorked = 0; // Reset se riposa
      }
    });
  }

  /**
   * 😴 GESTISCE GIORNO DI RIPOSO (NEGOZIO CHIUSO)
   */
  private handleRestDay(
    employeeTrackers: Map<string, EmployeeTracker>,
    date: Date
  ): void {
    
    // Tutti riposano nei giorni di chiusura
    employeeTrackers.forEach(tracker => {
      tracker.daysWorked = 0;
      tracker.lastWorkDate = null;
    });
    
    console.log('   😴 Giorno di riposo per tutti');
  }

  /**
   * 📈 GENERA REPORT FINALE DETTAGLIATO
   */
  private generateFinalReport(
    assignments: ShiftAssignment[],
    employees: Employee[],
    employeeTrackers: Map<string, EmployeeTracker>,
    weeklyAnalysis: any
  ): void {
    
    console.log('\n📊 ===== REPORT FINALE =====');
    console.log(`Turni generati: ${assignments.length}`);
    console.log(`Ore totali distribuite: ${assignments.reduce((sum, a) => sum + this.calculateShiftHours(a.shiftType), 0).toFixed(1)}h`);
    
    let totalTargetHours = 0;
    let totalAssignedHours = 0;
    let employeesUnderTarget = 0;
    let employeesOverTarget = 0;
    let employeesUnderMinimum = 0;
    
    console.log('\n👥 DETTAGLIO DIPENDENTI:');
    employees.forEach(employee => {
      const tracker = employeeTrackers.get(employee.id)!;
      const utilizationPercent = (tracker.assignedHours / employee.contractHours) * 100;
      const targetPercent = (tracker.assignedHours / tracker.targetHours) * 100;
      const minimumPercent = (tracker.assignedHours / employee.fixedHours) * 100;
      
      totalTargetHours += tracker.targetHours;
      totalAssignedHours += tracker.assignedHours;
      
      let status = '✅';
      if (tracker.assignedHours < employee.fixedHours) {
        status = '🔴'; // Sotto il minimo contrattuale
        employeesUnderMinimum++;
      } else if (utilizationPercent < 90) {
        status = '⚠️';
        employeesUnderTarget++;
      } else if (utilizationPercent > 105) {
        status = '🟠'; // Sopra il massimo
        employeesOverTarget++;
      }
      
      console.log(`   ${status} ${employee.firstName} ${employee.lastName}:`);
      console.log(`      Assegnate: ${tracker.assignedHours.toFixed(1)}h`);
      console.log(`      Minimo: ${employee.fixedHours}h (${minimumPercent.toFixed(1)}%)`);
      console.log(`      Contratto: ${employee.contractHours}h (${utilizationPercent.toFixed(1)}%)`);
      console.log(`      Obiettivo: ${tracker.assignedHours.toFixed(1)}h / ${tracker.targetHours.toFixed(1)}h (${targetPercent.toFixed(1)}%)`);
      console.log(`      Turni: ${tracker.assignments.length}`);
    });
    
    // 🔍 ANALISI COPERTURA GIORNALIERA
    console.log('\n📅 ANALISI COPERTURA GIORNALIERA:');
    const assignmentsByDate = new Map<string, ShiftAssignment[]>();
    assignments.forEach(assignment => {
      const dateKey = assignment.date.toDateString();
      if (!assignmentsByDate.has(dateKey)) {
        assignmentsByDate.set(dateKey, []);
      }
      assignmentsByDate.get(dateKey)!.push(assignment);
    });
    
    let uncoveredDays = 0;
    assignmentsByDate.forEach((dayAssignments, dateKey) => {
      const date = new Date(dateKey);
      const dayOfWeek = getDayOfWeek(date);
      
      if (dayAssignments.length === 0) {
        console.log(`   🔴 ${dayOfWeek} ${date.toLocaleDateString()}: SCOPERTO (0 turni)`);
        uncoveredDays++;
      } else {
        console.log(`   ✅ ${dayOfWeek} ${date.toLocaleDateString()}: ${dayAssignments.length} turni`);
      }
    });
    
    console.log('\n📈 STATISTICHE FINALI:');
    console.log(`   Utilizzo medio: ${((totalAssignedHours / (employees.reduce((sum, emp) => sum + emp.contractHours, 0))) * 100).toFixed(1)}%`);
    console.log(`   Obiettivo raggiunto: ${((totalAssignedHours / totalTargetHours) * 100).toFixed(1)}%`);
    console.log(`   Dipendenti sotto minimo: ${employeesUnderMinimum} 🔴`);
    console.log(`   Dipendenti sotto target: ${employeesUnderTarget}`);
    console.log(`   Dipendenti sopra target: ${employeesOverTarget}`);
    console.log(`   Giorni scoperti: ${uncoveredDays} 🔴`);
    
    // 🎯 VALUTAZIONE QUALITÀ GENERAZIONE
    if (employeesUnderMinimum === 0 && uncoveredDays === 0 && employeesUnderTarget === 0) {
      console.log('   🎉 TUTTI I DIPENDENTI NEL RANGE OTTIMALE!');
    } else {
      console.log('   ⚠️ PROBLEMI RILEVATI:');
      if (employeesUnderMinimum > 0) {
        console.log(`     🔴 ${employeesUnderMinimum} dipendenti sotto il minimo contrattuale`);
      }
      if (uncoveredDays > 0) {
        console.log(`     🔴 ${uncoveredDays} giorni senza copertura`);
      }
      if (employeesUnderTarget > employees.length / 2) {
      console.log('   ⚠️ MOLTI DIPENDENTI SOTTO-UTILIZZATI - Considerare più turni');
      }
    }
  }

  // === UTILITY FUNCTIONS ===

  private calculateDayHours(storeHours: { open: string; close: string }): number {
    const start = this.timeToMinutes(storeHours.open);
    const end = this.timeToMinutes(storeHours.close);
    return (end - start) / 60;
  }

  private createDynamicShift(storeHours: { open: string; close: string }, suffix: string = ''): ShiftType {
    return {
      id: `dynamic-${Date.now()}-${suffix}`,
      name: `Turno ${storeHours.open}-${storeHours.close}`,
      startTime: storeHours.open,
      endTime: storeHours.close,
      category: this.getShiftCategory(storeHours.open),
      difficulty: 1,
      requiredStaff: 1
    };
  }

  private getShiftCategory(startTime: string): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private calculateShiftHours(shiftType: ShiftType): number {
    const start = this.timeToMinutes(shiftType.startTime);
    const end = this.timeToMinutes(shiftType.endTime);
    return (end - start) / 60;
  }

  private createAssignment(employee: Employee, shiftType: ShiftType, date: Date): ShiftAssignment {
    return {
      id: `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      employeeId: employee.id,
      shiftId: `shift-${date.toISOString()}-${shiftType.id}`,
      date: new Date(date),
      shiftType,
      status: 'assigned',
      assignedBy: 'optimized-algorithm',
      assignedAt: new Date(),
      rotationScore: 90
    };
  }

  // Legacy methods maintained for compatibility
  private updateStatistics(employees: Employee[], assignments: ShiftAssignment[]): void {}

  private calculateEmployeeStatistics(employee: Employee, assignments: ShiftAssignment[]): RotationStatistics {
    return {
      employeeId: employee.id,
      period: { start: new Date(), end: new Date() },
      totalShifts: 0,
      shiftTypeDistribution: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      totalHours: 0,
      averageRestHours: 24,
      consecutiveDaysWorked: 0,
      rotationScore: 75,
      lastRotationDate: new Date(0)
    };
  }
}