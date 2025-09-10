import * as XLSX from 'xlsx';
import { Employee, Store, Shift } from '../types';
import { 
  ImportColumn, 
  ImportMapping, 
  ImportPreview, 
  ImportedShift, 
  ImportError, 
  ImportWarning,
  ImportOptions,
  ImportResult
} from '../types/import';

// Colonne standard per l'importazione turni
export const STANDARD_IMPORT_COLUMNS: ImportColumn[] = [
  { field: 'date', label: 'Data', required: true, type: 'date', example: '15/01/2024' },
  { field: 'employeeName', label: 'Nome Dipendente', required: true, type: 'text', example: 'Mario Rossi' },
  { field: 'storeName', label: 'Negozio', required: true, type: 'text', example: 'Negozio Centro' },
  { field: 'startTime', label: 'Orario Inizio', required: true, type: 'time', example: '09:00' },
  { field: 'endTime', label: 'Orario Fine', required: true, type: 'time', example: '17:00' },
  { field: 'breakDuration', label: 'Pausa (min)', required: false, type: 'number', example: '30' },
  { field: 'notes', label: 'Note', required: false, type: 'text', example: 'Turno straordinario' }
];

// Varianti comuni di nomi colonne per auto-mapping
export const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['data', 'date', 'giorno', 'giornata', 'data turno'],
  employeeName: ['dipendente', 'nome dipendente', 'nome', 'employee', 'worker', 'nome e cognome'],
  storeName: ['negozio', 'punto vendita', 'store', 'shop', 'filiale'],
  startTime: ['inizio', 'ora inizio', 'start time', 'orario inizio', 'dalle'],
  endTime: ['fine', 'ora fine', 'end time', 'orario fine', 'alle'],
  breakDuration: ['pausa', 'break', 'pausa minuti', 'break duration', 'durata pausa'],
  notes: ['note', 'notes', 'commenti', 'osservazioni', 'memo']
};

/**
 * Legge un file Excel e restituisce i dati grezzi
 */
export async function readExcelFile(file: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Prende il primo foglio
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converte in array di array
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false 
        });
        
        console.log('📊 Excel file read successfully:', {
          sheets: workbook.SheetNames.length,
          rows: jsonData.length,
          firstSheet: sheetName
        });
        
        resolve(jsonData as any[][]);
      } catch (error) {
        console.error('❌ Error reading Excel file:', error);
        reject(new Error('Errore durante la lettura del file Excel: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Errore durante la lettura del file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Analizza le colonne del file Excel e suggerisce un mapping automatico
 */
export function analyzeExcelColumns(data: any[][]): { 
  detectedColumns: string[]; 
  suggestedMapping: ImportMapping 
} {
  if (data.length === 0) {
    return { detectedColumns: [], suggestedMapping: {} };
  }
  
  // Usa la prima riga come header
  const headers = data[0].map((header: any) => 
    typeof header === 'string' ? header.toLowerCase().trim() : header?.toString().toLowerCase().trim() || ''
  );
  
  console.log('🔍 Detected Excel headers:', headers);
  
  const suggestedMapping: ImportMapping = {};
  
  // Auto-mapping basato su alias
  headers.forEach((header, index) => {
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some(alias => 
        header.includes(alias.toLowerCase()) || 
        alias.toLowerCase().includes(header)
      )) {
        const columnLetter = XLSX.utils.encode_col(index);
        suggestedMapping[columnLetter] = field;
        console.log(`🎯 Auto-mapped: Column ${columnLetter} (${header}) → ${field}`);
        break;
      }
    }
  });
  
  return {
    detectedColumns: headers,
    suggestedMapping
  };
}

/**
 * Valida e converte i dati Excel in turni importati
 */
export function parseExcelData(
  data: any[][],
  mapping: ImportMapping,
  employees: Employee[],
  stores: Store[],
  options: ImportOptions
): ImportPreview {
  const preview: ImportedShift[] = [];
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const duplicateCheck = new Set<string>();
  
  let validRows = 0;
  let invalidRows = 0;
  let duplicates = 0;
  
  // Crea mappe per lookup veloce
  const employeeMap = new Map<string, Employee>();
  employees.forEach(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    employeeMap.set(fullName, emp);
    employeeMap.set(emp.firstName.toLowerCase(), emp);
    employeeMap.set(emp.lastName.toLowerCase(), emp);
  });
  
  const storeMap = new Map<string, Store>();
  stores.forEach(store => {
    storeMap.set(store.name.toLowerCase(), store);
  });
  
  console.log('📋 Starting Excel data parsing...', {
    totalRows: data.length - 1, // Esclude header
    mapping,
    employees: employees.length,
    stores: stores.length
  });
  
  // Processa ogni riga (skip header)
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    const rowErrors: string[] = [];
    
    // Skip righe vuote se richiesto
    if (options.skipEmptyRows && row.every((cell: any) => !cell || cell.toString().trim() === '')) {
      continue;
    }
    
    try {
      const importedShift = parseRowToShift(
        row, 
        rowIndex, 
        mapping, 
        employeeMap, 
        storeMap, 
        options,
        rowErrors
      );
      
      if (importedShift) {
        // Controlla duplicati
        const shiftKey = `${importedShift.employeeId}-${importedShift.date.toISOString()}-${importedShift.startTime}`;
        if (duplicateCheck.has(shiftKey)) {
          duplicates++;
          rowErrors.push('Turno duplicato (stesso dipendente, data e orario)');
        } else {
          duplicateCheck.add(shiftKey);
        }
        
        importedShift.issues = rowErrors;
        importedShift.status = rowErrors.length === 0 ? 'valid' : 
                              rowErrors.some(e => e.includes('ERRORE')) ? 'invalid' : 'warning';
        
        preview.push(importedShift);
        
        if (importedShift.status === 'valid') {
          validRows++;
        } else if (importedShift.status === 'invalid') {
          invalidRows++;
        }
      } else {
        invalidRows++;
      }
      
      // Aggiungi errori alla lista generale
      rowErrors.forEach(error => {
        errors.push({
          row: rowIndex + 1,
          column: 'general',
          message: error,
          severity: error.includes('ERRORE') ? 'error' : 'warning'
        });
      });
      
    } catch (error) {
      console.error(`❌ Error parsing row ${rowIndex + 1}:`, error);
      invalidRows++;
      errors.push({
        row: rowIndex + 1,
        column: 'general',
        message: `Errore di parsing: ${(error as Error).message}`,
        severity: 'error'
      });
    }
  }
  
  console.log('✅ Excel parsing completed:', {
    totalProcessed: preview.length,
    valid: validRows,
    invalid: invalidRows,
    duplicates,
    errors: errors.length
  });
  
  return {
    totalRows: data.length - 1,
    validRows,
    invalidRows,
    duplicates,
    preview,
    errors,
    warnings
  };
}

/**
 * Converte una singola riga Excel in un turno importato
 */
function parseRowToShift(
  row: any[],
  rowIndex: number,
  mapping: ImportMapping,
  employeeMap: Map<string, Employee>,
  storeMap: Map<string, Store>,
  options: ImportOptions,
  errors: string[]
): ImportedShift | null {
  
  const getValue = (field: string): string => {
    const columnIndex = Object.entries(mapping).find(([_, f]) => f === field)?.[0];
    if (!columnIndex) return '';
    
    const colIndex = columnIndex.charCodeAt(0) - 65; // Convert A,B,C to 0,1,2
    const rawValue = row[colIndex];
    
    return rawValue ? rawValue.toString().trim() : '';
  };
  
  // Estrai valori base
  const dateStr = getValue('date');
  const employeeName = getValue('employeeName');
  const storeName = getValue('storeName');
  const startTime = getValue('startTime');
  const endTime = getValue('endTime');
  const breakStr = getValue('breakDuration');
  const notes = getValue('notes');
  
  // Validazione campi obbligatori
  if (!dateStr) {
    errors.push('ERRORE: Data mancante');
    return null;
  }
  
  if (!employeeName) {
    errors.push('ERRORE: Nome dipendente mancante');
    return null;
  }
  
  if (!storeName) {
    errors.push('ERRORE: Nome negozio mancante');
    return null;
  }
  
  if (!startTime || !endTime) {
    errors.push('ERRORE: Orari di inizio o fine mancanti');
    return null;
  }
  
  // Parse data
  let parsedDate: Date;
  try {
    parsedDate = parseDate(dateStr, options.dateFormat);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Data non valida');
    }
  } catch (error) {
    errors.push(`ERRORE: Formato data non valido "${dateStr}"`);
    return null;
  }
  
  // Parse orari
  const normalizedStartTime = normalizeTime(startTime);
  const normalizedEndTime = normalizeTime(endTime);
  
  if (!normalizedStartTime || !normalizedEndTime) {
    errors.push(`ERRORE: Formato orario non valido "${startTime}" - "${endTime}"`);
    return null;
  }
  
  // Validazione logica orari
  if (normalizedStartTime >= normalizedEndTime) {
    errors.push('ERRORE: Orario di fine deve essere dopo l\'orario di inizio');
    return null;
  }
  
  // Parse pausa
  let breakDuration = options.defaultBreakDuration;
  if (breakStr) {
    const parsedBreak = parseInt(breakStr);
    if (!isNaN(parsedBreak) && parsedBreak >= 0 && parsedBreak <= 480) {
      breakDuration = parsedBreak;
    } else {
      errors.push(`AVVISO: Durata pausa non valida "${breakStr}", usato default ${options.defaultBreakDuration}min`);
    }
  }
  
  // Trova dipendente
  let employee: Employee | undefined;
  const normalizedEmployeeName = employeeName.toLowerCase().trim();
  
  // Prova diversi pattern di matching
  employee = employeeMap.get(normalizedEmployeeName);
  
  if (!employee) {
    // Prova a separare nome e cognome
    const nameParts = employeeName.split(/\s+/);
    if (nameParts.length >= 2) {
      const fullNameReversed = `${nameParts[1]} ${nameParts[0]}`.toLowerCase();
      employee = employeeMap.get(fullNameReversed);
    }
  }
  
  if (!employee) {
    // Prova matching parziale
    for (const [key, emp] of employeeMap) {
      if (key.includes(normalizedEmployeeName) || normalizedEmployeeName.includes(key)) {
        employee = emp;
        break;
      }
    }
  }
  
  if (!employee) {
    if (options.createMissingEmployees) {
      errors.push(`AVVISO: Dipendente "${employeeName}" verrà creato automaticamente`);
    } else {
      errors.push(`ERRORE: Dipendente "${employeeName}" non trovato`);
      return null;
    }
  }
  
  // Trova negozio
  const store = storeMap.get(storeName.toLowerCase().trim());
  if (!store) {
    errors.push(`ERRORE: Negozio "${storeName}" non trovato`);
    return null;
  }
  
  // Validazione orari negozio
  const dayOfWeek = getDayOfWeek(parsedDate);
  const storeHours = store.openingHours[dayOfWeek];
  
  if (!storeHours) {
    errors.push(`AVVISO: Negozio chiuso di ${dayOfWeek}`);
  } else {
    if (!isTimeInRange(normalizedStartTime, storeHours.open, storeHours.close)) {
      errors.push(`AVVISO: Orario inizio fuori dagli orari del negozio (${storeHours.open}-${storeHours.close})`);
    }
    if (!isTimeInRange(normalizedEndTime, storeHours.open, storeHours.close)) {
      errors.push(`AVVISO: Orario fine fuori dagli orari del negozio (${storeHours.open}-${storeHours.close})`);
    }
  }
  
  return {
    rowIndex: rowIndex + 1,
    employeeName,
    employeeId: employee?.id,
    storeName,
    storeId: store.id,
    date: parsedDate,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
    breakDuration,
    notes: notes || undefined,
    status: 'valid',
    issues: []
  };
}

/**
 * Esegue l'importazione effettiva dei turni validati
 */
export async function executeImport(
  importedShifts: ImportedShift[],
  employees: Employee[],
  stores: Store[],
  existingShifts: Shift[],
  options: ImportOptions,
  onAddShift: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => Shift | null,
  onAddEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Employee,
  onUpdateShift: (id: string, updates: Partial<Shift>) => void
): Promise<ImportResult> {
  
  console.log('🚀 Starting import execution...', {
    shifts: importedShifts.length,
    options
  });
  
  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let newEmployees = 0;
  let updatedShifts = 0;
  let conflicts = 0;
  
  const createdEmployees = new Map<string, Employee>();
  
  try {
    for (const importedShift of importedShifts) {
      if (importedShift.status === 'invalid') {
        skippedCount++;
        continue;
      }
      
      // Gestisci dipendente mancante
      let targetEmployee: Employee | undefined;
      
      if (importedShift.employeeId) {
        targetEmployee = employees.find(emp => emp.id === importedShift.employeeId);
      } else if (options.createMissingEmployees) {
        // Crea dipendente se non esiste
        const employeeKey = importedShift.employeeName.toLowerCase();
        
        if (createdEmployees.has(employeeKey)) {
          targetEmployee = createdEmployees.get(employeeKey);
        } else {
          const nameParts = importedShift.employeeName.trim().split(/\s+/);
          const firstName = nameParts[0] || 'Nome';
          const lastName = nameParts.slice(1).join(' ') || 'Cognome';
          
          const newEmployee = onAddEmployee({
            firstName,
            lastName,
            contractHours: 40, // Default
            fixedHours: 20,    // Default
            isActive: true,
            storeId: importedShift.storeId
          });
          
          createdEmployees.set(employeeKey, newEmployee);
          targetEmployee = newEmployee;
          newEmployees++;
          
          console.log(`👤 Created new employee: ${firstName} ${lastName}`);
        }
      }
      
      if (!targetEmployee) {
        errorCount++;
        continue;
      }
      
      // Controlla turni esistenti
      const existingShift = existingShifts.find(shift => 
        shift.employeeId === targetEmployee!.id &&
        shift.date.toDateString() === importedShift.date.toDateString() &&
        shift.storeId === importedShift.storeId
      );
      
      if (existingShift) {
        if (options.updateExistingShifts) {
          // Aggiorna turno esistente
          const actualHours = calculateWorkingHours(
            importedShift.startTime, 
            importedShift.endTime, 
            importedShift.breakDuration
          );
          
          onUpdateShift(existingShift.id, {
            startTime: importedShift.startTime,
            endTime: importedShift.endTime,
            breakDuration: importedShift.breakDuration,
            actualHours,
            notes: importedShift.notes,
            status: 'scheduled'
          });
          
          updatedShifts++;
          console.log(`🔄 Updated existing shift: ${existingShift.id}`);
        } else {
          conflicts++;
          console.log(`⚠️ Skipped duplicate shift for ${targetEmployee.firstName} ${targetEmployee.lastName} on ${importedShift.date.toLocaleDateString()}`);
        }
        continue;
      }
      
      // Crea nuovo turno
      const actualHours = calculateWorkingHours(
        importedShift.startTime, 
        importedShift.endTime, 
        importedShift.breakDuration
      );
      
      const newShift = onAddShift({
        employeeId: targetEmployee.id,
        storeId: importedShift.storeId!,
        date: new Date(importedShift.date),
        startTime: importedShift.startTime,
        endTime: importedShift.endTime,
        breakDuration: importedShift.breakDuration,
        actualHours,
        status: 'scheduled',
        isLocked: false,
        notes: importedShift.notes
      });
      
      if (newShift) {
        importedCount++;
        console.log(`✅ Created new shift: ${newShift.id} for ${targetEmployee.firstName} ${targetEmployee.lastName}`);
      } else {
        errorCount++;
        console.error(`❌ Failed to create shift for ${targetEmployee.firstName} ${targetEmployee.lastName}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Import execution error:', error);
    return {
      success: false,
      importedCount,
      skippedCount,
      errorCount: errorCount + 1,
      message: `Errore durante l'importazione: ${(error as Error).message}`,
      details: {
        newShifts: importedCount,
        updatedShifts,
        newEmployees,
        conflicts
      }
    };
  }
  
  const totalProcessed = importedCount + updatedShifts + conflicts + errorCount;
  const successMessage = `Importazione completata: ${importedCount} nuovi turni creati` +
    (updatedShifts > 0 ? `, ${updatedShifts} aggiornati` : '') +
    (newEmployees > 0 ? `, ${newEmployees} dipendenti creati` : '') +
    (conflicts > 0 ? `, ${conflicts} conflitti risolti` : '');
  
  return {
    success: true,
    importedCount: importedCount + updatedShifts,
    skippedCount,
    errorCount,
    message: successMessage,
    details: {
      newShifts: importedCount,
      updatedShifts,
      newEmployees,
      conflicts
    }
  };
}

// Utility functions
function parseDate(dateStr: string, format: ImportOptions['dateFormat']): Date {
  // Prova diversi formati automaticamente
  const formats = [
    // Formato Excel numerico (giorni da 1900-01-01)
    () => {
      const excelDate = parseFloat(dateStr);
      if (!isNaN(excelDate) && excelDate > 25000 && excelDate < 80000) {
        // Excel date format (days since 1900-01-01, accounting for leap year bug)
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
        return date;
      }
      return null;
    },
    
    // ISO format
    () => {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    },
    
    // Italian format DD/MM/YYYY
    () => {
      const match = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    },
    
    // US format MM/DD/YYYY
    () => {
      const match = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (match) {
        const [, month, day, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    }
  ];
  
  for (const formatFn of formats) {
    const result = formatFn();
    if (result && !isNaN(result.getTime())) {
      return result;
    }
  }
  
  throw new Error(`Formato data non riconosciuto: ${dateStr}`);
}

function normalizeTime(timeStr: string): string {
  // Rimuovi spazi e caratteri speciali
  const cleaned = timeStr.replace(/[^\d:\.]/g, '');
  
  // Pattern matching per diversi formati
  const patterns = [
    /^(\d{1,2}):(\d{2})$/, // HH:MM
    /^(\d{1,2})\.(\d{2})$/, // HH.MM
    /^(\d{3,4})$/ // HHMM
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let hours: number, minutes: number;
      
      if (match[0].includes(':') || match[0].includes('.')) {
        hours = parseInt(match[1]);
        minutes = parseInt(match[2]);
      } else {
        // HHMM format
        const digits = match[1];
        if (digits.length === 3) {
          hours = parseInt(digits.substring(0, 1));
          minutes = parseInt(digits.substring(1, 3));
        } else {
          hours = parseInt(digits.substring(0, 2));
          minutes = parseInt(digits.substring(2, 4));
        }
      }
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
  }
  
  return '';
}

function calculateWorkingHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  const workingMinutes = Math.max(0, endTotalMin - startTotalMin - breakMinutes);
  
  return workingMinutes / 60;
}

function getDayOfWeek(date: Date): string {
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  return days[date.getDay()];
}

function isTimeInRange(time: string, startRange: string, endRange: string): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startRange);
  const endMinutes = timeToMinutes(endRange);
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Genera un file Excel template per l'importazione
 */
export function generateImportTemplate(): void {
  const templateData = [
    // Header
    ['Data', 'Nome Dipendente', 'Negozio', 'Orario Inizio', 'Orario Fine', 'Pausa (min)', 'Note'],
    
    // Esempi
    ['15/01/2024', 'Mario Rossi', 'Negozio Centro', '09:00', '17:00', '30', 'Turno standard'],
    ['15/01/2024', 'Giulia Verdi', 'Negozio Centro', '13:00', '21:00', '30', 'Turno pomeridiano'],
    ['16/01/2024', 'Marco Bianchi', 'Negozio Centro', '08:00', '16:00', '60', 'Turno con pausa lunga'],
    ['16/01/2024', 'Anna Neri', 'Negozio Centro', '14:00', '18:00', '0', 'Part-time senza pausa'],
    ['17/01/2024', 'Luigi Blu', 'Negozio Centro', '17:00', '22:00', '15', 'Turno serale'],
    
    // Riga vuota per separazione
    ['', '', '', '', '', '', ''],
    
    // Istruzioni
    ['ISTRUZIONI PER L\'IMPORTAZIONE:', '', '', '', '', '', ''],
    ['• Data: Formato DD/MM/YYYY o MM/DD/YYYY', '', '', '', '', '', ''],
    ['• Nome Dipendente: Nome e cognome completi', '', '', '', '', '', ''],
    ['• Negozio: Nome esatto del negozio (case sensitive)', '', '', '', '', '', ''],
    ['• Orari: Formato HH:MM (es: 09:00, 17:30)', '', '', '', '', '', ''],
    ['• Pausa: Minuti di pausa (0 = nessuna pausa)', '', '', '', '', '', ''],
    ['• Note: Campo opzionale per informazioni aggiuntive', '', '', '', '', '', '']
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Turni');
  
  // Styling per il template
  const headerRange = XLSX.utils.decode_range('A1:G1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellRef]) continue;
    
    worksheet[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "366092" } },
      alignment: { horizontal: "center" }
    };
  }
  
  // Auto-size columns
  const colWidths = [
    { wch: 12 }, // Data
    { wch: 20 }, // Nome Dipendente  
    { wch: 18 }, // Negozio
    { wch: 14 }, // Orario Inizio
    { wch: 14 }, // Orario Fine
    { wch: 12 }, // Pausa
    { wch: 25 }  // Note
  ];
  worksheet['!cols'] = colWidths;
  
  // Salva il file
  const fileName = `Template_Importazione_Turni_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  
  console.log('✅ Template generated:', fileName);
}

/**
 * Valida la compatibilità del file Excel prima dell'importazione
 */
export function validateExcelStructure(data: any[][]): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  if (data.length < 2) {
    issues.push('Il file deve contenere almeno 2 righe (header + dati)');
    return { isValid: false, issues, suggestions };
  }
  
  const headers = data[0];
  if (!Array.isArray(headers) || headers.length < 4) {
    issues.push('La prima riga deve contenere almeno 4 colonne (Data, Dipendente, Negozio, Orari)');
  }
  
  // Controlla se ci sono righe con dati
  const dataRows = data.slice(1).filter(row => 
    row.some(cell => cell && cell.toString().trim() !== '')
  );
  
  if (dataRows.length === 0) {
    issues.push('Il file non contiene righe di dati');
    return { isValid: false, issues, suggestions };
  }
  
  // Analizza la struttura
  const { suggestedMapping } = analyzeExcelColumns(data);
  const mappedFields = Object.values(suggestedMapping);
  const requiredFields = ['date', 'employeeName', 'storeName', 'startTime', 'endTime'];
  
  const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
  
  if (missingRequired.length > 0) {
    issues.push(`Colonne obbligatorie non rilevate: ${missingRequired.join(', ')}`);
    suggestions.push('Assicurati che il file contenga colonne per Data, Nome Dipendente, Negozio, Orario Inizio e Orario Fine');
  }
  
  // Controlla formato dati nelle prime righe
  const sampleRows = dataRows.slice(0, 5);
  sampleRows.forEach((row, index) => {
    if (row.length !== headers.length) {
      issues.push(`Riga ${index + 2}: numero di colonne diverso dall'header`);
    }
  });
  
  if (mappedFields.length < 3) {
    suggestions.push('Il sistema ha rilevato poche colonne familiari. Potrebbe essere necessario un mapping manuale');
  }
  
  if (dataRows.length > 1000) {
    suggestions.push(`File molto grande (${dataRows.length} righe). L'importazione potrebbe richiedere tempo`);
  }
  
  const isValid = issues.length === 0;
  
  if (isValid) {
    suggestions.push(`✅ File valido: ${dataRows.length} righe di dati, ${mappedFields.length} colonne mappate automaticamente`);
  }
  
  return { isValid, issues, suggestions };
}