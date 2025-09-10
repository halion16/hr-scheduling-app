import React, { useState } from 'react';
import { Employee, Store } from '../../types';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';

interface EmployeeFormProps {
  employee?: Employee;
  stores: Store[];
  onSubmit: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  employee,
  stores,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    contractHours: employee?.contractHours?.toString() || '',
    fixedHours: employee?.fixedHours?.toString() || '',
    storeId: employee?.storeId || '',
    isActive: employee?.isActive ?? true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Il nome è obbligatorio';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Il cognome è obbligatorio';
    }

    const contractHours = parseFloat(formData.contractHours);
    const fixedHours = parseFloat(formData.fixedHours);

    if (!formData.contractHours || contractHours <= 0 || contractHours > 60) {
      newErrors.contractHours = 'Le ore massime contrattuali devono essere tra 1 e 60';
    }

    if (!formData.fixedHours || fixedHours < 0 || fixedHours > 60) {
      newErrors.fixedHours = 'Le ore minime devono essere tra 0 e 60';
    }

    // Validazione logica: ore fisse non possono essere maggiori delle ore contrattuali
    if (contractHours > 0 && fixedHours > 0 && fixedHours > contractHours) {
      newErrors.fixedHours = 'Le ore minime non possono superare le ore massime del contratto';
      newErrors.contractHours = 'Le ore massime devono essere maggiori o uguali alle ore minime';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        contractHours: parseFloat(formData.contractHours),
        fixedHours: parseFloat(formData.fixedHours),
        storeId: formData.storeId || undefined,
        isActive: formData.isActive
      });
    }
  };

  const storeOptions = stores
    .filter(store => store.isActive)
    .map(store => ({
      value: store.id,
      label: store.name
    }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nome"
          value={formData.firstName}
          onChange={(value) => setFormData(prev => ({ ...prev, firstName: value }))}
          required
          error={errors.firstName}
        />
        <Input
          label="Cognome"
          value={formData.lastName}
          onChange={(value) => setFormData(prev => ({ ...prev, lastName: value }))}
          required
          error={errors.lastName}
        />
      </div>

      {/* Sezione ore con spiegazioni chiare */}
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            📋 Configurazione Ore Settimanali
          </h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Ore Massime Contratto:</strong> Limite settimanale oltre il quale si considera straordinario</p>
            <p><strong>Ore Minime Garantite:</strong> Ore minime che il dipendente deve lavorare per settimana</p>
            <p className="text-blue-600 font-medium">Le ore minime devono essere ≤ ore massime</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="Ore Massime Contratto (settimanali)"
              type="number"
              value={formData.contractHours}
              onChange={(value) => setFormData(prev => ({ ...prev, contractHours: value }))}
              required
              error={errors.contractHours}
              placeholder="40"
              step="0.5"
              min="1"
              max="60"
            />
            <p className="text-xs text-gray-500 mt-1">
              Oltre questo limite = straordinario (es. 40h)
            </p>
          </div>
          
          <div>
            <Input
              label="Ore Minime Garantite (settimanali)"
              type="number"
              value={formData.fixedHours}
              onChange={(value) => setFormData(prev => ({ ...prev, fixedHours: value }))}
              required
              error={errors.fixedHours}
              placeholder="20"
              step="0.5"
              min="0"
              max="60"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sotto questo limite = sotto minimo (es. 20h)
            </p>
          </div>
        </div>

        {/* Anteprima calcolo */}
        {formData.contractHours && formData.fixedHours && !errors.contractHours && !errors.fixedHours && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-sm text-green-800">
              <strong>✅ Range Orario Valido:</strong>
              <div className="mt-1">
                🟡 Sotto minimo: &lt; {formData.fixedHours}h/settimana
              </div>
              <div>
                🟢 Nei limiti: {formData.fixedHours}h - {formData.contractHours}h/settimana
              </div>
              <div>
                🔴 Straordinario: &gt; {formData.contractHours}h/settimana
              </div>
            </div>
          </div>
        )}
      </div>

      <Select
        label="Negozio Assegnato"
        value={formData.storeId}
        onChange={(value) => setFormData(prev => ({ ...prev, storeId: value }))}
        options={storeOptions}
        placeholder="Seleziona un negozio (opzionale)"
      />

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
          Dipendente Attivo
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit">
          {employee ? 'Aggiorna' : 'Crea'} Dipendente
        </Button>
      </div>
    </form>
  );
};