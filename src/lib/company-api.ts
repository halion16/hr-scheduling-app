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
}

// Backup dei dati mock per fallback
const MOCK_COMPANY_EMPLOYEES: CompanyApiEmployee[] = [
  {
    employeeId: 'EMP001',
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco.rossi@company.it',
    position: 'Senior Developer',
    department: 'IT',
    hireDate: '2022-03-15',
    phone: '+39 340 1234567',
    status: 'active'
  },
  {
    employeeId: 'EMP002',
    firstName: 'Sofia',
    lastName: 'Bianchi',
    email: 'sofia.bianchi@company.it',
    position: 'Marketing Manager',
    department: 'Marketing',
    hireDate: '2021-09-01',
    phone: '+39 340 2345678',
    status: 'active'
  },
  {
    employeeId: 'EMP003',
    firstName: 'Luca',
    lastName: 'Verdi',
    email: 'luca.verdi@company.it',
    position: 'Sales Representative',
    department: 'Sales',
    hireDate: '2023-01-10',
    phone: '+39 340 3456789',
    status: 'active'
  },
  {
    employeeId: 'EMP004',
    firstName: 'Anna',
    lastName: 'Neri',
    email: 'anna.neri@company.it',
    position: 'HR Manager',
    department: 'HR',
    hireDate: '2020-05-20',
    phone: '+39 340 4567890',
    status: 'active'
  },
  {
    employeeId: 'EMP005',
    firstName: 'Giovanni',
    lastName: 'Blu',
    email: 'giovanni.blu@company.it',
    position: 'Store Manager',
    department: 'Retail',
    hireDate: '2021-11-12',
    phone: '+39 340 5678901',
    status: 'active'
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
    status: 'active'
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
      return MOCK_COMPANY_EMPLOYEES.filter(emp => emp.status === 'active');
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
      status: (!ecosEmployee.Delete || ecosEmployee.Delete === '0') ? 'active' : 'inactive'
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
}