import React, { useState } from 'react';
import { Employee } from '../../types';
import { EmployeeHourBankReport } from '../../types/hourBank';
import { Button } from '../common/Button';
import { 
  User, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Plus,
  Minus
} from 'lucide-react';

interface HourBankEmployeeDetailProps {
  employee: Employee;
  report: EmployeeHourBankReport;
  onCreateRecoveryRequest: () => void;
}

export const HourBankEmployeeDetail: React.FC<HourBankEmployeeDetailProps> = ({
  employee,
  report,
  onCreateRecoveryRequest
}) => {
  const [showWeeklyDetails, setShowWeeklyDetails] = useState(false);

  const getBalanceStatus = (balance: number) => {
    if (balance > 10) return { color: 'text-green-600 bg-green-100', icon: TrendingUp, status: 'Credito Alto' };
    if (balance > 0) return { color: 'text-green-600 bg-green-50', icon: CheckCircle, status: 'Credito' };
    if (balance > -5) return { color: 'text-yellow-600 bg-yellow-50', icon: Clock, status: 'Equilibrio' };
    if (balance > -10) return { color: 'text-red-600 bg-red-50', icon: TrendingDown, status: 'Debito' };
    return { color: 'text-red-600 bg-red-100', icon: AlertTriangle, status: 'Debito Alto' };
  };

  const balanceStatus = getBalanceStatus(report.account.currentBalance);
  const Icon = balanceStatus.icon;

  return (
    <div className="space-y-6">
      {/* Employee Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${balanceStatus.color}`}>
              <Icon className="h-8 w-8" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {employee.firstName} {employee.lastName}
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Contratto: {employee.contractHours}h/settimana</div>
                <div>Ultimo aggiornamento: {report.account.lastCalculationDate.toLocaleDateString('it-IT')}</div>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-3xl font-bold ${balanceStatus.color.split(' ')[0]}`}>
              {report.account.currentBalance > 0 ? '+' : ''}{report.account.currentBalance.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-600">{balanceStatus.status}</div>
            
            {report.account.currentBalance > 0 && (
              <Button
                size="sm"
                icon={Calendar}
                onClick={onCreateRecoveryRequest}
                className="mt-2 bg-blue-600 hover:bg-blue-700"
              >
                Richiedi Recupero
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-900">
            {report.account.totalAccumulated.toFixed(1)}h
          </div>
          <div className="text-sm text-green-700">Totale Accumulate</div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-900">
            {report.account.totalRecovered.toFixed(1)}h
          </div>
          <div className="text-sm text-blue-700">Totale Recuperate</div>
        </div>
        
        <div className={`border rounded-lg p-4 text-center ${
          report.projectedBalance > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className={`text-2xl font-bold ${
            report.projectedBalance > 0 ? 'text-green-900' : 'text-red-900'
          }`}>
            {report.projectedBalance > 0 ? '+' : ''}{report.projectedBalance.toFixed(1)}h
          </div>
          <div className={`text-sm ${
            report.projectedBalance > 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            Bilancio Proiettato
          </div>
        </div>
      </div>

      {/* Recent Entries */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Ultime Entries</h4>
          <Button
            size="sm"
            variant="outline"
            icon={showWeeklyDetails ? Minus : Plus}
            onClick={() => setShowWeeklyDetails(!showWeeklyDetails)}
          >
            {showWeeklyDetails ? 'Nascondi' : 'Mostra'} Dettagli
          </Button>
        </div>
        
        <div className="p-4">
          {report.recentEntries.length > 0 ? (
            <div className="space-y-3">
              {report.recentEntries.slice(0, showWeeklyDetails ? undefined : 4).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      entry.type === 'excess' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {entry.type === 'excess' ? (
                        <Plus className="h-4 w-4 text-green-600" />
                      ) : (
                        <Minus className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900">
                        Settimana {entry.weekStartDate.toLocaleDateString('it-IT')}
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.actualHours.toFixed(1)}h lavorate vs {entry.contractHours}h contratto
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      entry.type === 'excess' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {entry.type === 'excess' ? '+' : ''}{entry.difference.toFixed(1)}h
                    </div>
                    <div className="text-xs text-gray-500">
                      {entry.type === 'excess' ? 'Eccesso' : 'Deficit'}
                    </div>
                  </div>
                </div>
              ))}
              
              {!showWeeklyDetails && report.recentEntries.length > 4 && (
                <div className="text-center text-sm text-gray-500 py-2">
                  ... e altre {report.recentEntries.length - 4} entries
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Nessuna entry nella banca ore</p>
              <p className="text-sm mt-1">Esegui un calcolo per generare i dati</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Recoveries */}
      {report.pendingRecoveries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Richieste Recupero in Attesa</h4>
          </div>
          
          <div className="p-4 space-y-3">
            {report.pendingRecoveries.map(request => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">
                    {request.requestedHours}h di recupero
                  </div>
                  <div className="text-sm text-gray-600">
                    Tipo: {request.requestType} • Richiesto: {request.requestDate.toLocaleDateString('it-IT')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {request.reason}
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    In Attesa
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">💡 Raccomandazioni</h4>
          <div className="space-y-2">
            {report.recommendations.map((recommendation, index) => (
              <div key={index} className="text-sm text-blue-800">
                {recommendation}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};