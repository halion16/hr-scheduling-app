import React, { useState, useEffect } from 'react';
import { CompanyApiService, CompanyApiEmployee } from '../../lib/company-api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { 
  Bug, 
  Search,
  RefreshCw,
  Database,
  Filter,
  Eye,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface EmployeeDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeeDebugModal: React.FC<EmployeeDebugModalProps> = ({
  isOpen,
  onClose
}) => {
  const [employees, setEmployees] = useState<CompanyApiEmployee[]>([]);
  const [rawApiData, setRawApiData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [orgUnitFilter, setOrgUnitFilter] = useState('');

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      console.log('🔍 DEBUG - Fetching employees for analysis...');
      const data = await CompanyApiService.fetchActiveEmployeesWithCache();
      console.log('🔍 DEBUG - Raw data:', data);
      setEmployees(data);
    } catch (error) {
      console.error('❌ DEBUG - Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDebugData();
    }
  }, [isOpen]);

  // Filtra dipendenti
  const filteredEmployees = employees.filter(emp => {
    const matchesName = !filter || 
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(filter.toLowerCase());
    const matchesOrgUnit = !orgUnitFilter || 
      (emp.organizationalUnit || '').toLowerCase().includes(orgUnitFilter.toLowerCase());
    return matchesName && matchesOrgUnit;
  });

  // Statistiche unità organizzative
  const orgUnitStats = employees.reduce((acc, emp) => {
    const orgUnit = emp.organizationalUnit || 'Non specificata';
    acc[orgUnit] = (acc[orgUnit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueOrgUnits = Object.keys(orgUnitStats).sort();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔍 Debug Dipendenti - Unità Organizzative"
      size="xl"
    >
      <div className="space-y-6">
        {/* Header con statistiche */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Bug className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-medium text-blue-900">Analisi Dati EcosAgile</h3>
            <div className="flex space-x-2 ml-auto">
              <Button
                onClick={() => CompanyApiService.exportRawDataToExcel()}
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                Export Excel
              </Button>
              
              <Button
                onClick={fetchDebugData}
                disabled={loading}
                variant="outline"
                size="sm"
                icon={loading ? undefined : RefreshCw}
              >
                {loading ? 'Aggiornando...' : 'Aggiorna'}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white rounded p-3 text-center">
              <div className="text-lg font-bold text-blue-600">{employees.length}</div>
              <div className="text-gray-600">Dipendenti Totali</div>
            </div>
            <div className="bg-white rounded p-3 text-center">
              <div className="text-lg font-bold text-green-600">{uniqueOrgUnits.length}</div>
              <div className="text-gray-600">Unità Organizzative</div>
            </div>
            <div className="bg-white rounded p-3 text-center">
              <div className="text-lg font-bold text-purple-600">
                {employees.filter(e => e.organizationalUnit).length}
              </div>
              <div className="text-gray-600">Con Unità</div>
            </div>
            <div className="bg-white rounded p-3 text-center">
              <div className="text-lg font-bold text-orange-600">
                {employees.filter(e => !e.organizationalUnit).length}
              </div>
              <div className="text-gray-600">Senza Unità</div>
            </div>
          </div>
        </div>

        {/* Unità Organizzative Overview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium mb-3 flex items-center">
            <Database className="h-4 w-4 mr-2" />
            Riepilogo Unità Organizzative
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {uniqueOrgUnits.map(orgUnit => (
              <div key={orgUnit} className="bg-white rounded p-2 flex justify-between items-center">
                <span className="truncate mr-2">{orgUnit}</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                  {orgUnitStats[orgUnit]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Filtri */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cerca Dipendente</label>
            <Input
              placeholder="Nome o cognome..."
              value={filter}
              onChange={setFilter}
              icon={Search}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filtra per Unità Organizzativa</label>
            <Input
              placeholder="es. Barberino, Milano..."
              value={orgUnitFilter}
              onChange={setOrgUnitFilter}
              icon={Filter}
            />
          </div>
        </div>

        {/* Lista Dipendenti Debug */}
        <div className="border rounded-lg">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">
                Dipendenti Dettaglio ({filteredEmployees.length} visualizzati)
              </h4>
              <Eye className="h-4 w-4 text-gray-500" />
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {loading ? 'Caricamento...' : 'Nessun dipendente trovato con i filtri specificati'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredEmployees.map((employee, index) => (
                  <div key={`${employee.employeeId}-${index}`} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                          <span className="ml-2 text-xs text-gray-500">({employee.employeeId})</span>
                        </div>
                        
                        <div className="text-sm text-gray-600 mt-1">
                          <div><strong>Email:</strong> {employee.email}</div>
                          <div><strong>Posizione:</strong> {employee.position}</div>
                          <div><strong>Dipartimento:</strong> {employee.department}</div>
                          <div><strong>Telefono:</strong> {employee.phone || 'N/A'}</div>
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          <div className="text-xs">
                            <strong className="text-blue-600">Unità Organizzativa:</strong>{' '}
                            <span className={`px-2 py-1 rounded ${
                              employee.organizationalUnit 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {employee.organizationalUnit || '❌ NON SPECIFICATA'}
                            </span>
                          </div>
                          
                          {employee.storeCode && (
                            <div className="text-xs">
                              <strong className="text-purple-600">Store Code:</strong>{' '}
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                {employee.storeCode}
                              </span>
                            </div>
                          )}
                          
                          {employee.storeName && (
                            <div className="text-xs">
                              <strong className="text-indigo-600">Store Name:</strong>{' '}
                              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                                {employee.storeName}
                              </span>
                            </div>
                          )}
                          
                          {employee.workLocation && (
                            <div className="text-xs">
                              <strong className="text-orange-600">Work Location:</strong>{' '}
                              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                {employee.workLocation}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 ml-4">
                        #{index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};