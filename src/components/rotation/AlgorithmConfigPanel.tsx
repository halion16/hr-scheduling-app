import React, { useState } from 'react';
import { RotationAlgorithmConfig, ShiftType } from '../../types/rotation';
import { Store } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Info,
  Sliders,
  Target,
  Clock,
  Users,
  Store as StoreIcon,
  Calendar
} from 'lucide-react';

interface AlgorithmConfigPanelProps {
  config: RotationAlgorithmConfig;
  onConfigChange: (config: RotationAlgorithmConfig) => void;
  shiftTypes: ShiftType[];
  stores?: Store[];
}

export const AlgorithmConfigPanel: React.FC<AlgorithmConfigPanelProps> = ({
  config,
  onConfigChange,
  shiftTypes,
  stores = []
}) => {
  const [formData, setFormData] = useState<RotationAlgorithmConfig>(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedStoreForStaff, setSelectedStoreForStaff] = useState<string>(stores[0]?.id || '');

  const algorithmOptions = [
    { 
      value: 'round_robin', 
      label: 'Round Robin',
      description: 'Distribuzione sequenziale semplice'
    },
    { 
      value: 'weighted_fair', 
      label: 'Weighted Fair',
      description: 'Distribuzione basata su punteggi di equità'
    },
    { 
      value: 'preference_based', 
      label: 'Basato su Preferenze',
      description: 'Priorità alle preferenze individuali'
    },
    { 
      value: 'hybrid', 
      label: 'Ibrido (Raccomandato)',
      description: 'Combina tutti gli approcci per risultati ottimali'
    }
  ];

  const handleParameterChange = (key: keyof RotationAlgorithmConfig['parameters'], value: number) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleConstraintChange = (key: keyof RotationAlgorithmConfig['constraints'], value: number | boolean) => {
    setFormData(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleAlgorithmChange = (algorithm: RotationAlgorithmConfig['algorithm']) => {
    setFormData(prev => ({ ...prev, algorithm }));
    setHasChanges(true);
  };

  const handleDailyStaffChange = (storeId: string, dayOfWeek: string, field: 'minStaff' | 'maxStaff', value: number) => {
    console.log('🔄 Modifica staff giornaliero:', { storeId, dayOfWeek, field, value });
    setFormData(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        dailyStaffRequirements: {
          ...prev.constraints.dailyStaffRequirements,
          [storeId]: {
            ...prev.constraints.dailyStaffRequirements?.[storeId],
            [dayOfWeek]: {
              ...prev.constraints.dailyStaffRequirements?.[storeId]?.[dayOfWeek],
              [field]: value
            }
          }
        }
      }
    }));
    setHasChanges(true);
    console.log('✅ HasChanges impostato a true');
  };

  const handleSave = () => {
    onConfigChange(formData);
    setHasChanges(false);
  };

  const handleReset = () => {
    const defaultConfig: RotationAlgorithmConfig = {
      algorithm: 'hybrid',
      parameters: {
        equityWeight: 0.4,
        preferenceWeight: 0.3,
        restWeight: 0.2,
        experienceWeight: 0.1,
        lookAheadDays: 14,
        maxIterations: 1000
      },
      constraints: {
        minRestBetweenShifts: 12,
        maxConsecutiveShifts: 5,
        maxWeeklyHours: 48,
        minWeeklyHours: 20,
        requireWeekendRotation: true,
        dailyStaffRequirements: {}
      }
    };
    setFormData(defaultConfig);
    setHasChanges(true);
  };

  // Calcola il totale dei pesi per la validazione
  const totalWeight = formData.parameters.equityWeight + 
                     formData.parameters.preferenceWeight + 
                     formData.parameters.restWeight + 
                     formData.parameters.experienceWeight;

  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.01;

  const DAYS_OF_WEEK = [
    'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'
  ];

  const DAY_LABELS = {
    lunedì: 'Lun',
    martedì: 'Mar',
    mercoledì: 'Mer',
    giovedì: 'Gio',
    venerdì: 'Ven',
    sabato: 'Sab',
    domenica: 'Dom'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configurazione Algoritmo</h2>
            <p className="text-gray-600">Personalizza il comportamento del sistema di rotazione</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button
            variant="outline"
            icon={RotateCcw}
            onClick={handleReset}
          >
            Ripristina Default
          </Button>
          <Button
            icon={Save}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Salva Configurazione
          </Button>
        </div>
      </div>

      {/* Avviso pesi non validi */}
      {!isWeightValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-900">Attenzione</span>
          </div>
          <p className="text-sm text-red-800 mt-2">
            La somma dei pesi deve essere uguale a 1.0. Attualmente: {totalWeight.toFixed(2)}
          </p>
        </div>
      )}

      {/* Selezione Algoritmo */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Algoritmo di Assegnazione</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {algorithmOptions.map(option => (
            <label
              key={option.value}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                formData.algorithm === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="algorithm"
                value={option.value}
                checked={formData.algorithm === option.value}
                onChange={(e) => handleAlgorithmChange(e.target.value as RotationAlgorithmConfig['algorithm'])}
                className="sr-only"
              />
              <div className="font-medium text-gray-900 mb-1">
                {option.label}
              </div>
              <div className="text-sm text-gray-600">
                {option.description}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Parametri Algoritmo */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Sliders className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Pesi Algoritmo</h3>
        </div>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              I pesi determinano l'importanza relativa di ogni fattore nell'assegnazione dei turni. 
              La somma deve essere uguale a 1.0 (100%).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Peso Equità ({(formData.parameters.equityWeight * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.parameters.equityWeight}
                onChange={(e) => handleParameterChange('equityWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500 mt-1">
                Importanza della distribuzione equa dei turni
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Peso Preferenze ({(formData.parameters.preferenceWeight * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.parameters.preferenceWeight}
                onChange={(e) => handleParameterChange('preferenceWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500 mt-1">
                Importanza delle preferenze individuali
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Peso Riposo ({(formData.parameters.restWeight * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.parameters.restWeight}
                onChange={(e) => handleParameterChange('restWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500 mt-1">
                Importanza del tempo di riposo tra turni
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Peso Esperienza ({(formData.parameters.experienceWeight * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.parameters.experienceWeight}
                onChange={(e) => handleParameterChange('experienceWeight', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500 mt-1">
                Importanza dell'esperienza per turni difficili
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-900">
              Totale Pesi: {totalWeight.toFixed(2)} / 1.00
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  isWeightValid ? 'bg-green-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(totalWeight * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vincoli */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Vincoli Operativi</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Riposo Minimo tra Turni (ore)"
            type="number"
            value={formData.constraints.minRestBetweenShifts.toString()}
            onChange={(value) => handleConstraintChange('minRestBetweenShifts', parseInt(value) || 12)}
            min="8"
            max="24"
          />

          <Input
            label="Massimo Turni Consecutivi"
            type="number"
            value={formData.constraints.maxConsecutiveShifts.toString()}
            onChange={(value) => handleConstraintChange('maxConsecutiveShifts', parseInt(value) || 5)}
            min="1"
            max="14"
          />

          <Input
            label="Ore Settimanali Massime"
            type="number"
            value={formData.constraints.maxWeeklyHours.toString()}
            onChange={(value) => handleConstraintChange('maxWeeklyHours', parseInt(value) || 48)}
            min="20"
            max="60"
          />

          <Input
            label="Ore Settimanali Minime"
            type="number"
            value={formData.constraints.minWeeklyHours.toString()}
            onChange={(value) => handleConstraintChange('minWeeklyHours', parseInt(value) || 20)}
            min="10"
            max="40"
          />
        </div>

        <div className="mt-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.constraints.requireWeekendRotation}
              onChange={(e) => handleConstraintChange('requireWeekendRotation', e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Richiedi Rotazione Weekend
            </span>
          </label>
          <div className="text-xs text-gray-500 mt-1 ml-6">
            Assicura che tutti i dipendenti lavorino equamente nei weekend
          </div>
        </div>
      </div>

      {/* Vincoli Staff Giornalieri */}
      {stores.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <StoreIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Vincoli Staff Giornalieri per Negozio</h3>
          </div>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Configura il numero minimo e massimo di dipendenti richiesti per ogni giorno della settimana per ciascun negozio.
                Questi vincoli verranno considerati durante la generazione automatica dei turni.
              </p>
            </div>

            <Select
              label="Seleziona Negozio per Configurazione"
              value={selectedStoreForStaff}
              onChange={setSelectedStoreForStaff}
              options={stores.map(store => ({
                value: store.id,
                label: store.name
              }))}
            />

            {selectedStoreForStaff && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  {stores.find(s => s.id === selectedStoreForStaff)?.name}
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700">
                          Giorno
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                          Staff Minimo
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                          Staff Massimo
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700">
                          Orari Negozio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS_OF_WEEK.map(day => {
                        const storeHours = stores.find(s => s.id === selectedStoreForStaff)?.openingHours[day];
                        const currentSettings = formData.constraints.dailyStaffRequirements?.[selectedStoreForStaff]?.[day];
                        const minStaff = currentSettings?.minStaff || 1;
                        const maxStaff = currentSettings?.maxStaff || 2;
                        
                        return (
                          <tr key={day} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 font-medium text-gray-900">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span>{DAY_LABELS[day as keyof typeof DAY_LABELS]}</span>
                              </div>
                            </td>
                            <td className="border border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={minStaff}
                                onChange={(e) => handleDailyStaffChange(
                                  selectedStoreForStaff, 
                                  day, 
                                  'minStaff', 
                                  parseInt(e.target.value) || 0
                                )}
                                className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={!storeHours}
                              />
                            </td>
                            <td className="border border-gray-300 px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={maxStaff}
                                onChange={(e) => handleDailyStaffChange(
                                  selectedStoreForStaff, 
                                  day, 
                                  'maxStaff', 
                                  parseInt(e.target.value) || 1
                                )}
                                className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={!storeHours}
                              />
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                              {storeHours ? (
                                <span className="text-green-700 bg-green-100 px-2 py-1 rounded text-xs">
                                  {storeHours.open} - {storeHours.close}
                                </span>
                              ) : (
                                <span className="text-red-700 bg-red-100 px-2 py-1 rounded text-xs">
                                  Chiuso
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-3 text-xs text-gray-500">
                  <p>💡 <strong>Staff Minimo:</strong> Numero minimo di dipendenti che devono essere presenti contemporaneamente</p>
                  <p>💡 <strong>Staff Massimo:</strong> Numero massimo di dipendenti che possono lavorare contemporaneamente</p>
                  <p>⚠️ I giorni di chiusura vengono automaticamente disabilitati</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parametri Avanzati */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Parametri Avanzati</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Giorni di Previsione"
            type="number"
            value={formData.parameters.lookAheadDays.toString()}
            onChange={(value) => handleParameterChange('lookAheadDays', parseInt(value) || 14)}
            min="7"
            max="30"
          />

          <Input
            label="Massime Iterazioni Algoritmo"
            type="number"
            value={formData.parameters.maxIterations.toString()}
            onChange={(value) => handleParameterChange('maxIterations', parseInt(value) || 1000)}
            min="100"
            max="5000"
          />
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Giorni di Previsione:</strong> Quanti giorni in anticipo l'algoritmo considera per ottimizzare le assegnazioni.
          </p>
          <p className="mt-2">
            <strong>Massime Iterazioni:</strong> Limite di calcolo per evitare tempi di elaborazione eccessivi.
          </p>
        </div>
      </div>

      {/* Anteprima Configurazione */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Anteprima Configurazione</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white p-3 rounded-lg">
            <div className="font-medium text-gray-900">Algoritmo</div>
            <div className="text-gray-600">
              {algorithmOptions.find(opt => opt.value === formData.algorithm)?.label}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg">
            <div className="font-medium text-gray-900">Focus Principale</div>
            <div className="text-gray-600">
              {formData.parameters.equityWeight >= 0.4 ? 'Equità' :
               formData.parameters.preferenceWeight >= 0.4 ? 'Preferenze' :
               formData.parameters.restWeight >= 0.4 ? 'Riposo' :
               'Bilanciato'}
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-lg">
            <div className="font-medium text-gray-900">Riposo Minimo</div>
            <div className="text-gray-600">{formData.constraints.minRestBetweenShifts}h</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg">
            <div className="font-medium text-gray-900">Max Consecutivi</div>
            <div className="text-gray-600">{formData.constraints.maxConsecutiveShifts} giorni</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg">
            <div className="font-medium text-gray-900">Staff Configurato</div>
            <div className="text-gray-600">
              {Object.keys(formData.constraints.dailyStaffRequirements || {}).length} negozi
            </div>
          </div>
        </div>
      </div>

      {/* Avviso finale per pesi non validi */}
      {!isWeightValid && hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-900">Nota</span>
          </div>
          <p className="text-sm text-yellow-800 mt-2">
            La somma dei pesi deve essere uguale a 1.0. Attualmente: {totalWeight.toFixed(2)}. 
            Puoi comunque salvare i vincoli staff, ma controlla i pesi dell'algoritmo.
          </p>
        </div>
      )}
    </div>
  );
};