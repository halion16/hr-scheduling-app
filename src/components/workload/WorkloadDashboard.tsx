import React, { useMemo, useState } from 'react';
import { Employee, Store, Shift } from '../../types';
import { ValidationAdminSettings } from '../../types/validation';
import { Button } from '../common/Button';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Clock, 
  Target, 
  RefreshCw,
  Info,
  CheckCircle2,
  Calendar,
  Activity
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  Legend
} from 'recharts';

interface WorkloadDashboardProps {
  employees: Employee[];
  shifts: Shift[];
  stores: Store[];
  weekStart: Date;
  adminSettings?: ValidationAdminSettings;
  storeFilter?: string; // 🆕 Filtro per negozio specifico
}

interface EmployeeWorkloadStats {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  totalShifts: number;
  dailyHours: { [date: string]: number };
  averageHoursPerDay: number;
  isOverloaded: boolean;
  isUnderloaded: boolean;
  equityScore: number;
  // 🆕 Nuovi campi per limiti individuali
  contractHours: number;
  minHours: number;
  contractUtilization: number;
}

interface WorkloadSummary {
  totalEmployees: number;
  totalHours: number;
  averageHours: number;
  maxHours: number;
  minHours: number;
  standardDeviation: number;
  equityScore: number;
  overloadedCount: number;
  underloadedCount: number;
  // 🆕 Nuovi campi per utilizzo contratti
  averageContractUtilization: number;
  optimallyUtilizedCount: number;
}

interface EquityTrendData {
  period: string;
  equityScore: number;
  totalHours: number;
  averageHours: number;
  standardDeviation: number;
}

interface WorkloadDistributionData {
  name: string;
  hours: number;
  percentage: number;
  color: string;
}

interface EmployeeComparisonData {
  name: string;
  actualHours: number;
  targetHours: number;
  difference: number;
}

export const WorkloadDashboard: React.FC<WorkloadDashboardProps> = ({
  employees,
  shifts,
  stores,
  weekStart,
  adminSettings,
  storeFilter // 🆕 Riceve il filtro negozio
}) => {
  // 🔧 Usa storeFilter passato dall'esterno invece del state locale
  const [selectedStore, setSelectedStore] = useState<string>(storeFilter || '');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [viewMode, setViewMode] = useState<'summary' | 'trends' | 'distribution'>('summary');

  // 🔧 Sincronizza il state locale con il filtro esterno
  React.useEffect(() => {
    setSelectedStore(storeFilter || '');
  }, [storeFilter]);

  // 🔧 Funzione riutilizzabile per calcolare ore dipendente da turni (COERENTE TRA TUTTI I SISTEMI)
  const calculateEmployeeStatsForPeriod = (
    employee: Employee, 
    shifts: Shift[], 
    periodStart: Date, 
    periodEnd: Date,
    adminSettings?: ValidationAdminSettings
  ) => {
    // Filtra turni del dipendente nel periodo
    const employeeShifts = shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shift.employeeId === employee.id && 
             shiftDate >= periodStart && 
             shiftDate <= periodEnd;
    });
    
    // 🔧 USA actualHours se disponibile, altrimenti calcola con break (LOGICA UNIFICATA)
    const totalHours = employeeShifts.reduce((sum, shift) => {
      if (shift.actualHours && shift.actualHours > 0) {
        return sum + shift.actualHours;
      } else {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const hoursMinusBreak = calculatedHours - (shift.breakDuration || 0) / 60;
        return sum + Math.max(0, hoursMinusBreak);
      }
    }, 0);

    // Calcola ore giornaliere
    const dailyHours: { [date: string]: number } = {};
    employeeShifts.forEach(shift => {
      const dateStr = shift.date.toISOString().split('T')[0];
      let hours: number;
      if (shift.actualHours && shift.actualHours > 0) {
        hours = shift.actualHours;
      } else {
        const start = new Date(`2000-01-01T${shift.startTime}`);
        const end = new Date(`2000-01-01T${shift.endTime}`);
        const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        hours = Math.max(0, calculatedHours - (shift.breakDuration || 0) / 60);
      }
      dailyHours[dateStr] = (dailyHours[dateStr] || 0) + hours;
    });

    const workingDays = Object.keys(dailyHours).length;
    const averageHoursPerDay = workingDays > 0 ? totalHours / workingDays : 0;

    // 🔧 USA LIMITI INDIVIDUALI del dipendente (ALLINEATO CON ALERT SYSTEM)
    const targetHoursPerWeek = adminSettings?.dynamicStaffRequirements?.targetHoursPerWeek || 32;
    const employeeMaxHours = employee.contractHours || targetHoursPerWeek;
    const employeeMinHours = employee.fixedHours || Math.max(employeeMaxHours * 0.5, 8);
    
    // 🔧 Calcola percentuale di utilizzo del contratto individuale
    const contractUtilization = employeeMaxHours > 0 ? (totalHours / employeeMaxHours) * 100 : 0;
    
    // 🔧 Equity Score basato su utilizzo ottimale del contratto (80-95%)
    const optimalUtilization = 87.5;
    const utilizationDeviation = Math.abs(contractUtilization - optimalUtilization);
    const equityScore = Math.max(0, 100 - utilizationDeviation * 2);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      totalHours: Number(totalHours.toFixed(1)),
      totalShifts: employeeShifts.length,
      dailyHours,
      averageHoursPerDay: Number(averageHoursPerDay.toFixed(1)),
      isOverloaded: totalHours > employeeMaxHours,
      isUnderloaded: totalHours < employeeMinHours,
      equityScore: Number(equityScore.toFixed(1)),
      contractHours: employeeMaxHours,
      minHours: employeeMinHours,
      contractUtilization: Number(contractUtilization.toFixed(1))
    };
  };

  // Calcola statistiche workload per periodo
  const workloadStats = useMemo(() => {
    console.log('🔄 Calculating workload stats for period:', selectedPeriod);
    
    // Calcola range del periodo
    const periodStart = new Date(weekStart);
    const periodEnd = new Date(weekStart);
    if (selectedPeriod === 'week') {
      periodEnd.setDate(periodEnd.getDate() + 6);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(0);
    }

    // 🔧 Filtra dipendenti per negozio selezionato E attivi
    const activeEmployees = employees.filter(emp => {
      const isActive = emp.isActive;
      const matchesStore = !selectedStore || emp.storeId === selectedStore;
      return isActive && matchesStore;
    });

    // 🔧 USA LA FUNZIONE UNIFICATA per calcolare stats dipendenti
    const employeeStats: EmployeeWorkloadStats[] = activeEmployees.map(employee => 
      calculateEmployeeStatsForPeriod(employee, shifts, periodStart, periodEnd, adminSettings)
    );

    // 🔧 Calcola summary basato su limiti individuali
    const totalHours = employeeStats.reduce((sum, emp) => sum + emp.totalHours, 0);
    const averageHours = employeeStats.length > 0 ? totalHours / employeeStats.length : 0;
    const maxHours = Math.max(...employeeStats.map(emp => emp.totalHours), 0);
    const minHours = employeeStats.length > 0 ? Math.min(...employeeStats.map(emp => emp.totalHours)) : 0;
    
    const averageEquityScore = employeeStats.length > 0 
      ? employeeStats.reduce((sum, emp) => sum + emp.equityScore, 0) / employeeStats.length 
      : 100;
    
    const averageContractUtilization = employeeStats.length > 0
      ? employeeStats.reduce((sum, emp) => sum + emp.contractUtilization, 0) / employeeStats.length
      : 0;
    
    const utilizationVariance = employeeStats.reduce((sum, emp) => 
      sum + Math.pow(emp.contractUtilization - averageContractUtilization, 2), 0) / Math.max(employeeStats.length, 1);
    const utilizationStandardDeviation = Math.sqrt(utilizationVariance);

    const summary: WorkloadSummary = {
      totalEmployees: employeeStats.length,
      totalHours: Number(totalHours.toFixed(1)),
      averageHours: Number(averageHours.toFixed(1)),
      maxHours: Number(maxHours.toFixed(1)),
      minHours: Number(minHours.toFixed(1)),
      standardDeviation: Number(utilizationStandardDeviation.toFixed(1)),
      equityScore: Number(averageEquityScore.toFixed(1)),
      overloadedCount: employeeStats.filter(emp => emp.isOverloaded).length,
      underloadedCount: employeeStats.filter(emp => emp.isUnderloaded).length,
      averageContractUtilization: Number(averageContractUtilization.toFixed(1)),
      optimallyUtilizedCount: employeeStats.filter(emp => 
        emp.contractUtilization >= 80 && emp.contractUtilization <= 95
      ).length
    };

    return { employeeStats, summary };
  }, [employees, shifts, selectedStore, selectedPeriod, weekStart, adminSettings]);

  // 🔧 Calcola dati trend equità per ultimi 4 periodi (USA FUNZIONE UNIFICATA)
  const equityTrendData = useMemo(() => {
    const trendData: EquityTrendData[] = [];
    const periodsToAnalyze = 4;

    for (let i = periodsToAnalyze - 1; i >= 0; i--) {
      const periodStart = new Date(weekStart);
      const periodEnd = new Date(weekStart);
      
      if (selectedPeriod === 'week') {
        periodStart.setDate(periodStart.getDate() - (i * 7));
        periodEnd.setDate(periodStart.getDate() + 6);
      } else {
        periodStart.setMonth(periodStart.getMonth() - i);
        periodStart.setDate(1);
        periodEnd.setMonth(periodStart.getMonth() + 1);
        periodEnd.setDate(0);
      }

      // 🔧 Filtra dipendenti per negozio selezionato E attivi
      const activeEmployees = employees.filter(emp => {
        const isActive = emp.isActive;
        const matchesStore = !selectedStore || emp.storeId === selectedStore;
        return isActive && matchesStore;
      });

      // 🔧 USA LA STESSA FUNZIONE UNIFICATA per calcolare stats periodo
      const periodEmployeeStats = activeEmployees.map(employee => 
        calculateEmployeeStatsForPeriod(employee, shifts, periodStart, periodEnd, adminSettings)
      );

      // 🔧 Calcola metriche aggregate usando le stesse formule del workloadStats
      const totalHours = periodEmployeeStats.reduce((sum, emp) => sum + emp.totalHours, 0);
      const averageHours = periodEmployeeStats.length > 0 ? totalHours / periodEmployeeStats.length : 0;
      
      const averageEquityScore = periodEmployeeStats.length > 0 
        ? periodEmployeeStats.reduce((sum, emp) => sum + emp.equityScore, 0) / periodEmployeeStats.length 
        : 100;
      
      const averageContractUtilization = periodEmployeeStats.length > 0
        ? periodEmployeeStats.reduce((sum, emp) => sum + emp.contractUtilization, 0) / periodEmployeeStats.length
        : 0;
      
      const utilizationVariance = periodEmployeeStats.reduce((sum, emp) => 
        sum + Math.pow(emp.contractUtilization - averageContractUtilization, 2), 0) / Math.max(periodEmployeeStats.length, 1);
      const utilizationStandardDeviation = Math.sqrt(utilizationVariance);

      const periodLabel = selectedPeriod === 'week' 
        ? `Sett. ${periodStart.getDate()}/${periodStart.getMonth() + 1}`
        : `${periodStart.toLocaleDateString('it-IT', { month: 'short' })}`;

      trendData.push({
        period: periodLabel,
        equityScore: Number(averageEquityScore.toFixed(1)), // 🔧 USA STESSO CALCOLO del workloadStats
        totalHours: Number(totalHours.toFixed(1)),
        averageHours: Number(averageHours.toFixed(1)),
        standardDeviation: Number(utilizationStandardDeviation.toFixed(1)) // 🔧 USA STESSA DEVIAZIONE del workloadStats
      });
    }

    return trendData;
  }, [employees, shifts, selectedStore, selectedPeriod, weekStart, adminSettings]);

  // Dati distribuzione workload
  const workloadDistributionData = useMemo(() => {
    const { employeeStats } = workloadStats;
    const totalHours = employeeStats.reduce((sum, emp) => sum + emp.totalHours, 0);
    
    const distributionRanges = [
      { name: '0-10h', min: 0, max: 10, color: '#ef4444' },
      { name: '11-20h', min: 11, max: 20, color: '#f59e0b' },
      { name: '21-30h', min: 21, max: 30, color: '#10b981' },
      { name: '31-40h', min: 31, max: 40, color: '#3b82f6' },
      { name: '40+h', min: 41, max: Infinity, color: '#8b5cf6' }
    ];

    return distributionRanges.map(range => {
      const employeesInRange = employeeStats.filter(emp => 
        emp.totalHours >= range.min && emp.totalHours <= range.max
      );
      const hoursInRange = employeesInRange.reduce((sum, emp) => sum + emp.totalHours, 0);
      const percentage = totalHours > 0 ? (hoursInRange / totalHours) * 100 : 0;

      return {
        name: range.name,
        hours: Number(hoursInRange.toFixed(1)),
        percentage: Number(percentage.toFixed(1)),
        color: range.color
      };
    }).filter(item => item.hours > 0);
  }, [workloadStats]);

  // Dati confronto dipendenti
  const employeeComparisonData = useMemo(() => {
    return workloadStats.employeeStats
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10) // Top 10 dipendenti
      .map(emp => ({
        name: emp.employeeName.split(' ')[0], // Solo nome
        actualHours: emp.totalHours,
        targetHours: emp.contractHours, // 🔧 USA LIMITI CONTRATTUALI INDIVIDUALI
        difference: emp.totalHours - emp.contractHours
      }));
  }, [workloadStats]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name.includes('Score') ? '%' : 'h'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getEquityColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getWorkloadColor = (employee: EmployeeWorkloadStats) => {
    if (employee.isOverloaded) return 'border-red-500 bg-red-50';
    if (employee.isUnderloaded) return 'border-yellow-500 bg-yellow-50';
    return 'border-green-500 bg-green-50';
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <PieChart className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Distribuzione Workload</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Store Filter */}
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutti i negozi</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>

            {/* Period Filter */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Settimana</option>
              <option value="month">Mese</option>
            </select>

            {/* View Mode Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                  viewMode === 'summary' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="h-4 w-4 inline mr-1" />
                Riepilogo
              </button>
              <button
                onClick={() => setViewMode('trends')}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                  viewMode === 'trends' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Activity className="h-4 w-4 inline mr-1" />
                Trend
              </button>
              <button
                onClick={() => setViewMode('distribution')}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                  viewMode === 'distribution' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PieChart className="h-4 w-4 inline mr-1" />
                Distribuzione
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => window.location.reload()}
            >
              Aggiorna
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Employees */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Dipendenti Attivi</p>
              <p className="text-xl font-semibold text-gray-900">{workloadStats.summary.totalEmployees}</p>
            </div>
            <Users className="h-6 w-6 text-blue-500" />
          </div>
        </div>

        {/* Total Hours */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Ore Totali</p>
              <p className="text-xl font-semibold text-gray-900">{workloadStats.summary.totalHours}h</p>
              <p className="text-xs text-gray-500">Media: {workloadStats.summary.averageHours}h</p>
            </div>
            <Clock className="h-6 w-6 text-green-500" />
          </div>
        </div>

        {/* Equity Score */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Score Equità</p>
              <p className={`text-xl font-semibold ${getEquityColor(workloadStats.summary.equityScore).split(' ')[0]}`}>
                {workloadStats.summary.equityScore.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500">σ: {workloadStats.summary.standardDeviation}%</p>
            </div>
            <Target className="h-6 w-6 text-purple-500" />
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Allerte</p>
              <div className="flex items-center space-x-2 mt-1">
                {workloadStats.summary.overloadedCount > 0 && (
                  <span className="text-red-600 font-semibold text-sm">{workloadStats.summary.overloadedCount} sovraccarichi</span>
                )}
                {workloadStats.summary.underloadedCount > 0 && (
                  <span className="text-yellow-600 font-semibold text-sm">{workloadStats.summary.underloadedCount} sottoutilizzati</span>
                )}
                {workloadStats.summary.overloadedCount === 0 && workloadStats.summary.underloadedCount === 0 && (
                  <span className="text-green-600 font-semibold text-sm flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Tutto OK
                  </span>
                )}
              </div>
            </div>
            <AlertTriangle className={`h-8 w-8 ${
              workloadStats.summary.overloadedCount > 0 ? 'text-red-500' :
              workloadStats.summary.underloadedCount > 0 ? 'text-yellow-500' : 'text-green-500'
            }`} />
          </div>
        </div>
      </div>

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Distribuzione Ore per Dipendente</h3>
            <p className="text-sm text-gray-600">Analisi dettagliata del carico di lavoro per {selectedPeriod === 'week' ? 'settimana' : 'mese'}</p>
          </div>
          
          {/* 🔧 Container con scorrimento verticale e orizzontale */}
          <div className="max-h-96 overflow-y-auto">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dipendente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ore Totali
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° Turni
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Media/Giorno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score Equità
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workloadStats.employeeStats
                  .sort((a, b) => b.totalHours - a.totalHours)
                  .map((employee) => (
                  <tr key={employee.employeeId} className={`hover:bg-gray-50 ${getWorkloadColor(employee)}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{employee.employeeName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-semibold">{employee.totalHours}h</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.totalShifts}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.averageHoursPerDay}h</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEquityColor(employee.equityScore)}`}>
                        {employee.equityScore.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.isOverloaded && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Sovraccarico
                        </span>
                      )}
                      {employee.isUnderloaded && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Sottoutilizzato
                        </span>
                      )}
                      {!employee.isOverloaded && !employee.isUnderloaded && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Bilanciato
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Trends View */}
      {viewMode === 'trends' && (
        <div className="space-y-6">
          {/* Equity Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Trend Score Equità</h3>
              <p className="text-sm text-gray-600">Evoluzione dell'equità della distribuzione nel tempo</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityTrendData}>
                  <defs>
                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={renderCustomTooltip} />
                  <Area 
                    type="monotone" 
                    dataKey="equityScore" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorEquity)" 
                    name="Score Equità"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hours Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Trend Ore Totali</h3>
              <p className="text-sm text-gray-600">Evoluzione delle ore totali e medie nel tempo</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityTrendData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={renderCustomTooltip} />
                  <Area 
                    type="monotone" 
                    dataKey="totalHours" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                    name="Ore Totali"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="averageHours" 
                    stroke="#f59e0b" 
                    fillOpacity={0.6} 
                    fill="url(#colorAverage)" 
                    name="Ore Medie"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Employee Comparison Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confronto Ore Dipendenti</h3>
              <p className="text-sm text-gray-600">Ore attuali vs. target per dipendente (top 10)</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={employeeComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip content={renderCustomTooltip} />
                  <Legend />
                  <Bar dataKey="actualHours" fill="#3b82f6" name="Ore Attuali" />
                  <Bar dataKey="targetHours" fill="#10b981" name="Ore Target" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Summary Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Statistiche Trend</h3>
              <p className="text-sm text-gray-600">Riepilogo dei trend degli ultimi 4 periodi</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Score Medio</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(equityTrendData.reduce((sum, data) => sum + data.equityScore, 0) / Math.max(equityTrendData.length, 1)).toFixed(0)}%
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Ore Medie</p>
                <p className="text-2xl font-bold text-green-600">
                  {(equityTrendData.reduce((sum, data) => sum + data.averageHours, 0) / Math.max(equityTrendData.length, 1)).toFixed(1)}h
                </p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Deviazione Media</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {(equityTrendData.reduce((sum, data) => sum + data.standardDeviation, 0) / Math.max(equityTrendData.length, 1)).toFixed(1)}h
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Trend</p>
                <p className="text-2xl font-bold text-purple-600">
                  {equityTrendData.length > 1 && 
                   equityTrendData[equityTrendData.length - 1].equityScore > equityTrendData[0].equityScore 
                   ? '↗' : '↘'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distribution View */}
      {viewMode === 'distribution' && (
        <div className="space-y-6">
          {/* Hours Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Distribuzione Ore per Range</h3>
              <p className="text-sm text-gray-600">Percentuale delle ore totali per fascia oraria</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={workloadDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {workloadDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value}%`, 'Percentuale']}
                    labelFormatter={(label) => `Range: ${label}`}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Summary Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Dettaglio Distribuzione</h3>
              <p className="text-sm text-gray-600">Breakdown dettagliato per range orario</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Range Ore
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dipendenti
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ore Totali
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentuale
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Indicatore
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workloadDistributionData.map((range, index) => {
                    const employeesInRange = workloadStats.employeeStats.filter(emp => {
                      const min = range.name === '0-10h' ? 0 : range.name === '11-20h' ? 11 : range.name === '21-30h' ? 21 : range.name === '31-40h' ? 31 : 41;
                      const max = range.name === '0-10h' ? 10 : range.name === '11-20h' ? 20 : range.name === '21-30h' ? 30 : range.name === '31-40h' ? 40 : Infinity;
                      return emp.totalHours >= min && emp.totalHours <= max;
                    });
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div 
                              className="w-4 h-4 rounded mr-3" 
                              style={{ backgroundColor: range.color }}
                            ></div>
                            <div className="text-sm font-medium text-gray-900">{range.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-semibold">{employeesInRange.length}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-semibold">{range.hours}h</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{range.percentage}%</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-300" 
                              style={{ 
                                width: `${range.percentage}%`, 
                                backgroundColor: range.color 
                              }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Workload Balance Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bilanciamento Workload</h3>
              <p className="text-sm text-gray-600">Dipendenti per categoria di carico di lavoro</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart 
                  data={[
                    { 
                      category: 'Sottoutilizzati', 
                      count: workloadStats.summary.underloadedCount,
                      color: '#f59e0b'
                    },
                    { 
                      category: 'Bilanciati', 
                      count: workloadStats.summary.totalEmployees - workloadStats.summary.overloadedCount - workloadStats.summary.underloadedCount,
                      color: '#10b981'
                    },
                    { 
                      category: 'Sovraccarichi', 
                      count: workloadStats.summary.overloadedCount,
                      color: '#ef4444'
                    }
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [`${value}`, 'Dipendenti']}
                    labelFormatter={(label) => `Categoria: ${label}`}
                  />
                  <Bar dataKey="count">
                    {[
                      { category: 'Sottoutilizzati', count: workloadStats.summary.underloadedCount, color: '#f59e0b' },
                      { category: 'Bilanciati', count: workloadStats.summary.totalEmployees - workloadStats.summary.overloadedCount - workloadStats.summary.underloadedCount, color: '#10b981' },
                      { category: 'Sovraccarichi', count: workloadStats.summary.overloadedCount, color: '#ef4444' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Insights */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Insights Distribuzione</h3>
              <p className="text-sm text-gray-600">Analisi automatica della distribuzione ore</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Range Predominante</h4>
                <p className="text-sm text-gray-600">
                  {workloadDistributionData.length > 0 && 
                   workloadDistributionData.reduce((prev, current) => 
                     prev.percentage > current.percentage ? prev : current
                   ).name
                  } con {workloadDistributionData.length > 0 && 
                    workloadDistributionData.reduce((prev, current) => 
                      prev.percentage > current.percentage ? prev : current
                    ).percentage
                  }%
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Concentrazione</h4>
                <p className="text-sm text-gray-600">
                  {workloadDistributionData.filter(d => d.percentage > 20).length > 2 
                    ? 'Distribuzione equilibrata' 
                    : 'Concentrazione alta'
                  }
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Raccomandazione</h4>
                <p className="text-sm text-gray-600">
                  {workloadStats.summary.overloadedCount > 0 
                    ? 'Redistribuire ore dipendenti sovraccarichi'
                    : workloadStats.summary.underloadedCount > 0 
                    ? 'Incrementare ore dipendenti sottoutilizzati'
                    : 'Distribuzione ottimale'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Come leggere i dati:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Score Equità</strong>: Indica quanto la distribuzione ore è bilanciata (100% = perfetto equilibrio)</li>
              <li>• <strong>Sovraccarico</strong>: Dipendenti che superano la soglia massima di ore configurata dall'admin</li>
              <li>• <strong>Sottoutilizzato</strong>: Dipendenti con meno di 10 ore nel periodo</li>
              <li>• Le soglie possono essere configurate dal pannello Amministratore &gt; Validazione</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};