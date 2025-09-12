import React, { useState } from 'react';
import { ValidationAdminSettings } from '../../types/validation';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { 
  Settings, 
  Shield, 
  Clock, 
  Users, 
  AlertTriangle, 
  Save, 
  RotateCcw,
  Info,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';

interface ValidationConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: ValidationAdminSettings;
  onSave: (settings: ValidationAdminSettings) => void;
}

// Configurazioni di default
const DEFAULT_SETTINGS: ValidationAdminSettings = {
  enabled: true,
  enableRealTimeValidation: true,
  
  dynamicStaffRequirements: {
    enabled: true,
    useHourlyRequirements: false,
    equityThreshold: 20, // 20%
    maxHoursVariation: 8 // max 8h differenza
  },
  
  coverageSettings: {
    minimumStaffPerHour: 1,
    minimumOverlapMinutes: 15,
    allowSinglePersonCoverage: false,
    criticalGapThresholdMinutes: 60
  },
  
  complianceSettings: {
    enforceRestPeriods: true,
    minimumRestHours: 11,
    maxConsecutiveWorkDays: 6,
    weeklyHourLimits: {
      enabled: true,
      maxWeeklyHours: 40,
      overtimeThreshold: 38
    }
  },
  
  alertSettings: {
    scoreThreshold: 80,
    enableWorkloadAlerts: true,
    enableCoverageAlerts: true,
    enableComplianceAlerts: true
  },
  
  storeSpecificSettings: {
    enabled: false,
    overrideGlobalSettings: false
  }
};

export const ValidationConfigPanel: React.FC<ValidationConfigPanelProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave
}) => {
  const [settings, setSettings] = useState<ValidationAdminSettings>(currentSettings || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'general' | 'staff' | 'coverage' | 'compliance' | 'alerts'>('general');
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = (updates: Partial<ValidationAdminSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateNestedSettings = <T extends keyof ValidationAdminSettings>(
    section: T,
    updates: Partial<ValidationAdminSettings[T]>
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(settings);
    setHasChanges(false);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  const tabs = [
    { id: 'general' as const, name: 'Generale', icon: Settings },
    { id: 'staff' as const, name: 'Personale', icon: Users },
    { id: 'coverage' as const, name: 'Copertura', icon: Clock },
    { id: 'compliance' as const, name: 'CCNL', icon: Shield },
    { id: 'alerts' as const, name: 'Avvisi', icon: AlertTriangle }
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="⚙️ Configurazione Validazione Turni" 
      size="xl"
    >
      <div className="flex flex-col h-[80vh]">
        {/* Status Bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${settings.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <h3 className="font-medium text-blue-900">
                  Sistema Validazione: {settings.enabled ? 'ATTIVO' : 'DISATTIVATO'}
                </h3>
                <p className="text-sm text-blue-700">
                  Validazione in tempo reale: {settings.enableRealTimeValidation ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {settings.enabled && (
                <>
                  <Zap className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">Sistema operativo</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Configurazioni Globali</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Sistema Validazione</label>
                      <p className="text-xs text-gray-500">Abilita/disabilita completamente il sistema di validazione</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ enabled: !settings.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        settings.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Validazione in Tempo Reale</label>
                      <p className="text-xs text-gray-500">Analizza automaticamente i turni quando vengono modificati</p>
                    </div>
                    <button
                      onClick={() => updateSettings({ enableRealTimeValidation: !settings.enableRealTimeValidation })}
                      disabled={!settings.enabled}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        settings.enableRealTimeValidation ? 'bg-blue-600' : 'bg-gray-200'
                      } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.enableRealTimeValidation ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Gestione Personale</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Requisiti Staff Dinamici</label>
                      <p className="text-xs text-gray-500">Adatta i requisiti staff in base alla configurazione negozi</p>
                    </div>
                    <button
                      onClick={() => updateNestedSettings('dynamicStaffRequirements', { 
                        enabled: !settings.dynamicStaffRequirements.enabled 
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.dynamicStaffRequirements.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.dynamicStaffRequirements.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Soglia Equità (%)"
                        type="number"
                        value={settings.dynamicStaffRequirements.equityThreshold.toString()}
                        onChange={(value) => updateNestedSettings('dynamicStaffRequirements', { 
                          equityThreshold: parseInt(value) || 20 
                        })}
                        min="0"
                        max="100"
                        disabled={!settings.dynamicStaffRequirements.enabled}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Deviazione standard massima per distribuzione equa
                      </p>
                    </div>

                    <div>
                      <Input
                        label="Max Variazione Ore"
                        type="number"
                        value={settings.dynamicStaffRequirements.maxHoursVariation.toString()}
                        onChange={(value) => updateNestedSettings('dynamicStaffRequirements', { 
                          maxHoursVariation: parseInt(value) || 8 
                        })}
                        min="0"
                        max="20"
                        disabled={!settings.dynamicStaffRequirements.enabled}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Differenza massima ore tra dipendenti
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coverage' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Copertura Turni</h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Input
                      label="Staff Minimo per Ora"
                      type="number"
                      value={settings.coverageSettings.minimumStaffPerHour.toString()}
                      onChange={(value) => updateNestedSettings('coverageSettings', { 
                        minimumStaffPerHour: parseInt(value) || 1 
                      })}
                      min="1"
                      max="10"
                    />
                  </div>

                  <div>
                    <Input
                      label="Sovrapposizione Minima (min)"
                      type="number"
                      value={settings.coverageSettings.minimumOverlapMinutes.toString()}
                      onChange={(value) => updateNestedSettings('coverageSettings', { 
                        minimumOverlapMinutes: parseInt(value) || 15 
                      })}
                      min="0"
                      max="60"
                    />
                  </div>

                  <div>
                    <Input
                      label="Soglia Gap Critico (min)"
                      type="number"
                      value={settings.coverageSettings.criticalGapThresholdMinutes.toString()}
                      onChange={(value) => updateNestedSettings('coverageSettings', { 
                        criticalGapThresholdMinutes: parseInt(value) || 60 
                      })}
                      min="15"
                      max="240"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Copertura Singola Persona</label>
                      <p className="text-xs text-gray-500">Permetti un solo dipendente per fascia oraria</p>
                    </div>
                    <button
                      onClick={() => updateNestedSettings('coverageSettings', { 
                        allowSinglePersonCoverage: !settings.coverageSettings.allowSinglePersonCoverage 
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.coverageSettings.allowSinglePersonCoverage ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.coverageSettings.allowSinglePersonCoverage ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Conformità CCNL</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Applica Periodi Riposo</label>
                      <p className="text-xs text-gray-500">Verifica riposi obbligatori tra turni</p>
                    </div>
                    <button
                      onClick={() => updateNestedSettings('complianceSettings', { 
                        enforceRestPeriods: !settings.complianceSettings.enforceRestPeriods 
                      })}
                      className={`relative inline-flex h-6 w-11 items-centers rounded-full transition-colors ${
                        settings.complianceSettings.enforceRestPeriods ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.complianceSettings.enforceRestPeriods ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Ore Riposo Minime"
                        type="number"
                        value={settings.complianceSettings.minimumRestHours.toString()}
                        onChange={(value) => updateNestedSettings('complianceSettings', { 
                          minimumRestHours: parseInt(value) || 11 
                        })}
                        min="8"
                        max="24"
                        disabled={!settings.complianceSettings.enforceRestPeriods}
                      />
                    </div>

                    <div>
                      <Input
                        label="Max Giorni Consecutivi"
                        type="number"
                        value={settings.complianceSettings.maxConsecutiveWorkDays.toString()}
                        onChange={(value) => updateNestedSettings('complianceSettings', { 
                          maxConsecutiveWorkDays: parseInt(value) || 6 
                        })}
                        min="1"
                        max="7"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Limiti Ore Settimanali</label>
                        <p className="text-xs text-gray-500">Controlla ore massime settimanali</p>
                      </div>
                      <button
                        onClick={() => updateNestedSettings('complianceSettings', { 
                          weeklyHourLimits: {
                            ...settings.complianceSettings.weeklyHourLimits,
                            enabled: !settings.complianceSettings.weeklyHourLimits.enabled
                          }
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.complianceSettings.weeklyHourLimits.enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.complianceSettings.weeklyHourLimits.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Input
                          label="Ore Massime Settimanali"
                          type="number"
                          value={settings.complianceSettings.weeklyHourLimits.maxWeeklyHours.toString()}
                          onChange={(value) => updateNestedSettings('complianceSettings', { 
                            weeklyHourLimits: {
                              ...settings.complianceSettings.weeklyHourLimits,
                              maxWeeklyHours: parseInt(value) || 40
                            }
                          })}
                          min="20"
                          max="60"
                          disabled={!settings.complianceSettings.weeklyHourLimits.enabled}
                        />
                      </div>

                      <div>
                        <Input
                          label="Soglia Straordinari"
                          type="number"
                          value={settings.complianceSettings.weeklyHourLimits.overtimeThreshold.toString()}
                          onChange={(value) => updateNestedSettings('complianceSettings', { 
                            weeklyHourLimits: {
                              ...settings.complianceSettings.weeklyHourLimits,
                              overtimeThreshold: parseInt(value) || 38
                            }
                          })}
                          min="20"
                          max="48"
                          disabled={!settings.complianceSettings.weeklyHourLimits.enabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sistema Avvisi</h3>
                
                <div className="space-y-4">
                  <div>
                    <Input
                      label="Soglia Score Validazione"
                      type="number"
                      value={settings.alertSettings.scoreThreshold.toString()}
                      onChange={(value) => updateNestedSettings('alertSettings', { 
                        scoreThreshold: parseInt(value) || 80 
                      })}
                      min="50"
                      max="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Score minimo per considerare la validazione come corretta
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Avvisi Distribuzione Carico</label>
                        <p className="text-xs text-gray-500">Notifica se distribuzione ore non equa</p>
                      </div>
                      <button
                        onClick={() => updateNestedSettings('alertSettings', { 
                          enableWorkloadAlerts: !settings.alertSettings.enableWorkloadAlerts 
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.alertSettings.enableWorkloadAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.alertSettings.enableWorkloadAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Avvisi Copertura Turni</label>
                        <p className="text-xs text-gray-500">Notifica gap di copertura e problemi staff</p>
                      </div>
                      <button
                        onClick={() => updateNestedSettings('alertSettings', { 
                          enableCoverageAlerts: !settings.alertSettings.enableCoverageAlerts 
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.alertSettings.enableCoverageAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.alertSettings.enableCoverageAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Avvisi Conformità CCNL</label>
                        <p className="text-xs text-gray-500">Notifica violazioni normative</p>
                      </div>
                      <button
                        onClick={() => updateNestedSettings('alertSettings', { 
                          enableComplianceAlerts: !settings.alertSettings.enableComplianceAlerts 
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.alertSettings.enableComplianceAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.alertSettings.enableComplianceAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
          <Button
            variant="secondary"
            onClick={handleReset}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Ripristina Default</span>
          </Button>

          <div className="flex items-center space-x-3">
            {hasChanges && (
              <div className="flex items-center text-amber-600 text-sm">
                <Info className="h-4 w-4 mr-1" />
                Modifiche non salvate
              </div>
            )}
            
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Annulla
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>Salva Configurazione</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};