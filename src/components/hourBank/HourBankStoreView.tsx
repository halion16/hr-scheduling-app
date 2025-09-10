import React, { useState } from 'react';
import { Employee, Store } from '../../types';
import { Button } from '../common/Button';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Plus,
  Minus,
  BarChart3
} from 'lucide-react';

interface HourBankStoreViewProps {
  store: Store;
  employees: Employee[];
  getStoreHourBankSummary: (storeId: string, storeName: string) => any;
  getEmployeeHourBankReport: (employeeId: string, employees: Employee[]) => any;
}

export const HourBankStoreView: React.FC<HourBankStoreViewProps> = ({
  store,
  employees,
  getStoreHourBankSummary,
  getEmployeeHourBankReport
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  
  const summary = getStoreHourBankSummary(store.id, store.name);
  const storeEmployees = employees.filter(emp => emp.storeId === store.id && emp.isActive);

  const getBalanceColor = (balance: number) => {
    if (balance > 5) return 'text-green-600';
    if (balance < -5) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 5) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (balance < -5) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Store Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{store.name}</h3>
            <p className="text-sm text-gray-600">Riepilogo Banca Ore</p>
          </div>
          
          <div className="text-right">
            <div className={`text-2xl font-bold ${getBalanceColor(summary.netBalance)}`}>
              {summary.netBalance > 0 ? '+' : ''}{summary.netBalance.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-600">Bilancio Netto</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-900">{summary.totalEmployees}</div>
            <div className="text-sm text-blue-700">Dipendenti</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-green-900">{summary.totalCredit.toFixed(1)}h</div>
            <div className="text-sm text-green-700">Credito Totale</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-red-900">{summary.totalDebt.toFixed(1)}h</div>
            <div className="text-sm text-red-700">Debito Totale</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-900">{summary.pendingRecoveries}</div>
            <div className="text-sm text-yellow-700">Recuperi Pending</div>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Dipendenti - Saldi Banca Ore</h4>
        </div>
        
        <div className="divide-y divide-gray-200">
          {storeEmployees.map(employee => {
            const report = getEmployeeHourBankReport(employee.id, employees);
            
            if (!report) {
              return (
                <div key={employee.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        Nessun dato banca ore disponibile
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    Account non inizializzato
                  </div>
                </div>
              );
            }

            const balance = report.account.currentBalance;
            
            return (
              <div key={employee.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      balance > 5 ? 'bg-green-100' :
                      balance < -5 ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {getBalanceIcon(balance)}
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {employee.contractHours}h contratto • 
                        {report.recentEntries.length} entries recenti
                      </div>
                      
                      {report.recommendations.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          💡 {report.recommendations[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${getBalanceColor(balance)}`}>
                      {balance > 0 ? '+' : ''}{balance.toFixed(1)}h
                    </div>
                    <div className="text-sm text-gray-500">
                      Saldo Attuale
                    </div>
                    
                    {report.pendingRecoveries.length > 0 && (
                      <div className="text-xs text-yellow-600 mt-1">
                        {report.pendingRecoveries.length} recuperi pending
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {storeEmployees.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun Dipendente</h3>
            <p className="text-gray-500">Non ci sono dipendenti assegnati a questo negozio</p>
          </div>
        )}
      </div>
    </div>
  );
};