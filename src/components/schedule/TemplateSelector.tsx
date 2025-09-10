import React, { useState } from 'react';
import { useShiftTemplates } from '../../hooks/useShiftTemplates';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Clock, Zap, Plus, Trash2, Star, TrendingUp, BarChart3, Sun, CloudSun, Moon } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (templateId: string) => void;
  onClose: () => void;
  suggestedTime?: string; // Per suggerire template basati sull'orario
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  onClose,
  suggestedTime
}) => {
  const { 
    templates, 
    addTemplate, 
    deleteTemplate, 
    getTemplatesByCategory,
    getSuggestedTemplates,
    getTemplateStats,
    determineCategory
  } = useShiftTemplates();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'suggested' | 'create'>('browse');
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    startTime: '',
    endTime: '',
    breakDuration: '30',
    description: '',
    category: 'custom' as const
  });

  const categorizedTemplates = getTemplatesByCategory();
  const suggestedTemplates = getSuggestedTemplates(suggestedTime);
  const stats = getTemplateStats();

  // Mappatura categorie con icone e colori
  const categoryConfig = {
    apertura: {
      label: '🌅 Apertura',
      description: 'Turni mattutini (06:00 - 12:00)',
      icon: Sun,
      color: 'from-yellow-50 to-orange-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800'
    },
    mediano: {
      label: '☀️ Mediano', 
      description: 'Turni centrali (12:00 - 17:00)',
      icon: CloudSun,
      color: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800'
    },
    chiusura: {
      label: '🌙 Chiusura',
      description: 'Turni serali (17:00 - 24:00)',
      icon: Moon,
      color: 'from-purple-50 to-indigo-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-800'
    },
    custom: {
      label: '⚙️ Personalizzati',
      description: 'Template creati manualmente',
      icon: Zap,
      color: 'from-gray-50 to-slate-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800'
    }
  };

  const categoryOptions = [
    { value: 'apertura', label: '🌅 Apertura (06:00-12:00)' },
    { value: 'mediano', label: '☀️ Mediano (12:00-17:00)' },
    { value: 'chiusura', label: '🌙 Chiusura (17:00-24:00)' },
    { value: 'custom', label: '⚙️ Personalizzato' }
  ];

  const handleCreateTemplate = () => {
    if (newTemplate.name && newTemplate.startTime && newTemplate.endTime) {
      // Auto-determina categoria se non è custom
      let finalCategory = newTemplate.category;
      if (finalCategory === 'custom' && newTemplate.startTime) {
        finalCategory = determineCategory(newTemplate.startTime, newTemplate.endTime) as any;
      }

      addTemplate({
        name: newTemplate.name,
        startTime: newTemplate.startTime,
        endTime: newTemplate.endTime,
        breakDuration: parseInt(newTemplate.breakDuration) || 30,
        description: newTemplate.description,
        category: finalCategory
      });
      
      setShowCreateForm(false);
      setNewTemplate({
        name: '',
        startTime: '',
        endTime: '',
        breakDuration: '30',
        description: '',
        category: 'custom'
      });
    }
  };

  const calculateHours = (start: string, end: string, breakMinutes: number): string => {
    if (!start || !end) return '';
    
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    const workingMinutes = endTotalMin - startTotalMin - breakMinutes;
    
    return (workingMinutes / 60).toFixed(1);
  };

  const tabs = [
    { id: 'browse' as const, label: '📋 Sfoglia', count: templates.length },
    { id: 'suggested' as const, label: '💡 Suggeriti', count: suggestedTemplates.length },
    { id: 'create' as const, label: '➕ Crea Nuovo', count: 0 }
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Template Turni"
      size="xl"
    >
      <div className="space-y-6">
        {/* Header con tabs e statistiche */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-white rounded-full px-2 py-0.5 text-xs font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              icon={BarChart3}
              onClick={() => setShowStats(!showStats)}
            >
              Statistiche
            </Button>
          </div>
        </div>

        {/* Statistiche collassabili */}
        {showStats && (
          <div className="bg-gray-50 rounded-lg p-4 border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.totalTemplates}</div>
                <div className="text-sm text-gray-600">Template Totali</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.totalUsage}</div>
                <div className="text-sm text-gray-600">Utilizzi Totali</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.customTemplates}</div>
                <div className="text-sm text-gray-600">Personalizzati</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{stats.avgUsagePerTemplate}</div>
                <div className="text-sm text-gray-600">Media Utilizzi</div>
              </div>
            </div>
            
            {stats.mostUsed.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-900 mb-2">🏆 Più Utilizzati</h4>
                <div className="flex flex-wrap gap-2">
                  {stats.mostUsed.map(template => (
                    <span key={template.id} className="text-xs bg-white rounded px-2 py-1 border">
                      {template.name} ({template.usageCount}×)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contenuto tab Sfoglia */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {Object.entries(categorizedTemplates).map(([category, categoryTemplates]) => {
              const config = categoryConfig[category as keyof typeof categoryConfig];
              if (!config || categoryTemplates.length === 0) return null;
              
              const Icon = config.icon;
              
              return (
                <div key={category} className={`rounded-lg border-2 ${config.borderColor} bg-gradient-to-r ${config.color} p-4`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Icon className={`h-5 w-5 ${config.textColor}`} />
                      <div>
                        <h3 className={`font-semibold ${config.textColor}`}>
                          {config.label}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${config.textColor} bg-white rounded px-2 py-1`}>
                      {categoryTemplates.length} template
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoryTemplates.map(template => (
                      <div
                        key={template.id}
                        className="bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer group transition-all hover:shadow-sm"
                        onClick={() => onSelect(template.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                              {template.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center space-x-2">
                              <Clock className="h-3 w-3" />
                              <span>{template.startTime} - {template.endTime}</span>
                              <span>•</span>
                              <span>{calculateHours(template.startTime, template.endTime, template.breakDuration)}h</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            {template.usageCount > 0 && (
                              <div className="flex items-center space-x-1">
                                <Star className="h-3 w-3 text-yellow-500" />
                                <span className="text-xs text-yellow-600 font-medium">
                                  {template.usageCount}
                                </span>
                              </div>
                            )}
                            {template.id.startsWith('custom-') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Eliminare il template "${template.name}"?`)) {
                                    deleteTemplate(template.id);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-0.5"
                                title="Elimina template"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
                            <span>Pausa: {template.breakDuration === 0 ? 'Nessuna' : `${template.breakDuration}min`}</span>
                            <span>Ore: {calculateHours(template.startTime, template.endTime, template.breakDuration)}h</span>
                          </div>
                          
                          {template.description && (
                            <div className="text-xs text-gray-500 italic">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Contenuto tab Suggeriti */}
        {activeTab === 'suggested' && (
          <div className="space-y-4">
            {suggestedTime && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    Suggerimenti per orario {suggestedTime}
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  Template più utilizzati per la fascia oraria rilevata
                </p>
              </div>
            )}
            
            {suggestedTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestedTemplates.map(template => (
                  <div
                    key={template.id}
                    className="bg-white p-4 rounded-lg border-2 border-blue-200 hover:border-blue-300 cursor-pointer group transition-all hover:shadow-md"
                    onClick={() => onSelect(template.id)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {template.name}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {template.startTime} - {template.endTime} • {calculateHours(template.startTime, template.endTime, template.breakDuration)}h
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 bg-blue-100 rounded px-2 py-1">
                        <Star className="h-3 w-3 text-blue-600" />
                        <span className="text-sm font-bold text-blue-700">
                          {template.usageCount}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      Pausa: {template.breakDuration === 0 ? 'Nessuna pausa' : `${template.breakDuration} minuti`}
                    </div>
                    
                    {template.description && (
                      <div className="text-sm text-gray-500 italic mt-2">
                        {template.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nessun template suggerito per questo orario</p>
                <p className="text-sm mt-1">Crea e usa template per vedere i suggerimenti</p>
              </div>
            )}
          </div>
        )}

        {/* Contenuto tab Crea Nuovo */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">
                ➕ Crea Nuovo Template
              </h4>
              <p className="text-sm text-green-800">
                I template ti permettono di applicare rapidamente combinazioni di orari ricorrenti
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nome Template"
                value={newTemplate.name}
                onChange={(value) => setNewTemplate(prev => ({ ...prev, name: value }))}
                placeholder="es. Apertura Weekend"
                required
              />
              <Select
                label="Categoria"
                value={newTemplate.category}
                onChange={(value) => setNewTemplate(prev => ({ ...prev, category: value as any }))}
                options={categoryOptions}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Orario Inizio"
                type="time"
                value={newTemplate.startTime}
                onChange={(value) => setNewTemplate(prev => ({ ...prev, startTime: value }))}
                required
              />
              <Input
                label="Orario Fine"
                type="time"
                value={newTemplate.endTime}
                onChange={(value) => setNewTemplate(prev => ({ ...prev, endTime: value }))}
                required
              />
              <Input
                label="Pausa (min)"
                type="number"
                value={newTemplate.breakDuration}
                onChange={(value) => setNewTemplate(prev => ({ ...prev, breakDuration: value }))}
                min="0"
                max="480"
                step="5"
              />
            </div>
            
            <Input
              label="Descrizione (opzionale)"
              value={newTemplate.description}
              onChange={(value) => setNewTemplate(prev => ({ ...prev, description: value }))}
              placeholder="Descrizione del template per facilità di riconoscimento"
            />

            {/* Anteprima live */}
            {newTemplate.startTime && newTemplate.endTime && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">
                  👁️ Anteprima Template
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Orario:</span>
                    <span className="ml-2 font-mono">{newTemplate.startTime} - {newTemplate.endTime}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Ore Lavoro:</span>
                    <span className="ml-2 font-bold">
                      {calculateHours(newTemplate.startTime, newTemplate.endTime, parseInt(newTemplate.breakDuration) || 0)}h
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Pausa:</span>
                    <span className="ml-2">
                      {newTemplate.breakDuration === '0' ? 'Nessuna pausa' : `${newTemplate.breakDuration} minuti`}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Categoria:</span>
                    <span className="ml-2">
                      {newTemplate.category === 'custom' && newTemplate.startTime ? 
                        determineCategory(newTemplate.startTime, newTemplate.endTime) : 
                        newTemplate.category}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <Button onClick={handleCreateTemplate} disabled={!newTemplate.name || !newTemplate.startTime || !newTemplate.endTime}>
                Crea Template
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('browse')}>
                Annulla
              </Button>
            </div>
          </div>
        )}

        {/* Footer con suggerimenti */}
        <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <strong>💡 Suggerimenti:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Clicca su un template per applicarlo</li>
                <li>• I template più usati appaiono con ⭐</li>
                <li>• Usa Ctrl+T per aprire rapidamente</li>
              </ul>
            </div>
            <div>
              <strong>🕒 Fasce Orarie:</strong>
              <ul className="mt-1 space-y-1">
                <li>• 🌅 Apertura: 06:00 - 12:00</li>
                <li>• ☀️ Mediano: 12:00 - 17:00</li>
                <li>• 🌙 Chiusura: 17:00 - 24:00</li>
              </ul>
            </div>
            <div>
              <strong>⚡ Template Auto:</strong>
              <ul className="mt-1 space-y-1">
                <li>• I pattern ricorrenti diventano template</li>
                <li>• Soglia: 5+ utilizzi dello stesso orario</li>
                <li>• Elimina quelli non necessari</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};