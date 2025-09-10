import React, { useState, useEffect } from 'react';
import { Employee } from '../../types';
import { ShiftType, EmployeePreference } from '../../types/rotation';
import { useShiftRotation } from '../../hooks/useShiftRotation';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { 
  User, 
  Settings, 
  Calendar, 
  Clock,
  Plus,
  Trash2,
  Save,
  AlertCircle
} from 'lucide-react';

interface EmployeePreferencesFormProps {
  employees: Employee[];
  shiftTypes: ShiftType[];
  selectedEmployee: Employee | null;
  onEmployeeSelect: (employee: Employee | null) => void;
}

export const EmployeePreferencesForm: React.FC<EmployeePreferencesFormProps> = ({
  employees,
  shiftTypes,
  selectedEmployee,
  onEmployeeSelect
}) => {
  const {
    employeePreferences,
    addEmployeePreference,
    updateEmployeePreference,
    deleteEmployeePreference,
    getEmployeePreference
  } = useShiftRotation();

  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [editingPreference, setEditingPreference] = useState<EmployeePreference | null>(null);

  const employeeOptions = employees.map(emp => ({
    value: emp.id,
    label: `${emp.firstName} ${emp.lastName}`
  }));

  const handleEditPreferences = (employee: Employee) => {
    const existing = getEmployeePreference(employee.id);
    setEditingPreference(existing || null);
    onEmployeeSelect(employee);
    setShowPreferenceModal(true);
  };

  const handleCreatePreferences = () => {
    if (selectedEmployee) {
      setEditingPreference(null);
      setShowPreferenceModal(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Preferenze Dipendenti</h2>
            <p className="text-gray-600">Gestisci le preferenze individuali per la rotazione turni</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Select
            value={selectedEmployee?.id || ''}
            onChange={(value) => {
              const employee = employees.find(emp => emp.id === value);
              onEmployeeSelect(employee || null);
            }}
            options={[
              { value: '', label: 'Seleziona dipendente...' },
              ...employeeOptions
            ]}
            className="min-w-[200px]"
          />
          
          {selectedEmployee && (
            <Button
              icon={Plus}
              onClick={handleCreatePreferences}
            >
              Gestisci Preferenze
            </Button>
          )}
        </div>
      </div>

      {/* Lista dipendenti con preferenze */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(employee => {
          const preferences = getEmployeePreference(employee.id);
          const hasPreferences = !!preferences;

          return (
            <div
              key={employee.id}
              className={`bg-white rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                hasPreferences ? 'border-green-200 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    hasPreferences ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <User className={`h-5 w-5 ${
                      hasPreferences ? 'text-green-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {employee.contractHours}h contratto
                    </div>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant={hasPreferences ? "outline" : "primary"}
                  onClick={() => handleEditPreferences(employee)}
                >
                  {hasPreferences ? 'Modifica' : 'Configura'}
                </Button>
              </div>

              {hasPreferences && preferences && (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600">Turni preferiti:</span>
                    <div className="mt-1">
                      {preferences.preferredShiftTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {preferences.preferredShiftTypes.map(shiftTypeId => {
                            const shiftType = shiftTypes.find(st => st.id === shiftTypeId);
                            return (
                              <span
                                key={shiftTypeId}
                                className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                              >
                                {shiftType?.name || 'Sconosciuto'}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">Nessuna preferenza</span>
                      )}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-600">Max giorni consecutivi:</span>
                    <span className="ml-2 font-medium">{preferences.maxConsecutiveDays}</span>
                  </div>

                  {preferences.preferredDaysOff.length > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-600">Giorni liberi preferiti:</span>
                      <div className="mt-1">
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          {preferences.preferredDaysOff.join(', ')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-sm">
                    <span className="text-gray-600">Priorità:</span>
                    <span className={`ml-2 px-2 py-1 text-xs rounded ${
                      preferences.priority === 'high' ? 'bg-red-100 text-red-800' :
                      preferences.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {preferences.priority === 'high' ? 'Alta' :
                       preferences.priority === 'medium' ? 'Media' : 'Bassa'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal per gestione preferenze */}
      <Modal
        isOpen={showPreferenceModal}
        onClose={() => {
          setShowPreferenceModal(false);
          setEditingPreference(null);
        }}
        title={`Preferenze - ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
        size="lg"
      >
        {selectedEmployee && (
          <PreferenceForm
            employee={selectedEmployee}
            shiftTypes={shiftTypes}
            existingPreference={editingPreference}
            onSave={(preferenceData) => {
              if (editingPreference) {
                updateEmployeePreference(editingPreference.id, preferenceData);
              } else {
                addEmployeePreference({
                  ...preferenceData,
                  employeeId: selectedEmployee.id
                });
              }
              setShowPreferenceModal(false);
              setEditingPreference(null);
            }}
            onDelete={() => {
              if (editingPreference) {
                deleteEmployeePreference(editingPreference.id);
                setShowPreferenceModal(false);
                setEditingPreference(null);
              }
            }}
            onCancel={() => {
              setShowPreferenceModal(false);
              setEditingPreference(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

// Componente form per le preferenze
interface PreferenceFormProps {
  employee: Employee;
  shiftTypes: ShiftType[];
  existingPreference: EmployeePreference | null;
  onSave: (data: Omit<EmployeePreference, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const PreferenceForm: React.FC<PreferenceFormProps> = ({
  employee,
  shiftTypes,
  existingPreference,
  onSave,
  onDelete,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    preferredShiftTypes: existingPreference?.preferredShiftTypes || [],
    unavailableDates: existingPreference?.unavailableDates || [],
    maxConsecutiveDays: existingPreference?.maxConsecutiveDays || 5,
    preferredDaysOff: existingPreference?.preferredDaysOff || [],
    notes: existingPreference?.notes || '',
    priority: existingPreference?.priority || 'medium' as const
  });

  const [newUnavailableDate, setNewUnavailableDate] = useState('');

  const daysOfWeek = [
    'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'
  ];

  const priorityOptions = [
    { value: 'low', label: 'Bassa' },
    { value: 'medium', label: 'Media' },
    { value: 'high', label: 'Alta' }
  ];

  const handleShiftTypeToggle = (shiftTypeId: string) => {
    setFormData(prev => ({
      ...prev,
      preferredShiftTypes: prev.preferredShiftTypes.includes(shiftTypeId)
        ? prev.preferredShiftTypes.filter(id => id !== shiftTypeId)
        : [...prev.preferredShiftTypes, shiftTypeId]
    }));
  };

  const handleDayOffToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      preferredDaysOff: prev.preferredDaysOff.includes(day)
        ? prev.preferredDaysOff.filter(d => d !== day)
        : [...prev.preferredDaysOff, day]
    }));
  };

  const handleAddUnavailableDate = () => {
    if (newUnavailableDate) {
      const date = new Date(newUnavailableDate);
      setFormData(prev => ({
        ...prev,
        unavailableDates: [...prev.unavailableDates, date]
      }));
      setNewUnavailableDate('');
    }
  };

  const handleRemoveUnavailableDate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      unavailableDates: prev.unavailableDates.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Turni preferiti */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Turni Preferiti
        </label>
        <div className="grid grid-cols-2 gap-3">
          {shiftTypes.map(shiftType => (
            <label key={shiftType.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferredShiftTypes.includes(shiftType.id)}
                onChange={() => handleShiftTypeToggle(shiftType.id)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{shiftType.name}</div>
                <div className="text-xs text-gray-500">
                  {shiftType.startTime} - {shiftType.endTime} • {shiftType.category}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Giorni liberi preferiti */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Giorni Liberi Preferiti
        </label>
        <div className="grid grid-cols-7 gap-2">
          {daysOfWeek.map(day => (
            <label key={day} className="flex flex-col items-center p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.preferredDaysOff.includes(day)}
                onChange={() => handleDayOffToggle(day)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mb-1"
              />
              <span className="text-xs text-center">
                {day.slice(0, 3)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Massimo giorni consecutivi */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Massimo Giorni Consecutivi
          </label>
          <input
            type="number"
            value={formData.maxConsecutiveDays}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              maxConsecutiveDays: parseInt(e.target.value) || 5 
            }))}
            min="1"
            max="14"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priorità Preferenze
          </label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              priority: e.target.value as 'low' | 'medium' | 'high'
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {priorityOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date non disponibili */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Date Non Disponibili
        </label>
        
        <div className="flex space-x-2 mb-3">
          <input
            type="date"
            value={newUnavailableDate}
            onChange={(e) => setNewUnavailableDate(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            type="button"
            onClick={handleAddUnavailableDate}
            disabled={!newUnavailableDate}
            icon={Plus}
            size="sm"
          >
            Aggiungi
          </Button>
        </div>

        {formData.unavailableDates.length > 0 && (
          <div className="space-y-2">
            {formData.unavailableDates.map((date, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm">
                  {date.toLocaleDateString('it-IT', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => handleRemoveUnavailableDate(index)}
                  className="!p-1"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note Aggiuntive
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Note speciali o richieste particolari..."
        />
      </div>

      {/* Avviso */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">Nota Importante</span>
        </div>
        <p className="text-sm text-blue-800 mt-2">
          Le preferenze vengono considerate dall'algorit mo di rotazione ma non sono garanzie assolute. 
          L'equità della distribuzione e le esigenze operative hanno priorità.
        </p>
      </div>

      {/* Azioni */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <div>
          {existingPreference && (
            <Button
              type="button"
              variant="danger"
              icon={Trash2}
              onClick={onDelete}
            >
              Elimina Preferenze
            </Button>
          )}
        </div>
        
        <div className="flex space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Annulla
          </Button>
          <Button
            type="submit"
            icon={Save}
          >
            Salva Preferenze
          </Button>
        </div>
      </div>
    </form>
  );
};