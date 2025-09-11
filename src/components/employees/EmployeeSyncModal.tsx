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
  UserPlus,
  Filter,
  Building
} from 'lucide-react';

interface EmployeeSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeesImport: (employees: Employee[], keepModalOpen?: boolean) => void;
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
  const [importingSingle, setImportingSingle] = useState<string | null>(null); // ID del dipendente in importazione singola
  const [importedEmployees, setImportedEmployees] = useState<Set<string>>(new Set()); // Dipendenti già importati in questa sessione
  const [step, setStep] = useState<'fetch' | 'preview' | 'import'>('fetch');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterName, setFilterName] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState(''); // Filtro per negozio
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

  // MAPPING SEMPLICE: organizationalUnit contiene nome negozio
  const simpleMapping = (employee: CompanyApiEmployee): { storeId: string; storeName: string; confidence: 'high' | 'medium' | 'low' } => {
    const orgUnit = employee.organizationalUnit || '';
    
    console.log(`🔍 MAPPING: ${employee.firstName} ${employee.lastName} - orgUnit: "${orgUnit}"`);
    console.log(`🏪 NEGOZI DISPONIBILI:`, stores.map(s => s.name));
    
    // PRIMA: Cerca match esatto
    for (const store of stores) {
      if (store.name.toLowerCase().trim() === orgUnit.toLowerCase().trim()) {
        console.log(`✅ MATCH ESATTO: "${orgUnit}" = "${store.name}"`);
        return { storeId: store.id, storeName: store.name, confidence: 'high' };
      }
    }
    
    // SECONDA: Cerca match parziale (solo se orgUnit contiene il nome del negozio)
    for (const store of stores) {
      const storeLower = store.name.toLowerCase().trim();
      const orgLower = orgUnit.toLowerCase().trim();
      
      if (orgLower.includes(storeLower) && storeLower.length > 3) {
        console.log(`✅ MATCH PARZIALE: "${orgUnit}" contiene "${store.name}"`);
        return { storeId: store.id, storeName: store.name, confidence: 'medium' };
      }
    }
    
    // Nessun match - primo negozio
    const firstStore = stores[0];
    console.log(`❌ NO MATCH: "${orgUnit}" → Default: "${firstStore?.name}"`);
    return { 
      storeId: firstStore?.id || '', 
      storeName: firstStore?.name || 'Default', 
      confidence: 'low' 
    };
  };

  // Fetch dipendenti da API (con cache)
  const fetchApiEmployees = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Salva la configurazione del negozio di default
      CompanyApiService.saveSyncConfig({ defaultStoreId });
      
      // Usa sempre il metodo con cache intelligente che supporta forceRefresh
      const employees = await CompanyApiService.fetchActiveEmployeesWithCache(forceRefresh);
      
      const mappedEmployees: EmployeeWithMapping[] = employees.map(emp => {
        const mapping = simpleMapping(emp);
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
          shouldImport: true // SEMPLICE: Seleziona tutti per default
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

  // STATISTICHE SEMPLIFICATE: Sempre sui dipendenti visibili/filtrati
  const calculateStats = () => {
    setStats({
      total: filteredEmployees.length,
      selected: filteredEmployees.filter(emp => emp.shouldImport).length,
      conflicts: filteredEmployees.filter(emp => emp.isConflict).length,
      new: filteredEmployees.filter(emp => !emp.isConflict).length
    });
  };

  // Aggiorna stats quando cambiano dipendenti o filtro negozio
  useEffect(() => {
    calculateStats();
  }, [apiEmployees, selectedStoreFilter]);

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

  // Importa dipendenti selezionati (solo quelli VISIBILI e SELEZIONATI)
  const importSelectedEmployees = async () => {
    setImporting(true);
    try {
      // IMPORTANTE: Usa filteredEmployees (quelli visibili) E che sono selezionati
      const toImport = filteredEmployees.filter(emp => emp.shouldImport);
      
      console.log(`🚀 IMPORT - Dipendenti da importare:`, toImport.map(e => ({
        nome: `${e.firstName} ${e.lastName}`,
        email: e.email,
        orgUnit: e.organizationalUnit,
        storeId: e.suggestedStoreId,
        storeName: e.suggestedStoreName,
        shouldImport: e.shouldImport
      })));
      
      if (toImport.length === 0) {
        alert('⚠️ Nessun dipendente selezionato per l\'importazione!');
        setImporting(false);
        return;
      }
      
      // Salva gli ID dei dipendenti importati e timestamp
      const importedIds = toImport.map(emp => emp.employeeId);
      CompanyApiService.saveSyncConfig({ 
        defaultStoreId,
        lastSyncTimestamp: Date.now(),
        syncedEmployeeIds: importedIds
      });
      
      const hrEmployees: Employee[] = toImport.map(emp => ({
        id: crypto.randomUUID(), // 🔧 FIX: Genera sempre ID univoco, non usare API employeeId
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

      // DEBUG: Verifica storeId per ogni dipendente
      console.log('🔍 VERIFICA STOREID:', hrEmployees.map(e => ({
        nome: `${e.firstName} ${e.lastName}`,
        storeId: e.storeId,
        storeName: stores.find(s => s.id === e.storeId)?.name || 'NEGOZIO NON TROVATO',
        orgUnit: toImport.find(api => api.employeeId === e.id)?.organizationalUnit
      })));

      // Conta dipendenti per storeId
      const storeIdCounts = hrEmployees.reduce((acc, e) => {
        acc[e.storeId] = (acc[e.storeId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📊 DISTRIBUZIONE DIPENDENTI PER STOREID:', storeIdCounts);
      
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

  // Importa un singolo dipendente mantenendo la modale aperta
  const importSingleEmployee = async (employeeId: string) => {
    setImportingSingle(employeeId);
    try {
      const employee = apiEmployees.find(emp => emp.employeeId === employeeId);
      if (!employee) {
        alert('Dipendente non trovato!');
        return;
      }

      // Importing single employee

      // Converti in formato HR con ID univoco generato
      const hrEmployee: Employee = {
        id: crypto.randomUUID(), // 🔧 FIX: Genera sempre ID univoco, non usare API employeeId
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone || '',
        position: employee.position,
        department: employee.department,
        hireDate: new Date(employee.hireDate),
        isActive: employee.status === 'active',
        storeId: employee.suggestedStoreId,
        skills: [],
        maxWeeklyHours: 40,
        minRestHours: 12,
        preferredShifts: [],
        contractType: 'full-time',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Importa il singolo dipendente con flag per mantenere modale aperta
      onEmployeesImport([hrEmployee], true);
      
      // Aggiorna lo stato: rimuovi dalle lista e aggiungi agli importati
      setImportedEmployees(prev => new Set([...prev, employeeId]));
      setApiEmployees(prev => prev.filter(emp => emp.employeeId !== employeeId));
      
      // Single employee import completed
      
    } catch (error: any) {
      alert(`Errore durante l'importazione di ${employeeId}: ${error.message}`);
    } finally {
      setImportingSingle(null);
    }
  };

  // Filtro dipartimenti disponibili
  const availableDepartments = [...new Set(apiEmployees.map(emp => emp.department))];

  // FILTRO SEMPLICE: Solo per negozio se selezionato
  const filteredEmployees = selectedStoreFilter 
    ? apiEmployees.filter(emp => emp.suggestedStoreId === selectedStoreFilter)
    : apiEmployees;

  // DEBUG: Log dei risultati del filtro
  if (selectedStoreFilter) {
    console.log(`📊 FILTRO RISULTATO: ${filteredEmployees.length} dipendenti su ${apiEmployees.length} totali per store ${selectedStoreFilter}`);
    console.log(`🏪 STORE SELEZIONATO:`, stores.find(s => s.id === selectedStoreFilter)?.name);
  }

  // Reset degli stati quando si chiude la modale
  const handleClose = () => {
    setImportedEmployees(new Set());
    setImportingSingle(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
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
                <>
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
                  <Button
                    onClick={() => {
                      CompanyApiService.clearCache();
                      alert('✅ Cache MOCK cancellata! Ora puoi recuperare i dati REALI da EcosAgile.');
                    }}
                    disabled={loading}
                    variant="outline"
                    size="lg"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Cancella Cache
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div>
            {/* Statistiche */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-5 gap-4 text-center">
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
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{importedEmployees.size}</div>
                  <div className="text-sm text-gray-600">Già Importati</div>
                </div>
              </div>
              
              {/* Messaggio di feedback per importazioni singole */}
              {importedEmployees.size > 0 && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-emerald-800 font-medium">
                      ✅ {importedEmployees.size} dipendente{importedEmployees.size > 1 ? 'i' : ''} importato{importedEmployees.size > 1 ? 'i' : ''} con successo in questa sessione!
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    La modale rimane aperta per continuare con altri dipendenti.
                  </p>
                </div>
              )}
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

                {/* FILTRO NEGOZIO SEMPLIFICATO */}
                <Select
                  value={selectedStoreFilter}
                  onChange={(storeId) => {
                    setSelectedStoreFilter(storeId || '');
                  }}
                  options={[
                    { value: '', label: '🏪 Tutti i Negozi' },
                    ...stores.map(store => ({
                      value: store.id,
                      label: store.name
                    }))
                  ]}
                  size="sm"
                />

                {/* Pulsante Reset Filtri */}
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setFilterName('');
                    setFilterDepartment('');
                    console.log('🔄 Reset filtri completato');
                  }}
                  className="text-gray-600"
                >
                  Reset
                </Button>
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
                          {employee.organizationalUnit && (
                            <>
                              <br />
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 inline-block">
                                📍 {employee.organizationalUnit}
                              </span>
                            </>
                          )}
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
                      
                      {/* Pulsante Importa Singolo */}
                      <Button
                        size="sm"
                        onClick={() => importSingleEmployee(employee.employeeId)}
                        disabled={importingSingle === employee.employeeId}
                        icon={importingSingle === employee.employeeId ? undefined : UserPlus}
                        className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                      >
                        {importingSingle === employee.employeeId ? (
                          <>
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          'Importa'
                        )}
                      </Button>
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