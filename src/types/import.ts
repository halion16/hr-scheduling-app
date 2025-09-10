export interface ImportColumn {
  field: string;
  label: string;
  required: boolean;
  type: 'text' | 'date' | 'time' | 'number';
  example: string;
}

export interface ImportMapping {
  [excelColumn: string]: string; // Maps Excel column to app field
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  preview: ImportedShift[];
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportedShift {
  rowIndex: number;
  employeeName: string;
  employeeId?: string;
  storeName: string;
  storeId?: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakDuration: number;
  notes?: string;
  status: 'valid' | 'invalid' | 'warning';
  issues: string[];
}

export interface ImportError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportWarning {
  row: number;
  message: string;
  suggestion: string;
}

export interface ImportOptions {
  skipEmptyRows: boolean;
  mergeWithExisting: boolean;
  updateExistingShifts: boolean;
  createMissingEmployees: boolean;
  defaultBreakDuration: number;
  dateFormat: 'auto' | 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  message: string;
  details: {
    newShifts: number;
    updatedShifts: number;
    newEmployees: number;
    conflicts: number;
  };
}