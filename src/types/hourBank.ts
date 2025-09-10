export interface HourBankAccount {
  id: string;
  employeeId: string;
  storeId: string;
  currentBalance: number; // Ore in banca (positive = credito, negative = debito)
  totalAccumulated: number; // Ore totali accumulate nel tempo
  totalRecovered: number; // Ore totali recuperate
  lastCalculationDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface HourBankEntry {
  id: string;
  employeeId: string;
  storeId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  contractHours: number; // Ore previste dal contratto per quella settimana
  actualHours: number; // Ore effettivamente lavorate
  difference: number; // Differenza (positive = eccesso, negative = deficit)
  type: 'excess' | 'deficit';
  description: string;
  isProcessed: boolean; // Se è stato processato in banca ore
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HourRecoveryRequest {
  id: string;
  employeeId: string;
  requestedHours: number;
  requestDate: Date;
  requestedBy: string;
  reason: string;
  requestType: 'time_off' | 'shorter_week' | 'early_leave' | 'late_arrival';
  status: 'pending' | 'approved' | 'rejected' | 'used';
  approvedBy?: string;
  approvedAt?: Date;
  scheduledDate?: Date; // Quando verrà utilizzato il recupero
  actualUsedHours?: number;
  usedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HourBankSummary {
  storeId: string;
  storeName: string;
  totalEmployees: number;
  employeesWithCredit: number;
  employeesWithDebt: number;
  totalCredit: number;
  totalDebt: number;
  netBalance: number;
  pendingRecoveries: number;
  averageBalance: number;
  lastUpdated: Date;
}

export interface EmployeeHourBankReport {
  employee: {
    id: string;
    name: string;
    contractHours: number;
  };
  account: HourBankAccount;
  recentEntries: HourBankEntry[];
  pendingRecoveries: HourRecoveryRequest[];
  weeklyBreakdown: {
    weekStart: Date;
    contractHours: number;
    actualHours: number;
    difference: number;
    isProcessed: boolean;
  }[];
  projectedBalance: number; // Bilancio proiettato includendo pending
  recommendations: string[];
}

export interface HourBankCalculationOptions {
  includeLockedShifts: boolean;
  includeCompletedShifts: boolean;
  startDate?: Date;
  endDate?: Date;
  recalculateFromStart: boolean;
}

export interface HourBankStatistics {
  totalAccounts: number;
  accountsWithCredit: number;
  accountsWithDebt: number;
  largestCredit: number;
  largestDebt: number;
  averageBalance: number;
  totalPendingRecoveries: number;
  pendingRecoveryHours: number;
  lastCalculationRun: Date;
  calculationDuration: number; // milliseconds
}