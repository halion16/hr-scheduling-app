import React, { useState, useMemo } from 'react';
import { Employee, Store, Shift } from '../../types';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { 
  Calendar,
  CalendarDays,
  Users, 
  BarChart3, 
  Download,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Coffee,
  Home
} from 'lucide-react';
import { exportWeekendReportToExcel } from '../../utils/weekendReportUtils';
import { getWeekNumber } from '../../utils/timeUtils';

interface WeekendRestReportProps {
  employees: Employee[];
  stores: Store[];
  shifts: Shift[];
}

interface WeekendStats {
  storeId: string;
  storeName: string;
  weekNumber?: number; // Numero della settimana (per la visualizzazione settimanale)
  weekRange?: string; // Range della settimana (per la visualizzazione)
  totalEmployees: number;
  activeEmployees: number;
  saturdayOffCount: number;
  sundayOffCount: number;
  bothDaysOffCount: number;
  neitherDayOffCount: number;
  saturdayOffPercentage: number;
  sundayOffPercentage: number;
  bothDaysOffPercentage: number;
  weekendDetails: WeekendDetail[];
}

interface WeekendDetail {
  weekStartDate: Date;
  weekEndDate: Date;
  saturdayDate: Date;
  sundayDate: Date;
  employeesWithSaturdayOff: string[];
  employeesWithSundayOff: string[];
  employeesWithBothOff: string[];
  totalWeekendShifts: number;
}

interface EmployeeWeekendStatus {
  employeeId: string;
  employeeName: string;
  weekendsAnalyzed: number;
  saturdaysOff: number;
  sundaysOff: number;
  bothDaysOff: number;
  weekendWorkPercentage: number;
  fairnessScore: number;
}

export const WeekendRestReport: React.FC<WeekendRestReportProps> = ({
  employees,
  stores,
  shifts
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'summary' | 'weekly' | 'detailed' | 'employee'>('summary');

  // Calcola i weekend del mese selezionato
  const monthWeekends = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    
    const weekends: { saturday: Date; sunday: Date }[] = [];
    
    // Trova tutti i weekend del mese
    for (let date = new Date(startOfMonth); date <= endOfMonth; date.setDate(date.getDate() + 1)) {
      if (date.getDay() === 6) { // Sabato
        const saturday = new Date(date);
        const sunday = new Date(date);
        sunday.setDate(sunday.getDate() + 1);
        
        // Include il weekend se almeno un giorno è nel mese
        if (saturday.getMonth() === month - 1 || sunday.getMonth() === month - 1) {
          weekends.push({ saturday, sunday });
        }
      }
    }
    
    return weekends;
  }, [selectedMonth]);

  // Raggruppa weekend per settimana
  const weekendsByWeek = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const weekGroups: { weekNumber: number; weekRange: string; weekends: { saturday: Date; sunday: Date }[] }[] = [];
    
    // Ordina i weekend per data
    const sortedWeekends = [...monthWeekends].sort((a, b) => a.saturday.getTime() - b.saturday.getTime());
    
    // Raggruppa per settimana dell'anno
    sortedWeekends.forEach(weekend => {
      const weekNumber = getWeekNumber(weekend.saturday);
      const existingWeek = weekGroups.find(w => w.weekNumber === weekNumber);
      
      if (existingWeek) {
        existingWeek.weekends.push(weekend);
      } else {
        // Trova lunedì e domenica della settimana
        const mondayOfWeek = new Date(weekend.saturday);
        mondayOfWeek.setDate(mondayOfWeek.getDate() - (mondayOfWeek.getDay() || 7) + 1);
        
        const sundayOfWeek = new Date(mondayOfWeek);
        sundayOfWeek.setDate(sundayOfWeek.getDate() + 6);
        
        const weekRange = `${mondayOfWeek.toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})} - ${sundayOfWeek.toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})}`;
        
        weekGroups.push({
          weekNumber,
          weekRange,
          weekends: [weekend]
        });
      }
    });
    
    return weekGroups.sort((a, b) => a.weekNumber - b.weekNumber);
  }, [monthWeekends]);

  // Analizza le statistiche weekend per store
  const weekendStats = useMemo(() => {
    const stats: WeekendStats[] = [];
    const targetStores = selectedStore === 'all' ? stores : stores.filter(s => s.id === selectedStore);

    for (const store of targetStores) {
      const storeEmployees = employees.filter(emp => emp.storeId === store.id && emp.isActive);
      const storeShifts = shifts.filter(shift => shift.storeId === store.id);
      const totalEmployees = storeEmployees.length;
      
      // 🆕 STATS CUMULATIVE PER IL MESE
      const cumulativeStats: WeekendStats = {
        storeId: store.id,
        storeName: store.name,
        totalEmployees,
        activeEmployees: totalEmployees,
        saturdayOffCount: 0,
        sundayOffCount: 0,
        bothDaysOffCount: 0,
        neitherDayOffCount: 0,
        saturdayOffPercentage: 0,
        sundayOffPercentage: 0,
        bothDaysOffPercentage: 0,
        weekendDetails: []
      };
      
      // 🆕 STATS PER OGNI SETTIMANA
      weekendsByWeek.forEach(weekGroup => {
        const weekStats: WeekendStats = {
          storeId: store.id,
          storeName: store.name,
          totalEmployees,
          activeEmployees: totalEmployees,
          saturdayOffCount: 0,
          sundayOffCount: 0,
          bothDaysOffCount: 0,
          neitherDayOffCount: 0,
          saturdayOffPercentage: 0,
          sundayOffPercentage: 0,
          bothDaysOffPercentage: 0,
          weekendDetails: [],
          weekNumber: weekGroup.weekNumber,
          weekRange: weekGroup.weekRange
        };
        
        // Contatori per la settimana
        const weekendDetails: WeekendDetail[] = [];
        const employeeSaturdayOff = new Set<string>();
        const employeeSundayOff = new Set<string>();
        const employeeBothOff = new Set<string>();
        
        // 📊 ANALIZZA OGNI WEEKEND DI QUESTA SETTIMANA
        weekGroup.weekends.forEach(weekend => {
          const saturdayShifts = storeShifts.filter(shift => 
            shift.date.toDateString() === weekend.saturday.toDateString()
          );
          const sundayShifts = storeShifts.filter(shift => 
            shift.date.toDateString() === weekend.sunday.toDateString()
          );
          
          const employeesWorkingSaturday = new Set(saturdayShifts.map(s => s.employeeId));
          const employeesWorkingSunday = new Set(sundayShifts.map(s => s.employeeId));
          
          const employeesWithSaturdayOff = storeEmployees
            .filter(emp => !employeesWorkingSaturday.has(emp.id))
            .map(emp => emp.id);
          
          const employeesWithSundayOff = storeEmployees
            .filter(emp => !employeesWorkingSunday.has(emp.id))
            .map(emp => emp.id);
          
          const employeesWithBothOff = storeEmployees
            .filter(emp => !employeesWorkingSaturday.has(emp.id) && !employeesWorkingSunday.has(emp.id))
            .map(emp => emp.id);
          
          // ✅ AGGIUNGI AGLI INSIEMI PER LA SETTIMANA CORRENTE
          employeesWithSaturdayOff.forEach(id => {
            employeeSaturdayOff.add(id);
          });
          
          employeesWithSundayOff.forEach(id => {
            employeeSundayOff.add(id);
          });
          
          employeesWithBothOff.forEach(id => {
            employeeBothOff.add(id);
          });
          
          // 📝 CREA DETTAGLIO WEEKEND
          weekendDetails.push({
            weekStartDate: new Date(weekend.saturday.getTime() - 5 * 24 * 60 * 60 * 1000), // Lunedì precedente
            weekEndDate: weekend.sunday,
            saturdayDate: weekend.saturday,
            sundayDate: weekend.sunday,
            employeesWithSaturdayOff,
            employeesWithSundayOff,
            employeesWithBothOff,
            totalWeekendShifts: saturdayShifts.length + sundayShifts.length
          });
        });
        
        // 📊 CALCOLA STATISTICHE PER QUESTA SETTIMANA
        weekStats.saturdayOffCount = employeeSaturdayOff.size;
        weekStats.sundayOffCount = employeeSundayOff.size;
        weekStats.bothDaysOffCount = employeeBothOff.size;
        weekStats.neitherDayOffCount = totalEmployees - new Set([...employeeSaturdayOff, ...employeeSundayOff]).size;
        
        // 📈 CALCOLA PERCENTUALI SETTIMANALI
        weekStats.saturdayOffPercentage = totalEmployees > 0 ? (weekStats.saturdayOffCount / totalEmployees) * 100 : 0;
        weekStats.sundayOffPercentage = totalEmployees > 0 ? (weekStats.sundayOffCount / totalEmployees) * 100 : 0;
        weekStats.bothDaysOffPercentage = totalEmployees > 0 ? (weekStats.bothDaysOffCount / totalEmployees) * 100 : 0;
        weekStats.weekendDetails = weekendDetails;
        
        stats.push(weekStats);
      });
      
      // 🔄 CALCOLA STATS CUMULATIVE SEPARATAMENTE
      let cumulativeSaturdayOff = 0;
      let cumulativeSundayOff = 0;
      let cumulativeBothOff = 0;
      const allWeekendDetails: WeekendDetail[] = [];
      
      monthWeekends.forEach(weekend => {
        const saturdayShifts = storeShifts.filter(shift => 
          shift.date.toDateString() === weekend.saturday.toDateString()
        );
        const sundayShifts = storeShifts.filter(shift => 
          shift.date.toDateString() === weekend.sunday.toDateString()
        );
        
        const employeesWorkingSaturday = new Set(saturdayShifts.map(s => s.employeeId));
        const employeesWorkingSunday = new Set(sundayShifts.map(s => s.employeeId));
        
        const employeesWithSaturdayOff = storeEmployees
          .filter(emp => !employeesWorkingSaturday.has(emp.id))
          .map(emp => emp.id);
        
        const employeesWithSundayOff = storeEmployees
          .filter(emp => !employeesWorkingSunday.has(emp.id))
          .map(emp => emp.id);
        
        const employeesWithBothOff = storeEmployees
          .filter(emp => !employeesWorkingSaturday.has(emp.id) && !employeesWorkingSunday.has(emp.id))
          .map(emp => emp.id);
        
        cumulativeSaturdayOff += employeesWithSaturdayOff.length;
        cumulativeSundayOff += employeesWithSundayOff.length;
        cumulativeBothOff += employeesWithBothOff.length;
        
        allWeekendDetails.push({
          weekStartDate: new Date(weekend.saturday.getTime() - 5 * 24 * 60 * 60 * 1000),
          weekEndDate: weekend.sunday,
          saturdayDate: weekend.saturday,
          sundayDate: weekend.sunday,
          employeesWithSaturdayOff,
          employeesWithSundayOff,
          employeesWithBothOff,
          totalWeekendShifts: saturdayShifts.length + sundayShifts.length
        });
      });
      
      // 📊 AGGIORNA STATS CUMULATIVE
      cumulativeStats.saturdayOffCount = cumulativeSaturdayOff;
      cumulativeStats.sundayOffCount = cumulativeSundayOff;
      cumulativeStats.bothDaysOffCount = cumulativeBothOff;
      cumulativeStats.weekendDetails = allWeekendDetails;
      
      const totalWeekends = monthWeekends.length;
      const totalPossibleEntries = totalEmployees * totalWeekends;
      
      cumulativeStats.saturdayOffPercentage = totalPossibleEntries > 0 ? 
        (cumulativeStats.saturdayOffCount / totalPossibleEntries) * 100 : 0;
      cumulativeStats.sundayOffPercentage = totalPossibleEntries > 0 ? 
        (cumulativeStats.sundayOffCount / totalPossibleEntries) * 100 : 0;
      cumulativeStats.bothDaysOffPercentage = totalPossibleEntries > 0 ? 
        (cumulativeStats.bothDaysOffCount / totalPossibleEntries) * 100 : 0;
      
      const allSaturdayOff = new Set(cumulativeStats.weekendDetails.flatMap(d => d.employeesWithSaturdayOff));
      const allSundayOff = new Set(cumulativeStats.weekendDetails.flatMap(d => d.employeesWithSundayOff));
      cumulativeStats.neitherDayOffCount = totalEmployees - new Set([...allSaturdayOff, ...allSundayOff]).size;
      
      // ✅ AGGIUNGI LE STATS CUMULATIVE
      stats.push(cumulativeStats);
    }
    
    return stats.sort((a, b) => a.storeName.localeCompare(b.storeName));
  }, [employees, stores, shifts, monthWeekends, selectedStore, weekendsByWeek]);

  // Analizza equità dipendenti
  const employeeAnalysis = useMemo(() => {
    const analysis: EmployeeWeekendStatus[] = [];
    const targetStores = selectedStore === 'all' ? stores : stores.filter(s => s.id === selectedStore);
    
    for (const store of targetStores) {
      const storeEmployees = employees.filter(emp => emp.storeId === store.id && emp.isActive);
      
      for (const employee of storeEmployees) {
        let saturdaysOff = 0;
        let sundaysOff = 0;
        let bothDaysOff = 0;
        
        for (const weekend of monthWeekends) {
          const saturdayShift = shifts.find(shift => 
            shift.employeeId === employee.id && 
            shift.date.toDateString() === weekend.saturday.toDateString()
          );
          const sundayShift = shifts.find(shift => 
            shift.employeeId === employee.id && 
            shift.date.toDateString() === weekend.sunday.toDateString()
          );
          
          const hasSaturdayOff = !saturdayShift;
          const hasSundayOff = !sundayShift;
          
          if (hasSaturdayOff) saturdaysOff++;
          if (hasSundayOff) sundaysOff++;
          if (hasSaturdayOff && hasSundayOff) bothDaysOff++;
        }
        
        const weekendsAnalyzed = monthWeekends.length;
        const weekendWorkPercentage = ((weekendsAnalyzed * 2 - saturdaysOff - sundaysOff) / (weekendsAnalyzed * 2)) * 100;
        
        // Calcola fairness score (0-100, 100 = perfettamente equo)
        const idealRestDays = weekendsAnalyzed; // Idealmente 1 giorno di riposo per weekend
        const actualRestDays = saturdaysOff + sundaysOff;
        const fairnessScore = Math.max(0, 100 - Math.abs(idealRestDays - actualRestDays) * 10);
        
        analysis.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          weekendsAnalyzed,
          saturdaysOff,
          sundaysOff,
          bothDaysOff,
          weekendWorkPercentage,
          fairnessScore
        });
      }
    }
    
    return analysis.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [employees, stores, shifts, monthWeekends, selectedStore]);

  const handleExport = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    exportWeekendReportToExcel(weekendStats, employeeAnalysis, monthWeekends, month, year);
  };

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    
    // Ultimi 6 mesi
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const label = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  }, []);

  const storeOptions = [
    { value: 'all', label: 'Tutti i Negozi' },
    ...stores.filter(s => s.isActive).map(store => ({
      value: store.id,
      label: store.name
    }))
  ];

  const viewModeOptions = [
    { value: 'summary', label: 'Riepilogo' },
    { value: 'weekly', label: 'Settimanale' },
    { value: 'detailed', label: 'Dettaglio' },
    { value: 'employee', label: 'Dipendenti' }
  ];

  // Calcola statistiche generali
  const overallStats = useMemo(() => {
    // Inizializza esplicitamente le variabili a 0
    let calculatedTotalEmployees = 0;
    let calculatedAvgSaturdayOff = 0;
    let calculatedAvgSundayOff = 0;
    let calculatedAvgBothOff = 0;
    
    // Filtra solo gli oggetti validi con tutte le proprietà richieste
    const validStats = Array.isArray(weekendStats) ? weekendStats.filter(stat => 
      stat && 
      typeof stat === 'object' && 
      typeof stat.totalEmployees === 'number' && 
      typeof stat.saturdayOffPercentage === 'number' && 
      typeof stat.sundayOffPercentage === 'number' && 
      typeof stat.bothDaysOffPercentage === 'number'
    ) : [];
    
    // Controlla che validStats sia un array non vuoto
    if (validStats.length > 0) {
      calculatedTotalEmployees = validStats.reduce((sum, stat) => sum + stat.totalEmployees, 0);
      calculatedAvgSaturdayOff = validStats.reduce((sum, stat) => sum + stat.saturdayOffPercentage, 0) / validStats.length;
      calculatedAvgSundayOff = validStats.reduce((sum, stat) => sum + stat.sundayOffPercentage, 0) / validStats.length;
      calculatedAvgBothOff = validStats.reduce((sum, stat) => sum + stat.bothDaysOffPercentage, 0) / validStats.length;
    }
    
    return {
      totalEmployees: calculatedTotalEmployees,
      avgSaturdayOff: Number(calculatedAvgSaturdayOff.toFixed(1)),
      avgSundayOff: Number(calculatedAvgSundayOff.toFixed(1)),
      avgBothOff: Number(calculatedAvgBothOff.toFixed(1)),
      totalWeekends: monthWeekends.length,
      storesAnalyzed: validStats.length
    };
  }, [weekendStats, monthWeekends]);

  return (
    <div className="space-y-4">
      {/* Header - Ridotto */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 rounded-lg p-2">
              <Coffee className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Report Riposi Weekend (Turni Pianificati)</h1>
              <p className="text-sm text-gray-600">Analisi distribuzione giorni di riposo basata sui turni effettivi</p>
            </div>
          </div>
          
          <Button
            icon={Download}
            onClick={handleExport}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            Esporta
          </Button>
        </div>

        {/* Controlli - Compatti */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthOptions}
            className="text-sm"
          />
          
          <Select
            value={selectedStore}
            onChange={setSelectedStore}
            options={storeOptions}
            className="text-sm"
          />
          
          <Select
            value={viewMode}
            onChange={setViewMode}
            options={viewModeOptions}
            className="text-sm"
          />
        </div>

        {/* Statistiche Generali - Compatte */}
        <div className="grid grid-cols-5 gap-2">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-blue-900">{overallStats.totalEmployees}</div>
            <div className="text-xs text-blue-700">Dipendenti</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-purple-900">{overallStats.totalWeekends}</div>
            <div className="text-xs text-purple-700">Weekend</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-green-900">{overallStats.avgSaturdayOff}%</div>
            <div className="text-xs text-green-700">Sabati Liberi <span className="text-xs text-blue-600">(pianificati)</span></div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-yellow-900">{overallStats.avgSundayOff}%</div>
            <div className="text-xs text-yellow-700">Domeniche Libere <span className="text-xs text-blue-600">(pianificati)</span></div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-indigo-900">{overallStats.avgBothOff}%</div>
            <div className="text-xs text-indigo-700">Weekend Completi <span className="text-xs text-blue-600">(pianificati)</span></div>
          </div>
        </div>
      </div>

      {/* Contenuto Principale */}
      {viewMode === 'summary' && (
        <SummaryView weekendStats={weekendStats.filter(stat => !stat.weekNumber)} monthWeekends={monthWeekends} selectedMonth={selectedMonth} />
      )}
      
      {viewMode === 'weekly' && (
        <WeeklyView 
          weekendStats={weekendStats.filter(stat => stat.weekNumber)} 
          weekendsByWeek={weekendsByWeek}
          employees={employees}
        />
      )}

      {viewMode === 'detailed' && (
        <DetailedView weekendStats={weekendStats} employees={employees} />
      )}

      {viewMode === 'employee' && (
        <EmployeeView employeeAnalysis={employeeAnalysis} />
      )}
    </div>
  );
};

// Componente Vista Riepilogo Mensile - Compatto
const SummaryView: React.FC<{ 
  weekendStats: WeekendStats[]; 
  monthWeekends: any[];
  selectedMonth: string;
}> = ({ 
  weekendStats, 
  monthWeekends,
  selectedMonth
}) => {
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'long' });
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-900">Riepilogo Cumulativo Mensile: {monthName} {year}</h3>
        <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          Totale Mese
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Punto Vendita
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dip.
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sab Liberi
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dom Libere
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Weekend Completi
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Equità
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {weekendStats.map((stat) => {
              const equityScore = Math.round((stat.saturdayOffPercentage + stat.sundayOffPercentage) / 2);
              
              return (
                <tr key={stat.storeId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{stat.storeName}</div>
                    <div className="text-xs text-gray-500">{stat.totalEmployees} dip.</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-gray-900">{stat.totalEmployees}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-blue-600">{stat.saturdayOffCount}</div>
                    <div className="text-xs text-gray-500">{stat.saturdayOffPercentage.toFixed(0)}%</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-purple-600">{stat.sundayOffCount}</div>
                    <div className="text-xs text-gray-500">{stat.sundayOffPercentage.toFixed(0)}%</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-green-600">{stat.bothDaysOffCount}</div>
                    <div className="text-xs text-gray-500">{stat.bothDaysOffPercentage.toFixed(0)}%</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      equityScore >= 70 ? 'bg-green-100 text-green-800' :
                      equityScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {equityScore >= 70 ? <CheckCircle className="h-3 w-3 mr-1" /> :
                       equityScore >= 50 ? <AlertTriangle className="h-3 w-3 mr-1" /> :
                       <TrendingDown className="h-3 w-3 mr-1" />}
                      {equityScore}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Nuovo componente Vista Settimanale
const WeeklyView: React.FC<{ 
  weekendStats: WeekendStats[]; 
  weekendsByWeek: any[];
  employees: Employee[];
}> = ({ 
  weekendStats, 
  weekendsByWeek,
  employees 
}) => {
  return (
  <div className="space-y-6">
    {weekendsByWeek.map((weekGroup, index) => {
      const weekStats = weekendStats.filter(stat => stat.weekNumber === weekGroup.weekNumber);
      
      return (
        <div key={`week-${weekGroup.weekNumber}`} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <h3 className="text-md font-semibold text-gray-900">Settimana {weekGroup.weekNumber}: {weekGroup.weekRange}</h3>
            </div>
            <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {weekGroup.weekends.length} weekend
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Punto Vendita
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dip.
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sab Liberi
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dom Libere
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Weekend Completi
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equità
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {weekStats.map((stat) => {
                  const equityScore = Math.round((stat.saturdayOffPercentage + stat.sundayOffPercentage) / 2);
                  
                  return (
                    <tr key={`${stat.storeId}-week-${stat.weekNumber}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{stat.storeName}</div>
                        <div className="text-xs text-gray-500">{stat.totalEmployees} dip.</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <div className="text-sm font-bold text-gray-900">{stat.totalEmployees}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <div className="text-sm font-bold text-blue-600">{stat.saturdayOffCount}</div>
                        <div className="text-xs text-gray-500">{stat.saturdayOffPercentage.toFixed(0)}%</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <div className="text-sm font-bold text-purple-600">{stat.sundayOffCount}</div>
                        <div className="text-xs text-gray-500">{stat.sundayOffPercentage.toFixed(0)}%</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <div className="text-sm font-bold text-green-600">{stat.bothDaysOffCount}</div>
                        <div className="text-xs text-gray-500">{stat.bothDaysOffPercentage.toFixed(0)}%</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          equityScore >= 70 ? 'bg-green-100 text-green-800' :
                          equityScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {equityScore >= 70 ? <CheckCircle className="h-3 w-3 mr-1" /> :
                           equityScore >= 50 ? <AlertTriangle className="h-3 w-3 mr-1" /> :
                           <TrendingDown className="h-3 w-3 mr-1" />}
                          {equityScore}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Dettaglio weekend della settimana */}
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {weekGroup.weekends.map((weekend, idx) => (
                <div key={idx} className="bg-white p-2 rounded border border-gray-200 text-xs">
                  <div className="font-medium text-gray-900">
                    {weekend.saturday.toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})} - 
                    {weekend.sunday.toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);
};

// Componente Vista Dettagliata - Compatta
const DetailedView: React.FC<{ weekendStats: WeekendStats[]; employees: Employee[] }> = ({ 
  weekendStats, 
  employees 
}) => {
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  
  return (
    <div className="space-y-4">
      {weekendStats.map((stat) => (
        <div key={stat.storeId} className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-md font-semibold text-gray-900">{stat.storeName}</h3>
            <p className="text-xs text-gray-600">Dettaglio weekend per weekend (turni pianificati)</p>
          </div>
          
          <div className="p-4">
            <div className="space-y-3">
              {stat.weekendDetails.map((detail, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {detail.saturdayDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - {detail.sundayDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {detail.totalWeekendShifts} turni
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-xs font-medium text-blue-900 mb-1">Sabato ({detail.employeesWithSaturdayOff.length})</div>
                      <div className="space-y-0.5">
                        {detail.employeesWithSaturdayOff.map(empId => {
                          const emp = employeeMap.get(empId);
                          return emp ? (
                            <div key={empId} className="text-xs text-blue-700">
                              {emp.firstName} {emp.lastName}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 rounded p-2">
                      <div className="text-xs font-medium text-purple-900 mb-1">Domenica ({detail.employeesWithSundayOff.length})</div>
                      <div className="space-y-0.5">
                        {detail.employeesWithSundayOff.map(empId => {
                          const emp = employeeMap.get(empId);
                          return emp ? (
                            <div key={empId} className="text-xs text-purple-700">
                              {emp.firstName} {emp.lastName}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                    
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-xs font-medium text-green-900 mb-1">Entrambi ({detail.employeesWithBothOff.length})</div>
                      <div className="space-y-0.5">
                        {detail.employeesWithBothOff.map(empId => {
                          const emp = employeeMap.get(empId);
                          return emp ? (
                            <div key={empId} className="text-xs text-green-700">
                              {emp.firstName} {emp.lastName}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Componente Vista Dipendenti - Compatta
const EmployeeView: React.FC<{ employeeAnalysis: EmployeeWeekendStatus[] }> = ({ 
  employeeAnalysis 
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-200">
      <h3 className="text-md font-semibold text-gray-900">Analisi per Dipendente</h3>
    </div>
    
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dipendente
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Weekend
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sab Liberi
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dom Libere
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Completi
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              % Lavoro
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Equità
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employeeAnalysis.map((emp) => (
            <tr key={emp.employeeId} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{emp.employeeName}</div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className="text-sm text-gray-900">{emp.weekendsAnalyzed}</div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className="text-sm text-blue-600 font-medium">
                  {emp.saturdaysOff}/{emp.weekendsAnalyzed}
                </div>
                <div className="text-xs text-gray-500">
                  {((emp.saturdaysOff / emp.weekendsAnalyzed) * 100).toFixed(0)}%
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className="text-sm text-purple-600 font-medium">
                  {emp.sundaysOff}/{emp.weekendsAnalyzed}
                </div>
                <div className="text-xs text-gray-500">
                  {((emp.sundaysOff / emp.weekendsAnalyzed) * 100).toFixed(0)}%
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className="text-sm text-green-600 font-medium">
                  {emp.bothDaysOff}
                </div>
                <div className="text-xs text-gray-500">
                  {((emp.bothDaysOff / emp.weekendsAnalyzed) * 100).toFixed(0)}%
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className={`text-sm font-medium ${
                  emp.weekendWorkPercentage > 70 ? 'text-red-600' :
                  emp.weekendWorkPercentage > 50 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {emp.weekendWorkPercentage.toFixed(0)}%
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  emp.fairnessScore >= 80 ? 'bg-green-100 text-green-800' :
                  emp.fairnessScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {emp.fairnessScore >= 80 ? <CheckCircle className="h-3 w-3 mr-1" /> :
                   emp.fairnessScore >= 60 ? <AlertTriangle className="h-3 w-3 mr-1" /> :
                   <TrendingDown className="h-3 w-3 mr-1" />}
                  {emp.fairnessScore.toFixed(0)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);