export interface ShiftGridValidationResult {
  isValid: boolean;
  score: number; // 0-100, percentuale di validità
  summary: {
    totalDays: number;
    validDays: number;
    daysWithIssues: number;
    daysWithoutShifts: number;
    totalAnomalies: number;
    criticalIssues: number;
    warnings: number;
  };
  dailyResults: DailyValidationResult[];
  overallIssues: ValidationIssue[];
  workloadDistribution: WorkloadDistribution; // Nuova analisi distribuzione carico
}

export interface DailyValidationResult {
  date: Date;
  dayOfWeek: string;
  isStoreOpen: boolean;
  isValid: boolean;
  hasShifts: boolean;
  storeHours?: {
    open: string;
    close: string;
  };
  coverage: CoverageAnalysis;
  issues: ValidationIssue[];
  staffing: StaffingAnalysis;
}

export interface CoverageAnalysis {
  hasOpeningCoverage: boolean;
  hasClosingCoverage: boolean;
  hasContinuousCoverage: boolean;
  coverageGaps: TimeGap[];
  coveredMinutes: number;
  totalOperatingMinutes: number;
  coveragePercentage: number;
}

export interface StaffingAnalysis {
  hourlyStaffCount: HourlyStaffCount[];
  peakStaffCount: number;
  minimumStaffCount: number;
  averageStaffCount: number;
  understaffedPeriods: UnderstaffedPeriod[];
  recommendedMinimumStaff: number;
}

export interface TimeGap {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  severity: 'critical' | 'warning';
  description: string;
}

export interface HourlyStaffCount {
  hour: string; // "09:00"
  staffCount: number;
  activeShifts: string[]; // shift IDs
  activeEmployees: string[]; // employee IDs
  employeeShiftDetails: EmployeeShiftDetail[]; // detailed employee info
  isAdequate: boolean;
  recommendedMin: number;
}

export interface UnderstaffedPeriod {
  startTime: string;
  endTime: string;
  currentStaff: number;
  recommendedStaff: number;
  severity: 'critical' | 'warning';
}

export interface ValidationIssue {
  type: 'no_shifts' | 'no_opening_coverage' | 'no_closing_coverage' | 
        'coverage_gap' | 'understaffed' | 'overstaffed' | 'invalid_shift';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  description?: string;
  suggestedAction?: string;
  timeRange?: {
    start: string;
    end: string;
  };
  affectedShifts?: string[];
  date?: Date;
}

// Nuove interfacce per tracking dipendenti
export interface EmployeeShiftDetail {
  employeeId: string;
  employeeName: string;
  shiftId: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
}

export interface EmployeeWorkload {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  daysWorked: number;
  shifts: string[];
  dailyHours: { [date: string]: number };
  averageHoursPerDay: number;
}

export interface WorkloadDistribution {
  employees: EmployeeWorkload[];
  maxHours: number;
  minHours: number;
  averageHours: number;
  standardDeviation: number;
  isEquitable: boolean; // true se distribuzione è equa
  inequityScore: number; // 0-100, più alto = meno equo
}

// 🆕 CONFIGURAZIONI AMMINISTRATORE PER VALIDAZIONE
export interface ValidationAdminSettings {
  // Configurazioni base
  enabled: boolean;
  enableRealTimeValidation: boolean;
  
  // Requisiti staff
  dynamicStaffRequirements: {
    enabled: boolean;
    useHourlyRequirements: boolean;
    equityThreshold: number; // % soglia per distribuzione equa
    maxHoursVariation: number; // massima differenza ore tra dipendenti
  };
  
  // Copertura turni
  coverageSettings: {
    minimumStaffPerHour: number;
    minimumOverlapMinutes: number;
    allowSinglePersonCoverage: boolean;
    criticalGapThresholdMinutes: number; // soglia gap critico
  };
  
  // CCNL e compliance
  complianceSettings: {
    enforceRestPeriods: boolean;
    minimumRestHours: number;
    maxConsecutiveWorkDays: number;
    weeklyHourLimits: {
      enabled: boolean;
      maxWeeklyHours: number;
      overtimeThreshold: number;
    };
  };
  
  // Notifiche e soglie
  alertSettings: {
    scoreThreshold: number; // sotto questa soglia = allerta
    enableWorkloadAlerts: boolean;
    enableCoverageAlerts: boolean;
    enableComplianceAlerts: boolean;
  };
  
  // Personalizzazione per negozio
  storeSpecificSettings: {
    enabled: boolean;
    overrideGlobalSettings: boolean;
  };
}

export interface HourlyStaffRequirement {
  storeId: string;
  dayOfWeek: string; // "lunedì", "martedì", etc.
  timeSlots: TimeSlotRequirement[];
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlotRequirement {
  startTime: string; // "09:00"
  endTime: string;   // "13:00"
  minStaff: number;
  maxStaff: number;
  preferredStaff: number;
  requiredRoles?: string[];
  description?: string; // "Apertura", "Pranzo", "Sera", etc.
}