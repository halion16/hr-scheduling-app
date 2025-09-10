export interface ShiftRotationRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  ruleType: 'distribution' | 'rest' | 'preference' | 'constraint';
  parameters: {
    minRestHours?: number;
    maxConsecutiveShifts?: number;
    preferredShiftTypes?: ShiftType[];
    maxWeeklyHours?: number;
    minWeeklyHours?: number;
    rotationCycle?: number; // giorni
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftType {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  category: 'morning' | 'afternoon' | 'evening' | 'night';
  difficulty: number; // 1-5, per bilanciamento carico
  requiredStaff: number;
}

export interface EmployeePreference {
  id: string;
  employeeId: string;
  preferredShiftTypes: string[];
  unavailableDates: Date[];
  maxConsecutiveDays: number;
  preferredDaysOff: string[]; // giorni della settimana
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  date: Date;
  shiftType: ShiftType;
  status: 'assigned' | 'confirmed' | 'requested_change' | 'substituted';
  assignedBy: string;
  assignedAt: Date;
  confirmedAt?: Date;
  substitutionRequest?: SubstitutionRequest;
  rotationScore: number; // punteggio di equità
}

export interface SubstitutionRequest {
  id: string;
  originalAssignmentId: string;
  requestedBy: string;
  requestedAt: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  proposedSubstitute?: string;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export interface RotationStatistics {
  employeeId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalShifts: number;
  shiftTypeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  totalHours: number;
  averageRestHours: number;
  consecutiveDaysWorked: number;
  rotationScore: number; // 0-100, equità della distribuzione
  lastRotationDate: Date;
}

export interface NotificationSettings {
  id: string;
  employeeId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  advanceNoticeHours: number;
  notifyOnAssignment: boolean;
  notifyOnChanges: boolean;
  notifyOnSubstitutions: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RotationAlgorithmConfig {
  algorithm: 'round_robin' | 'weighted_fair' | 'preference_based' | 'hybrid';
  parameters: {
    equityWeight: number; // 0-1
    preferenceWeight: number; // 0-1
    restWeight: number; // 0-1
    experienceWeight: number; // 0-1
    lookAheadDays: number;
    maxIterations: number;
  };
  constraints: {
    minRestBetweenShifts: number; // ore
    maxConsecutiveShifts: number;
    maxWeeklyHours: number;
    minWeeklyHours: number;
    requireWeekendRotation: boolean;
    dailyStaffRequirements?: {
      [storeId: string]: {
        [dayOfWeek: string]: {
          minStaff: number;
          maxStaff: number;
        };
      };
    };
  };
}