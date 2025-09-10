import React, { useState } from 'react';
import { Store, StaffRequirement, WeightingEvent, StaffRole, CalculatedStaffNeed } from '../../types';
import { useStaffPlanning } from '../../hooks/useStaffPlanning';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { StaffCalendarView } from './StaffCalendarView';
import { WeightingEventForm } from './WeightingEventForm';
import { Users, Calendar, Zap, Plus, Settings, BarChart3, Copy, Check, X, AlertTriangle } from 'lucide-react';

interface StaffPlanningPanelProps {
  store: Store;
  onUpdateStore: (storeId: string, updates: Partial<Store>) => void;
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

export const StaffPlanningPanel: React.FC<StaffPlanningPanelProps> = ({
  store,
  onUpdateStore
}) => {
  const {
    staffRoles,
    staffRequirements,
    setStaffRequirements,
    weightingEvents,
    addStaffRequirement,
    updateStaffRequirement,
    deleteStaffRequirement,
    getStoreRequirements,
    addWeightingEvent,
    updateWeightingEvent,
    deleteWeightingEvent,
    getEventsInRange,
    calculateStaffNeeds
  } = useStaffPlanning();

  const [activeTab, setActiveTab] = useState<'requirements' | 'events' | 'calendar'>('requirements');
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<StaffRequirement | null>(null);
  const [editingEvent, setEditingEvent] = useState<WeightingEvent | null>(null);
  
  // Stati per duplicazione
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [sourceRequirement, setSourceRequirement] = useState<StaffRequirement | null>(null);
  const [selectedTargetDays, setSelectedTargetDays] = useState<string[]>([]);

  // Handler per salvare eventi
  const handleSaveEvent = (eventData: Omit<WeightingEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('💾 Saving weighting event:', eventData);
    if (editingEvent) {
      updateWeightingEvent(editingEvent.id, eventData);
      console.log('✅ Updated existing event:', editingEvent.id);
    } else {
      const newEvent = addWeightingEvent(eventData);
      console.log('✅ Created new event:', newEvent.id);
    }
    setShowEventModal(false);
    setEditingEvent(null);
  };

  // 🔄 AGGIORNAMENTO AUTOMATICO: Usa staffRequirements dal hook invece di getStoreRequirements
  const storeRequirements = staffRequirements.filter(req => req.storeId === store.id);

  const handleSaveRequirement = (requirementData: Omit<StaffRequirement, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingRequirement) {
      updateStaffRequirement(editingRequirement.id, requirementData);
    } else {
      addStaffRequirement(requirementData);
    }
    setShowRequirementModal(false);
    setEditingRequirement(null);
  };

  // Gestione duplicazione
  const handleDuplicateRequirements = () => {
    if (!sourceRequirement || selectedTargetDays.length === 0) return;
    
    console.log('🔄 Duplicazione requisiti:', {
      from: sourceRequirement.dayOfWeek,
      to: selectedTargetDays,
      roles: sourceRequirement.roles.length
    });
    
    // 🔧 BATCH OPERATION: Esegui tutte le operazioni in un singolo update
    const newRequirements: StaffRequirement[] = [];
    const updatedRequirements: StaffRequirement[] = [];
    
    selectedTargetDays.forEach(targetDay => {
      const existingRequirement = storeRequirements.find(req => req.dayOfWeek === targetDay);
      
      // Crea una copia profonda dei ruoli
      const duplicatedRoles = sourceRequirement.roles.map(role => ({
        roleId: role.roleId,
        minStaff: role.minStaff,
        maxStaff: role.maxStaff,
        peakHours: role.peakHours ? role.peakHours.map(peak => ({
          startTime: peak.startTime,
          endTime: peak.endTime,
          additionalStaff: peak.additionalStaff
        })) : undefined
      }));
      
      const requirementData = {
        storeId: store.id,
        dayOfWeek: targetDay,
        roles: duplicatedRoles,
        notes: sourceRequirement.notes ? `${sourceRequirement.notes} (Duplicato da ${sourceRequirement.dayOfWeek})` : `Duplicato da ${sourceRequirement.dayOfWeek}`
      };
      
      if (existingRequirement) {
        // Prepara per update
        updatedRequirements.push({
          ...existingRequirement,
          ...requirementData,
          updatedAt: new Date()
        });
        console.log(`   🔄 Preparato aggiornamento per ${targetDay}`);
      } else {
        // Prepara per creazione
        newRequirements.push({
          ...requirementData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`   ➕ Preparato nuovo requisito per ${targetDay}`);
      }
    });
    
    // 🚀 ESEGUI OPERAZIONE BATCH UNICA
    console.log(`🔄 Esecuzione batch: ${newRequirements.length} nuovi, ${updatedRequirements.length} aggiornamenti`);
    
    // Aggiorna tutti i requisiti in una singola operazione
    setStaffRequirements(prevRequirements => {
      let updatedList = [...prevRequirements];
      
      // Prima gli aggiornamenti
      updatedRequirements.forEach(updatedReq => {
        const index = updatedList.findIndex(req => req.id === updatedReq.id);
        if (index !== -1) {
          updatedList[index] = updatedReq;
          console.log(`   ✅ Aggiornato ${updatedReq.dayOfWeek}`);
        }
      });
      
      // Poi le aggiunte
      updatedList = [...updatedList, ...newRequirements];
      newRequirements.forEach(newReq => {
        console.log(`   ✅ Aggiunto ${newReq.dayOfWeek}`);
      });
      
      console.log(`✅ Batch completato: ${updatedList.length} requisiti totali`);
      return updatedList;
    });
    
    // Reset e chiudi modal
    setSourceRequirement(null);
    setSelectedTargetDays([]);
    setShowDuplicateModal(false);
    
    // 🆕 CONFERMA COMPLETAMENTO
    setTimeout(() => {
      console.log('🎉 Duplicazione completata, mostrando notifica...');
      alert(`✅ Requisiti duplicati con successo su ${selectedTargetDays.length} giorni!\n\nControlla i giorni nella lista per verificare.`);
    }, 200);
  };
  
  const toggleTargetDay = (day: string) => {
    setSelectedTargetDays(prev =>
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };
  const tabs = [
    { id: 'requirements' as const, name: 'Requisiti Base', icon: Users },
    { id: 'events' as const, name: 'Eventi Ponderazione', icon: Zap },
    { id: 'calendar' as const, name: 'Calendario', icon: Calendar }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Pianificazione Personale - {store.name}
              </h3>
              <p className="text-sm text-gray-500">
                Gestisci i requisiti di personale e gli eventi di ponderazione
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'requirements' && (
          <RequirementsTab
            store={store}
            requirements={storeRequirements}
            staffRoles={staffRoles}
            onAdd={() => setShowRequirementModal(true)}
            onEdit={(req) => {
              setEditingRequirement(req);
              setShowRequirementModal(true);
            }}
            onDelete={deleteStaffRequirement}
            onDuplicate={(req) => {
              setSourceRequirement(req);
              setShowDuplicateModal(true);
            }}
          />
        )}

        {activeTab === 'events' && (
          <EventsTab
            store={store}
            weightingEvents={weightingEvents}
            getEventsInRange={getEventsInRange}
            onAdd={() => setShowEventModal(true)}
            onEdit={(event) => {
              setEditingEvent(event);
              setShowEventModal(true);
            }}
            onDelete={deleteWeightingEvent}
          />
        )}

        {activeTab === 'calendar' && (
          <StaffCalendarView
            store={store}
            calculateStaffNeeds={calculateStaffNeeds}
            staffRoles={staffRoles}
          />
        )}
      </div>

      {/* Requirement Modal */}
      <Modal
        isOpen={showRequirementModal}
        onClose={() => {
          setShowRequirementModal(false);
          setEditingRequirement(null);
        }}
        title={editingRequirement ? 'Modifica Requisiti' : 'Aggiungi Requisiti'}
        size="lg"
      >
        <RequirementForm
          store={store}
          requirement={editingRequirement}
          staffRoles={staffRoles}
         onSave={handleSaveRequirement}
          onCancel={() => {
            setShowRequirementModal(false);
            setEditingRequirement(null);
          }}
        />
      </Modal>

      {/* Event Modal */}
      <Modal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? 'Modifica Evento' : 'Aggiungi Evento'}
        size="lg"
      >
        <WeightingEventForm
          event={editingEvent}
          stores={[store]}
          onSave={handleSaveEvent}
          onCancel={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
        />
      </Modal>
      
      {/* Modal Duplicazione Requisiti */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setSourceRequirement(null);
          setSelectedTargetDays([]);
        }}
        title="Duplica Requisiti Personale"
        size="lg"
      >
        <DuplicateRequirementsModal
          sourceRequirement={sourceRequirement}
          storeRequirements={storeRequirements}
          selectedTargetDays={selectedTargetDays}
          onToggleTargetDay={toggleTargetDay}
          onConfirm={handleDuplicateRequirements}
          onCancel={() => {
            setShowDuplicateModal(false);
            setSourceRequirement(null);
            setSelectedTargetDays([]);
          }}
          staffRoles={staffRoles}
        />
      </Modal>
    </div>
  );
};

// Requirements Tab Component
interface RequirementsTabProps {
  store: Store;
  requirements: StaffRequirement[];
  staffRoles: StaffRole[];
  onAdd: () => void;
  onEdit: (requirement: StaffRequirement) => void;
  onDelete: (id: string) => void;
  onDuplicate: (requirement: StaffRequirement) => void;
}

const RequirementsTab: React.FC<RequirementsTabProps> = ({
  requirements,
  staffRoles,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate
}) => {
  const roleMap = new Map(staffRoles.map(role => [role.id, role]));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium text-gray-900">Requisiti Personale per Giorno</h4>
        <Button icon={Plus} onClick={onAdd}>
          Aggiungi Requisiti
        </Button>
      </div>

      <div className="space-y-3">
        {DAYS_OF_WEEK.map(day => {
          const dayRequirement = requirements.find(req => req.dayOfWeek === day);
          
          return (
            <div key={day} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900">
                    {DAY_LABELS[day as keyof typeof DAY_LABELS]}
                  </h5>
                  
                  {dayRequirement ? (
                    <div className="mt-2 space-y-2">
                      {dayRequirement.roles.map(role => {
                        const roleInfo = roleMap.get(role.roleId);
                        return (
                          <div key={role.roleId} className="text-sm">
                            <span className="font-medium text-gray-700">
                              {roleInfo?.name || 'Ruolo Sconosciuto'}:
                            </span>
                            <span className="ml-2 text-gray-600">
                              {role.minStaff}-{role.maxStaff} persone
                            </span>
                            {role.peakHours && role.peakHours.length > 0 && (
                              <div className="ml-4 text-xs text-blue-600">
                                Ore di punta: {role.peakHours.map(peak => 
                                  `${peak.startTime}-${peak.endTime} (+${peak.additionalStaff})`
                                ).join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {dayRequirement.notes && (
                        <div className="text-xs text-gray-500 italic">
                          Note: {dayRequirement.notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500">
                      Nessun requisito configurato
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  {dayRequirement ? (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        icon={Copy}
                        onClick={() => onDuplicate(dayRequirement)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Duplica
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(dayRequirement)}
                      >
                        Modifica
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDelete(dayRequirement.id)}
                      >
                        Elimina
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAdd}
                    >
                      Configura
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Events Tab Component
interface EventsTabProps {
  store: Store;
  weightingEvents: WeightingEvent[];
  getEventsInRange: (startDate: Date, endDate: Date, storeId?: string) => WeightingEvent[];
  onAdd: () => void;
  onEdit: (event: WeightingEvent) => void;
  onDelete: (id: string) => void;
}

const EventsTab: React.FC<EventsTabProps> = ({ 
  store, 
  weightingEvents,
  getEventsInRange,
  onAdd, 
  onEdit,
  onDelete
}) => {
  
  // Filtra eventi per questo negozio
  const storeEvents = weightingEvents.filter(event => 
    !event.storeIds || event.storeIds.includes(store.id)
  );
  
  // Get events for next 3 months per questo negozio
  const today = new Date();
  const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  const upcomingEvents = storeEvents.filter(event => 
    event.isActive && 
    ((event.startDate <= threeMonthsLater && event.endDate >= today) ||
     (event.startDate >= today && event.startDate <= threeMonthsLater))
  );

  const categoryLabels = {
    holiday: 'Festività',
    local_event: 'Eventi Locali',
    promotion: 'Saldi/Promozioni',
    weather: 'Condizioni Meteo',
    delivery: 'Scarico Merce'
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium text-gray-900">Eventi di Ponderazione</h4>
        <Button icon={Plus} onClick={onAdd}>
          Aggiungi Evento
        </Button>
      </div>

      {upcomingEvents.length > 0 ? (
        <div className="space-y-3">
          {upcomingEvents.map(event => (
            <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h5 className="font-medium text-gray-900">{event.name}</h5>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      event.multiplier > 1 ? 'bg-red-100 text-red-800' :
                      event.multiplier < 1 ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.multiplier}x
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {categoryLabels[event.category]}
                    </span>
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-600">
                    {event.startDate.toLocaleDateString('it-IT')} - {event.endDate.toLocaleDateString('it-IT')}
                  </div>
                  
                  {event.description && (
                    <div className="mt-1 text-sm text-gray-500">
                      {event.description}
                    </div>
                  )}
                  
                  {event.daysOfWeek && event.daysOfWeek.length < 7 && (
                    <div className="mt-1 text-xs text-blue-600">
                      Solo: {event.daysOfWeek.map(day => DAY_LABELS[day as keyof typeof DAY_LABELS]).join(', ')}
                    </div>
                  )}
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(event)}
                >
                  Modifica
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm(`Eliminare l'evento "${event.name}"?`)) {
                      onDelete(event.id);
                    }
                  }}
                >
                  Elimina
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Nessun evento di ponderazione configurato</p>
          <Button className="mt-4" variant="outline" onClick={onAdd}>
            Crea il Primo Evento
          </Button>
        </div>
      )}
    </div>
  );
};

// Requirement Form Component
interface RequirementFormProps {
  store: Store;
  requirement?: StaffRequirement | null;
  staffRoles: StaffRole[];
  onSave: (data: Omit<StaffRequirement, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const RequirementForm: React.FC<RequirementFormProps> = ({
  store,
  requirement,
  staffRoles,
  onSave,
  onCancel
}) => {
  const [selectedDay, setSelectedDay] = useState(requirement?.dayOfWeek || 'lunedì');
  const [roles, setRoles] = useState(requirement?.roles || []);
  const [notes, setNotes] = useState(requirement?.notes || '');

  const dayOptions = DAYS_OF_WEEK.map(day => ({
    value: day,
    label: DAY_LABELS[day as keyof typeof DAY_LABELS]
  }));

  const addRole = () => {
    if (staffRoles.length > 0) {
      setRoles(prev => [...prev, {
        roleId: staffRoles[0].id,
        minStaff: 1,
        maxStaff: 2,
        peakHours: []
      }]);
    }
  };

  const updateRole = (index: number, updates: Partial<typeof roles[0]>) => {
    setRoles(prev => prev.map((role, i) => 
      i === index ? { ...role, ...updates } : role
    ));
  };

  const removeRole = (index: number) => {
    setRoles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      storeId: store.id,
      dayOfWeek: selectedDay,
      roles,
      notes: notes.trim() || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Select
        label="Giorno della Settimana"
        value={selectedDay}
        onChange={setSelectedDay}
        options={dayOptions}
        required
      />

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-md font-medium text-gray-900">Ruoli Richiesti</h4>
          <Button type="button" size="sm" onClick={addRole}>
            Aggiungi Ruolo
          </Button>
        </div>

        {roles.map((role, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex-1 grid grid-cols-3 gap-4">
                <Select
                  label="Ruolo"
                  value={role.roleId}
                  onChange={(value) => updateRole(index, { roleId: value })}
                  options={staffRoles.map(r => ({ value: r.id, label: r.name }))}
                  required
                />
                <Input
                  label="Min Personale"
                  type="number"
                  value={role.minStaff.toString()}
                  onChange={(value) => updateRole(index, { minStaff: parseInt(value) || 1 })}
                  required
                />
                <Input
                  label="Max Personale"
                  type="number"
                  value={role.maxStaff.toString()}
                  onChange={(value) => updateRole(index, { maxStaff: parseInt(value) || 1 })}
                  required
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => removeRole(index)}
                className="ml-4"
              >
                Rimuovi
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Input
        label="Note (opzionale)"
        value={notes}
        onChange={setNotes}
        placeholder="Note speciali per questo giorno..."
      />

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit">
          Salva Requisiti
        </Button>
      </div>
    </form>
  );
};

// Duplicate Requirements Modal Component
interface DuplicateRequirementsModalProps {
  sourceRequirement: StaffRequirement | null;
  storeRequirements: StaffRequirement[];
  selectedTargetDays: string[];
  onToggleTargetDay: (day: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  staffRoles: StaffRole[];
}

const DuplicateRequirementsModal: React.FC<DuplicateRequirementsModalProps> = ({
  sourceRequirement,
  storeRequirements,
  selectedTargetDays,
  onToggleTargetDay,
  onConfirm,
  onCancel,
  staffRoles
}) => {
  if (!sourceRequirement) return null;

  const roleMap = new Map(staffRoles.map(role => [role.id, role]));
  const targetDays = DAYS_OF_WEEK.filter(day => day !== sourceRequirement.dayOfWeek);
  const existingDays = storeRequirements.map(req => req.dayOfWeek);
  const hasOverwrites = selectedTargetDays.some(day => existingDays.includes(day));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          <Copy className="h-6 w-6 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">
            Duplica Requisiti Personale
          </h3>
        </div>
        <p className="text-sm text-gray-600">
          Copia i requisiti da <strong>{DAY_LABELS[sourceRequirement.dayOfWeek as keyof typeof DAY_LABELS]}</strong> agli altri giorni
        </p>
      </div>

      {/* Source Requirements Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          📋 Requisiti da duplicare ({DAY_LABELS[sourceRequirement.dayOfWeek as keyof typeof DAY_LABELS]}):
        </h4>
        <div className="space-y-1">
          {sourceRequirement.roles.map(role => {
            const roleInfo = roleMap.get(role.roleId);
            return (
              <div key={role.roleId} className="text-sm text-blue-800">
                • <strong>{roleInfo?.name}</strong>: {role.minStaff}-{role.maxStaff} persone
                {role.peakHours && role.peakHours.length > 0 && (
                  <span className="text-blue-600 ml-2">
                    (Ore di punta: {role.peakHours.map(peak => 
                      `${peak.startTime}-${peak.endTime} +${peak.additionalStaff}`
                    ).join(', ')})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Days Selection */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">
          🎯 Seleziona i giorni dove duplicare:
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {targetDays.map(day => {
            const isSelected = selectedTargetDays.includes(day);
            const hasExisting = existingDays.includes(day);
            
            return (
              <button
                key={day}
                type="button"
                onClick={() => onToggleTargetDay(day)}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  isSelected 
                    ? hasExisting
                      ? 'bg-yellow-100 border-yellow-300 text-yellow-800'  // Existing + Selected
                      : 'bg-green-100 border-green-300 text-green-800'     // New + Selected
                    : hasExisting
                      ? 'bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-300'  // Existing
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'         // Empty
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{DAY_LABELS[day as keyof typeof DAY_LABELS]}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                  {hasExisting && !isSelected && <AlertTriangle className="h-4 w-4" />}
                </div>
                <div className="text-xs mt-1">
                  {isSelected 
                    ? hasExisting ? '⚠️ Sovrascrive' : '✅ Nuovo'
                    : hasExisting ? '📋 Ha requisiti' : '➕ Vuoto'
                  }
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Warning for overwrites */}
      {hasOverwrites && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Attenzione!</p>
              <p className="text-yellow-700">
                Alcuni giorni selezionati hanno già requisiti configurati che verranno sovrascritti.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {selectedTargetDays.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>Riepilogo:</strong> I requisiti di <strong>{sourceRequirement.roles.length} ruoli</strong> verranno 
            duplicati su <strong>{selectedTargetDays.length} giorni</strong> ({selectedTargetDays.map(day => 
              DAY_LABELS[day as keyof typeof DAY_LABELS]
            ).join(', ')}).
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Annulla
        </Button>
        <Button 
          onClick={onConfirm}
          disabled={selectedTargetDays.length === 0}
          className="bg-green-600 hover:bg-green-700"
        >
          <Copy className="h-4 w-4 mr-2" />
          Duplica su {selectedTargetDays.length} giorni
        </Button>
      </div>
    </div>
  );
};