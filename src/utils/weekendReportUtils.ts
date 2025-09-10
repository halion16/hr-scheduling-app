import * as XLSX from 'xlsx';

export const exportWeekendReportToExcel = (
  weekendStats: any[],
  employeeAnalysis: any[],
  monthWeekends: any[],
  month: number,
  year: number
) => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Riepilogo per Negozio
  const summaryData = weekendStats.map(stat => ({
    'Punto Vendita': stat.storeName,
    'Dipendenti Totali': stat.totalEmployees,
    'Dipendenti Attivi': stat.activeEmployees,
    'Sabati Liberi (N°)': stat.saturdayOffCount,
    'Sabati Liberi (%)': `${stat.saturdayOffPercentage.toFixed(1)}%`,
    'Domeniche Libere (N°)': stat.sundayOffCount,
    'Domeniche Libere (%)': `${stat.sundayOffPercentage.toFixed(1)}%`,
    'Weekend Completi (N°)': stat.bothDaysOffCount,
    'Weekend Completi (%)': `${stat.bothDaysOffPercentage.toFixed(1)}%`,
    'Dipendenti Senza Riposi': stat.neitherDayOffCount,
    'Score Equità': `${Math.round((stat.saturdayOffPercentage + stat.sundayOffPercentage) / 2)}%`
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo Negozi');

  // Sheet 2: Analisi Dipendenti
  const employeeData = employeeAnalysis.map(emp => ({
    'Dipendente': emp.employeeName,
    'Weekend Analizzati': emp.weekendsAnalyzed,
    'Sabati Liberi': emp.saturdaysOff,
    'Domeniche Libere': emp.sundaysOff,
    'Weekend Completi': emp.bothDaysOff,
    'Percentuale Sabati Liberi': `${((emp.saturdaysOff / emp.weekendsAnalyzed) * 100).toFixed(1)}%`,
    'Percentuale Domeniche Libere': `${((emp.sundaysOff / emp.weekendsAnalyzed) * 100).toFixed(1)}%`,
    'Percentuale Lavoro Weekend': `${emp.weekendWorkPercentage.toFixed(1)}%`,
    'Score Equità': emp.fairnessScore.toFixed(0),
    'Valutazione': emp.fairnessScore >= 80 ? 'Ottima' : emp.fairnessScore >= 60 ? 'Buona' : 'Da Migliorare'
  }));

  const employeeSheet = XLSX.utils.json_to_sheet(employeeData);
  XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Analisi Dipendenti');

  // Sheet 3: Dettaglio Weekend
  const weekendDetailData: any[] = [];
  weekendStats.forEach(stat => {
    stat.weekendDetails.forEach((detail: any) => {
      weekendDetailData.push({
        'Punto Vendita': stat.storeName,
        'Data Sabato': detail.saturdayDate.toLocaleDateString('it-IT'),
        'Data Domenica': detail.sundayDate.toLocaleDateString('it-IT'),
        'Turni Weekend Totali': detail.totalWeekendShifts,
        'Sabato Libero (N°)': detail.employeesWithSaturdayOff.length,
        'Domenica Libera (N°)': detail.employeesWithSundayOff.length,
        'Weekend Completo (N°)': detail.employeesWithBothOff.length,
        'Copertura Weekend (%)': `${((detail.totalWeekendShifts / (stat.totalEmployees * 2)) * 100).toFixed(1)}%`
      });
    });
  });

  const detailSheet = XLSX.utils.json_to_sheet(weekendDetailData);
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Dettaglio Weekend');

  // Auto-size columns
  [summarySheet, employeeSheet, detailSheet].forEach(sheet => {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const colWidths: { wch: number }[] = [];
    
    for (let C = range.s.c; C <= range.e.c; C++) {
      let maxWidth = 10;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        if (cell && cell.v) {
          const cellLength = cell.v.toString().length;
          maxWidth = Math.max(maxWidth, cellLength);
        }
      }
      colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    }
    
    sheet['!cols'] = colWidths;
  });

  // Genera nome file
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  
  const fileName = `Report_Riposi_Weekend_${monthNames[month - 1]}_${year}.xlsx`;
  
  // Salva il file
  XLSX.writeFile(workbook, fileName);
};