export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  contractHours: number;
  fixedHours: number;
  isActive: boolean;
  storeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: string;
  name: string;
  openingHours: {
    [key: string]: {
      open: string;
      close: string;
    };
  };
  weeklySchedules?: WeeklyStoreSchedule[];
  closureDays?: ClosureDay[];
  isActive: boolean;
  staffRequirements?: StaffRequirement[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyStoreSchedule {
  id: string;
  storeId: string;
  weekStartDate: Date; // Lunedì della settimana
  weekEndDate: Date;   // Domenica della settimana
  openingHours: {
    [key: string]: {
      open: string;
      close: string;
    };
  };
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClosureDay {
  id: string;
  storeId: string;
  date: Date;
  reason: string;
  notes?: string;
  isFullDay: boolean;
  customHours?: {
    open: string;
    close: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Shift {
  id: string;
  employeeId: string;
  storeId: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakDuration: number; // in minutes
  actualHours: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  isLocked: boolean; // Nuovo campo per la convalida
  lockedAt?: Date; // Quando è stato bloccato
  lockedBy?: string; // Chi l'ha bloccato
  validationStatus?: ShiftValidationStatus; // Nuovo campo per workflow
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftConflict {
  type: 'outside_hours' | 'overlap' | 'insufficient_break';
  message: string;
  severity: 'error' | 'warning';
}

export interface WeeklySchedule {
  weekStart: Date;
  shifts: Shift[];
  employees: Employee[];
  store: Store;
}

export interface Preferences {
  defaultBreakDuration: number; // in minutes
  language: 'it' | 'en';
  theme: 'light' | 'dark';
  dateFormat: 'dd/mm/yyyy' | 'mm/dd/yyyy';
  userRole: 'admin' | 'manager' | 'user'; // Nuovo campo per i ruoli
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  description?: string;
  category: 'apertura' | 'mediano' | 'chiusura' | 'custom';
  usageCount: number;
  createdAt: Date;
}

export interface CopiedShift {
  startTime: string;
  endTime: string;
  breakDuration: number;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  duration: number;
  isLocked: boolean;
  status: Shift['status'];
  color: string;
}

// Nuovi tipi per la pianificazione ponderata del personale
export interface StaffRole {
  id: string;
  name: string;
  description?: string;
  priority: number; // 1 = alta priorità
}

export interface StaffRequirement {
  id: string;
  storeId: string;
  dayOfWeek: string; // 'lunedì', 'martedì', etc.
  roles: {
    roleId: string;
    minStaff: number;
    maxStaff: number;
    peakHours?: {
      startTime: string;
      endTime: string;
      additionalStaff: number;
    }[];
  }[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeightingEvent {
  id: string;
  name: string;
  description?: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  multiplier: number; // 0.5 - 2.0
  daysOfWeek?: string[]; // Se null, si applica a tutti i giorni nel range
  storeIds?: string[]; // Se null, si applica a tutti i negozi
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EventCategory = 
  | 'holiday' 
  | 'local_event' 
  | 'promotion' 
  | 'weather' 
  | 'delivery';

export interface EmployeeUnavailability {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: 'holiday' | 'sick' | 'personal' | 'training' | 'other';
  reason?: string;
  notes?: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalculatedStaffNeed {
  storeId: string;
  date: Date;
  dayOfWeek: string;
  baseRequirement: StaffRequirement;
  appliedEvents: WeightingEvent[];
  finalMultiplier: number;
  calculatedStaff: {
    roleId: string;
    baseMin: number;
    baseMax: number;
    weightedMin: number;
    weightedMax: number;
  }[];
}

// 🔍 VALIDATION SYSTEM TYPES
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface ValidationRule {
  name: string;
  category: 'critical' | 'warning' | 'info';
  weight: number; // Impact on score
  validator: (shift: Shift, context: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  employees: Employee[];
  stores: Store[];
  allShifts: Shift[];
  selectedDate?: Date;
  bulkOperation?: boolean;
}

// 🔄 WORKFLOW TYPES
export type ShiftValidationStatus = 
  | 'draft'              // Bozza, modificabile
  | 'ready_review'       // Pronto per revisione
  | 'under_review'       // In fase di revisione
  | 'validated'          // Validato, non modificabile
  | 'published'          // Pubblicato ai dipendenti
  | 'locked_final';      // Bloccato definitivamente

// 🗃️ AUDIT TRAIL TYPES
export interface LockAuditEntry {
  id: string;
  shiftId: string;
  employeeId: string;
  employeeName: string;
  storeId: string;
  operation: 'lock' | 'unlock' | 'bulk_lock' | 'bulk_unlock' | 'validation_failed';
  timestamp: Date;
  user: string;
  reason?: string;
  previousState?: {
    isLocked: boolean;
    actualHours: number;
  };
  newState?: {
    isLocked: boolean;
    actualHours: number;
  };
  validationResult?: {
    isValid: boolean;
    score: number;
    errors: string[];
    warnings: string[];
  };
  metadata?: {
    bulkOperationId?: string;
    totalAffectedShifts?: number;
    ipAddress?: string;
    userAgent?: string;
  };
}