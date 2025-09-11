import { Employee, Store } from '../types';

// Interfaccia per dipendenti da API aziendale
export interface CompanyApiEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  department: string;
  hireDate: string;
  phone?: string;
  status: 'active' | 'inactive';
  // Informazioni negozio/unità organizzativa dal gestionale
  organizationalUnit?: string;  // Unità organizzativa da EcosAgile
  storeCode?: string;          // Codice negozio dal gestionale
  storeName?: string;          // Nome negozio dal gestionale
  storeId?: string;            // ID mappato al sistema HR (se già presente)
  workLocation?: string;       // Sede di lavoro generica
}

// Backup dei dati mock per fallback
const MOCK_COMPANY_EMPLOYEES: CompanyApiEmployee[] = [
  {
    employeeId: 'EMP001',
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco.rossi@company.it',
    position: 'Sales Representative',
    department: 'Sales',
    hireDate: '2022-03-15',
    phone: '+39 340 1234567',
    status: 'active',
    organizationalUnit: 'Barberino',
    storeCode: 'BAR001',
    storeName: 'Barberino',
    workLocation: 'Barberino'
  },
  {
    employeeId: 'EMP002',
    firstName: 'Sofia',
    lastName: 'Bianchi',
    email: 'sofia.bianchi@company.it',
    position: 'Store Manager',
    department: 'Retail',
    hireDate: '2021-09-01',
    phone: '+39 340 2345678',
    status: 'active',
    organizationalUnit: 'Barberino',
    storeCode: 'BAR001',
    storeName: 'Barberino',
    workLocation: 'Barberino'
  },
  {
    employeeId: 'EMP003',
    firstName: 'Luca',
    lastName: 'Verdi',
    email: 'luca.verdi@company.it',
    position: 'Sales Assistant',
    department: 'Sales',
    hireDate: '2023-01-10',
    phone: '+39 340 3456789',
    status: 'active',
    organizationalUnit: 'Barberino',
    storeCode: 'BAR001',
    storeName: 'Barberino',
    workLocation: 'Barberino'
  },
  {
    employeeId: 'EMP004',
    firstName: 'Anna',
    lastName: 'Neri',
    email: 'anna.neri@company.it',
    position: 'Cashier',
    department: 'Retail',
    hireDate: '2020-05-20',
    phone: '+39 340 4567890',
    status: 'active',
    organizationalUnit: 'Barberino',
    storeCode: 'BAR001',
    storeName: 'Barberino',
    workLocation: 'Barberino'
  },
  {
    employeeId: 'EMP005',
    firstName: 'Giovanni',
    lastName: 'Blu',
    email: 'giovanni.blu@company.it',
    position: 'Part-time Sales',
    department: 'Sales',
    hireDate: '2021-11-12',
    phone: '+39 340 5678901',
    status: 'active',
    organizationalUnit: 'Barberino',
    storeCode: 'BAR001',
    storeName: 'Barberino',
    workLocation: 'Barberino'
  },
  {
    employeeId: 'EMP006',
    firstName: 'Chiara',
    lastName: 'Rosa',
    email: 'chiara.rosa@company.it',
    position: 'Assistant Manager',
    department: 'Retail',
    hireDate: '2022-08-03',
    phone: '+39 340 6789012',
    status: 'active',
    organizationalUnit: 'Milano Centro',
    storeCode: 'MIL001',
    storeName: 'Milano Centro',
    workLocation: 'Milano'
  }
];

interface ApiCredentials {
  endpoint: string;
  apiKey: string;
  version: string;
  useMock: boolean;
  // EcosAgile specific credentials
  userid?: string;
  password?: string;
  clientId?: string;
  instanceCode?: string;
  ecosApiAuthToken?: string;
  urlCalToken?: string;
  apiPassword?: string;
}

interface EcosAgileTokenResponse {
  token: string;
  success: boolean;
  message?: string;
}

export class CompanyApiService {
  private static getCredentials(): ApiCredentials {
    // Carica le credenziali salvate o usa i defaults
    const saved = localStorage.getItem('hr-scheduling-api-settings');
    const defaults: ApiCredentials = {
      endpoint: 'https://ha.ecosagile.com',
      apiKey: 'your-api-key',
      version: 'v1',
      useMock: true, // Default a mock per sicurezza
      // Credenziali EcosAgile
      instanceCode: 'ee',
      userid: 'TUO_USERNAME',
      password: 'TUA_PASSWORD', 
      clientId: '16383',
      // Token specifici per autenticazione
      ecosApiAuthToken: '039b969c-339d-4316-9c84-e4bfe1a77f3f',
      urlCalToken: '0AF0QFNRF5HPS5FJT6MMWF0DI',
      apiPassword: 'dG2ZhGyt!'
    };
    
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Autentica con EcosAgile e ottieni il token
  private static async getEcosAgileToken(): Promise<string> {
    const credentials = this.getCredentials();
    
    if (!credentials.instanceCode || !credentials.userid || !credentials.password) {
      const missing = [];
      if (!credentials.instanceCode) missing.push('Codice Istanza');
      if (!credentials.userid) missing.push('Username');
      if (!credentials.password) missing.push('Password');
      throw new Error(`Credenziali EcosAgile incomplete. Mancano: ${missing.join(', ')}`);
    }

    const tokenUrl = `${credentials.endpoint}/${credentials.instanceCode}/api.pm?ApiName=TokenGet`;
    
    const formData = new URLSearchParams();
    formData.append('Userid', credentials.userid);
    formData.append('Password', credentials.password);
    formData.append('ClientID', credentials.clientId || '16383');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Errore TokenGet: ${response.status} ${response.statusText}. Dettagli: ${errorText}`);
    }

    const responseText = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(responseText);
      
      // Check if it's an EcosAgile XML error response converted to JSON
      if (data.ECOSAGILE_TABLE_DATA && data.ECOSAGILE_TABLE_DATA.ECOSAGILE_ERROR_MESSAGE) {
        const error = data.ECOSAGILE_TABLE_DATA.ECOSAGILE_ERROR_MESSAGE;
        if (error.CODE === 'FAIL') {
          throw new Error(`EcosAgile API Error: ${error.USERMESSAGE || error.MESSAGE || 'Errore sconosciuto'}`);
        }
      }
      
      // Check for success token response
      if (data.ECOSAGILE_TABLE_DATA && 
          data.ECOSAGILE_TABLE_DATA.ECOSAGILE_DATA && 
          data.ECOSAGILE_TABLE_DATA.ECOSAGILE_DATA.ECOSAGILE_DATA_ROW) {
        const authToken = data.ECOSAGILE_TABLE_DATA.ECOSAGILE_DATA.ECOSAGILE_DATA_ROW.AuthToken;
        if (authToken) {
          return authToken;
        }
      }
      
    } catch (parseError) {
      throw new Error(`Risposta API non è JSON valido: ${responseText}`);
    }
    
    throw new Error('Formato risposta EcosAgile non riconosciuto');
  }

  // Test connessione API
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    const credentials = this.getCredentials();
    
    if (credentials.useMock) {
      return { success: true, message: 'Usando dati mock per testing' };
    }

    try {
      const token = await this.getEcosAgileToken();
      return { success: true, message: 'Connessione EcosAgile riuscita e token ottenuto' };
    } catch (error: any) {
      let errorMessage = `Errore connessione EcosAgile: ${error.message}`;
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Errore di connessione - possibile problema CORS o rete. Verifica le credenziali.';
      }
      
      return { success: false, message: errorMessage };
    }
  }

  // Recupera dipendenti attivi
  static async fetchActiveEmployees(): Promise<CompanyApiEmployee[]> {
    const credentials = this.getCredentials();
    
    // Se siamo in modalità mock, usa i dati di test
    if (credentials.useMock) {
      await this.delay(1000); // Simula latenza di rete
      console.log('🔄 Usando dati MOCK per testing');
      return MOCK_COMPANY_EMPLOYEES.filter(emp => emp.status === 'active');
    }

    // Chiamata API EcosAgile reale
    try {
      console.log('🌐 Chiamando API EcosAgile');
      
      const token = await this.getEcosAgileToken();
      
      const apiUrl = `${credentials.endpoint}/${credentials.instanceCode}/api.pm?ApiName=PeopleExpressGetAll&AuthToken=${token}`;
      
      const formData = new URLSearchParams();
      formData.append('PersonStatusCode', "='A'");
      formData.append('TerminationDate', "=''");
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`Errore API EcosAgile: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      const data = JSON.parse(responseText);
      
      // Controlla errori EcosAgile
      if (data.ECOSAGILE_TABLE_DATA && data.ECOSAGILE_TABLE_DATA.ECOSAGILE_ERROR_MESSAGE) {
        const error = data.ECOSAGILE_TABLE_DATA.ECOSAGILE_ERROR_MESSAGE;
        if (error.CODE === 'FAIL') {
          throw new Error(`Errore EcosAgile: ${error.USERMESSAGE || error.MESSAGE || 'Errore sconosciuto'}`);
        }
      }

      // Estrai i dati dei dipendenti
      let employees: any[] = [];
      
      if (data.ECOSAGILE_TABLE_DATA && data.ECOSAGILE_TABLE_DATA.ECOSAGILE_DATA) {
        const ecosData = data.ECOSAGILE_TABLE_DATA.ECOSAGILE_DATA.ECOSAGILE_DATA_ROW;
        if (Array.isArray(ecosData)) {
          employees = ecosData;
        } else if (ecosData) {
          employees = [ecosData];
        }
      }
      
      // SALVA I DATI GREZZI PER DEBUG
      this.saveRawApiData(employees);
      console.log(`🔍 DEBUG - Salvati ${employees.length} dipendenti grezzi da EcosAgile`);
      
      // Converte dal formato EcosAgile al formato standard
      const mappedEmployees = employees
        .filter(emp => !emp.Delete || emp.Delete === '0')
        .map(emp => this.mapEcosAgileToStandardFormat(emp));
      
      console.log(`✅ Importati ${mappedEmployees.length} dipendenti da EcosAgile`);
      return mappedEmployees;

    } catch (error: any) {
      console.error('❌ Errore EcosAgile, usando fallback mock:', error.message);
      
      // Fallback ai dati mock in caso di errore
      await this.delay(500);
      const mockEmployees = MOCK_COMPANY_EMPLOYEES.filter(emp => emp.status === 'active');
      
      // SALVA ANCHE I MOCK COME DATI GREZZI PER DEBUG
      this.saveRawApiData(mockEmployees);
      console.log(`🔍 DEBUG - Usando ${mockEmployees.length} dipendenti mock come fallback`);
      
      return mockEmployees;
    }
  }

  // Mappa la risposta EcosAgile al formato standard
  private static mapEcosAgileToStandardFormat(ecosEmployee: any): CompanyApiEmployee {
    return {
      employeeId: ecosEmployee.EmplID || ecosEmployee.EmplCode || ecosEmployee.ID || 'N/A',
      firstName: ecosEmployee.NameFirst || ecosEmployee.Nome || ecosEmployee.FirstName || 'N/A',
      lastName: ecosEmployee.NameLast || ecosEmployee.Cognome || ecosEmployee.LastName || 'N/A',
      email: ecosEmployee.EMail || ecosEmployee.Email || ecosEmployee.email || '',
      position: ecosEmployee.Position || ecosEmployee.JobTitle || ecosEmployee.Posizione || 'Non specificato',
      department: ecosEmployee.Department || ecosEmployee.Dipartimento || 'Non specificato',
      hireDate: ecosEmployee.HireDate || ecosEmployee.DataAssunzione || new Date().toISOString().split('T')[0],
      phone: ecosEmployee.Phone || ecosEmployee.Telefono || ecosEmployee.PhoneNumber || '',
      status: (!ecosEmployee.Delete || ecosEmployee.Delete === '0') ? 'active' : 'inactive',
      // CAMPO PRINCIPALE: DepartmentDescShort contiene i nomi dei negozi
      organizationalUnit: ecosEmployee.DepartmentDescShort || 
                         ecosEmployee.OrganizationalUnit || 
                         ecosEmployee.UnitaOrganizzativa || 
                         ecosEmployee.BusinessUnit || 
                         ecosEmployee.WorkLocation || 
                         ecosEmployee.Office || 
                         ecosEmployee.Branch || 
                         ecosEmployee.Store ||
                         ecosEmployee.Location ||
                         '',
      storeCode: ecosEmployee.StoreCode || ecosEmployee.BranchCode || '',
      storeName: ecosEmployee.StoreName || ecosEmployee.BranchName || '',
      workLocation: ecosEmployee.WorkLocation || ecosEmployee.City || ecosEmployee.Location || ''
    };
  }

  // Sincronizza dipendenti per HR Scheduling app
  static async syncEmployees(defaultStoreId?: string): Promise<Employee[]> {
    const companyEmployees = await this.fetchActiveEmployees();
    return companyEmployees.map(emp => this.mapToHREmployee(emp, defaultStoreId));
  }

  // Mappa da CompanyApiEmployee a Employee della HR app
  private static mapToHREmployee(companyEmployee: CompanyApiEmployee, defaultStoreId?: string): Employee {
    return {
      id: companyEmployee.employeeId,
      firstName: companyEmployee.firstName,
      lastName: companyEmployee.lastName,
      email: companyEmployee.email,
      phone: companyEmployee.phone || '',
      position: companyEmployee.position,
      department: companyEmployee.department,
      hireDate: new Date(companyEmployee.hireDate),
      isActive: companyEmployee.status === 'active',
      storeId: defaultStoreId || '', // Assegna a negozio di default o lascia vuoto
      skills: [], // Lista vuota di default
      maxWeeklyHours: 40, // Default 40 ore settimanali
      minRestHours: 12, // Default 12 ore di riposo minimo
      preferredShifts: [], // Lista vuota di default
      contractType: 'full-time', // Default full-time
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Salva credenziali
  static saveCredentials(credentials: Partial<ApiCredentials>): void {
    const current = this.getCredentials();
    const updated = { ...current, ...credentials };
    localStorage.setItem('hr-scheduling-api-settings', JSON.stringify(updated));
  }

  // Reset ai defaults
  static resetToDefaults(): void {
    const defaults = {
      endpoint: 'https://ha.ecosagile.com',
      apiKey: 'your-api-key',
      version: 'v1',
      useMock: true,
      instanceCode: 'ee',
      userid: 'TUO_USERNAME',
      password: 'TUA_PASSWORD', 
      clientId: '16383',
      ecosApiAuthToken: '039b969c-339d-4316-9c84-e4bfe1a77f3f',
      urlCalToken: '0AF0QFNRF5HPS5FJT6MMWF0DI',
      apiPassword: 'dG2ZhGyt!'
    };
    localStorage.setItem('hr-scheduling-api-settings', JSON.stringify(defaults));
  }

  // Attiva/disattiva modalità mock
  static toggleMockMode(useMock: boolean): void {
    this.saveCredentials({ useMock });
  }

  // ========== PERSISTENZA LOCALE DATI API ==========
  
  // Salva dipendenti da API in cache locale
  static saveApiEmployeesCache(employees: CompanyApiEmployee[]): void {
    const cacheData = {
      employees,
      timestamp: Date.now(),
      expiresIn: 1000 * 60 * 30 // Cache valida per 30 minuti
    };
    localStorage.setItem('hr-api-employees-cache', JSON.stringify(cacheData));
  }

  // Carica dipendenti da cache locale
  static getApiEmployeesCache(): CompanyApiEmployee[] | null {
    try {
      const cached = localStorage.getItem('hr-api-employees-cache');
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();
      
      // Verifica se la cache è ancora valida
      if (now - cacheData.timestamp > cacheData.expiresIn) {
        localStorage.removeItem('hr-api-employees-cache');
        return null;
      }

      return cacheData.employees;
    } catch (error) {
      console.error('Errore caricamento cache dipendenti:', error);
      return null;
    }
  }

  // Salva configurazioni di sincronizzazione
  static saveSyncConfig(config: { 
    defaultStoreId?: string;
    lastSyncTimestamp?: number;
    syncedEmployeeIds?: string[];
  }): void {
    const current = this.getSyncConfig();
    const updated = { ...current, ...config };
    localStorage.setItem('hr-sync-config', JSON.stringify(updated));
  }

  // Carica configurazioni di sincronizzazione
  static getSyncConfig(): {
    defaultStoreId?: string;
    lastSyncTimestamp?: number;
    syncedEmployeeIds?: string[];
  } {
    try {
      const saved = localStorage.getItem('hr-sync-config');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Errore caricamento config sync:', error);
      return {};
    }
  }

  // Pulisci cache (per debug o reset)
  static clearCache(): void {
    localStorage.removeItem('hr-api-employees-cache');
    localStorage.removeItem('hr-sync-config');
  }

  // Fetch con cache intelligente
  static async fetchActiveEmployeesWithCache(): Promise<CompanyApiEmployee[]> {
    // Prima prova a usare la cache
    const cachedEmployees = this.getApiEmployeesCache();
    if (cachedEmployees) {
      console.log(`✅ Usando ${cachedEmployees.length} dipendenti dalla cache locale`);
      return cachedEmployees;
    }

    // Se cache non disponibile, fetch da API e salva in cache
    console.log('🔄 Cache non disponibile, fetch da API...');
    const freshEmployees = await this.fetchActiveEmployees();
    this.saveApiEmployeesCache(freshEmployees);
    return freshEmployees;
  }

  // ========== GESTIONE DATI GREZZI PER DEBUG ==========
  
  // Salva i dati grezzi della API per debug
  static saveRawApiData(rawData: any[]): void {
    const debugData = {
      rawEmployees: rawData,
      timestamp: Date.now(),
      source: rawData.length === 6 ? 'mock' : 'api'
    };
    localStorage.setItem('hr-raw-api-debug', JSON.stringify(debugData));
    console.log(`🔍 DEBUG - Salvati ${rawData.length} dipendenti grezzi (${debugData.source})`);
  }

  // Recupera i dati grezzi per debug
  static getRawApiData(): any[] {
    try {
      const saved = localStorage.getItem('hr-raw-api-debug');
      if (!saved) return [];
      
      const debugData = JSON.parse(saved);
      console.log(`🔍 DEBUG - Recuperati ${debugData.rawEmployees.length} dipendenti grezzi da ${debugData.source}`);
      return debugData.rawEmployees || [];
    } catch (error) {
      console.error('❌ Errore recupero dati grezzi:', error);
      return [];
    }
  }

  // Export Excel dei dati grezzi
  static exportRawDataToExcel(): void {
    const rawData = this.getRawApiData();
    if (rawData.length === 0) {
      alert('❌ Nessun dato grezzo disponibile. Esegui prima una sincronizzazione.');
      return;
    }

    // Ottieni tutti i possibili campi da tutti i dipendenti
    const allFields = new Set<string>();
    rawData.forEach(employee => {
      Object.keys(employee).forEach(key => allFields.add(key));
    });

    const fieldsList = Array.from(allFields).sort();
    
    // Crea i dati per l'Excel
    const excelData = rawData.map((employee, index) => {
      const row: any = { '_RECORD_NUMBER': index + 1 };
      
      // Aggiungi tutti i campi possibili
      fieldsList.forEach(field => {
        const value = employee[field];
        row[field] = value !== undefined && value !== null ? String(value) : '';
      });
      
      return row;
    });

    // Crea CSV (Excel compatibile)
    const headers = ['_RECORD_NUMBER', ...fieldsList];
    let csvContent = headers.join('\t') + '\n';
    
    excelData.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape per caratteri speciali in CSV
        return typeof value === 'string' && value.includes('\t') ? `"${value}"` : value;
      });
      csvContent += values.join('\t') + '\n';
    });

    // Download del file
    const blob = new Blob([csvContent], { type: 'text/tab-separated-values;charset=utf-8' });
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = URL.createObjectURL(blob);
    link.download = `EcosAgile_RawData_${timestamp}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`📊 EXPORT EXCEL - Esportati ${excelData.length} dipendenti con ${fieldsList.length} campi`);
    console.log(`📋 CAMPI TROVATI:`, fieldsList);
    alert(`✅ Export completato!\n\nFile: EcosAgile_RawData_${timestamp}.xls\nDipendenti: ${excelData.length}\nCampi: ${fieldsList.length}\n\nTutti i campi grezzi dalla API sono inclusi!`);
  }
}