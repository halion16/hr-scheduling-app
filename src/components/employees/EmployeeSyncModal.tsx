import React, { useState, useEffect } from 'react';
import { CompanyApiService, CompanyApiEmployee } from '../../lib/company-api';
import { Employee, Store } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { 
  Users, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  MapPin,
  UserCheck,
  Filter,
  Building
} from 'lucide-react';

interface EmployeeSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeesImport: (employees: Employee[]) => void;
  stores: Store[];
  existingEmployees: Employee[];
}

interface EmployeeWithMapping extends CompanyApiEmployee {
  suggestedStoreId: string;
  suggestedStoreName: string;
  isConflict: boolean;
  existingEmployee?: Employee;
  shouldImport: boolean;
  mappingConfidence: 'high' | 'medium' | 'low';
}

export const EmployeeSyncModal: React.FC<EmployeeSyncModalProps> = ({
  isOpen,
  onClose,
  onEmployeesImport,
  stores,
  existingEmployees
}) => {
  const [apiEmployees, setApiEmployees] = useState<EmployeeWithMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'fetch' | 'preview' | 'import'>('fetch');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterName, setFilterName] = useState('');
  const [defaultStoreId, setDefaultStoreId] = useState(() => {
    // Carica il defaultStoreId salvato, altrimenti usa il primo store
    const syncConfig = CompanyApiService.getSyncConfig();
    return syncConfig.defaultStoreId || stores[0]?.id || '';
  });
  
  // Stati per statistiche
  const [stats, setStats] = useState({
    total: 0,
    selected: 0,
    conflicts: 0,
    new: 0
  });

  // Regole di mapping intelligente
  const smartMapping = (employee: CompanyApiEmployee): { storeId: string; storeName: string; confidence: 'high' | 'medium' | 'low' } => {
    // Mapping basato su dipartimento
    const departmentMappings: Record<string, string[]> = {
      'retail': ['negozio', 'store', 'vendite', 'sales'],
      'it': ['informatica', 'tech', 'sviluppo'],
      'hr': ['risorse umane', 'personale'],
      'marketing': ['marketing', 'comunicazione'],
      'amministrazione': ['admin', 'contabilità', 'accounting']
    };

    const dept = employee.department.toLowerCase();
    const position = employee.position.toLowerCase();

    // 1. Cerca corrispondenza diretta nel nome del negozio
    for (const store of stores) {
      const storeName = store.name.toLowerCase();
      if (storeName.includes(dept) || dept.includes(storeName.split(' ')[0])) {
        return { storeId: store.id, storeName: store.name, confidence: 'high' };
      }
    }

    // 2. Mapping basato su keywords nel dipartimento/posizione
    for (const [storeType, keywords] of Object.entries(departmentMappings)) {
      if (keywords.some(keyword => dept.includes(keyword) || position.includes(keyword))) {
        const matchingStore = stores.find(s => 
          s.name.toLowerCase().includes(storeType) || 
          s.name.toLowerCase().includes('retail') ||
          s.name.toLowerCase().includes('negozio')
        );
        if (matchingStore) {
          return { storeId: matchingStore.id, storeName: matchingStore.name, confidence: 'medium' };
        }
      }
    }

    // 3. Se contiene "manager" o "responsabile", cerca il primo negozio
    if (position.includes('manager') || position.includes('responsabile')) {
      const firstStore = stores[0];
      if (firstStore) {
        return { storeId: firstStore.id, storeName: firstStore.name, confidence: 'medium' };
      }
    }

    // 4. Fallback al negozio di default
    const defaultStore = stores.find(s => s.id === defaultStoreId) || stores[0];
    return { 
      storeId: defaultStore?.id || '', 
      storeName: defaultStore?.name || 'Nessun negozio', 
      confidence: 'low' 
    };
  };

  // Fetch dipendenti da API (con cache)
  const fetchApiEmployees = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Salva la configurazione del negozio di default
      CompanyApiService.saveSyncConfig({ defaultStoreId });
      
      let employees;
      if (forceRefresh) {
        // Forza il refresh bypassando la cache
        console.log('🔄 Forzando refresh da API...');
        employees = await CompanyApiService.fetchActiveEmployees();
        CompanyApiService.saveApiEmployeesCache(employees);
      } else {
        employees = await CompanyApiService.fetchActiveEmployeesWithCache();
      }
      
      const mappedEmployees: EmployeeWithMapping[] = employees.map(emp => {
        const mapping = smartMapping(emp);
        const existingEmp = existingEmployees.find(existing => 
          existing.id === emp.employeeId || 
          existing.email.toLowerCase() === emp.email.toLowerCase()
        );

        return {
          ...emp,
          suggestedStoreId: mapping.storeId,
          suggestedStoreName: mapping.storeName,
          mappingConfidence: mapping.confidence,
          isConflict: !!existingEmp,
          existingEmployee: existingEmp,
          shouldImport: !existingEmp // Di default, importa solo quelli nuovi
        };
      });

      setApiEmployees(mappedEmployees);
      calculateStats(mappedEmployees);
      setStep('preview');
    } catch (error: any) {
      alert(`Errore durante il recupero dipendenti: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calcola statistiche
  const calculateStats = (employees: EmployeeWithMapping[]) => {
    const filtered = employees.filter(emp => {
      const matchesDepartment = !filterDepartment || 
        emp.department.toLowerCase().includes(filterDepartment.toLowerCase());
      const matchesName = !filterName || 
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(filterName.toLowerCase());
      return matchesDepartment && matchesName;
    });

    setStats({
      total: employees.length,
      selected: employees.filter(emp => emp.shouldImport).length,
      conflicts: employees.filter(emp => emp.isConflict).length,
      new: employees.filter(emp => !emp.isConflict).length
    });
  };

  // Aggiorna stats quando cambiano le selezioni
  useEffect(() => {
    calculateStats(apiEmployees);
  }, [apiEmployees, filterDepartment, filterName]);

  // Toggle selezione dipendente
  const toggleEmployeeSelection = (employeeId: string) => {
    setApiEmployees(prev => 
      prev.map(emp => 
        emp.employeeId === employeeId 
          ? { ...emp, shouldImport: !emp.shouldImport }
          : emp
      )
    );
  };

  // Cambia mapping negozio per un dipendente
  const changeEmployeeStore = (employeeId: string, storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    setApiEmployees(prev =>
      prev.map(emp =>
        emp.employeeId === employeeId
          ? { 
              ...emp, 
              suggestedStoreId: storeId, 
              suggestedStoreName: store?.name || '',
              mappingConfidence: storeId === emp.suggestedStoreId ? emp.mappingConfidence : 'medium'
            }
          : emp
      )
    );
  };

  // Importa dipendenti selezionati
  const importSelectedEmployees = async () => {
    setImporting(true);
    try {
      const toImport = apiEmployees.filter(emp => emp.shouldImport);
      
      // Salva gli ID dei dipendenti importati e timestamp
      const importedIds = toImport.map(emp => emp.employeeId);
      CompanyApiService.saveSyncConfig({ 
        defaultStoreId,
        lastSyncTimestamp: Date.now(),
        syncedEmployeeIds: importedIds
      });
      
      const hrEmployees: Employee[] = toImport.map(emp => ({
        id: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone || '',
        position: emp.position,
        department: emp.department,
        hireDate: new Date(emp.hireDate),
        isActive: emp.status === 'active',
        storeId: emp.suggestedStoreId,
        skills: [],
        maxWeeklyHours: 40,
        minRestHours: 12,
        preferredShifts: [],
        contractType: 'full-time',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      console.log('📤 EmployeeSyncModal - Inviando questi dipendenti per l\'import:', hrEmployees.map(e => ({
        id: e.id,
        nome: `${e.firstName} ${e.lastName}`,
        email: e.email,
        storeId: e.storeId,
        shouldImport: toImport.find(api => api.employeeId === e.id)?.shouldImport
      })));
      
      onEmployeesImport(hrEmployees);
      setStep('import');
      
      // Chiudi modal dopo 2 secondi
      setTimeout(() => {
        onClose();
        setStep('fetch');
        setApiEmployees([]);
      }, 2000);

    } catch (error: any) {
      alert(`Errore durante l'importazione: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Filtro dipartimenti disponibili
  const availableDepartments = [...new Set(apiEmployees.map(emp => emp.department))];

  // Filtra dipendenti per dipartimento e nome
  const filteredEmployees = apiEmployees.filter(emp => {
    const matchesDepartment = !filterDepartment || 
      emp.department.toLowerCase().includes(filterDepartment.toLowerCase());
    const matchesName = !filterName || 
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(filterName.toLowerCase());
    return matchesDepartment && matchesName;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sincronizzazione Dipendenti da API"
      size="xl"
    >
      <div className="space-y-6">
        
        {/* Step 1: Fetch */}
        {step === 'fetch' && (
          <div className="text-center py-8">
            <Users className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-4">Importa Dipendenti dal Sistema Aziendale</h3>
            <p className="text-gray-600 mb-4">
              Il sistema recupererà i dipendenti attivi e suggerirà automaticamente l'assegnazione ai negozi
            </p>
            
            {/* Avviso Cache */}
            {(() => {
              const cachedEmployees = CompanyApiService.getApiEmployeesCache();
              const syncConfig = CompanyApiService.getSyncConfig();
              if (cachedEmployees || syncConfig.lastSyncTimestamp) {
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm">
                    <div className="flex items-start space-x-2">
                      <RefreshCw className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-blue-800">
                        <strong>Dati disponibili in cache locale:</strong>
                        <ul className="mt-1 space-y-1 text-blue-700">
                          {cachedEmployees && (
                            <li>• {cachedEmployees.length} dipendenti in cache</li>
                          )}
                          {syncConfig.lastSyncTimestamp && (
                            <li>• Ultima sincronizzazione: {new Date(syncConfig.lastSyncTimestamp).toLocaleString()}</li>
                          )}
                        </ul>
                        <p className="mt-2 text-xs">
                          La cache viene usata automaticamente per velocizzare l'operazione.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Negozio di Default</label>
              <Select
                value={defaultStoreId}
                onChange={setDefaultStoreId}
                options={stores.map(store => ({
                  value: store.id,
                  label: store.name
                }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Usato per dipendenti senza mapping automatico
              </p>
            </div>

            <div className="flex space-x-3 justify-center">
              <Button
                onClick={() => fetchApiEmployees(false)}
                disabled={loading}
                icon={loading ? undefined : Download}
                size="lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  'Recupera Dipendenti'
                )}
              </Button>

              {CompanyApiService.getApiEmployeesCache() && (
                <Button
                  onClick={() => fetchApiEmployees(true)}
                  disabled={loading}
                  variant="outline"
                  icon={RefreshCw}
                  size="lg"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  Forza Refresh
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div>
            {/* Statistiche */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                  <div className="text-sm text-gray-600">Dipendenti Trovati</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.selected}</div>
                  <div className="text-sm text-gray-600">Da Importare</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{stats.conflicts}</div>
                  <div className="text-sm text-gray-600">Conflitti</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{stats.new}</div>
                  <div className="text-sm text-gray-600">Nuovi</div>
                </div>
              </div>
            </div>

            {/* Filtri */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Input
                  placeholder="Cerca per nome o cognome..."
                  value={filterName}
                  onChange={setFilterName}
                  className="w-full"
                />
              </div>
              <div>
                <Select
                  value={filterDepartment}
                  onChange={setFilterDepartment}
                  options={[
                    { value: '', label: 'Tutti i Dipartimenti' },
                    ...availableDepartments.map(dept => ({ value: dept, label: dept }))
                  ]}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Visualizzati: <span className="font-medium">{filteredEmployees.length}</span> di {apiEmployees.length}
                {stats.selected > 0 && (
                  <span className="ml-2 text-green-600 font-medium">
                    • {stats.selected} selezionati per l'import
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Calcola quanti dipendenti VISIBILI sono selezionati
                    const visibleSelectedCount = filteredEmployees.filter(emp => emp.shouldImport).length;
                    const shouldSelectAll = visibleSelectedCount < filteredEmployees.length;
                    
                    // Aggiorna solo i dipendenti visibili nel filtro
                    setApiEmployees(prev => prev.map(emp => {
                      const isVisible = filteredEmployees.find(filtered => filtered.employeeId === emp.employeeId);
                      return isVisible ? { ...emp, shouldImport: shouldSelectAll } : emp;
                    }));
                  }}
                >
                  {(() => {
                    const visibleSelectedCount = filteredEmployees.filter(emp => emp.shouldImport).length;
                    return visibleSelectedCount < filteredEmployees.length ? 
                      `Seleziona Visibili (${filteredEmployees.length})` : 
                      'Deseleziona Visibili';
                  })()}
                </Button>

                {/* Selezione rapida per negozio */}
                {filteredEmployees.length > 0 && (
                  <Select
                    value=""
                    onChange={(storeId) => {
                      if (!storeId) return;
                      
                      // Trova i dipendenti visibili assegnati a questo negozio
                      const employeesForStore = filteredEmployees.filter(emp => 
                        emp.suggestedStoreId === storeId
                      );
                      
                      if (employeesForStore.length > 0) {
                        const allSelected = employeesForStore.every(emp => emp.shouldImport);
                        const shouldSelect = !allSelected;
                        
                        // Aggiorna la selezione per i dipendenti di questo negozio
                        setApiEmployees(prev => prev.map(emp => {
                          const isForThisStore = employeesForStore.find(filtered => 
                            filtered.employeeId === emp.employeeId
                          );
                          return isForThisStore ? { ...emp, shouldImport: shouldSelect } : emp;
                        }));
                      }
                    }}
                    options={[
                      { value: '', label: 'Seleziona per Negozio...' },
                      ...stores.map(store => {
                        const count = filteredEmployees.filter(emp => emp.suggestedStoreId === store.id).length;
                        return {
                          value: store.id,
                          label: `${store.name} (${count})`
                        };
                      }).filter(option => option.label.includes('(') && !option.label.includes('(0)'))
                    ]}
                    size="sm"
                  />
                )}
              </div>
            </div>

            {/* Lista dipendenti */}
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              {filteredEmployees.map(employee => (
                <div 
                  key={employee.employeeId}
                  className={`p-4 border-b last:border-b-0 ${
                    employee.isConflict ? 'bg-orange-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={employee.shouldImport}
                        onChange={() => toggleEmployeeSelection(employee.employeeId)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {employee.firstName} {employee.lastName}
                          </span>
                          
                          {employee.isConflict && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Esiste già
                            </span>
                          )}
                          
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                            employee.mappingConfidence === 'high' ? 'bg-green-100 text-green-800' :
                            employee.mappingConfidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {employee.mappingConfidence === 'high' ? 'Alta confidenza' :
                             employee.mappingConfidence === 'medium' ? 'Media confidenza' : 
                             'Bassa confidenza'}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          {employee.position} • {employee.department} • {employee.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <Select
                        value={employee.suggestedStoreId}
                        onChange={(value) => changeEmployeeStore(employee.employeeId, value)}
                        options={stores.map(store => ({
                          value: store.id,
                          label: store.name
                        }))}
                        size="sm"
                        className="min-w-[150px]"
                      />
                    </div>
                  </div>

                  {employee.isConflict && employee.existingEmployee && (
                    <div className="mt-2 p-2 bg-orange-100 rounded text-sm">
                      <strong>Dipendente esistente:</strong> {employee.existingEmployee.firstName} {employee.existingEmployee.lastName} 
                      ({employee.existingEmployee.email})
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Azioni */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('fetch')}
              >
                Indietro
              </Button>
              
              <Button
                onClick={importSelectedEmployees}
                disabled={stats.selected === 0 || importing}
                icon={importing ? undefined : UserCheck}
              >
                {importing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  `Importa ${stats.selected} Dipendenti`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'import' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Importazione Completata!</h3>
            <p className="text-gray-600">
              {stats.selected} dipendenti sono stati importati con successo nel sistema.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};