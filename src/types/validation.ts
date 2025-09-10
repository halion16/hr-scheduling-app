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