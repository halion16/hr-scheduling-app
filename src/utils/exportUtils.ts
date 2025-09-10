import * as XLSX from 'xlsx';
import { Employee, Store, Shift } from '../types';
import { formatDate, calculateWorkingHours } from './timeUtils';

export const exportScheduleToExcel = (
  shifts: Shift[],
  employees: Employee[],
  stores: Store[],
  weekStart: Date
) => {
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  const storeMap = new Map(stores.map(store => [store.id, store]));

  const data = shifts.map(shift => {
    const employee = employeeMap.get(shift.employeeId);
    const store = storeMap.get(shift.storeId);
    
    return {
      Data: shift.date.toLocaleDateString('it-IT'),
      'Nome Dipendente': employee ? `${employee.firstName} ${employee.lastName}` : 'Sconosciuto',
      Negozio: store?.name || 'Sconosciuto',
      'Orario Inizio': shift.startTime,
      'Orario Fine': shift.endTime,
      'Durata Pausa (min)': shift.breakDuration,
      'Ore Lavorate': shift.actualHours.toFixed(2),
      Stato: shift.status === 'scheduled' ? 'Programmato' : 
             shift.status === 'confirmed' ? 'Confermato' :
             shift.status === 'completed' ? 'Completato' : 'Annullato',
      Note: shift.notes || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pianificazione');

  // Auto-dimensiona le colonne
  const colWidths = [
    { wch: 12 }, // Data
    { wch: 20 }, // Nome Dipendente
    { wch: 15 }, // Negozio
    { wch: 12 }, // Orario Inizio
    { wch: 12 }, // Orario Fine
    { wch: 18 }, // Durata Pausa
    { wch: 15 }, // Ore Lavorate
    { wch: 12 }, // Stato
    { wch: 30 }  // Note
  ];
  worksheet['!cols'] = colWidths;

  const fileName = `Pianificazione_${weekStart.toLocaleDateString('it-IT').replace(/\//g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

export const exportEmployeesToExcel = (employees: Employee[], stores: Store[]) => {
  const storeMap = new Map(stores.map(store => [store.id, store]));

  const data = employees.map(employee => ({
    Nome: employee.firstName,
    Cognome: employee.lastName,
    'Ore Contratto': employee.contractHours,
    'Ore Fisse': employee.fixedHours,
    Stato: employee.isActive ? 'Attivo' : 'Inattivo',
    Negozio: employee.storeId ? (storeMap.get(employee.storeId)?.name || 'Sconosciuto') : 'Non Assegnato',
    'Data Creazione': employee.createdAt.toLocaleDateString('it-IT')
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dipendenti');

  worksheet['!cols'] = [
    { wch: 15 }, // Nome
    { wch: 15 }, // Cognome
    { wch: 15 }, // Ore Contratto
    { wch: 12 }, // Ore Fisse
    { wch: 10 }, // Stato
    { wch: 20 }, // Negozio
    { wch: 15 }  // Data Creazione
  ];

  XLSX.writeFile(workbook, 'Dipendenti.xlsx');
};