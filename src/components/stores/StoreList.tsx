import React, { useState } from 'react';
import { Store } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Edit, Trash2, Store as StoreIcon, Clock, MapPin, Calendar, Copy, Grid, List, ChevronDown, ChevronUp, Filter, SortAsc } from 'lucide-react';
import { Modal } from '../common/Modal';

interface StoreListProps {
  stores: Store[];
  onEdit: (store: Store) => void;
  onDelete: (storeId: string) => void;
  onAdd: () => void;
  onDuplicate?: (storeData: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type ViewMode = 'grid' | 'list' | 'compact';
type SortField = 'name' | 'createdAt' | 'totalHours' | 'openDays';
type SortDirection = 'asc' | 'desc';

export const StoreList: React.FC<StoreListProps> = ({
  stores,
  onEdit,
  onDelete,
  onAdd,
  onDuplicate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [storeToDuplicate, setStoreToDuplicate] = useState<Store | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  const dayNames = {
    lunedì: 'Lunedì',
    martedì: 'Martedì',
    mercoledì: 'Mercoledì',
    giovedì: 'Giovedì',
    venerdì: 'Venerdì',
    sabato: 'Sabato',
    domenica: 'Domenica'
  };

  const dayAbbreviations = {
    lunedì: 'Lun',
    martedì: 'Mar',
    mercoledì: 'Mer',
    giovedì: 'Gio',
    venerdì: 'Ven',
    sabato: 'Sab',
    domenica: 'Dom'
  };

  const calculateTotalWeeklyHours = (openingHours: Store['openingHours']) => {
    if (!openingHours || typeof openingHours !== 'object') {
      return 0;
    }
    return Object.values(openingHours).reduce((total, hours) => {
      if (!hours) return total;
      
      const [openHour, openMin] = hours.open.split(':').map(Number);
      const [closeHour, closeMin] = hours.close.split(':').map(Number);
      
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;
      
      return total + (closeMinutes - openMinutes) / 60;
    }, 0);
  };

  const getOperatingStatus = (openingHours: Store['openingHours']) => {
    if (!openingHours || typeof openingHours !== 'object') {
      return { openDays: 0, totalWeeklyHours: 0 };
    }
    const openDays = Object.values(openingHours).filter(hours => hours).length;
    const totalWeeklyHours = calculateTotalWeeklyHours(openingHours);
    
    return {
      openDays,
      totalWeeklyHours,
      averageDaily: openDays > 0 ? totalWeeklyHours / openDays : 0
    };
  };

  // Filtri e ordinamento
  const filteredAndSortedStores = React.useMemo(() => {
    let filtered = stores.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && store.isActive) ||
        (statusFilter === 'inactive' && !store.isActive);
      
      return matchesSearch && matchesStatus;
    });

    // Ordinamento
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'totalHours':
          aValue = getOperatingStatus(a.openingHours).totalWeeklyHours;
          bValue = getOperatingStatus(b.openingHours).totalWeeklyHours;
          break;
        case 'openDays':
          aValue = getOperatingStatus(a.openingHours).openDays;
          bValue = getOperatingStatus(b.openingHours).openDays;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [stores, searchTerm, statusFilter, sortField, sortDirection]);

  const handleDuplicateClick = (store: Store) => {
    setStoreToDuplicate(store);
    setDuplicateName(`Copia di ${store.name}`);
    setShowDuplicateModal(true);
  };

  const handleDuplicateConfirm = () => {
    if (storeToDuplicate && onDuplicate && duplicateName.trim()) {
      onDuplicate({
        name: duplicateName.trim(),
        openingHours: { ...storeToDuplicate.openingHours },
        isActive: true,
        staffRequirements: storeToDuplicate.staffRequirements 
          ? [...storeToDuplicate.staffRequirements] 
          : undefined
      });
      setShowDuplicateModal(false);
      setStoreToDuplicate(null);
      setDuplicateName('');
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateModal(false);
    setStoreToDuplicate(null);
    setDuplicateName('');
  };

  const statusOptions = [
    { value: 'all', label: 'Tutti gli Stati' },
    { value: 'active', label: 'Solo Attivi' },
    { value: 'inactive', label: 'Solo Inattivi' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Nome' },
    { value: 'createdAt', label: 'Data Creazione' },
    { value: 'totalHours', label: 'Ore Totali' },
    { value: 'openDays', label: 'Giorni Aperti' }
  ];

  const viewModeOptions = [
    { value: 'grid', label: 'Griglia', icon: Grid },
    { value: 'list', label: 'Lista', icon: List },
    { value: 'compact', label: 'Compatta', icon: Filter }
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header migliorato */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestione Negozi</h2>
            <p className="text-gray-600 mt-1">
              {filteredAndSortedStores.length} di {stores.length} negozi
              {statusFilter !== 'all' && ` (${statusFilter === 'active' ? 'attivi' : 'inattivi'})`}
            </p>
          </div>
          <Button icon={StoreIcon} onClick={onAdd} className="lg:self-start">
            Aggiungi Negozio
          </Button>
        </div>

        {/* Controlli avanzati */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Prima riga controlli */}
            <div className="flex flex-1 gap-3">
              <Input
                placeholder="Cerca negozi per nome..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="flex-1"
              />
              
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                className="min-w-[140px]"
              />
              
              <Button
                variant="outline"
                icon={showFilters ? ChevronUp : ChevronDown}
                onClick={() => setShowFilters(!showFilters)}
                size="sm"
                className="px-3"
              >
                Filtri
              </Button>
            </div>

            {/* Vista e ordinamento */}
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1">
                {viewModeOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setViewMode(option.value as ViewMode)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors flex items-center space-x-1 ${
                        viewMode === option.value 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title={option.label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filtri avanzati (collassabili) */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="Ordina per"
                  value={sortField}
                  onChange={(value) => setSortField(value as SortField)}
                  options={sortOptions}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Direzione
                  </label>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setSortDirection('asc')}
                      className={`flex-1 px-3 py-1 rounded-md text-sm transition-colors ${
                        sortDirection === 'asc' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      A-Z / 0-9
                    </button>
                    <button
                      onClick={() => setSortDirection('desc')}
                      className={`flex-1 px-3 py-1 rounded-md text-sm transition-colors ${
                        sortDirection === 'desc' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Z-A / 9-0
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Statistiche Rapide
                  </label>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-sm">
                      <span className="font-medium">{filteredAndSortedStores.length}</span> negozi •{' '}
                      <span className="font-medium">
                        {filteredAndSortedStores.filter(s => s.isActive).length}
                      </span> attivi •{' '}
                      <span className="font-medium">
                        {filteredAndSortedStores.reduce((sum, s) => sum + getOperatingStatus(s.openingHours).totalWeeklyHours, 0).toFixed(0)}h
                      </span> totali
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contenuto principale con vista dinamica */}
        {filteredAndSortedStores.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <StoreIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun negozio trovato</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Nessun negozio corrisponde ai criteri di ricerca.' 
                : 'Non hai ancora creato nessun negozio.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button icon={StoreIcon} onClick={onAdd}>
                Crea il Primo Negozio
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Vista Griglia (attuale migliorata) */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredAndSortedStores.map((store) => (
                  <StoreGridCard
                    key={store.id}
                    store={store}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={handleDuplicateClick}
                    dayNames={dayNames}
                    dayAbbreviations={dayAbbreviations}
                    getOperatingStatus={getOperatingStatus}
                  />
                ))}
              </div>
            )}

            {/* Vista Lista compatta */}
            {viewMode === 'list' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Negozio
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stato
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Giorni Aperti
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ore Totali
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Media/Giorno
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Orari
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAndSortedStores.map((store) => (
                        <StoreListRow
                          key={store.id}
                          store={store}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onDuplicate={handleDuplicateClick}
                          dayAbbreviations={dayAbbreviations}
                          getOperatingStatus={getOperatingStatus}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Vista Compatta */}
            {viewMode === 'compact' && (
              <div className="space-y-2">
                {filteredAndSortedStores.map((store) => (
                  <StoreCompactCard
                    key={store.id}
                    store={store}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={handleDuplicateClick}
                    getOperatingStatus={getOperatingStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Duplicazione */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={handleDuplicateCancel}
        title="Duplica Negozio"
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Copy className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">Duplicazione Negozio</span>
            </div>
            <p className="text-sm text-blue-800">
              Stai per creare una copia di <strong>{storeToDuplicate?.name}</strong> con tutti gli stessi orari di apertura/chiusura.
            </p>
          </div>

          {storeToDuplicate && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Orari che verranno copiati:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(storeToDuplicate.openingHours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="font-medium text-gray-700">
                      {dayNames[day as keyof typeof dayNames]}:
                    </span>
                    <span className="font-mono text-gray-900">
                      {hours ? `${hours.open} - ${hours.close}` : 'Chiuso'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Nome del Nuovo Negozio"
            value={duplicateName}
            onChange={setDuplicateName}
            placeholder="Inserisci il nome per il negozio duplicato"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <StoreIcon className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-900 text-sm">Cosa viene duplicato:</span>
              </div>
              <ul className="text-sm text-green-800 space-y-1">
                <li>✅ Tutti gli orari settimanali</li>
                <li>✅ Configurazioni staff</li>
                <li>✅ Stato attivo</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-900 text-sm">NON duplicato:</span>
              </div>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>❌ Dipendenti assegnati</li>
                <li>❌ Turni esistenti</li>
                <li>❌ Storico dati</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={handleDuplicateCancel}>
              Annulla
            </Button>
            <Button
              onClick={handleDuplicateConfirm}
              disabled={!duplicateName.trim()}
              icon={Copy}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Duplica Negozio
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// Componente Card per Vista Griglia
interface StoreCardProps {
  store: Store;
  onEdit: (store: Store) => void;
  onDelete: (storeId: string) => void;
  onDuplicate: (store: Store) => void;
  dayNames: Record<string, string>;
  dayAbbreviations: Record<string, string>;
  getOperatingStatus: (openingHours: Store['openingHours']) => any;
}

const StoreGridCard: React.FC<StoreCardProps> = ({
  store,
  onEdit,
  onDelete,
  onDuplicate,
  dayNames,
  dayAbbreviations,
  getOperatingStatus
}) => {
  const [showFullHours, setShowFullHours] = useState(false);
  const operatingStatus = getOperatingStatus(store?.openingHours || {});

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Header compatto */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <div className="bg-blue-100 rounded-lg p-1.5">
                <StoreIcon className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 truncate">{store.name}</h3>
            </div>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              store.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {store.isActive ? 'Attivo' : 'Inattivo'}
            </span>
          </div>
          
          <div className="flex space-x-1 ml-2">
            <Button
              size="sm"
              variant="outline"
              icon={Copy}
              onClick={() => onDuplicate(store)}
              className="!p-1.5"
              title="Duplica"
            />
            <Button
              size="sm"
              variant="outline"
              icon={Edit}
              onClick={() => onEdit(store)}
              className="!p-1.5"
              title="Modifica"
            />
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={() => onDelete(store.id)}
              className="!p-1.5"
              title="Elimina"
            />
          </div>
        </div>
      </div>

      {/* Statistiche compatte */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-xs text-gray-500">Giorni</div>
            <div className="text-sm font-semibold text-gray-900">{operatingStatus.openDays}/7</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Tot</div>
            <div className="text-sm font-semibold text-gray-900">{operatingStatus.totalWeeklyHours.toFixed(0)}h</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Media</div>
            <div className="text-sm font-semibold text-gray-900">{operatingStatus.averageDaily.toFixed(1)}h</div>
          </div>
        </div>
      </div>

      {/* Orari collassabili */}
      <div className="p-4">
        <button
          onClick={() => setShowFullHours(!showFullHours)}
          className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>Orari di Apertura</span>
          </span>
          {showFullHours ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        
        {showFullHours ? (
          <div className="mt-3 space-y-1.5">
            {Object.entries(store?.openingHours || {}).map(([day, hours]) => (
              <div key={day} className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-600 w-16">
                  {dayAbbreviations[day as keyof typeof dayAbbreviations]}
                </span>
                {hours ? (
                  <span className="text-sm text-gray-900 font-mono">
                    {hours.open} - {hours.close}
                  </span>
                ) : (
                  <span className="text-sm text-red-500">Chiuso</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-xs text-gray-500">
            Click per vedere tutti gli orari
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Creato: {store.createdAt.toLocaleDateString('it-IT')}
        </div>
      </div>
    </div>
  );
};

// Componente Riga per Vista Lista
const StoreListRow: React.FC<StoreCardProps> = ({
  store,
  onEdit,
  onDelete,
  onDuplicate,
  dayAbbreviations,
  getOperatingStatus
}) => {
  const operatingStatus = getOperatingStatus(store?.openingHours || {});
  
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 rounded-lg p-2">
            <StoreIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{store.name}</div>
            <div className="text-sm text-gray-500">
              Creato: {store.createdAt.toLocaleDateString('it-IT')}
            </div>
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          store.isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {store.isActive ? 'Attivo' : 'Inattivo'}
        </span>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm font-medium text-gray-900">{operatingStatus.openDays}/7</div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm font-medium text-gray-900">{operatingStatus.totalWeeklyHours.toFixed(0)}h</div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="text-sm font-medium text-gray-900">{operatingStatus.averageDaily.toFixed(1)}h</div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {Object.entries(store?.openingHours || {}).map(([day, hours]) => (
            <span
              key={day}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                hours 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}
              title={hours ? `${hours.open} - ${hours.close}` : 'Chiuso'}
            >
              {dayAbbreviations[day as keyof typeof dayAbbreviations]}
            </span>
          ))}
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="flex justify-end space-x-1">
          <Button
            size="sm"
            variant="outline"
            icon={Copy}
            onClick={() => onDuplicate(store)}
            className="!p-1.5"
            title="Duplica"
          />
          <Button
            size="sm"
            variant="outline"
            icon={Edit}
            onClick={() => onEdit(store)}
            className="!p-1.5"
            title="Modifica"
          />
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => onDelete(store.id)}
            className="!p-1.5"
            title="Elimina"
          />
        </div>
      </td>
    </tr>
  );
};

// Componente Card per Vista Compatta
const StoreCompactCard: React.FC<{
  store: Store;
  onEdit: (store: Store) => void;
  onDelete: (storeId: string) => void;
  onDuplicate: (store: Store) => void;
  getOperatingStatus: (openingHours: Store['openingHours']) => any;
}> = ({
  store,
  onEdit,
  onDelete,
  onDuplicate,
  getOperatingStatus
}) => {
  const operatingStatus = getOperatingStatus(store?.openingHours || {});
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="bg-blue-100 rounded-lg p-2">
            <StoreIcon className="h-5 w-5 text-blue-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <h3 className="font-semibold text-gray-900 truncate">{store.name}</h3>
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                store.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {store.isActive ? 'Attivo' : 'Inattivo'}
              </span>
            </div>
            
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span>{operatingStatus.openDays}/7 giorni</span>
              <span>{operatingStatus.totalWeeklyHours.toFixed(0)}h totali</span>
              <span>{operatingStatus.averageDaily.toFixed(1)}h/giorno</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-1 ml-4">
          <Button
            size="sm"
            variant="outline"
            icon={Copy}
            onClick={() => onDuplicate(store)}
            className="!p-2"
            title="Duplica"
          />
          <Button
            size="sm"
            variant="outline"
            icon={Edit}
            onClick={() => onEdit(store)}
            className="!p-2"
            title="Modifica"
          />
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            onClick={() => onDelete(store.id)}
            className="!p-2"
            title="Elimina"
          />
        </div>
      </div>
    </div>
  );
};