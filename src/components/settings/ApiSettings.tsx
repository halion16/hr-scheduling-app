import React, { useState, useEffect } from 'react';
import { CompanyApiService } from '../../lib/company-api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { 
  Settings, 
  Database, 
  RefreshCw, 
  Save, 
  TestTube,
  Users,
  Download,
  AlertTriangle
} from 'lucide-react';

interface ApiSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeSync?: (employees: any[]) => void;
}

export const ApiSettings: React.FC<ApiSettingsProps> = ({
  isOpen,
  onClose,
  onEmployeeSync
}) => {
  const [apiSettings, setApiSettings] = useState({
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
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingEmployees, setSyncingEmployees] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('hr-scheduling-api-settings');
    if (saved) {
      const savedSettings = JSON.parse(saved);
      setApiSettings(prev => ({ ...prev, ...savedSettings }));
    }
  }, [isOpen]);

  const handleSaveSettings = () => {
    CompanyApiService.saveCredentials(apiSettings);
    alert('Impostazioni API salvate con successo!');
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      // Salva temporaneamente per il test
      CompanyApiService.saveCredentials(apiSettings);
      
      const result = await CompanyApiService.testConnection();
      setConnectionStatus(result);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error: any) {
      const errorResult = { success: false, message: error.message };
      setConnectionStatus(errorResult);
      alert(`❌ Errore durante il test: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncEmployees = async () => {
    setSyncingEmployees(true);
    
    try {
      // Salva le impostazioni prima della sincronizzazione
      CompanyApiService.saveCredentials(apiSettings);
      
      const employees = await CompanyApiService.syncEmployees();
      
      if (onEmployeeSync) {
        onEmployeeSync(employees);
      }
      
      alert(`✅ Sincronizzati ${employees.length} dipendenti da API aziendale!`);
    } catch (error: any) {
      alert(`❌ Errore durante la sincronizzazione: ${error.message}`);
    } finally {
      setSyncingEmployees(false);
    }
  };

  const toggleMockMode = () => {
    const newUseMock = !apiSettings.useMock;
    const newSettings = { ...apiSettings, useMock: newUseMock };
    setApiSettings(newSettings);
    
    CompanyApiService.saveCredentials(newSettings);
    
    if (newUseMock) {
      alert('🔄 Modalità MOCK attivata - usando dati di test');
    } else {
      alert('🌐 Modalità API REALE attivata - usando la tua API aziendale');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Vuoi ripristinare le impostazioni di default?')) {
      CompanyApiService.resetToDefaults();
      alert('Impostazioni ripristinate. Ricarica il modal per vedere le modifiche.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impostazioni API Aziendale"
      size="xl"
    >
      <div className="space-y-6">
        {/* Status Connection */}
        {connectionStatus && (
          <div className={`p-4 rounded-lg border ${
            connectionStatus.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {connectionStatus.success ? '✅' : '❌'}
              <span className="ml-2 font-medium">
                {connectionStatus.success ? 'Connessione riuscita' : 'Errore connessione'}
              </span>
            </div>
            <p className="text-sm mt-1">{connectionStatus.message}</p>
          </div>
        )}

        {/* Modalità API */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-blue-900">Modalità API</h3>
              <p className="text-sm text-blue-700">
                {apiSettings.useMock 
                  ? '🔄 Usando dati MOCK per testing (6 dipendenti demo)' 
                  : '🌐 Usando API EcosAgile reale'
                }
              </p>
            </div>
            <Button
              variant={apiSettings.useMock ? "outline" : "solid"}
              size="sm"
              onClick={toggleMockMode}
            >
              {apiSettings.useMock ? 'Attiva API Reale' : 'Usa Mock'}
            </Button>
          </div>
        </div>

        {/* Configurazione EcosAgile */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Configurazione EcosAgile
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Endpoint API</label>
              <Input
                value={apiSettings.endpoint}
                onChange={(value) => setApiSettings({...apiSettings, endpoint: value})}
                placeholder="https://ha.ecosagile.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Codice Istanza</label>
              <Input
                value={apiSettings.instanceCode}
                onChange={(value) => setApiSettings({...apiSettings, instanceCode: value})}
                placeholder="ee"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Username EcosAgile</label>
              <Input
                value={apiSettings.userid}
                onChange={(value) => setApiSettings({...apiSettings, userid: value})}
                placeholder="TUO_USERNAME"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Password EcosAgile</label>
              <Input
                type="password"
                value={apiSettings.password}
                onChange={(value) => setApiSettings({...apiSettings, password: value})}
                placeholder="TUA_PASSWORD"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Client ID</label>
            <Input
              value={apiSettings.clientId}
              onChange={(value) => setApiSettings({...apiSettings, clientId: value})}
              placeholder="16383"
            />
          </div>
        </div>

        {/* Token Aziendali */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="font-medium mb-3 flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            Token Aziendali (Opzionali)
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">EcosApi AuthToken</label>
              <Input
                type="password"
                value={apiSettings.ecosApiAuthToken}
                onChange={(value) => setApiSettings({...apiSettings, ecosApiAuthToken: value})}
                placeholder="039b969c-339d..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">URL Cal Token</label>
              <Input
                type="password"
                value={apiSettings.urlCalToken}
                onChange={(value) => setApiSettings({...apiSettings, urlCalToken: value})}
                placeholder="0AF0QFNRF5HPS5FJT6..."
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">API Password</label>
              <Input
                type="password"
                value={apiSettings.apiPassword}
                onChange={(value) => setApiSettings({...apiSettings, apiPassword: value})}
                placeholder="dG2ZhGyt!"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button 
            onClick={handleSaveSettings}
            icon={Save}
          >
            Salva Configurazione
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleTestConnection}
            disabled={testingConnection}
            icon={testingConnection ? undefined : TestTube}
          >
            {testingConnection ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              'Testa Connessione'
            )}
          </Button>

          <Button 
            variant="outline"
            onClick={handleSyncEmployees}
            disabled={syncingEmployees}
            icon={syncingEmployees ? undefined : Users}
          >
            {syncingEmployees ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizzando...
              </>
            ) : (
              'Sincronizza Dipendenti'
            )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleResetDefaults}
            icon={AlertTriangle}
            size="sm"
          >
            Reset Defaults
          </Button>
        </div>

        {/* Info */}
        <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">ℹ️ Come funziona:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Modalità Mock:</strong> Usa 6 dipendenti demo per test e sviluppo</li>
            <li><strong>Modalità API Reale:</strong> Si connette al tuo sistema EcosAgile</li>
            <li><strong>Testa Connessione:</strong> Verifica che le credenziali siano corrette</li>
            <li><strong>Sincronizza Dipendenti:</strong> Importa i dipendenti attivi nel sistema turni</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};