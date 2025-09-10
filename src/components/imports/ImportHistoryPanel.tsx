import React, { useState } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { 
  History, 
  FileSpreadsheet, 
  Calendar, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  Download,
  Eye,
  Trash2
} from 'lucide-react';

interface ImportHistory {
  id: string;
  fileName: string;
  importDate: Date;
  success: boolean;
  importedCount: number;
  errorCount: number;
  details: {
    newShifts: number;
    updatedShifts: number;
    newEmployees: number;
    conflicts: number;
  };
  message: string;
}

interface ImportHistoryPanelProps {
  onClose?: () => void;
}

export const ImportHistoryPanel: React.FC<ImportHistoryPanelProps> = ({ onClose }) => {
  const [importHistory, setImportHistory] = useLocalStorage<ImportHistory[]>('hr-import-history', []);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedImport, setSelectedImport] = useState<ImportHistory | null>(null);

  const handleDeleteHistory = (importId: string) => {
    if (confirm('Eliminare questo record dall\'cronologia?')) {
      setImportHistory(prev => prev.filter(item => item.id !== importId));
    }
  };

  const handleClearAllHistory = () => {
    if (confirm('Eliminare tutta la cronologia delle importazioni? Questa azione non è reversibile.')) {
      setImportHistory([]);
    }
  };

  const exportHistoryToExcel = () => {
    // Implementation for exporting history would go here
    console.log('📊 Exporting import history...');
  };

  const sortedHistory = [...importHistory].sort((a, b) => 
    new Date(b.importDate).getTime() - new Date(a.importDate).getTime()
  );

  const totalImports = importHistory.length;
  const successfulImports = importHistory.filter(item => item.success).length;
  const totalShiftsImported = importHistory.reduce((sum, item) => sum + item.importedCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <History className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cronologia Importazioni</h2>
            <p className="text-gray-600">Visualizza e gestisci le importazioni precedenti</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            icon={Download}
            onClick={exportHistoryToExcel}
            size="sm"
            disabled={importHistory.length === 0}
          >
            Esporta Cronologia
          </Button>
          
          <Button
            variant="danger"
            icon={Trash2}
            onClick={handleClearAllHistory}
            size="sm"
            disabled={importHistory.length === 0}
          >
            Svuota Cronologia
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose} size="sm">
              Chiudi
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalImports}</div>
          <div className="text-sm text-blue-700">Importazioni Totali</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{successfulImports}</div>
          <div className="text-sm text-green-700">Completate</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{totalShiftsImported}</div>
          <div className="text-sm text-purple-700">Turni Importati</div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {sortedHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Importazione
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Turni
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dettagli
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium text-gray-900">{item.fileName}</div>
                          <div className="text-sm text-gray-500">Excel Import</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(item.importDate).toLocaleDateString('it-IT')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.importDate).toLocaleTimeString('it-IT', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        item.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.success ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Successo
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Errore
                          </>
                        )}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {item.importedCount}
                      </div>
                      {item.errorCount > 0 && (
                        <div className="text-xs text-red-600">
                          {item.errorCount} errori
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-xs text-gray-600 space-y-1">
                        {item.details.newShifts > 0 && (
                          <div>+{item.details.newShifts} nuovi</div>
                        )}
                        {item.details.updatedShifts > 0 && (
                          <div>~{item.details.updatedShifts} aggiornati</div>
                        )}
                        {item.details.newEmployees > 0 && (
                          <div>+{item.details.newEmployees} dipendenti</div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={Eye}
                          onClick={() => {
                            setSelectedImport(item);
                            setShowDetailModal(true);
                          }}
                        >
                          Dettagli
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={Trash2}
                          onClick={() => handleDeleteHistory(item.id)}
                        >
                          Elimina
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nessuna Importazione
            </h3>
            <p className="text-gray-500">
              La cronologia delle importazioni apparirà qui dopo aver importato file Excel
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedImport && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedImport(null);
          }}
          title={`Dettagli Importazione - ${selectedImport.fileName}`}
          size="lg"
        >
          <ImportDetailModal
            importItem={selectedImport}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedImport(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

// Import Detail Modal Component
const ImportDetailModal: React.FC<{
  importItem: ImportHistory;
  onClose: () => void;
}> = ({ importItem, onClose }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          File
        </label>
        <div className="text-lg font-semibold text-gray-900">
          {importItem.fileName}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Data e Ora
        </label>
        <div className="text-lg font-semibold text-gray-900">
          {new Date(importItem.importDate).toLocaleDateString('it-IT')} alle {' '}
          {new Date(importItem.importDate).toLocaleTimeString('it-IT', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>

    <div className={`p-4 rounded-lg ${
      importItem.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      <div className="flex items-center space-x-2 mb-2">
        {importItem.success ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-600" />
        )}
        <span className={`font-medium ${
          importItem.success ? 'text-green-900' : 'text-red-900'
        }`}>
          {importItem.success ? 'Importazione Completata' : 'Importazione Fallita'}
        </span>
      </div>
      <p className={`text-sm ${
        importItem.success ? 'text-green-800' : 'text-red-800'
      }`}>
        {importItem.message}
      </p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-blue-50 rounded-lg p-3 text-center">
        <div className="text-xl font-bold text-blue-600">{importItem.details.newShifts}</div>
        <div className="text-sm text-blue-700">Nuovi Turni</div>
      </div>
      <div className="bg-green-50 rounded-lg p-3 text-center">
        <div className="text-xl font-bold text-green-600">{importItem.details.updatedShifts}</div>
        <div className="text-sm text-green-700">Aggiornati</div>
      </div>
      <div className="bg-purple-50 rounded-lg p-3 text-center">
        <div className="text-xl font-bold text-purple-600">{importItem.details.newEmployees}</div>
        <div className="text-sm text-purple-700">Nuovi Dipendenti</div>
      </div>
      <div className="bg-yellow-50 rounded-lg p-3 text-center">
        <div className="text-xl font-bold text-yellow-600">{importItem.details.conflicts}</div>
        <div className="text-sm text-yellow-700">Conflitti</div>
      </div>
    </div>

    <div className="flex justify-end">
      <Button onClick={onClose}>Chiudi</Button>
    </div>
  </div>
);

// Hook per registrare le importazioni nella cronologia
export const useImportHistory = () => {
  const [importHistory, setImportHistory] = useLocalStorage<ImportHistory[]>('hr-import-history', []);

  const addImportToHistory = (
    fileName: string,
    success: boolean,
    importedCount: number,
    errorCount: number,
    message: string,
    details: ImportHistory['details']
  ) => {
    const newImport: ImportHistory = {
      id: crypto.randomUUID(),
      fileName,
      importDate: new Date(),
      success,
      importedCount,
      errorCount,
      details,
      message
    };

    setImportHistory(prev => [newImport, ...prev].slice(0, 50)); // Keep last 50 imports
    console.log('📝 Added import to history:', newImport);
  };

  return {
    importHistory,
    addImportToHistory
  };
};