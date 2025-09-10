import React, { useState, useRef } from 'react';
import { Employee, Store, Shift } from '../../types';
import { ImportMapping, ImportPreview, ImportOptions, ImportResult } from '../../types/import';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle, 
  Settings,
  Eye,
  X,
  Zap,
  Users,
  Calendar,
  Clock,
  MapPin,
  FileText,
  RefreshCw
} from 'lucide-react';
import {
  readExcelFile,
  analyzeExcelColumns,
  parseExcelData,
  executeImport,
  generateImportTemplate,
  validateExcelStructure,
  STANDARD_IMPORT_COLUMNS
} from '../../utils/excelImportUtils';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  stores: Store[];
  existingShifts: Shift[];
  onAddShift: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => Shift | null;
  onAddEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Employee;
  onUpdateShift: (id: string, updates: Partial<Shift>) => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'result';

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  employees,
  stores,
  existingShifts,
  onAddShift,
  onAddEmployee,
  onUpdateShift
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ImportMapping>({});
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    skipEmptyRows: true,
    mergeWithExisting: false,
    updateExistingShifts: false,
    createMissingEmployees: false,
    defaultBreakDuration: 30,
    dateFormat: 'auto'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setExcelData([]);
    setDetectedColumns([]);
    setColumnMapping({});
    setImportPreview(null);
    setImportResult(null);
    setIsProcessing(false);
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      alert('Seleziona un file Excel (.xlsx o .xls)');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      console.log('📂 Reading Excel file:', file.name);
      const data = await readExcelFile(file);
      
      // Valida struttura
      const validation = validateExcelStructure(data);
      if (!validation.isValid) {
        alert(`Errore nella struttura del file:\n\n${validation.issues.join('\n')}\n\n${validation.suggestions.join('\n')}`);
        setIsProcessing(false);
        return;
      }

      setExcelData(data);
      
      // Auto-analizza colonne
      const { detectedColumns, suggestedMapping } = analyzeExcelColumns(data);
      setDetectedColumns(detectedColumns);
      setColumnMapping(suggestedMapping);
      
      console.log('✅ File analysis completed:', {
        rows: data.length,
        columns: detectedColumns.length,
        autoMapped: Object.keys(suggestedMapping).length
      });
      
      setCurrentStep('mapping');
    } catch (error) {
      console.error('❌ File reading error:', error);
      alert('Errore durante la lettura del file: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingComplete = () => {
    if (Object.keys(columnMapping).length === 0) {
      alert('Configura almeno una colonna nel mapping');
      return;
    }

    // Verifica che i campi obbligatori siano mappati
    const mappedFields = Object.values(columnMapping);
    const requiredFields = STANDARD_IMPORT_COLUMNS.filter(col => col.required).map(col => col.field);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));

    if (missingRequired.length > 0) {
      alert(`Campi obbligatori non mappati: ${missingRequired.join(', ')}`);
      return;
    }

    setIsProcessing(true);

    try {
      console.log('🔍 Generating preview with mapping:', columnMapping);
      const preview = parseExcelData(excelData, columnMapping, employees, stores, importOptions);
      setImportPreview(preview);
      setCurrentStep('preview');
    } catch (error) {
      console.error('❌ Preview generation error:', error);
      alert('Errore durante la generazione dell\'anteprima: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;

    const validShifts = importPreview.preview.filter(shift => shift.status !== 'invalid');
    
    if (validShifts.length === 0) {
      alert('Nessun turno valido da importare');
      return;
    }

    setCurrentStep('importing');
    setIsProcessing(true);

    try {
      console.log('🚀 Starting import execution...', validShifts.length, 'shifts');
      
      const result = await executeImport(
        validShifts,
        employees,
        stores,
        existingShifts,
        importOptions,
        onAddShift,
        onAddEmployee,
        onUpdateShift
      );
      
      setImportResult(result);
      setCurrentStep('result');
      
      console.log('✅ Import completed:', result);
    } catch (error) {
      console.error('❌ Import execution error:', error);
      setImportResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        message: 'Errore durante l\'importazione: ' + (error as Error).message,
        details: { newShifts: 0, updatedShifts: 0, newEmployees: 0, conflicts: 0 }
      });
      setCurrentStep('result');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return <UploadStep 
          onFileSelect={handleFileSelect}
          isProcessing={isProcessing}
          fileInputRef={fileInputRef}
        />;
      
      case 'mapping':
        return <MappingStep
          detectedColumns={detectedColumns}
          columnMapping={columnMapping}
          onMappingChange={setColumnMapping}
          importOptions={importOptions}
          onOptionsChange={setImportOptions}
          onNext={handleMappingComplete}
          onBack={() => setCurrentStep('upload')}
          isProcessing={isProcessing}
          excelData={excelData}
        />;
      
      case 'preview':
        return <PreviewStep
          preview={importPreview!}
          employees={employees}
          stores={stores}
          onConfirm={handleImportConfirm}
          onBack={() => setCurrentStep('mapping')}
        />;
      
      case 'importing':
        return <ImportingStep />;
      
      case 'result':
        return <ResultStep
          result={importResult!}
          onClose={handleClose}
          onImportAnother={() => setCurrentStep('upload')}
        />;
      
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return '📂 Carica File Excel';
      case 'mapping': return '🔗 Mappa Colonne';
      case 'preview': return '👁️ Anteprima Importazione';
      case 'importing': return '⏳ Importazione in Corso';
      case 'result': return importResult?.success ? '✅ Importazione Completata' : '❌ Errore Importazione';
      default: return 'Importa da Excel';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={getStepTitle()}
      size="xl"
    >
      <div className="space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-2">
          {['upload', 'mapping', 'preview', 'importing', 'result'].map((step, index) => {
            const isActive = currentStep === step;
            const isCompleted = ['upload', 'mapping', 'preview', 'importing'].indexOf(currentStep) > index;
            
            return (
              <React.Fragment key={step}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive ? 'bg-blue-600 text-white' :
                  isCompleted ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < 4 && (
                  <div className={`w-8 h-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </Modal>
  );
};

// Upload Step Component
interface UploadStepProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const UploadStep: React.FC<UploadStepProps> = ({ onFileSelect, isProcessing, fileInputRef }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find(file => 
      file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
    );
    
    if (excelFile) {
      onFileSelect(excelFile);
    } else {
      alert('Seleziona un file Excel (.xlsx o .xls)');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">Importazione Turni da Excel</span>
        </div>
        <p className="text-sm text-blue-800">
          Carica un file Excel con i turni da importare nella griglia di pianificazione. 
          Il sistema supporta diversi formati e può creare automaticamente dipendenti mancanti.
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <Upload className="h-6 w-6 text-gray-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Carica File Excel
            </h3>
            <p className="text-gray-600 mb-4">
              Trascina il file qui o clicca per selezionarlo
            </p>
            
            <Button
              icon={Upload}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Elaborazione...' : 'Seleziona File'}
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Template Download */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Non hai un file Excel?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Scarica il template con esempi e istruzioni per creare il tuo file di importazione
            </p>
          </div>
          
          <Button
            variant="outline"
            icon={Download}
            onClick={generateImportTemplate}
          >
            Scarica Template
          </Button>
        </div>
      </div>

      {/* Supported Formats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">📋 Formati Supportati</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="text-gray-700">Colonne Richieste:</strong>
            <ul className="mt-1 space-y-1 text-gray-600">
              <li>• Data (DD/MM/YYYY o MM/DD/YYYY)</li>
              <li>• Nome Dipendente (Nome Cognome)</li>
              <li>• Negozio (nome esatto)</li>
              <li>• Orario Inizio (HH:MM)</li>
              <li>• Orario Fine (HH:MM)</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-700">Colonne Opzionali:</strong>
            <ul className="mt-1 space-y-1 text-gray-600">
              <li>• Pausa in minuti (default: 30)</li>
              <li>• Note/Commenti</li>
              <li>• Stato turno</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mapping Step Component
interface MappingStepProps {
  detectedColumns: string[];
  columnMapping: ImportMapping;
  onMappingChange: (mapping: ImportMapping) => void;
  importOptions: ImportOptions;
  onOptionsChange: (options: ImportOptions) => void;
  onNext: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

const MappingStep: React.FC<MappingStepProps> = ({
  detectedColumns,
  columnMapping,
  onMappingChange,
  importOptions,
  onOptionsChange,
  onNext,
  onBack,
  isProcessing
}) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const updateMapping = (columnIndex: number, field: string) => {
    const columnLetter = String.fromCharCode(65 + columnIndex); // A, B, C, etc.
    const newMapping = { ...columnMapping };
    
    if (field === '') {
      delete newMapping[columnLetter];
    } else {
      newMapping[columnLetter] = field;
    }
    
    onMappingChange(newMapping);
  };

  const fieldOptions = [
    { value: '', label: '-- Non mappare --' },
    ...STANDARD_IMPORT_COLUMNS.map(col => ({
      value: col.field,
      label: `${col.label} ${col.required ? '(*)' : ''}`,
      disabled: Object.values(columnMapping).includes(col.field) && 
               !Object.entries(columnMapping).find(([k, v]) => v === col.field)?.[0]
    }))
  ];

  const mappedFields = Object.values(columnMapping);
  const requiredFields = STANDARD_IMPORT_COLUMNS.filter(col => col.required).map(col => col.field);
  const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Settings className="h-5 w-5 text-yellow-600" />
          <span className="font-medium text-yellow-900">Configurazione Mapping</span>
        </div>
        <p className="text-sm text-yellow-800">
          Associa le colonne del file Excel ai campi dell'applicazione. 
          I campi contrassegnati con (*) sono obbligatori.
        </p>
      </div>

      {/* Column Mapping */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Mapping Colonne</h4>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Colonna Excel
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Esempio Dati
                  </th>
                  <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">
                    Mappa a Campo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detectedColumns.map((column, index) => {
                  const columnLetter = String.fromCharCode(65 + index);
                  const currentMapping = columnMapping[columnLetter] || '';
                  
                  return (
                    <tr key={index}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {columnLetter}: {column || `Colonna ${index + 1}`}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 max-w-[200px] truncate">
                        {/* Mostra esempio dalla seconda riga */}
                        {/* Dovremmo passare anche excelData per mostrare esempi reali */}
                        <span className="italic">Esempio dati...</span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={currentMapping}
                          onChange={(e) => updateMapping(index, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {fieldOptions.map(option => (
                            <option 
                              key={option.value} 
                              value={option.value}
                              disabled={option.disabled}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Stato Validazione</h4>
        <div className="space-y-2">
          {STANDARD_IMPORT_COLUMNS.filter(col => col.required).map(col => {
            const isMapped = mappedFields.includes(col.field);
            return (
              <div key={col.field} className="flex items-center space-x-2">
                {isMapped ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={isMapped ? 'text-green-700' : 'text-red-700'}>
                  {col.label} {isMapped ? '✓' : '(richiesto)'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="w-full px-4 py-3 text-left flex items-center justify-between border-b border-gray-200 hover:bg-gray-50"
        >
          <span className="font-medium text-gray-900">Opzioni Avanzate</span>
          <Settings className="h-4 w-4 text-gray-600" />
        </button>
        
        {showAdvancedOptions && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importOptions.skipEmptyRows}
                    onChange={(e) => onOptionsChange({ ...importOptions, skipEmptyRows: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Salta righe vuote</span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importOptions.updateExistingShifts}
                    onChange={(e) => onOptionsChange({ ...importOptions, updateExistingShifts: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Aggiorna turni esistenti</span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={importOptions.createMissingEmployees}
                    onChange={(e) => onOptionsChange({ ...importOptions, createMissingEmployees: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Crea dipendenti mancanti</span>
                </label>
              </div>
              
              <div>
                <Input
                  label="Pausa default (min)"
                  type="number"
                  value={importOptions.defaultBreakDuration.toString()}
                  onChange={(value) => onOptionsChange({ 
                    ...importOptions, 
                    defaultBreakDuration: parseInt(value) || 30 
                  })}
                  min="0"
                  max="480"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <Button
          onClick={onNext}
          disabled={missingRequired.length > 0 || isProcessing}
          icon={isProcessing ? RefreshCw : Eye}
        >
          {isProcessing ? 'Elaborazione...' : 'Genera Anteprima'}
        </Button>
      </div>
    </div>
  );
};

// Preview Step Component
interface PreviewStepProps {
  preview: ImportPreview;
  employees: Employee[];
  stores: Store[];
  onConfirm: () => void;
  onBack: () => void;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
  preview,
  employees,
  stores,
  onConfirm,
  onBack
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'warning'>('all');

  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  const storeMap = new Map(stores.map(store => [store.id, store]));

  const filteredPreview = preview.preview.filter(shift => {
    if (filterStatus === 'all') return true;
    return shift.status === filterStatus;
  });

  const statusOptions = [
    { value: 'all', label: `Tutti (${preview.preview.length})` },
    { value: 'valid', label: `Validi (${preview.validRows})` },
    { value: 'warning', label: `Avvisi (${preview.preview.filter(s => s.status === 'warning').length})` },
    { value: 'invalid', label: `Errori (${preview.invalidRows})` }
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{preview.totalRows}</div>
          <div className="text-sm text-blue-700">Righe Totali</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{preview.validRows}</div>
          <div className="text-sm text-green-700">Valide</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {preview.preview.filter(s => s.status === 'warning').length}
          </div>
          <div className="text-sm text-yellow-700">Con Avvisi</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{preview.invalidRows}</div>
          <div className="text-sm text-red-700">Errori</div>
        </div>
      </div>

      {/* Filter and Details Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusOptions}
            className="min-w-[150px]"
          />
          
          <Button
            size="sm"
            variant="outline"
            icon={showDetails ? EyeOff : Eye}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Nascondi' : 'Mostra'} Dettagli
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredPreview.length} di {preview.preview.length} turni
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Riga
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Stato
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Dipendente
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Negozio
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Orario
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Ore
                </th>
                {showDetails && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Issues
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPreview.map((shift, index) => {
                const actualHours = calculatePreviewHours(shift.startTime, shift.endTime, shift.breakDuration);
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      #{shift.rowIndex}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        shift.status === 'valid' ? 'bg-green-100 text-green-800' :
                        shift.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {shift.status === 'valid' ? '✓' :
                         shift.status === 'warning' ? '⚠️' : '❌'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {shift.date.toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      <div className="flex items-center space-x-1">
                        {shift.employeeId ? (
                          <User className="h-3 w-3 text-green-600" />
                        ) : (
                          <Users className="h-3 w-3 text-orange-600" />
                        )}
                        <span>{shift.employeeName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-blue-600" />
                        <span>{shift.storeName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-900">
                      {shift.startTime} - {shift.endTime}
                      {shift.breakDuration > 0 && (
                        <div className="text-xs text-gray-500">
                          {shift.breakDuration}min pausa
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {actualHours.toFixed(1)}h
                    </td>
                    {showDetails && (
                      <td className="px-3 py-2">
                        {shift.issues.length > 0 && (
                          <div className="space-y-1">
                            {shift.issues.map((issue, issueIndex) => (
                              <div
                                key={issueIndex}
                                className={`text-xs px-2 py-1 rounded ${
                                  issue.includes('ERRORE') 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {issue}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Major Issues Warning */}
      {(preview.invalidRows > 0 || preview.duplicates > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-900">Attenzione</span>
          </div>
          <div className="text-sm text-red-800 space-y-1">
            {preview.invalidRows > 0 && (
              <p>• {preview.invalidRows} righe contengono errori e verranno saltate</p>
            )}
            {preview.duplicates > 0 && (
              <p>• {preview.duplicates} turni duplicati rilevati</p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <Button
          onClick={onConfirm}
          disabled={preview.validRows === 0}
          icon={Zap}
          className="bg-green-600 hover:bg-green-700"
        >
          Importa {preview.validRows} Turni
        </Button>
      </div>
    </div>
  );
};

// Importing Step Component
const ImportingStep: React.FC = () => (
  <div className="text-center py-12">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      Importazione in Corso...
    </h3>
    <p className="text-gray-600">
      Sto importando i turni nella griglia di pianificazione. 
      Questo potrebbe richiedere alcuni minuti per file grandi.
    </p>
  </div>
);

// Result Step Component
interface ResultStepProps {
  result: ImportResult;
  onClose: () => void;
  onImportAnother: () => void;
}

const ResultStep: React.FC<ResultStepProps> = ({ result, onClose, onImportAnother }) => (
  <div className="space-y-6">
    <div className={`text-center py-8 ${result.success ? 'bg-green-50' : 'bg-red-50'} rounded-lg`}>
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4">
        {result.success ? (
          <CheckCircle className="h-8 w-8 text-green-600" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-red-600" />
        )}
      </div>
      
      <h3 className={`text-xl font-semibold mb-2 ${
        result.success ? 'text-green-900' : 'text-red-900'
      }`}>
        {result.success ? 'Importazione Completata!' : 'Importazione Fallita'}
      </h3>
      
      <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
        {result.message}
      </p>
    </div>

    {result.success && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{result.details.newShifts}</div>
          <div className="text-sm text-blue-700">Nuovi Turni</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{result.details.updatedShifts}</div>
          <div className="text-sm text-green-700">Aggiornati</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{result.details.newEmployees}</div>
          <div className="text-sm text-purple-700">Nuovi Dipendenti</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{result.details.conflicts}</div>
          <div className="text-sm text-yellow-700">Conflitti Risolti</div>
        </div>
      </div>
    )}

    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={onImportAnother}
        icon={Upload}
      >
        Importa Altro File
      </Button>
      <Button onClick={onClose}>
        Chiudi
      </Button>
    </div>
  </div>
);

// Helper function
function calculatePreviewHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  const workingMinutes = Math.max(0, endTotalMin - startTotalMin - breakMinutes);
  
  return workingMinutes / 60;
}