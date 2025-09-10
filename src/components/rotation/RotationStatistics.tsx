import React, { useState, useMemo } from 'react';
import { Employee } from '../../types';
import { ShiftAssignment, RotationStatistics as RotationStatsType } from '../../types/rotation';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { addDays } from '../../utils/timeUtils';

interface RotationStatisticsProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  currentWeek: Date;
  getRotationStatistics: (employeeId: string, startDate: Date, endDate: Date) => RotationStatsType | null;
  teamSummary: any;
}

export const RotationStatistics: React.FC<RotationStatisticsProps> = ({
  employees,
  assignments,
  currentWeek,
  getRotationStatistics,
  teamSummary
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  const periodOptions = [
    { value: 'week', label: 'Ultima Settimana' },
    { value: 'month', label: 'Ultimo Mese' },
    { value: 'quarter', label: 'Ultimo Trimestre' }
  ];

  const employeeOptions = [
    { value: 'all', label: 'Tutti i Dipendenti' },
    ...employees.map(emp => ({
      value: emp.id,
      label: `${emp.firstName} ${emp.lastName}`
    }))
  ];

  // Calcola date del periodo
  const { startDate, endDate } = useMemo(() => {
    const end = addDays(currentWeek, 6);
    let start: Date;

    switch (selectedPeriod) {
      case 'week':
        start = new Date(currentWeek);
        break;
      case 'month':
        start = new Date(currentWeek);
        start.setDate(start.getDate() - 30);
        break;
      case 'quarter':
        start = new Date(currentWeek);
        start.setDate(start.getDate() - 90);
        break;
      default:
        start = new Date(currentWeek);
    }

    return { startDate: start, endDate: end };
  }, [selectedPeriod, currentWeek]);

  // Calcola statistiche per tutti i dipendenti
  const employeeStats = useMemo(() => {
    return employees.map(employee => {
      const stats = getRotationStatistics(employee.id, startDate, endDate);
      return {
        employee,
        stats
      };
    }).filter(item => item.stats !== null);
  }, [employees, startDate, endDate, getRotationStatistics]);

  // Statistiche aggregate del team
  const aggregateStats = useMemo(() => {
    const totalShifts = employeeStats.reduce((sum, item) => sum + (item.stats?.totalShifts || 0), 0);
    const totalHours = employeeStats.reduce((sum, item) => sum + (item.stats?.totalHours || 0), 0);
    const avgRotationScore = employeeStats.length > 0 
      ? employeeStats.reduce((sum, item) => sum + (item.stats?.rotationScore || 0), 0) / employeeStats.length
      : 0;

    const shiftDistribution = employeeStats.reduce((acc, item) => {
      if (item.stats) {
        acc.morning += item.stats.shiftTypeDistribution.morning;
        acc.afternoon += item.stats.shiftTypeDistribution.afternoon;
        acc.evening += item.stats.shiftTypeDistribution.evening;
        acc.night += item.stats.shiftTypeDistribution.night;
      }
      return acc;
    }, { morning: 0, afternoon: 0, evening: 0, night: 0 });

    return {
      totalShifts,
      totalHours,
      avgRotationScore: Math.round(avgRotationScore),
      shiftDistribution,
      activeEmployees: employeeStats.length
    };
  }, [employeeStats]);

  // Dipendenti con performance migliori/peggiori
  const topPerformers = useMemo(() => {
    return employeeStats
      .sort((a, b) => (b.stats?.rotationScore || 0) - (a.stats?.rotationScore || 0))
      .slice(0, 3);
  }, [employeeStats]);

  const needsAttention = useMemo(() => {
    return employeeStats
      .filter(item => (item.stats?.rotationScore || 0) < 60)
      .sort((a, b) => (a.stats?.rotationScore || 0) - (b.stats?.rotationScore || 0))
      .slice(0, 3);
  }, [employeeStats]);

  const selectedEmployeeStats = selectedEmployee !== 'all' 
    ? employeeStats.find(item => item.employee.id === selectedEmployee)
    : null;

  return (
    <div className="space-y-6">
      {/* Controlli */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Statistiche Rotazione</h2>
        <div className="flex space-x-3">
          <Select
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            options={periodOptions}
            className="min-w-[150px]"
          />
          <Select
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            options={employeeOptions}
            className="min-w-[200px]"
          />
        </div>
      </div>

      {/* Statistiche generali del team */}
      {selectedEmployee === 'all' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-blue-900">{aggregateStats.totalShifts}</div>
                  <div className="text-sm text-blue-700">Turni Totali</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-900">{aggregateStats.totalHours.toFixed(0)}h</div>
                  <div className="text-sm text-green-700">Ore Totali</div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Target className="h-8 w-8 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold text-purple-900">{aggregateStats.avgRotationScore}</div>
                  <div className="text-sm text-purple-700">Score Medio</div>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold text-orange-900">{aggregateStats.activeEmployees}</div>
                  <div className="text-sm text-orange-700">Dipendenti Attivi</div>
                </div>
              </div>
            </div>
          </div>

          {/* Distribuzione turni per tipo */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuzione Turni per Tipo</h3>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(aggregateStats.shiftDistribution).map(([type, count]) => {
                const total = Object.values(aggregateStats.shiftDistribution).reduce((sum, c) => sum + c, 0);
                const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0';
                
                const typeLabels = {
                  morning: '🌅 Mattina',
                  afternoon: '☀️ Pomeriggio',
                  evening: '🌆 Serale',
                  night: '🌙 Notturno'
                };

                const typeColors = {
                  morning: 'bg-yellow-100 text-yellow-800',
                  afternoon: 'bg-blue-100 text-blue-800',
                  evening: 'bg-purple-100 text-purple-800',
                  night: 'bg-indigo-100 text-indigo-800'
                };

                return (
                  <div key={type} className={`p-4 rounded-lg ${typeColors[type as keyof typeof typeColors]}`}>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm">{typeLabels[type as keyof typeof typeLabels]}</div>
                      <div className="text-xs mt-1">{percentage}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top performers e dipendenti che necessitano attenzione */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Award className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
              </div>
              <div className="space-y-3">
                {topPerformers.map((item, index) => (
                  <div key={item.employee.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        'bg-orange-300 text-orange-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.employee.firstName} {item.employee.lastName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.stats?.totalShifts} turni • {item.stats?.totalHours.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {item.stats?.rotationScore}
                      </div>
                      <div className="text-xs text-gray-500">Score</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Necessitano Attenzione */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">Necessitano Attenzione</h3>
              </div>
              {needsAttention.length > 0 ? (
                <div className="space-y-3">
                  {needsAttention.map((item) => (
                    <div key={item.employee.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.employee.firstName} {item.employee.lastName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.stats?.totalShifts} turni • {item.stats?.totalHours.toFixed(1)}h
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-yellow-600">
                          {item.stats?.rotationScore}
                        </div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Tutti i dipendenti hanno performance soddisfacenti!</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabella dettagliata dipendenti */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Dettaglio per Dipendente</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dipendente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Turni
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ore Totali
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score Rotazione
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Giorni Consecutivi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Riposo Medio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employeeStats.map((item) => (
                    <tr key={item.employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {item.employee.firstName} {item.employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.employee.contractHours}h contratto
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.stats?.totalShifts || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.stats?.totalHours.toFixed(1) || '0.0'}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (item.stats?.rotationScore || 0) >= 80 ? 'bg-green-100 text-green-800' :
                            (item.stats?.rotationScore || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.stats?.rotationScore || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.stats?.consecutiveDaysWorked || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.stats?.averageRestHours.toFixed(1) || '0.0'}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Statistiche dipendente singolo */}
      {selectedEmployee !== 'all' && selectedEmployeeStats && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {selectedEmployeeStats.employee.firstName} {selectedEmployeeStats.employee.lastName}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {selectedEmployeeStats.stats?.totalShifts}
                </div>
                <div className="text-sm text-gray-600">Turni Totali</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {selectedEmployeeStats.stats?.totalHours.toFixed(1)}h
                </div>
                <div className="text-sm text-gray-600">Ore Lavorate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {selectedEmployeeStats.stats?.rotationScore}
                </div>
                <div className="text-sm text-gray-600">Score Rotazione</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {selectedEmployeeStats.stats?.averageRestHours.toFixed(1)}h
                </div>
                <div className="text-sm text-gray-600">Riposo Medio</div>
              </div>
            </div>

            {/* Distribuzione turni per tipo */}
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(selectedEmployeeStats.stats?.shiftTypeDistribution || {}).map(([type, count]) => {
                const typeLabels = {
                  morning: '🌅 Mattina',
                  afternoon: '☀️ Pomeriggio',
                  evening: '🌆 Serale',
                  night: '🌙 Notturno'
                };

                return (
                  <div key={type} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{count}</div>
                    <div className="text-sm text-gray-600">
                      {typeLabels[type as keyof typeof typeLabels]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};