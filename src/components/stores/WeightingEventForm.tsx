import React, { useState } from 'react';
import { WeightingEvent, EventCategory, Store } from '../../types';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

interface WeightingEventFormProps {
  event?: WeightingEvent | null;
  stores: Store[];
  onSave: (data: Omit<WeightingEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const DAYS_OF_WEEK = [
  'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'
];

const DAY_LABELS = {
  lunedì: 'Lunedì',
  martedì: 'Martedì',
  mercoledì: 'Mercoledì',
  giovedì: 'Giovedì',
  venerdì: 'Venerdì',
  sabato: 'Sabato',
  domenica: 'Domenica'
};

const categoryOptions = [
  { value: 'holiday', label: 'Festività' },
  { value: 'local_event', label: 'Eventi Locali' },
  { value: 'promotion', label: 'Saldi/Promozioni' },
  { value: 'weather', label: 'Condizioni Meteo' },
  { value: 'delivery', label: 'Scarico Merce' }
];

const multiplierPresets = [
  { value: 0.5, label: '0.5x - Riduzione 50%', color: 'text-green-600' },
  { value: 0.7, label: '0.7x - Riduzione 30%', color: 'text-green-500' },
  { value: 0.8, label: '0.8x - Riduzione 20%', color: 'text-green-400' },
  { value: 1.0, label: '1.0x - Standard', color: 'text-gray-600' },
  { value: 1.2, label: '1.2x - Aumento 20%', color: 'text-yellow-500' },
  { value: 1.5, label: '1.5x - Aumento 50%', color: 'text-orange-500' },
  { value: 1.8, label: '1.8x - Aumento 80%', color: 'text-red-500' },
  { value: 2.0, label: '2.0x - Raddoppio', color: 'text-red-600' }
];

export const WeightingEventForm: React.FC<WeightingEventFormProps> = ({
  event,
  stores,
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    name: event?.name || '',
    description: event?.description || '',
    category: event?.category || 'holiday' as EventCategory,
    startDate: event?.startDate ? event.startDate.toISOString().split('T')[0] : '',
    endDate: event?.endDate ? event.endDate.toISOString().split('T')[0] : '',
    multiplier: event?.multiplier || 1.0,
    customMultiplier: '',
    daysOfWeek: event?.daysOfWeek || null,
    storeIds: event?.storeIds || null,
    isActive: event?.isActive ?? true
  });

  const [showAdvanced, setShowAdvanced] = useState(
    (event?.daysOfWeek && event.daysOfWeek.length < 7) || 
    (event?.storeIds && event.storeIds.length < stores.length)
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Il nome è obbligatorio';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'La data di inizio è obbligatoria';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'La data di fine è obbligatoria';
    }

    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      newErrors.endDate = 'La data di fine deve essere successiva alla data di inizio';
    }

    if (formData.multiplier < 0.1 || formData.multiplier > 3.0) {
      newErrors.multiplier = 'Il moltiplicatore deve essere tra 0.1 e 3.0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      console.log('💾 Saving weighting event:', {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        multiplier: formData.multiplier,
        category: formData.category,
        storeIds: formData.storeIds,
        daysOfWeek: formData.daysOfWeek,
        isActive: formData.isActive
      });
      
      onSave({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        multiplier: formData.multiplier,
        daysOfWeek: formData.daysOfWeek,
        storeIds: formData.storeIds,
        isActive: formData.isActive
      });
    }
  };

  const handleMultiplierChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setFormData(prev => ({ ...prev, multiplier: numValue, customMultiplier: '' }));
    }
  };

  const handleCustomMultiplierChange = (value: string) => {
    setFormData(prev => ({ ...prev, customMultiplier: value }));
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0.1 && numValue <= 3.0) {
      setFormData(prev => ({ ...prev, multiplier: numValue }));
    }
  };

  const toggleDayOfWeek = (day: string) => {
    setFormData(prev => {
      const currentDays = prev.daysOfWeek || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      
      return {
        ...prev,
        daysOfWeek: newDays.length === 7 ? null : newDays
      };
    });
  };

  const toggleStore = (storeId: string) => {
    setFormData(prev => {
      const currentStores = prev.storeIds || [];
      const newStores = currentStores.includes(storeId)
        ? currentStores.filter(id => id !== storeId)
        : [...currentStores, storeId];
      
      return {
        ...prev,
        storeIds: newStores.length === stores.length ? null : newStores
      };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">Informazioni Base</h4>
        
        <Input
          label="Nome Evento"
          value={formData.name}
          onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
          required
          error={errors.name}
          placeholder="es. Black Friday, Festa della Mamma"
        />

        <Input
          label="Descrizione (opzionale)"
          value={formData.description}
          onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Descrizione dettagliata dell'evento..."
        />

        <Select
          label="Categoria"
          value={formData.category}
          onChange={(value) => setFormData(prev => ({ ...prev, category: value as EventCategory }))}
          options={categoryOptions}
          required
        />
      </div>

      {/* Date Range */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">Periodo</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data Inizio"
            type="date"
            value={formData.startDate}
            onChange={(value) => setFormData(prev => ({ ...prev, startDate: value }))}
            required
            error={errors.startDate}
          />
          <Input
            label="Data Fine"
            type="date"
            value={formData.endDate}
            onChange={(value) => setFormData(prev => ({ ...prev, endDate: value }))}
            required
            error={errors.endDate}
          />
        </div>
      </div>

      {/* Multiplier */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">Moltiplicatore Personale</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {multiplierPresets.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleMultiplierChange(preset.value.toString())}
              className={`p-3 text-sm rounded-lg border transition-colors ${
                formData.multiplier === preset.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`font-medium ${preset.color}`}>
                {preset.value}x
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {preset.value < 1 ? 'Riduzione' : preset.value > 1 ? 'Aumento' : 'Standard'}
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Moltiplicatore Personalizzato"
            type="number"
            value={formData.customMultiplier}
            onChange={handleCustomMultiplierChange}
            placeholder="1.0"
            step="0.1"
            min="0.1"
            max="3.0"
          />
          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <div>Valore attuale: <span className="font-medium">{formData.multiplier}x</span></div>
              <div className="text-xs text-gray-500 mt-1">
                {formData.multiplier < 1 ? 'Riduce il personale richiesto' :
                 formData.multiplier > 1 ? 'Aumenta il personale richiesto' :
                 'Mantiene i requisiti standard'}
              </div>
            </div>
          </div>
        </div>
        
        {errors.multiplier && (
          <p className="text-sm text-red-600">{errors.multiplier}</p>
        )}
      </div>

      {/* Advanced Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium text-gray-900">Opzioni Avanzate</h4>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showAdvanced ? 'Nascondi' : 'Mostra'}
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 border border-gray-200 rounded-lg p-4">
            {/* Days of Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Giorni della Settimana (lascia tutti selezionati per applicare a tutti i giorni)
              </label>
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = !formData.daysOfWeek || formData.daysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDayOfWeek(day)}
                      className={`p-2 text-xs rounded border transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {DAY_LABELS[day as keyof typeof DAY_LABELS].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stores */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Negozi (lascia tutti selezionati per applicare a tutti i negozi)
              </label>
              <div className="space-y-2">
                {stores.map(store => {
                  const isSelected = !formData.storeIds || formData.storeIds.includes(store.id);
                  return (
                    <label key={store.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStore(store.id)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">{store.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
          Evento Attivo
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit">
          {event ? 'Aggiorna' : 'Crea'} Evento
        </Button>
      </div>
    </form>
  );
};