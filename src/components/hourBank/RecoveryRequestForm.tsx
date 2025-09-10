import React, { useState } from 'react';
import { Employee } from '../../types';
import { HourBankAccount, HourRecoveryRequest } from '../../types/hourBank';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { 
  Calendar, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

interface RecoveryRequestFormProps {
  employees: Employee[];
  hourBankAccounts: HourBankAccount[];
  onSubmit: (data: Omit<HourRecoveryRequest, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const RecoveryRequestForm: React.FC<RecoveryRequestFormProps> = ({
  employees,
  hourBankAccounts,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    employeeId: '',
    requestedHours: '',
    reason: '',
    requestType: 'time_off' as HourRecoveryRequest['requestType'],
    scheduledDate: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const employeeOptions = employees
    .filter(emp => {
      const account = hourBankAccounts.find(acc => acc.employeeId === emp.id);
      return account && account.currentBalance > 0;
    })
    .map(emp => ({
      value: emp.id,
      label: `${emp.firstName} ${emp.lastName}`
    }));

  const requestTypeOptions = [
    { value: 'time_off', label: '🏖️ Permesso/Ferie' },
    { value: 'shorter_week', label: '📅 Settimana Ridotta' },
    { value: 'early_leave', label: '🕐 Uscita Anticipata' },
    { value: 'late_arrival', label: '🕘 Entrata Posticipata' }
  ];

  const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
  const selectedAccount = hourBankAccounts.find(acc => acc.employeeId === formData.employeeId);
  const requestedHours = parseFloat(formData.requestedHours) || 0;
  const remainingBalance = selectedAccount ? selectedAccount.currentBalance - requestedHours : 0;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.employeeId) {
      newErrors.employeeId = 'Seleziona un dipendente';
    }

    if (!formData.requestedHours) {
      newErrors.requestedHours = 'Inserisci le ore da recuperare';
    } else {
      const hours = parseFloat(formData.requestedHours);
      if (isNaN(hours) || hours <= 0) {
        newErrors.requestedHours = 'Le ore devono essere un numero positivo';
      } else if (hours > 40) {
        newErrors.requestedHours = 'Non puoi richiedere più di 40 ore per volta';
      } else if (selectedAccount && hours > selectedAccount.currentBalance) {
        newErrors.requestedHours = `Credito insufficiente (disponibili: ${selectedAccount.currentBalance.toFixed(1)}h)`;
      }
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Inserisci il motivo della richiesta';
    }

    if (!formData.scheduledDate) {
      newErrors.scheduledDate = 'Seleziona quando utilizzare il recupero';
    } else {
      const selectedDate = new Date(formData.scheduledDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.scheduledDate = 'La data deve essere futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit({
        employeeId: formData.employeeId,
        requestedHours: parseFloat(formData.requestedHours),
        requestDate: new Date(),
        requestedBy: 'manager', // In futuro collegare all'utente corrente
        reason: formData.reason.trim(),
        requestType: formData.requestType,
        status: 'pending',
        scheduledDate: new Date(formData.scheduledDate),
        notes: formData.notes.trim() || undefined
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Info className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">Richiesta Recupero Ore</span>
        </div>
        <p className="text-sm text-blue-800">
          Richiedi di utilizzare le ore accumulate in banca ore per ridurre l'orario di lavoro. 
          Le richieste devono essere approvate prima dell'utilizzo.
        </p>
      </div>

      <Select
        label="Dipendente"
        value={formData.employeeId}
        onChange={(value) => setFormData(prev => ({ ...prev, employeeId: value }))}
        options={[
          { value: '', label: 'Seleziona dipendente...' },
          ...employeeOptions
        ]}
        required
        error={errors.employeeId}
      />

      {selectedAccount && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900">Credito Disponibile</h4>
              <p className="text-sm text-green-800">
                Saldo attuale banca ore di {selectedEmployee?.firstName} {selectedEmployee?.lastName}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-900">
                {selectedAccount.currentBalance.toFixed(1)}h
              </div>
              <div className="text-sm text-green-700">Disponibili</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Ore da Recuperare"
          type="number"
          value={formData.requestedHours}
          onChange={(value) => setFormData(prev => ({ ...prev, requestedHours: value }))}
          required
          error={errors.requestedHours}
          step="0.5"
          min="0.5"
          max="40"
          placeholder="8.0"
        />

        <Select
          label="Tipo Recupero"
          value={formData.requestType}
          onChange={(value) => setFormData(prev => ({ ...prev, requestType: value as HourRecoveryRequest['requestType'] }))}
          options={requestTypeOptions}
          required
        />
      </div>

      <Input
        label="Data Utilizzo Prevista"
        type="date"
        value={formData.scheduledDate}
        onChange={(value) => setFormData(prev => ({ ...prev, scheduledDate: value }))}
        required
        error={errors.scheduledDate}
        min={new Date().toISOString().split('T')[0]}
      />

      <Input
        label="Motivo della Richiesta"
        value={formData.reason}
        onChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}
        required
        error={errors.reason}
        placeholder="es. Appuntamento medico, impegno familiare..."
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note Aggiuntive (opzionale)
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Dettagli aggiuntivi sulla richiesta..."
        />
      </div>

      {/* Preview calcolo */}
      {formData.employeeId && formData.requestedHours && selectedAccount && (
        <div className={`p-4 rounded-lg border ${
          remainingBalance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2 mb-2">
            {remainingBalance >= 0 ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <span className={`font-medium ${
              remainingBalance >= 0 ? 'text-green-900' : 'text-red-900'
            }`}>
              Anteprima Calcolo
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Saldo Attuale:</span>
              <div className="font-bold text-green-600">
                +{selectedAccount.currentBalance.toFixed(1)}h
              </div>
            </div>
            <div>
              <span className="text-gray-600">Ore Richieste:</span>
              <div className="font-bold text-blue-600">
                -{requestedHours.toFixed(1)}h
              </div>
            </div>
            <div>
              <span className="text-gray-600">Saldo Residuo:</span>
              <div className={`font-bold ${
                remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {remainingBalance > 0 ? '+' : ''}{remainingBalance.toFixed(1)}h
              </div>
            </div>
          </div>
          
          {remainingBalance < 0 && (
            <div className="mt-2 text-sm text-red-800">
              ⚠️ Richiesta superiore al credito disponibile
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Annulla
        </Button>
        <Button
          type="submit"
          icon={Calendar}
          disabled={!selectedAccount || remainingBalance < 0}
        >
          Crea Richiesta
        </Button>
      </div>
    </form>
  );
};