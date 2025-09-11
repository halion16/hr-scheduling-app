import React, { useState } from 'react';
import { Employee, Store } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Edit, Trash2, Search, UserPlus, Download, RotateCcw, Store as StoreIcon } from 'lucide-react';

interface EmployeeListProps {
  employees: Employee[];
  stores: Store[];
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onAdd: () => void;
  onSync?: () => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  stores,
  onEdit,
  onDelete,
  onAdd,
  onSync
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');

  const storeMap = new Map(stores.map(store => [store.id, store]));

  // Debug logging removed for cleaner console

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && employee.isActive) ||
      (statusFilter === 'inactive' && !employee.isActive);
    
    const matchesStore = 
      storeFilter === 'all' || 
      employee.storeId === storeFilter ||
      (storeFilter === 'unassigned' && !employee.storeId);

    // Filter debug removed

    return matchesSearch && matchesStatus && matchesStore;
  });

  // Filter result debug removed

  const storeOptions = [
    { value: 'all', label: 'Tutti i Negozi' },
    { value: 'unassigned', label: 'Non Assegnati' },
    ...stores.map(store => ({ value: store.id, label: store.name }))
  ];

  const statusOptions = [
    { value: 'all', label: 'Tutti gli Stati' },
    { value: 'active', label: 'Attivi' },
    { value: 'inactive', label: 'Inattivi' }
  ];

  // Funzione di pulizia localStorage (temporanea per debug)
  const clearLocalStorage = () => {
    if (confirm('🧹 ATTENZIONE: Questo rimuoverà SOLO i dipendenti corrotti. I negozi saranno preservati. Continuare?')) {
      localStorage.removeItem('hr-employees');
      localStorage.removeItem('hr-shifts');
      localStorage.removeItem('hr-unavailabilities');
      // NON rimuoviamo hr-stores per preservare i negozi
      alert('✅ Dipendenti rimossi! La pagina verrà ricaricata.');
      window.location.reload();
    }
  };

  // Funzione per ricreare i negozi comuni
  const recreateStores = () => {
    if (confirm('🏪 Ricreare i negozi comuni dall\'API EcosAgile? Questo aggiungerà i negozi mancanti.')) {
      const commonStores = [
        'Antegnate', 'Mantova', 'Barberino', 'Castelromano', 'Valmontone', 
        'Castelguelfo', 'Agira', 'Marcianise', 'Noventa D.P.', 'Valdichiana',
        'Molfetta', 'Brugnato', 'Franciacorta', 'Orio Center', 'Citta Sant\'Angelo',
        'Marzocca', 'Jesi'
      ];

      const storeObjects = commonStores.map(name => ({
        id: crypto.randomUUID(),
        name: name,
        address: '',
        phone: '',
        email: '',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      localStorage.setItem('hr-stores', JSON.stringify(storeObjects));
      alert(`✅ Creati ${storeObjects.length} negozi! La pagina verrà ricaricata.`);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Dipendenti</h2>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            icon={StoreIcon} 
            onClick={recreateStores}
            className="text-blue-600 hover:text-blue-700 border-blue-300"
          >
            Ripristina Negozi
          </Button>
          <Button 
            variant="outline" 
            icon={RotateCcw} 
            onClick={clearLocalStorage}
            className="text-red-600 hover:text-red-700 border-red-300"
          >
            Reset Dati
          </Button>
          {onSync && (
            <Button 
              variant="outline" 
              icon={Download} 
              onClick={onSync}
              className="text-green-600 hover:text-green-700 border-green-300"
            >
              Sincronizza API
            </Button>
          )}
          <Button icon={UserPlus} onClick={onAdd}>
            Aggiungi Dipendente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Cerca dipendenti..."
          value={searchTerm}
          onChange={setSearchTerm}
          className="relative"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
        <Select
          value={storeFilter}
          onChange={setStoreFilter}
          options={storeOptions}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ore Contratto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ore Fisse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Negozio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.contractHours}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.fixedHours}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.storeId ? storeMap.get(employee.storeId)?.name || 'Sconosciuto' : 'Non Assegnato'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      employee.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {employee.isActive ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Edit}
                        onClick={() => onEdit(employee)}
                      />
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => onDelete(employee.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nessun dipendente trovato con i criteri specificati.</p>
          </div>
        )}
      </div>
    </div>
  );
};