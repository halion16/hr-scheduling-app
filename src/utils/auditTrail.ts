import { Shift, Employee } from '../types';

/**
 * 🗃️ STEP 2: AUDIT TRAIL SYSTEM
 * 
 * Sistema completo di tracciamento operazioni per compliance
 * e monitoraggio delle modifiche ai turni.
 */

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

export interface AuditStatistics {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByUser: Record<string, number>;
  operationsByDate: Record<string, number>;
  successRate: number;
  avgValidationScore: number;
  recentActivity: LockAuditEntry[];
}

// 💾 LOCAL STORAGE KEYS
const AUDIT_STORAGE_KEY = 'hr_shift_audit_trail';
const AUDIT_SETTINGS_KEY = 'hr_shift_audit_settings';

interface AuditSettings {
  maxEntries: number;
  retentionDays: number;
  enableDetailedLogging: boolean;
}

const DEFAULT_SETTINGS: AuditSettings = {
  maxEntries: 1000,
  retentionDays: 90,
  enableDetailedLogging: true
};

// 🔧 AUDIT TRAIL MANAGER
class AuditTrailManager {
  private settings: AuditSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): AuditSettings {
    try {
      const stored = localStorage.getItem(AUDIT_SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch (error) {
      console.warn('Failed to load audit settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(AUDIT_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save audit settings:', error);
    }
  }

  private loadAuditEntries(): LockAuditEntry[] {
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (!stored) return [];
      
      const entries: LockAuditEntry[] = JSON.parse(stored);
      
      // Convert timestamp strings back to Date objects
      return entries.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));
    } catch (error) {
      console.error('Failed to load audit entries:', error);
      return [];
    }
  }

  private saveAuditEntries(entries: LockAuditEntry[]): void {
    try {
      // Apply retention policy
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.settings.retentionDays);
      
      const filteredEntries = entries
        .filter(entry => entry.timestamp >= cutoffDate)
        .slice(-this.settings.maxEntries)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(filteredEntries));
    } catch (error) {
      console.error('Failed to save audit entries:', error);
      
      // If storage is full, try to free space by removing old entries
      if (error instanceof DOMException && error.code === 22) {
        try {
          const reducedEntries = entries.slice(-Math.floor(this.settings.maxEntries / 2));
          localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(reducedEntries));
        } catch (retryError) {
          console.error('Failed to save even reduced audit entries:', retryError);
        }
      }
    }
  }

  logShiftLockOperation(
    shift: Shift,
    employee: Employee,
    operation: 'lock' | 'unlock',
    user: string,
    reason?: string,
    validationResult?: any
  ): void {
    const entry: LockAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shiftId: shift.id,
      employeeId: shift.employeeId,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      storeId: shift.storeId,
      operation,
      timestamp: new Date(),
      user,
      reason,
      previousState: {
        isLocked: operation === 'lock' ? false : true,
        actualHours: shift.actualHours
      },
      newState: {
        isLocked: operation === 'lock' ? true : false,
        actualHours: shift.actualHours
      },
      validationResult,
      metadata: this.settings.enableDetailedLogging ? {
        ipAddress: this.getClientIP(),
        userAgent: navigator.userAgent
      } : undefined
    };

    const entries = this.loadAuditEntries();
    entries.unshift(entry);
    this.saveAuditEntries(entries);
  }

  logBulkOperation(
    shifts: Shift[],
    employees: Employee[],
    operation: 'bulk_lock' | 'bulk_unlock',
    user: string,
    results?: { successful: number; failed: number; validationResults?: any[] }
  ): void {
    const bulkOperationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    shifts.forEach((shift, index) => {
      const employee = employees.find(emp => emp.id === shift.employeeId);
      if (!employee) return;

      const entry: LockAuditEntry = {
        id: `audit_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        shiftId: shift.id,
        employeeId: shift.employeeId,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        storeId: shift.storeId,
        operation,
        timestamp: new Date(),
        user,
        previousState: {
          isLocked: operation === 'bulk_lock' ? false : true,
          actualHours: shift.actualHours
        },
        newState: {
          isLocked: operation === 'bulk_lock' ? true : false,
          actualHours: shift.actualHours
        },
        validationResult: results?.validationResults?.[index],
        metadata: {
          bulkOperationId,
          totalAffectedShifts: shifts.length,
          ...(this.settings.enableDetailedLogging ? {
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent
          } : {})
        }
      };

      const entries = this.loadAuditEntries();
      entries.unshift(entry);
      this.saveAuditEntries(entries);
    });
  }

  logValidationFailure(
    shift: Shift,
    employee: Employee,
    user: string,
    validationResult: any
  ): void {
    const entry: LockAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shiftId: shift.id,
      employeeId: shift.employeeId,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      storeId: shift.storeId,
      operation: 'validation_failed',
      timestamp: new Date(),
      user,
      validationResult,
      metadata: this.settings.enableDetailedLogging ? {
        ipAddress: this.getClientIP(),
        userAgent: navigator.userAgent
      } : undefined
    };

    const entries = this.loadAuditEntries();
    entries.unshift(entry);
    this.saveAuditEntries(entries);
  }

  getAuditHistoryForShift(shiftId: string): LockAuditEntry[] {
    const entries = this.loadAuditEntries();
    return entries
      .filter(entry => entry.shiftId === shiftId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAuditHistoryForEmployee(employeeId: string): LockAuditEntry[] {
    const entries = this.loadAuditEntries();
    return entries
      .filter(entry => entry.employeeId === employeeId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAuditStatistics(): AuditStatistics {
    const entries = this.loadAuditEntries();
    
    const operationsByType: Record<string, number> = {};
    const operationsByUser: Record<string, number> = {};
    const operationsByDate: Record<string, number> = {};
    let totalValidationScore = 0;
    let validationCount = 0;

    entries.forEach(entry => {
      // Count by operation type
      operationsByType[entry.operation] = (operationsByType[entry.operation] || 0) + 1;
      
      // Count by user
      operationsByUser[entry.user] = (operationsByUser[entry.user] || 0) + 1;
      
      // Count by date
      const dateKey = entry.timestamp.toDateString();
      operationsByDate[dateKey] = (operationsByDate[dateKey] || 0) + 1;
      
      // Track validation scores
      if (entry.validationResult?.score !== undefined) {
        totalValidationScore += entry.validationResult.score;
        validationCount++;
      }
    });

    const successfulOps = (operationsByType.lock || 0) + (operationsByType.bulk_lock || 0);
    const totalOps = entries.length;
    const successRate = totalOps > 0 ? (successfulOps / totalOps) * 100 : 0;
    const avgValidationScore = validationCount > 0 ? totalValidationScore / validationCount : 0;

    return {
      totalOperations: totalOps,
      operationsByType,
      operationsByUser,
      operationsByDate,
      successRate: Math.round(successRate * 100) / 100,
      avgValidationScore: Math.round(avgValidationScore * 100) / 100,
      recentActivity: entries.slice(0, 10)
    };
  }

  exportAuditData(startDate?: Date, endDate?: Date): LockAuditEntry[] {
    let entries = this.loadAuditEntries();
    
    if (startDate || endDate) {
      entries = entries.filter(entry => {
        const entryDate = entry.timestamp;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });
    }
    
    return entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  clearAuditData(): void {
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear audit data:', error);
    }
  }

  updateSettings(newSettings: Partial<AuditSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  getSettings(): AuditSettings {
    return { ...this.settings };
  }

  private getClientIP(): string {
    // In a real application, this would be obtained from the server
    return 'client-ip-not-available';
  }
}

// 🏭 SINGLETON INSTANCE
const auditTrailManager = new AuditTrailManager();

// 📤 EXPORTED FUNCTIONS
export function logShiftLockOperation(
  shift: Shift,
  employee: Employee,
  operation: 'lock' | 'unlock',
  user: string,
  reason?: string,
  validationResult?: any
): void {
  auditTrailManager.logShiftLockOperation(shift, employee, operation, user, reason, validationResult);
}

export function logBulkOperation(
  shifts: Shift[],
  employees: Employee[],
  operation: 'bulk_lock' | 'bulk_unlock',
  user: string,
  results?: { successful: number; failed: number; validationResults?: any[] }
): void {
  auditTrailManager.logBulkOperation(shifts, employees, operation, user, results);
}

export function logValidationFailure(
  shift: Shift,
  employee: Employee,
  user: string,
  validationResult: any
): void {
  auditTrailManager.logValidationFailure(shift, employee, user, validationResult);
}

export function getAuditHistoryForShift(shiftId: string): LockAuditEntry[] {
  return auditTrailManager.getAuditHistoryForShift(shiftId);
}

export function getAuditHistoryForEmployee(employeeId: string): LockAuditEntry[] {
  return auditTrailManager.getAuditHistoryForEmployee(employeeId);
}

export function getAuditStatistics(): AuditStatistics {
  return auditTrailManager.getAuditStatistics();
}

export function exportAuditData(startDate?: Date, endDate?: Date): LockAuditEntry[] {
  return auditTrailManager.exportAuditData(startDate, endDate);
}

export function clearAuditData(): void {
  auditTrailManager.clearAuditData();
}

export function updateAuditSettings(settings: Partial<AuditSettings>): void {
  auditTrailManager.updateSettings(settings);
}

export function getAuditSettings(): AuditSettings {
  return auditTrailManager.getSettings();
}

// 📊 UTILITY FUNCTIONS
export function formatAuditEntry(entry: LockAuditEntry): string {
  const time = entry.timestamp.toLocaleTimeString();
  const date = entry.timestamp.toLocaleDateString();
  
  let action = '';
  switch (entry.operation) {
    case 'lock': action = 'bloccato'; break;
    case 'unlock': action = 'sbloccato'; break;
    case 'bulk_lock': action = 'bloccato (massa)'; break;
    case 'bulk_unlock': action = 'sbloccato (massa)'; break;
    case 'validation_failed': action = 'validazione fallita'; break;
  }
  
  return `${date} ${time} - ${entry.employeeName}: turno ${action} da ${entry.user}`;
}

export function getOperationIcon(operation: string): string {
  switch (operation) {
    case 'lock': return '🔒';
    case 'unlock': return '🔓';
    case 'bulk_lock': return '🔒📦';
    case 'bulk_unlock': return '🔓📦';
    case 'validation_failed': return '❌';
    default: return '📝';
  }
}

export function getOperationColor(operation: string): string {
  switch (operation) {
    case 'lock': 
    case 'bulk_lock': return 'text-green-600';
    case 'unlock': 
    case 'bulk_unlock': return 'text-blue-600';
    case 'validation_failed': return 'text-red-600';
    default: return 'text-gray-600';
  }
}