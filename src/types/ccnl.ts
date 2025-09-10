// CCNL del commercio compliance types
export interface CCNLRestPeriodRule {
  id: string;
  name: string;
  description: string;
  articleReference: string; // Reference to specific CCNL article
  type: 'daily_rest' | 'weekly_rest' | 'consecutive_days' | 'shift_gap';
  minimumHours: number;
  maximumConsecutiveDays?: number;
  exceptions?: string[];
  isActive: boolean;
  severity: 'critical' | 'warning';
}

export interface CCNLViolation {
  id: string;
  type: CCNLRestPeriodRule['type'];
  employeeId: string;
  shiftIds: string[];
  violationDate: Date;
  description: string;
  articleReference: string;
  severity: 'critical' | 'warning';
  suggestedResolution: string;
  currentValue: number;
  requiredValue: number;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface CCNLComplianceReport {
  employeeId: string;
  weekStart: Date;
  weekEnd: Date;
  violations: CCNLViolation[];
  dailyRestCompliance: {
    date: Date;
    hasMinimumRest: boolean;
    restHours: number;
    requiredHours: number;
  }[];
  weeklyRestCompliance: {
    hasWeeklyRest: boolean;
    weeklyRestHours: number;
    requiredWeeklyRest: number;
  };
  consecutiveDaysWorked: number;
  maxAllowedConsecutiveDays: number;
  complianceScore: number; // 0-100
  overallStatus: 'compliant' | 'minor_violations' | 'major_violations';
}

// CCNL del commercio standard rules
export const CCNL_STANDARD_RULES: CCNLRestPeriodRule[] = [
  {
    id: 'daily-rest-11h',
    name: 'Riposo Giornaliero Minimo',
    description: 'Riposo continuativo di almeno 11 ore nelle 24 ore',
    articleReference: 'Art. 15 CCNL Commercio',
    type: 'daily_rest',
    minimumHours: 11,
    isActive: true,
    severity: 'critical'
  },
  {
    id: 'weekly-rest-35h',
    name: 'Riposo Settimanale Minimo',
    description: 'Riposo settimanale continuativo di almeno 35 ore',
    articleReference: 'Art. 16 CCNL Commercio',
    type: 'weekly_rest',
    minimumHours: 35,
    isActive: true,
    severity: 'critical'
  },
  {
    id: 'max-consecutive-6days',
    name: 'Massimo Giorni Consecutivi',
    description: 'Non più di 6 giorni lavorativi consecutivi',
    articleReference: 'Art. 16 CCNL Commercio',
    type: 'consecutive_days',
    minimumHours: 0,
    maximumConsecutiveDays: 6,
    isActive: true,
    severity: 'critical'
  },
  {
    id: 'shift-gap-minimum',
    name: 'Intervallo Minimo tra Turni',
    description: 'Almeno 11 ore tra la fine di un turno e l\'inizio del successivo',
    articleReference: 'Art. 15 CCNL Commercio',
    type: 'shift_gap',
    minimumHours: 11,
    isActive: true,
    severity: 'critical'
  }
];