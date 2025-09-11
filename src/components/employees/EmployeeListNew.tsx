import React, { useState, useEffect } from 'react';
import { Employee, Store } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Edit, Trash2, UserPlus, Download } from 'lucide-react';

interface EmployeeListNewProps {
  employees: Employee[];
  stores: Store[];
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onAdd: () => void;
  onSync?: () => void;
}

export const EmployeeListNew: React.FC<EmployeeListNewProps> = ({
  employees,
  stores,
  onEdit,
  onDelete,
  onAdd,
  onSync
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all'); // Assicurati che sia 'all' di default

  // Debug: Log degli input ricevuti
  useEffect(() => {
    console.log('📋 EMPLOYEE LIST NEW - Dati ricevuti:');
    console.log('  👥 Employees:', employees.length);
    console.log('  🏪 Stores:', stores.length);
    console.log('  🔍 Filtro attuale:', { searchTerm, statusFilter, storeFilter });
    
    console.log('📊 DETTAGLIO EMPLOYEES:');
    employees.forEach((emp, i) => {
      console.log(`  ${i+1}. ${emp.firstName} ${emp.lastName}`);
      console.log(`     ID: ${emp.id}`);
      console.log(`     StoreID: ${emp.storeId}`);
      console.log(`     Email: ${emp.email}`);
      console.log(`     Active: ${emp.isActive}`);
    });
    
    console.log('📊 DETTAGLIO STORES:');
    stores.forEach((store, i) => {
      console.log(`  ${i+1}. ${store.name} (ID: ${store.id})`);
    });
  }, [employees, stores, searchTerm, statusFilter, storeFilter]);

  // Reset filtro quando arrivano nuovi dipendenti (dopo import)
  useEffect(() => {
    if (employees.length > 0 && storeFilter !== 'all') {
      console.log('🔄 Resettando filtro negozio dopo import dipendenti');
      setStoreFilter('all');
    }
  }, [employees.length]); // Solo quando cambia il numero di dipendenti

  // Crea mappa store ID -> nome per lookup rapido
  const storeMap = new Map();
  stores.forEach(store => {
    if (store.id && store.name) {
      storeMap.set(store.id, store.name);
    }
  });

  // Filtro semplice e trasparente
  const filteredEmployees = employees.filter(employee => {
    // Filtro ricerca nome
    const matchesSearch = searchTerm === '' || 
      employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.lastName.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro stato
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && employee.isActive) ||
      (statusFilter === 'inactive' && !employee.isActive);

    // Filtro negozio - LOGICA SEMPLICE
    let matchesStore = false;
    if (storeFilter === 'all') {
      matchesStore = true;
    } else if (storeFilter === 'unassigned') {
      matchesStore = !employee.storeId;
    } else {
      // Confronto diretto degli ID
      matchesStore = employee.storeId === storeFilter;
    }

    // Debug per negozio specifico
    if (storeFilter !== 'all') {
      console.log(`🔍 FILTRO ${employee.firstName} ${employee.lastName}:`);
      console.log(`   StoreID dipendente: "${employee.storeId}"`);
      console.log(`   StoreID filtro: "${storeFilter}"`);
      console.log(`   Match: ${matchesStore}`);
    }

    return matchesSearch && matchesStatus && matchesStore;
  });

  // RESET automatico filtro se nasconde troppi dipendenti
  useEffect(() => {
    // Se ci sono dipendenti ma ne vediamo molto pochi, resettiamo il filtro
    if (employees.length > 1 && filteredEmployees.length < employees.length && storeFilter !== 'all') {
      console.log(`🔄 RESET AUTOMATICO: ${employees.length} dipendenti totali, solo ${filteredEmployees.length} visibili. Resettando filtro...`);
      setStoreFilter('all');
    }
  }, [employees.length, filteredEmployees.length, storeFilter]);

  // Debug risultato filtro - SEMPRE attivo per debug
  useEffect(() => {
    console.log(`📊 RISULTATO FILTRO (${storeFilter}):`);
    console.log(`   Dipendenti totali: ${employees.length}`);
    console.log(`   Dipendenti filtrati: ${filteredEmployees.length}`);
    
    if (storeFilter !== 'all') {
      console.log(`   Negozio selezionato: ${storeMap.get(storeFilter) || 'SCONOSCIUTO'} (${storeFilter})`);
    }
    
    console.log(`   Lista dipendenti filtrati:`);
    filteredEmployees.forEach(emp => {
      console.log(`   ✓ ${emp.firstName} ${emp.lastName} (Store: ${emp.storeId} = ${storeMap.get(emp.storeId) || 'NO STORE'}, Active: ${emp.isActive})`);
    });
  }, [filteredEmployees, storeFilter, storeMap, employees.length]);

  // Opzioni per filtri
  const storeOptions = [
    { value: 'all', label: 'Tutti i Negozi' },
    { value: 'unassigned', label: 'Non Assegnati' },
    ...stores.map(store => ({
      value: store.id,
      label: store.name
    }))
  ];

  const statusOptions = [
    { value: 'all', label: 'Tutti gli Stati' },
    { value: 'active', label: 'Attivi' },
    { value: 'inactive', label: 'Inattivi' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Dipendenti</h2>
        <div className="flex space-x-3">
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

      {/* Filtri */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Cerca dipendenti..."
          value={searchTerm}
          onChange={setSearchTerm}
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

      {/* Statistiche Debug */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📊 Info Debug:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium">Totali:</span> {employees.length}
          </div>
          <div>
            <span className="font-medium">Filtrati:</span> {filteredEmployees.length}
          </div>
          <div>
            <span className="font-medium">Negozi:</span> {stores.length}
          </div>
          <div>
            <span className="font-medium">Filtro:</span> {storeFilter === 'all' ? 'Tutti' : storeMap.get(storeFilter) || 'Sconosciuto'}
          </div>
        </div>
        {/* Avviso se filtrati sono molto meno dei totali */}
        {employees.length > 0 && filteredEmployees.length < employees.length && (
          <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded text-sm">
            <div className="flex items-center justify-between">
              <div>
                ⚠️ <strong>Attenzione:</strong> Sono mostrati solo {filteredEmployees.length} dipendenti su {employees.length} totali.
                {storeFilter !== 'all' && (
                  <span> Filtra per negozio attivo: <strong>{storeMap.get(storeFilter) || 'Sconosciuto'}</strong></span>
                )}
              </div>
              {storeFilter !== 'all' && (
                <Button
                  size="sm"
                  onClick={() => {
                    console.log('🔄 Reset manuale filtro negozio');
                    setStoreFilter('all');
                  }}
                  className="ml-3 bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Mostra Tutti
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posizione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Negozio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID (Debug)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id || `emp-${employee.email}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.position || 'Non specificato'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div>{employee.storeId ? storeMap.get(employee.storeId) || 'Negozio Sconosciuto' : 'Non Assegnato'}</div>
                      <div className="text-xs text-gray-400">ID: {employee.storeId || 'N/A'}</div>
                    </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                    {employee.id || 'NO ID'}
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

        {/* Messaggio vuoto */}
        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {employees.length === 0 
                ? 'Nessun dipendente presente. Usa "Sincronizza API" per importare i dipendenti.'
                : 'Nessun dipendente trovato con i criteri di filtro specificati.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};