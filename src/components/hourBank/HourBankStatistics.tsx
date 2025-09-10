import React, { useState, useMemo } from 'react';
import { Employee, Store } from '../../types';
import { HourBankAccount, HourBankEntry, HourBankStatistics as HourBankStatsType } from '../../types/hourBank';
import { Button } from '../common/Button';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Users,
  Clock,
  Download,
  Eye,
  Filter
} from 'lucide-react';

interface HourBankStatisticsProps {
  statistics: HourBankStatsType;
  entries: HourBankEntry[];
  accounts: HourBankAccount[];
  employees: Employee[];
  stores: Store[];
}

export const HourBankStatistics: React.FC<HourBankStatisticsProps> = ({
  statistics,
  entries,
  accounts,
  employees,
  stores
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [showDetails, setShowDetails] = useState(false);

  const employeeMap = useMemo(() => 
    new Map(employees.map(emp => [emp.id, emp])), 
    [employees]
  );

  const storeMap = useMemo(() => 
    new Map(stores.map(store => [store.id, store])), 
    [stores]
  );

  // Analisi trend per periodo
  const periodAnalysis = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (selectedPeriod) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
    }

    const periodEntries = entries.filter(entry => entry.weekStartDate >= startDate);
    
    const totalExcess = periodEntries
      .filter(entry => entry.type === 'excess')
      .reduce((sum, entry) => sum + entry.difference, 0);
    
    const totalDeficit = periodEntries
      .filter(entry => entry.type === 'deficit')
      .reduce((sum, entry) => sum + Math.abs(entry.difference), 0);

    // Analisi per negozio
    const storeAnalysis = stores.map(store => {
      const storeEntries = periodEntries.filter(entry => entry.storeId === store.id);
      const storeExcess = storeEntries
        .filter(entry => entry.type === 'excess')
        .reduce((sum, entry) => sum + entry.difference, 0);
      const storeDeficit = storeEntries
        .filter(entry => entry.type === 'deficit')
        .reduce((sum, entry) => sum + Math.abs(entry.difference), 0);

      return {
        store,
        entries: storeEntries.length,
        excess: storeExcess,
        deficit: storeDeficit,
        net: storeExcess - storeDeficit
      };
    }).filter(analysis => analysis.entries > 0);

    return {
      totalEntries: periodEntries.length,
      totalExcess,
      totalDeficit,
      netBalance: totalExcess - totalDeficit,
      storeAnalysis
    };
  }, [entries, selectedPeriod, stores]);

  // Top performers e dipendenti che necessitano attenzione
  const employeeAnalysis = useMemo(() => {
    const topCreditors = accounts
      .filter(acc => acc.currentBalance > 0)
      .sort((a, b) => b.currentBalance - a.currentBalance)
      .slice(0, 5)
      .map(acc => ({
        account: acc,
        employee: employeeMap.get(acc.employeeId)
      }))
      .filter(item => item.employee);

    const topDebtors = accounts
      .filter(acc => acc.currentBalance < 0)
      .sort((a, b) => a.currentBalance - b.currentBalance)
      .slice(0, 5)
      .map(acc => ({
        account: acc,
        employee: employeeMap.get(acc.employeeId)
      }))
      .filter(item => item.employee);

    return { topCreditors, topDebtors };
  }, [accounts, employeeMap]);

  const exportStatistics = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      period: selectedPeriod,
      overallStatistics: statistics,
      periodAnalysis,
      employeeAnalysis,
      detailedAccounts: accounts.map(acc => ({
        employeeName: employeeMap.get(acc.employeeId) ? 
          `${employeeMap.get(acc.employeeId)!.firstName} ${employeeMap.get(acc.employeeId)!.lastName}` : 
          'Sconosciuto',
        storeName: storeMap.get(acc.storeId)?.name || 'Sconosciuto',
        currentBalance: acc.currentBalance,
        totalAccumulated: acc.totalAccumulated,
        totalRecovered: acc.totalRecovered,
        lastCalculation: acc.lastCalculationDate
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statistiche_Banca_Ore_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Statistiche Avanzate</h3>
        <div className="flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">Ultima Settimana</option>
            <option value="month">Ultimo Mese</option>
            <option value="quarter">Ultimo Trimestre</option>
          </select>
          
          <Button
            size="sm"
            variant="outline"
            icon={showDetails ? Eye : Filter}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Nascondi' : 'Mostra'} Dettagli
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            icon={Download}
            onClick={exportStatistics}
          >
            Esporta
          </Button>
        </div>
      </div>

      {/* Period Analysis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
          <div className="text-2xl font-bold text-blue-900">{periodAnalysis.totalEntries}</div>
          <div className="text-sm text-blue-700">Entries {selectedPeriod === 'week' ? 'Settimana' : selectedPeriod === 'month' ? 'Mese' : 'Trimestre'}</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
          <div className="text-2xl font-bold text-green-900">+{periodAnalysis.totalExcess.toFixed(1)}h</div>
          <div className="text-sm text-green-700">Eccesso Totale</div>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
          <div className="text-2xl font-bold text-red-900">-{periodAnalysis.totalDeficit.toFixed(1)}h</div>
          <div className="text-sm text-red-700">Deficit Totale</div>
        </div>
        
        <div className={`rounded-lg p-4 text-center border ${
          periodAnalysis.netBalance > 0 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className={`text-2xl font-bold ${
            periodAnalysis.netBalance > 0 ? 'text-green-900' : 'text-red-900'
          }`}>
            {periodAnalysis.netBalance > 0 ? '+' : ''}{periodAnalysis.netBalance.toFixed(1)}h
          </div>
          <div className={`text-sm ${
            periodAnalysis.netBalance > 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            Bilancio Netto
          </div>
        </div>
      </div>

      {/* Store Analysis for Period */}
      {showDetails && periodAnalysis.storeAnalysis.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              Analisi per Negozio - {selectedPeriod === 'week' ? 'Settimana' : selectedPeriod === 'month' ? 'Mese' : 'Trimestre'}
            </h4>
          </div>
          
          <div className="p-4">
            <div className="space-y-3">
              {periodAnalysis.storeAnalysis.map(analysis => (
                <div key={analysis.store.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{analysis.store.name}</div>
                    <div className="text-sm text-gray-600">
                      {analysis.entries} entries nel periodo
                    </div>
                  </div>
                  
                  <div className="text-right space-y-1">
                    <div className="text-sm">
                      <span className="text-green-600">+{analysis.excess.toFixed(1)}h</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className="text-red-600">-{analysis.deficit.toFixed(1)}h</span>
                    </div>
                    <div className={`text-sm font-bold ${
                      analysis.net > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Netto: {analysis.net > 0 ? '+' : ''}{analysis.net.toFixed(1)}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Creditori */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-gray-900">Maggiori Creditori</h4>
            </div>
          </div>
          
          <div className="p-4">
            {employeeAnalysis.topCreditors.length > 0 ? (
              <div className="space-y-3">
                {employeeAnalysis.topCreditors.map((item, index) => (
                  <div key={item.account.id} className="flex items-center justify-between">
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
                          {item.employee!.firstName} {item.employee!.lastName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.employee!.contractHours}h contratto
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        +{item.account.currentBalance.toFixed(1)}h
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.account.totalAccumulated.toFixed(1)}h accumulate
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>Nessun dipendente con credito</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Debitori */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <h4 className="font-medium text-gray-900">Maggiori Debitori</h4>
            </div>
          </div>
          
          <div className="p-4">
            {employeeAnalysis.topDebtors.length > 0 ? (
              <div className="space-y-3">
                {employeeAnalysis.topDebtors.map((item, index) => (
                  <div key={item.account.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center text-xs font-bold text-red-700">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.employee!.firstName} {item.employee!.lastName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {item.employee!.contractHours}h contratto
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600">
                        {item.account.currentBalance.toFixed(1)}h
                      </div>
                      <div className="text-xs text-gray-500">
                        Debito ore
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <p>Nessun dipendente in debito!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Statistiche Dettagliate</h4>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{statistics.totalAccounts}</div>
              <div className="text-sm text-gray-600">Account Totali</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-green-600">{statistics.accountsWithCredit}</div>
              <div className="text-sm text-gray-600">Con Credito</div>
              <div className="text-xs text-gray-500">
                {statistics.totalAccounts > 0 ? Math.round((statistics.accountsWithCredit / statistics.totalAccounts) * 100) : 0}%
              </div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-red-600">{statistics.accountsWithDebt}</div>
              <div className="text-sm text-gray-600">Con Debito</div>
              <div className="text-xs text-gray-500">
                {statistics.totalAccounts > 0 ? Math.round((statistics.accountsWithDebt / statistics.totalAccounts) * 100) : 0}%
              </div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-blue-600">{statistics.averageBalance.toFixed(1)}h</div>
              <div className="text-sm text-gray-600">Bilancio Medio</div>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Informazioni Sistema</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Ultimo Calcolo:</span>
            <div className="font-medium">
              {statistics.lastCalculationRun.toLocaleString('it-IT')}
            </div>
          </div>
          
          <div>
            <span className="text-gray-600">Durata Calcolo:</span>
            <div className="font-medium">
              {statistics.calculationDuration.toFixed(0)}ms
            </div>
          </div>
          
          <div>
            <span className="text-gray-600">Richieste Pending:</span>
            <div className="font-medium">
              {statistics.totalPendingRecoveries} ({statistics.pendingRecoveryHours.toFixed(1)}h)
            </div>
          </div>
          
          <div>
            <span className="text-gray-600">Efficienza Sistema:</span>
            <div className="font-medium text-green-600">
              {statistics.totalAccounts > 0 ? 'Operativo' : 'In Attesa Dati'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};