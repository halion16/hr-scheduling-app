import { Shift, Employee, Store } from '../types';
import { ValidationResult, validateShiftForLocking, ValidationContext } from './shiftValidationRules';
import { logShiftLockOperation, logBulkOperation } from './auditTrail';

/**
 * 🔄 STEP 3: WORKFLOW ENGINE
 * 
 * Sistema di workflow per la gestione degli stati dei turni
 * con transizioni controllate e validazioni integrate.
 */

export type ShiftValidationStatus = 
  | 'draft'              // Bozza, modificabile
  | 'ready_review'       // Pronto per revisione
  | 'under_review'       // In fase di revisione
  | 'validated'          // Validato, non modificabile
  | 'published'          // Pubblicato ai dipendenti
  | 'locked_final';      // Bloccato definitivamente

export interface WorkflowTransition {
  from: ShiftValidationStatus;
  to: ShiftValidationStatus;
  requiredRole: 'admin' | 'manager' | 'user';
  requiresValidation: boolean;
  label: string;
  icon: string;
  confirmationMessage?: string;
  autoTransitions?: ShiftValidationStatus[];
}

export interface WorkflowResult {
  success: boolean;
  newStatus?: ShiftValidationStatus;
  error?: string;
  validationResult?: ValidationResult;
  autoTransitioned?: boolean;
}

// 🏗️ WORKFLOW CONFIGURATION
export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  // From DRAFT
  {
    from: 'draft',
    to: 'ready_review',
    requiredRole: 'user',
    requiresValidation: true,
    label: 'Invia per Revisione',
    icon: '📤',
    confirmationMessage: 'Confermi l\'invio del turno per revisione?'
  },
  {
    from: 'draft',
    to: 'validated',
    requiredRole: 'admin',
    requiresValidation: true,
    label: 'Valida Direttamente',
    icon: '✅',
    confirmationMessage: 'Confermi la validazione diretta del turno?'
  },

  // From READY_REVIEW
  {
    from: 'ready_review',
    to: 'under_review',
    requiredRole: 'manager',
    requiresValidation: false,
    label: 'Prendi in Carico',
    icon: '👁️',
    autoTransitions: ['validated']
  },
  {
    from: 'ready_review',
    to: 'draft',
    requiredRole: 'manager',
    requiresValidation: false,
    label: 'Rimanda a Bozza',
    icon: '↩️',
    confirmationMessage: 'Il turno tornerà in stato di bozza per modifiche.'
  },

  // From UNDER_REVIEW
  {
    from: 'under_review',
    to: 'validated',
    requiredRole: 'manager',
    requiresValidation: true,
    label: 'Approva',
    icon: '✅',
    confirmationMessage: 'Confermi l\'approvazione del turno?',
    autoTransitions: ['published']
  },
  {
    from: 'under_review',
    to: 'draft',
    requiredRole: 'manager',
    requiresValidation: false,
    label: 'Respingi',
    icon: '❌',
    confirmationMessage: 'Il turno tornerà in bozza per correzioni.'
  },

  // From VALIDATED
  {
    from: 'validated',
    to: 'published',
    requiredRole: 'manager',
    requiresValidation: false,
    label: 'Pubblica',
    icon: '📢',
    confirmationMessage: 'I dipendenti vedranno questo turno.'
  },
  {
    from: 'validated',
    to: 'locked_final',
    requiredRole: 'admin',
    requiresValidation: false,
    label: 'Blocca Definitivamente',
    icon: '🔒',
    confirmationMessage: 'Il turno non sarà più modificabile.'
  },

  // From PUBLISHED
  {
    from: 'published',
    to: 'locked_final',
    requiredRole: 'manager',
    requiresValidation: false,
    label: 'Blocca',
    icon: '🔒',
    confirmationMessage: 'Il turno sarà bloccato definitivamente.'
  },
  {
    from: 'published',
    to: 'validated',
    requiredRole: 'admin',
    requiresValidation: false,
    label: 'Rimuovi Pubblicazione',
    icon: '📤',
    confirmationMessage: 'Il turno non sarà più visibile ai dipendenti.'
  },

  // From LOCKED_FINAL
  {
    from: 'locked_final',
    to: 'published',
    requiredRole: 'admin',
    requiresValidation: false,
    label: 'Sblocca',
    icon: '🔓',
    confirmationMessage: 'Il turno tornerà modificabile. Operazione critica!'
  }
];

// 🎨 STATUS CONFIGURATION
export const STATUS_CONFIG = {
  draft: {
    label: 'Bozza',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: '📝',
    canEdit: true,
    description: 'Turno in fase di creazione o modifica'
  },
  ready_review: {
    label: 'Pronto per Revisione',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    icon: '📤',
    canEdit: false,
    description: 'In attesa di essere preso in carico da un manager'
  },
  under_review: {
    label: 'In Revisione',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: '👁️',
    canEdit: false,
    description: 'Attualmente sotto revisione da parte di un manager'
  },
  validated: {
    label: 'Validato',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    icon: '✅',
    canEdit: false,
    description: 'Approvato e validato, pronto per la pubblicazione'
  },
  published: {
    label: 'Pubblicato',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
    icon: '📢',
    canEdit: false,
    description: 'Visibile ai dipendenti'
  },
  locked_final: {
    label: 'Bloccato',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    icon: '🔒',
    canEdit: false,
    description: 'Definitivamente bloccato, non modificabile'
  }
} as const;

// 🚀 WORKFLOW ENGINE CLASS
export class ShiftWorkflowEngine {
  private validationContext: ValidationContext;

  constructor(context: ValidationContext) {
    this.validationContext = context;
  }

  updateContext(context: ValidationContext): void {
    this.validationContext = context;
  }

  getAvailableTransitions(
    currentStatus: ShiftValidationStatus,
    userRole: 'admin' | 'manager' | 'user'
  ): WorkflowTransition[] {
    return WORKFLOW_TRANSITIONS.filter(transition => 
      transition.from === currentStatus && 
      this.hasRequiredRole(userRole, transition.requiredRole)
    );
  }

  private hasRequiredRole(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = { 'admin': 3, 'manager': 2, 'user': 1 };
    return (roleHierarchy[userRole as keyof typeof roleHierarchy] || 0) >= 
           (roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0);
  }

  async executeWorkflowTransition(
    shift: Shift,
    targetStatus: ShiftValidationStatus,
    userRole: 'admin' | 'manager' | 'user',
    userName: string,
    reason?: string
  ): Promise<WorkflowResult> {
    const currentStatus = (shift as any).validationStatus || 'draft';
    
    // Find the transition
    const transition = WORKFLOW_TRANSITIONS.find(t => 
      t.from === currentStatus && 
      t.to === targetStatus &&
      this.hasRequiredRole(userRole, t.requiredRole)
    );

    if (!transition) {
      return {
        success: false,
        error: `Transizione non permessa da ${currentStatus} a ${targetStatus} per il ruolo ${userRole}`
      };
    }

    // Perform validation if required
    let validationResult: ValidationResult | undefined;
    if (transition.requiresValidation) {
      validationResult = validateShiftForLocking(shift, this.validationContext);
      
      if (!validationResult.isValid) {
        // Log validation failure
        const employee = this.validationContext.employees.find(emp => emp.id === shift.employeeId);
        if (employee) {
          logShiftLockOperation(shift, employee, 'lock', userName, `Validation failed: ${validationResult.errors.join(', ')}`, validationResult);
        }
        
        return {
          success: false,
          error: `Validazione fallita: ${validationResult.errors.join(', ')}`,
          validationResult
        };
      }
    }

    // Execute the transition
    const newShift = { ...shift, validationStatus: targetStatus } as any;
    
    // Log the transition
    const employee = this.validationContext.employees.find(emp => emp.id === shift.employeeId);
    if (employee) {
      const operation = targetStatus === 'locked_final' ? 'lock' : 
                      currentStatus === 'locked_final' ? 'unlock' : 'lock';
      logShiftLockOperation(newShift, employee, operation, userName, reason, validationResult);
    }

    // Check for auto-transitions
    let finalStatus = targetStatus;
    let autoTransitioned = false;

    if (transition.autoTransitions && transition.autoTransitions.length > 0) {
      // For now, take the first auto-transition
      // In a real system, you might have more complex logic here
      const autoTarget = transition.autoTransitions[0];
      const autoTransition = WORKFLOW_TRANSITIONS.find(t => 
        t.from === targetStatus && 
        t.to === autoTarget &&
        this.hasRequiredRole(userRole, t.requiredRole)
      );

      if (autoTransition) {
        finalStatus = autoTarget;
        autoTransitioned = true;
      }
    }

    return {
      success: true,
      newStatus: finalStatus,
      validationResult,
      autoTransitioned
    };
  }

  async executeBulkTransition(
    shifts: Shift[],
    targetStatus: ShiftValidationStatus,
    userRole: 'admin' | 'manager' | 'user',
    userName: string,
    reason?: string
  ): Promise<{
    successful: Shift[];
    failed: { shift: Shift; error: string }[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      avgValidationScore: number;
    };
  }> {
    const successful: Shift[] = [];
    const failed: { shift: Shift; error: string }[] = [];
    let totalValidationScore = 0;
    let validationCount = 0;

    for (const shift of shifts) {
      const result = await this.executeWorkflowTransition(
        shift, 
        targetStatus, 
        userRole, 
        userName, 
        reason
      );

      if (result.success && result.newStatus) {
        const updatedShift = { ...shift, validationStatus: result.newStatus };
        successful.push(updatedShift);
        
        if (result.validationResult?.score !== undefined) {
          totalValidationScore += result.validationResult.score;
          validationCount++;
        }
      } else {
        failed.push({ shift, error: result.error || 'Unknown error' });
      }
    }

    // Log bulk operation
    const employees = this.validationContext.employees;
    const operation = targetStatus === 'locked_final' ? 'bulk_lock' : 'bulk_unlock';
    logBulkOperation(successful, employees, operation, userName, {
      successful: successful.length,
      failed: failed.length
    });

    return {
      successful,
      failed,
      summary: {
        total: shifts.length,
        successful: successful.length,
        failed: failed.length,
        avgValidationScore: validationCount > 0 ? totalValidationScore / validationCount : 0
      }
    };
  }

  canEditShift(shift: Shift): boolean {
    const status = (shift as any).validationStatus || 'draft';
    return STATUS_CONFIG[status]?.canEdit || false;
  }

  getStatusDisplayName(status: ShiftValidationStatus): string {
    return STATUS_CONFIG[status]?.label || status;
  }

  getStatusIcon(status: ShiftValidationStatus): string {
    return STATUS_CONFIG[status]?.icon || '📝';
  }

  getStatusColor(status: ShiftValidationStatus): string {
    return STATUS_CONFIG[status]?.color || 'gray';
  }

  getStatusBadgeClasses(status: ShiftValidationStatus): string {
    const config = STATUS_CONFIG[status];
    if (!config) return 'bg-gray-100 text-gray-800 border-gray-300';
    
    return `${config.bgColor} ${config.textColor} ${config.borderColor}`;
  }

  getShiftsByStatus(shifts: Shift[]): Record<ShiftValidationStatus, Shift[]> {
    const result = {} as Record<ShiftValidationStatus, Shift[]>;
    
    // Initialize all status arrays
    Object.keys(STATUS_CONFIG).forEach(status => {
      result[status as ShiftValidationStatus] = [];
    });

    // Group shifts by status
    shifts.forEach(shift => {
      const status = (shift as any).validationStatus || 'draft';
      if (result[status]) {
        result[status].push(shift);
      }
    });

    return result;
  }
}

// 📤 UTILITY FUNCTIONS
export function createWorkflowEngine(context: ValidationContext): ShiftWorkflowEngine {
  return new ShiftWorkflowEngine(context);
}

export function isShiftLocked(shift: Shift): boolean {
  const status = (shift as any).validationStatus || 'draft';
  return status === 'locked_final';
}

export function isShiftEditable(shift: Shift): boolean {
  const status = (shift as any).validationStatus || 'draft';
  return STATUS_CONFIG[status]?.canEdit || false;
}

export function getWorkflowStatistics(shifts: Shift[]): {
  byStatus: Record<ShiftValidationStatus, number>;
  totalShifts: number;
  lockedPercentage: number;
  validatedPercentage: number;
} {
  const byStatus = {} as Record<ShiftValidationStatus, number>;
  
  // Initialize counters
  Object.keys(STATUS_CONFIG).forEach(status => {
    byStatus[status as ShiftValidationStatus] = 0;
  });

  // Count shifts by status
  shifts.forEach(shift => {
    const status = (shift as any).validationStatus || 'draft';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  const totalShifts = shifts.length;
  const lockedShifts = byStatus.locked_final || 0;
  const validatedShifts = (byStatus.validated || 0) + (byStatus.published || 0) + (byStatus.locked_final || 0);

  return {
    byStatus,
    totalShifts,
    lockedPercentage: totalShifts > 0 ? (lockedShifts / totalShifts) * 100 : 0,
    validatedPercentage: totalShifts > 0 ? (validatedShifts / totalShifts) * 100 : 0
  };
}