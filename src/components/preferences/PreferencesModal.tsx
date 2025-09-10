import React, { useState } from 'react';
import { Preferences } from '../../types';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences;
  onSave: (preferences: Preferences) => void;
  onReset: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSave,
  onReset
}) => {
  const [formData, setFormData] = useState<Preferences>(preferences);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.defaultBreakDuration || formData.defaultBreakDuration < 0 || formData.defaultBreakDuration > 240) {
      newErrors.defaultBreakDuration = 'La durata della pausa deve essere tra 0 e 240 minuti';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const handleCancel = () => {
    setFormData(preferences);
    setErrors({});
    onClose();
  };

  const languageOptions = [
    { value: 'it', label: 'Italiano' },
    { value: 'en', label: 'English' }
  ];

  const themeOptions = [
    { value: 'light', label: 'Chiaro' },
    { value: 'dark', label: 'Scuro' }
  ];

  const dateFormatOptions = [
    { value: 'dd/mm/yyyy', label: 'GG/MM/AAAA' },
    { value: 'mm/dd/yyyy', label: 'MM/GG/AAAA' }
  ];

  const roleOptions = [
    { value: 'admin', label: 'Amministratore' },
    { value: 'manager', label: 'Manager' },
    { value: 'user', label: 'Utente' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Preferenze"
      size="md"
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Impostazioni Turni</h3>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <Input
              label="Durata Pausa Predefinita (minuti)"
              type="number"
              value={formData.defaultBreakDuration.toString()}
              onChange={(value) => setFormData(prev => ({ 
                ...prev, 
                defaultBreakDuration: parseInt(value) || 0 
              }))}
              error={errors.defaultBreakDuration}
              placeholder="30"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Valore utilizzato come default quando si crea un nuovo turno
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Impostazioni Sistema</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <Select
              label="Ruolo Utente"
              value={formData.userRole}
              onChange={(value) => setFormData(prev => ({ 
                ...prev, 
                userRole: value as 'admin' | 'manager' | 'user'
              }))}
              options={roleOptions}
            />
            <p className="text-xs text-blue-600">
              Gli amministratori possono sbloccare tutti i turni • I manager possono bloccare/sbloccare • Gli utenti possono solo visualizzare turni bloccati
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Impostazioni Interfaccia</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <Select
              label="Lingua"
              value={formData.language}
              onChange={(value) => setFormData(prev => ({ 
                ...prev, 
                language: value as 'it' | 'en' 
              }))}
              options={languageOptions}
            />
            
            <Select
              label="Tema"
              value={formData.theme}
              onChange={(value) => setFormData(prev => ({ 
                ...prev, 
                theme: value as 'light' | 'dark' 
              }))}
              options={themeOptions}
              disabled
            />
            
            <Select
              label="Formato Data"
              value={formData.dateFormat}
              onChange={(value) => setFormData(prev => ({ 
                ...prev, 
                dateFormat: value as 'dd/mm/yyyy' | 'mm/dd/yyyy' 
              }))}
              options={dateFormatOptions}
              disabled
            />
          </div>
          
          <p className="text-xs text-gray-400">
            Alcune opzioni saranno disponibili in versioni future
          </p>
        </div>

        <div className="flex justify-between pt-4 border-t border-gray-200">
          <Button 
            variant="secondary" 
            onClick={handleReset}
          >
            Ripristina Default
          </Button>
          
          <div className="flex space-x-3">
            <Button variant="outline" onClick={handleCancel}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              Salva Preferenze
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};