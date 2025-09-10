import React, { useState } from 'react';
import { Store, WeeklyStoreSchedule, ClosureDay } from '../../types';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { StaffPlanningPanel } from './StaffPlanningPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../common/Tabs';
import { Clock, Users, Copy, Info, Calendar, ChevronLeft, ChevronRight, Plus, X, AlertTriangle, History, CalendarX, Eye } from 'lucide-react';
import { getStartOfWeek, addDays, formatDate } from '../../utils/timeUtils';

interface StoreFormProps {
  store?: Store;
  onSubmit: (data: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onUpdateStore?: (storeId: string, updates: Partial<Store>) => void;
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

export const StoreForm: React.FC<StoreFormProps> = ({
  store,
  onSubmit,
  onCancel,
  onUpdateStore
}) => {
  const [activeTab, setActiveTab] = useState('hours');
  const [currentWeek, setCurrentWeek] = useState(() => getStartOfWeek(new Date()));
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [newClosure, setNewClosure] = useState({
    date: '',
    reason: '',
    notes: '',
    isFullDay: true,
    customOpen: '09:00',
    customClose: '18:00'
  });
  
  const [formData, setFormData] = useState({
    name: store?.name || '',
    isActive: store?.isActive ?? true
  });

  // Gestione orari per settimana corrente
  const getCurrentWeekSchedule = (): WeeklyStoreSchedule | null => {
    if (!store?.weeklySchedules) return null;
    return store.weeklySchedules.find(schedule => 
      schedule.weekStartDate.toDateString() === currentWeek.toDateString() && schedule.isActive
    ) || null;
  };

  const [openingHours, setOpeningHours] = useState(() => {
    // Prima prova a caricare orari per la settimana corrente
    const weekSchedule = getCurrentWeekSchedule();
    if (weekSchedule) {
      return weekSchedule.openingHours;
    }
    
    // Fallback agli orari standard del negozio
    if (store?.openingHours) {
      return store.openingHours;
    }
    
    // Default
    return DAYS_OF_WEEK.reduce((acc, day) => ({
      ...acc,
      [day]: { open: '09:00', close: '18:00' }
    }), {});
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [weekNotes, setWeekNotes] = useState(() => {
    const weekSchedule = getCurrentWeekSchedule();
    return weekSchedule?.notes || '';
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Il nome del negozio è obbligatorio';
    }

    // Valida gli orari di apertura
    DAYS_OF_WEEK.forEach(day => {
      const hours = openingHours[day];
      if (hours && hours.open >= hours.close) {
        newErrors[`${day}_hours`] = `L'orario di chiusura di ${DAY_LABELS[day as keyof typeof DAY_LABELS]} deve essere successivo all'apertura`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Salva orari per la settimana corrente
  const saveWeeklySchedule = () => {
    if (!store || !onUpdateStore) return;
    
    const existingSchedules = store.weeklySchedules || [];
    const currentScheduleIndex = existingSchedules.findIndex(schedule => 
      schedule.weekStartDate.toDateString() === currentWeek.toDateString()
    );
    
    const weekEnd = addDays(currentWeek, 6);
    const newSchedule: WeeklyStoreSchedule = {
      id: currentScheduleIndex >= 0 ? existingSchedules[currentScheduleIndex].id : crypto.randomUUID(),
      storeId: store.id,
      weekStartDate: new Date(currentWeek),
      weekEndDate: weekEnd,
      openingHours: { ...openingHours },
      notes: weekNotes.trim() || undefined,
      isActive: true,
      createdAt: currentScheduleIndex >= 0 ? existingSchedules[currentScheduleIndex].createdAt : new Date(),
      updatedAt: new Date()
    };
    
    let updatedSchedules;
    if (currentScheduleIndex >= 0) {
      // Aggiorna schedule esistente
      updatedSchedules = existingSchedules.map((schedule, index) => 
        index === currentScheduleIndex ? newSchedule : schedule
      );
    } else {
      // Aggiungi nuovo schedule
      updatedSchedules = [...existingSchedules, newSchedule];
    }
    
    onUpdateStore(store.id, {
      weeklySchedules: updatedSchedules,
      // Aggiorna anche gli orari base del negozio se è la settimana corrente
      openingHours: isCurrentWeek() ? openingHours : store.openingHours
    });
    
    console.log('✅ Orari settimanali salvati per:', formatWeekRange(currentWeek, weekEnd));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      if (store && onUpdateStore) {
        // Salva orari settimanali e dati base
        saveWeeklySchedule();
        onUpdateStore(store.id, {
          name: formData.name.trim(),
          isActive: formData.isActive
        });
      } else {
        onSubmit({
          name: formData.name.trim(),
          openingHours,
          isActive: formData.isActive
        });
      }
    }
  };

  const updateDayHours = (day: string, field: 'open' | 'close', value: string) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  // Navigazione settimane
  const goToPreviousWeek = () => {
    if (hasUnsavedChanges()) {
      if (confirm('Hai modifiche non salvate. Vuoi salvarle prima di cambiare settimana?')) {
        saveWeeklySchedule();
      }
    }
    setCurrentWeek(prev => addDays(prev, -7));
    loadWeekSchedule(addDays(currentWeek, -7));
  };

  const goToNextWeek = () => {
    if (hasUnsavedChanges()) {
      if (confirm('Hai modifiche non salvate. Vuoi salvarle prima di cambiare settimana?')) {
        saveWeeklySchedule();
      }
    }
    setCurrentWeek(prev => addDays(prev, 7));
    loadWeekSchedule(addDays(currentWeek, 7));
  };

  const goToCurrentWeek = () => {
    const today = getStartOfWeek(new Date());
    setCurrentWeek(today);
    loadWeekSchedule(today);
  };

  const loadWeekSchedule = (weekStart: Date) => {
    if (!store) return;
    
    const weekSchedule = store.weeklySchedules?.find(schedule => 
      schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
    );
    
    if (weekSchedule) {
      setOpeningHours(weekSchedule.openingHours);
      setWeekNotes(weekSchedule.notes || '');
      console.log('📅 Caricati orari per settimana:', formatWeekRange(weekStart, addDays(weekStart, 6)));
    } else {
      // Usa orari base del negozio come default
      setOpeningHours(store.openingHours);
      setWeekNotes('');
      console.log('📅 Caricati orari base per nuova settimana');
    }
  };

  const hasUnsavedChanges = (): boolean => {
    const currentSchedule = getCurrentWeekSchedule();
    if (!currentSchedule) {
      // Nuova settimana - verifica se differisce dagli orari base
      return JSON.stringify(openingHours) !== JSON.stringify(store?.openingHours) || 
             weekNotes.trim() !== '';
    }
    
    return JSON.stringify(openingHours) !== JSON.stringify(currentSchedule.openingHours) || 
           weekNotes.trim() !== (currentSchedule.notes || '');
  };

  const isCurrentWeek = (): boolean => {
    const today = getStartOfWeek(new Date());
    return currentWeek.toDateString() === today.toDateString();
  };

  const formatWeekRange = (start: Date, end: Date): string => {
    return `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  // Gestione giorni di chiusura
  const handleAddClosureDay = () => {
    if (!newClosure.date || !newClosure.reason.trim()) {
      alert('Inserisci data e motivo della chiusura');
      return;
    }

    const date = new Date(newClosure.date);
    const customHours = !newClosure.isFullDay ? {
      open: newClosure.customOpen,
      close: newClosure.customClose
    } : undefined;

    addClosureDay(date, newClosure.reason.trim(), newClosure.notes.trim() || undefined, newClosure.isFullDay, customHours);
    
    // Reset form
    setNewClosure({
      date: '',
      reason: '',
      notes: '',
      isFullDay: true,
      customOpen: '09:00',
      customClose: '18:00'
    });
    
    setShowClosureModal(false);
  };

  const addClosureDay = (date: Date, reason: string, notes?: string, isFullDay: boolean = true, customHours?: { open: string; close: string }) => {
    if (!store || !onUpdateStore) return;
    
    const newClosure: ClosureDay = {
      id: crypto.randomUUID(),
      storeId: store.id,
      date: new Date(date),
      reason: reason.trim(),
      notes: notes?.trim(),
      isFullDay,
      customHours,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const updatedClosures = [...(store.closureDays || []), newClosure];
    onUpdateStore(store.id, { closureDays: updatedClosures });
    
    console.log('➕ Aggiunto giorno di chiusura:', date.toLocaleDateString(), reason);
  };

  const removeClosureDay = (closureId: string) => {
    if (!store || !onUpdateStore) return;
    
    const updatedClosures = (store.closureDays || []).filter(closure => closure.id !== closureId);
    onUpdateStore(store.id, { closureDays: updatedClosures });
    
    console.log('🗑️ Rimosso giorno di chiusura:', closureId);
  };

  // Ottieni chiusure per la settimana corrente
  const getWeekClosures = (): ClosureDay[] => {
    if (!store?.closureDays) return [];
    
    const weekEnd = addDays(currentWeek, 6);
    return store.closureDays.filter(closure => {
      const closureDate = new Date(closure.date);
      return closureDate >= currentWeek && closureDate <= weekEnd;
    });
  };
  // Se stiamo modificando un negozio esistente, mostra le tabs
  if (store && onUpdateStore) {
    return (
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hours" className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Orari</span>
            </TabsTrigger>
            <TabsTrigger value="closures" className="flex items-center space-x-2">
              <CalendarX className="h-4 w-4" />
              <span>Chiusure</span>
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Personale</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hours" className="mt-6">
            <WeeklyHoursForm
              store={store}
              formData={formData}
              setFormData={setFormData}
              openingHours={openingHours}
              updateDayHours={updateDayHours}
              errors={errors}
              onSubmit={handleSubmit}
              onCancel={onCancel}
              currentWeek={currentWeek}
              goToPreviousWeek={goToPreviousWeek}
              goToNextWeek={goToNextWeek}
              goToCurrentWeek={goToCurrentWeek}
              saveWeeklySchedule={saveWeeklySchedule}
              hasUnsavedChanges={hasUnsavedChanges()}
              weekNotes={weekNotes}
              setWeekNotes={setWeekNotes}
              showHistoryModal={() => setShowHistoryModal(true)}
              formatWeekRange={formatWeekRange}
              isCurrentWeek={isCurrentWeek()}
            />
          </TabsContent>

          <TabsContent value="closures" className="mt-6">
            <ClosuresForm
              store={store}
              currentWeek={currentWeek}
              weekClosures={getWeekClosures()}
              addClosureDay={handleAddClosureDay}
              removeClosureDay={removeClosureDay}
              showClosureModal={setShowClosureModal}
              goToPreviousWeek={goToPreviousWeek}
              goToNextWeek={goToNextWeek}
              goToCurrentWeek={goToCurrentWeek}
              formatWeekRange={formatWeekRange}
              newClosure={newClosure}
              setNewClosure={setNewClosure}
            />
          </TabsContent>

          <TabsContent value="staff" className="mt-6">
            <StaffPlanningPanel
              store={store}
              onUpdateStore={onUpdateStore}
            />
          </TabsContent>
        </Tabs>

        {/* Modal Chiusure */}
        {showClosureModal && (
          <ClosureModal
            store={store}
            onClose={() => setShowClosureModal(false)}
            onAddClosure={addClosureDay}
            currentWeek={currentWeek}
          />
        )}

        {/* Modal Storico */}
        {showHistoryModal && (
          <HistoryModal
            store={store}
            onClose={() => setShowHistoryModal(false)}
            currentWeek={currentWeek}
            setCurrentWeek={(week) => {
              setCurrentWeek(week);
              loadWeekSchedule(week);
              setShowHistoryModal(false);
            }}
            formatWeekRange={formatWeekRange}
          />
        )}
      </div>
    );
  }

  // Form semplice per nuovo negozio
  return (
    <HoursForm
      formData={formData}
      setFormData={setFormData}
      openingHours={openingHours}
      updateDayHours={updateDayHours}
      errors={errors}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isEditing={false}
    />
  );
};

// Nuovo componente per gestione orari settimanali
interface WeeklyHoursFormProps {
  store: Store;
  formData: { name: string; isActive: boolean };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; isActive: boolean }>>;
  openingHours: Record<string, { open: string; close: string }>;
  updateDayHours: (day: string, field: 'open' | 'close', value: string) => void;
  errors: Record<string, string>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  currentWeek: Date;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  saveWeeklySchedule: () => void;
  hasUnsavedChanges: boolean;
  weekNotes: string;
  setWeekNotes: (notes: string) => void;
  showHistoryModal: () => void;
  formatWeekRange: (start: Date, end: Date) => string;
  isCurrentWeek: boolean;
}

const WeeklyHoursForm: React.FC<WeeklyHoursFormProps> = ({
  store,
  formData,
  setFormData,
  openingHours,
  updateDayHours,
  errors,
  onSubmit,
  onCancel,
  currentWeek,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
  saveWeeklySchedule,
  hasUnsavedChanges,
  weekNotes,
  setWeekNotes,
  showHistoryModal,
  formatWeekRange,
  isCurrentWeek
}) => {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  
  const weekEnd = addDays(currentWeek, 6);
  const totalSchedules = store.weeklySchedules?.length || 0;
  
  const handleDuplicate = (fromDay: string) => {
    const sourceHours = openingHours[fromDay];
    if (!sourceHours) return;
    
    // Mostra notifica di conferma
    const sourceDayLabel = DAY_LABELS[fromDay as keyof typeof DAY_LABELS];
    setTimeout(() => {
      alert(`✅ Orari di ${sourceDayLabel} (${sourceHours.open}-${sourceHours.close}) duplicati con successo su tutti i giorni!`);
    }, 100);
    
    DAYS_OF_WEEK.forEach(day => {
      if (day !== fromDay) {
        updateDayHours(day, 'open', sourceHours.open);
        updateDayHours(day, 'close', sourceHours.close);
      }
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header con navigazione settimane */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-medium text-blue-900">
                Gestione Orari Settimanali
              </h3>
              <p className="text-sm text-blue-700">
                Configura orari specifici per ogni settimana
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              icon={History}
              onClick={showHistoryModal}
              disabled={totalSchedules === 0}
            >
              Storico ({totalSchedules})
            </Button>
          </div>
        </div>
        
        {/* Navigazione settimana */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              icon={ChevronLeft}
              onClick={goToPreviousWeek}
            />
            <div className="text-center min-w-[200px]">
              <div className="font-medium text-gray-900">
                {formatWeekRange(currentWeek, weekEnd)}
              </div>
              <div className="text-sm text-gray-600">
                {isCurrentWeek ? 'Settimana Corrente' : 'Settimana Personalizzata'}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              icon={ChevronRight}
              onClick={goToNextWeek}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              icon={Calendar}
              onClick={goToCurrentWeek}
            >
              Oggi
            </Button>
            
            {hasUnsavedChanges && (
              <Button
                size="sm"
                variant="success"
                onClick={saveWeeklySchedule}
                className="bg-green-600 hover:bg-green-700"
              >
                Salva Settimana
              </Button>
            )}
          </div>
        </div>
        
        {hasUnsavedChanges && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Modifiche non salvate per questa settimana
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Form dati base negozio */}
      <form onSubmit={onSubmit} className="space-y-6">
      <Input
        label="Nome Negozio"
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        required
        error={errors.name}
        placeholder="Negozio Principale"
      />

        <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Orari di Apertura</h3>
            <div className="flex space-x-2">
              <Button
            type="button"
            size="sm"
            variant="outline"
            icon={Copy}
                onClick={() => setShowDuplicateModal(true)}
          >
            Duplica orari
          </Button>
            </div>
        </div>
        
        <div className="space-y-3">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">
                {DAY_LABELS[day as keyof typeof DAY_LABELS]}
              </label>
              <Input
                label="Apertura"
                type="time"
                value={openingHours[day]?.open || '09:00'}
                onChange={(value) => updateDayHours(day, 'open', value)}
              />
              <Input
                label="Chiusura"
                type="time"
                value={openingHours[day]?.close || '18:00'}
                onChange={(value) => updateDayHours(day, 'close', value)}
              />
              {errors[`${day}_hours`] && (
                <p className="text-sm text-red-600 col-span-4">{errors[`${day}_hours`]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
        
        {/* Note settimanali */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Note per questa settimana (opzionale)
          </label>
          <textarea
            value={weekNotes}
            onChange={(e) => setWeekNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="es. Orari festivi, chiusure straordinarie, eventi speciali..."
          />
        </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
          Negozio Attivo
        </label>
      </div>

        <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
          <Button type="submit">
            Aggiorna Negozio
        </Button>
      </div>
      </form>
      
      {/* Modal duplica orari */}
      {showDuplicateModal && (
        <DayToDuplicateModal 
          onClose={() => setShowDuplicateModal(false)} 
          onDuplicate={handleDuplicate} 
        />
      )}
    </div>
  );
};

// Componente form per gestione chiusure
interface ClosuresFormProps {
  store: Store;
  currentWeek: Date;
  weekClosures: ClosureDay[];
  addClosureDay: () => void;
  removeClosureDay: (closureId: string) => void;
  showClosureModal: React.Dispatch<React.SetStateAction<boolean>>;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  formatWeekRange: (start: Date, end: Date) => string;
  newClosure: any;
  setNewClosure: React.Dispatch<React.SetStateAction<any>>;
}

const ClosuresForm: React.FC<ClosuresFormProps> = ({
  store,
  currentWeek,
  weekClosures,
  addClosureDay,
  removeClosureDay,
  showClosureModal,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
  formatWeekRange,
  newClosure,
  setNewClosure
}) => {
  const weekEnd = addDays(currentWeek, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const [showAddModal, setShowAddModal] = useState(false);
  
  return (
    <div className="space-y-6">
      {/* Header con navigazione */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CalendarX className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900">
                Giorni di Chiusura Straordinaria
              </h3>
              <p className="text-sm text-red-700">
                Gestisci chiusure temporanee e orari speciali
              </p>
            </div>
          </div>
          
          <Button
            icon={Plus}
            onClick={() => setShowAddModal(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            Aggiungi Chiusura
          </Button>
        </div>
        
        {/* Navigazione settimana */}
        <div className="flex items-center justify-center space-x-4">
          <Button
            size="sm"
            variant="outline"
            icon={ChevronLeft}
            onClick={goToPreviousWeek}
          />
          <div className="text-center">
            <div className="font-medium text-gray-900">
              {formatWeekRange(currentWeek, weekEnd)}
            </div>
            <div className="text-sm text-gray-600">
              {weekClosures.length} chiusure programmate
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon={ChevronRight}
            onClick={goToNextWeek}
          />
          <Button
            size="sm"
            variant="outline"
            icon={Calendar}
            onClick={goToCurrentWeek}
          >
            Oggi
          </Button>
        </div>
      </div>
      
      {/* Calendario settimana con chiusure */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">Calendario Chiusure</h4>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(date => {
              const dayClosures = weekClosures.filter(closure => 
                closure.date.toDateString() === date.toDateString()
              );
              const hasClosures = dayClosures.length > 0;
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={date.toISOString()}
                  className={`p-3 border rounded-lg text-center min-h-[100px] ${
                    hasClosures ? 'bg-red-50 border-red-200' : 
                    isToday ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm">
                    {date.toLocaleDateString('it-IT', { weekday: 'short' })}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {date.getDate()}/{date.getMonth() + 1}
                  </div>
                  
                  {hasClosures ? (
                    <div className="space-y-2">
                      {dayClosures.map(closure => (
                        <div key={closure.id} className="bg-white rounded p-2 border border-red-300">
                          <div className="text-xs font-medium text-red-800 mb-1">
                            {closure.isFullDay ? 'Chiuso' : 'Orari Ridotti'}
                          </div>
                          <div className="text-xs text-red-600 mb-1">
                            {closure.reason}
                          </div>
                          {!closure.isFullDay && closure.customHours && (
                            <div className="text-xs text-gray-600">
                              {closure.customHours.open}-{closure.customHours.close}
                            </div>
                          )}
                          <button
                            onClick={() => removeClosureDay(closure.id)}
                            className="text-red-500 hover:text-red-700 mt-1"
                            title="Rimuovi chiusura"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      Aperto normalmente
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Modal Aggiungi Chiusura */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Aggiungi Giorno di Chiusura</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  value={newClosure.date}
                  onChange={(e) => setNewClosure(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo *
                </label>
                <select
                  value={newClosure.reason}
                  onChange={(e) => setNewClosure(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleziona motivo...</option>
                  <option value="Festività Nazionale">Festività Nazionale</option>
                  <option value="Festività Locale">Festività Locale</option>
                  <option value="Manutenzione Straordinaria">Manutenzione Straordinaria</option>
                  <option value="Evento Aziendale">Evento Aziendale</option>
                  <option value="Formazione Staff">Formazione Staff</option>
                  <option value="Inventario">Inventario</option>
                  <option value="Motivi Personali">Motivi Personali</option>
                  <option value="Emergenza">Emergenza</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="fullDay"
                    name="closureType"
                    checked={newClosure.isFullDay}
                    onChange={() => setNewClosure(prev => ({ ...prev, isFullDay: true }))}
                    className="h-4 w-4 text-red-600"
                  />
                  <label htmlFor="fullDay" className="text-sm font-medium text-gray-700">
                    Chiusura completa (tutto il giorno)
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="partialDay"
                    name="closureType"
                    checked={!newClosure.isFullDay}
                    onChange={() => setNewClosure(prev => ({ ...prev, isFullDay: false }))}
                    className="h-4 w-4 text-red-600"
                  />
                  <label htmlFor="partialDay" className="text-sm font-medium text-gray-700">
                    Orari modificati
                  </label>
                </div>
                
                {!newClosure.isFullDay && (
                  <div className="ml-6 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apertura
                      </label>
                      <input
                        type="time"
                        value={newClosure.customOpen}
                        onChange={(e) => setNewClosure(prev => ({ ...prev, customOpen: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Chiusura
                      </label>
                      <input
                        type="time"
                        value={newClosure.customClose}
                        onChange={(e) => setNewClosure(prev => ({ ...prev, customClose: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note aggiuntive (opzionale)
                </label>
                <textarea
                  value={newClosure.notes}
                  onChange={(e) => setNewClosure(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dettagli aggiuntivi sulla chiusura..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Annulla
              </Button>
              <Button
                onClick={addClosureDay}
                className="bg-red-600 hover:bg-red-700"
                disabled={!newClosure.date || !newClosure.reason}
              >
                Aggiungi Chiusura
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Lista chiusure della settimana */}
      {weekClosures.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Dettaglio Chiusure Settimana</h4>
          </div>
          
          <div className="p-4 space-y-3">
            {weekClosures.map(closure => (
              <div key={closure.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-red-900">
                    {closure.date.toLocaleDateString('it-IT', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </div>
                  <div className="text-sm text-red-700 mt-1">
                    <strong>{closure.reason}</strong>
                    {closure.isFullDay ? ' (Chiuso tutto il giorno)' : ' (Orari modificati)'}
                  </div>
                  {!closure.isFullDay && closure.customHours && (
                    <div className="text-sm text-gray-600 mt-1">
                      Orari speciali: {closure.customHours.open} - {closure.customHours.close}
                    </div>
                  )}
                  {closure.notes && (
                    <div className="text-sm text-gray-600 mt-1 italic">
                      Note: {closure.notes}
                    </div>
                  )}
                </div>
                
                <Button
                  size="sm"
                  variant="danger"
                  icon={X}
                  onClick={() => removeClosureDay(closure.id)}
                >
                  Rimuovi
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente form per orari semplici (per nuovi negozi)
interface HoursFormProps {
  formData: { name: string; isActive: boolean };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; isActive: boolean }>>;
  openingHours: Record<string, { open: string; close: string }>;
  updateDayHours: (day: string, field: 'open' | 'close', value: string) => void;
  errors: Record<string, string>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
}

const HoursForm: React.FC<HoursFormProps> = ({
  formData,
  setFormData,
  openingHours,
  updateDayHours,
  errors,
  onSubmit,
  onCancel,
  isEditing
}) => {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  
  const handleDuplicate = (fromDay: string) => {
    const sourceHours = openingHours[fromDay];
    if (!sourceHours) return;
    
    const sourceDayLabel = DAY_LABELS[fromDay as keyof typeof DAY_LABELS];
    setTimeout(() => {
      alert(`✅ Orari di ${sourceDayLabel} (${sourceHours.open}-${sourceHours.close}) duplicati con successo su tutti i giorni!`);
    }, 100);
    
    DAYS_OF_WEEK.forEach(day => {
      if (day !== fromDay) {
        updateDayHours(day, 'open', sourceHours.open);
        updateDayHours(day, 'close', sourceHours.close);
      }
    });
  };
  
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Input
        label="Nome Negozio"
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        required
        error={errors.name}
        placeholder="Negozio Principale"
      />
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Orari di Apertura</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={Copy}
            onClick={() => setShowDuplicateModal(true)}
          >
            Duplica orari
          </Button>
        </div>
        <div className="space-y-3">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="grid grid-cols-4 gap-4 items-center">
              <label className="text-sm font-medium text-gray-700">
                {DAY_LABELS[day as keyof typeof DAY_LABELS]}
              </label>
              <Input
                label="Apertura"
                type="time"
                value={openingHours[day]?.open || '09:00'}
                onChange={(value) => updateDayHours(day, 'open', value)}
              />
              <Input
                label="Chiusura"
                type="time"
                value={openingHours[day]?.close || '18:00'}
                onChange={(value) => updateDayHours(day, 'close', value)}
              />
              {errors[`${day}_hours`] && (
                <p className="text-sm text-red-600 col-span-4">{errors[`${day}_hours`]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
          Negozio Attivo
        </label>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit">
          {isEditing ? 'Aggiorna' : 'Crea'} Negozio
        </Button>
      </div>
      
      {showDuplicateModal && (
        <DayToDuplicateModal 
          onClose={() => setShowDuplicateModal(false)} 
          onDuplicate={handleDuplicate} 
        />
      )}
    </form>
  );
};

// Modal per duplicazione orari
interface DayToDuplicateModalProps {
  onClose: () => void;
  onDuplicate: (fromDay: string) => void;
}

const DayToDuplicateModal: React.FC<DayToDuplicateModalProps> = ({ onClose, onDuplicate }) => {
  const [selectedDay, setSelectedDay] = useState(DAYS_OF_WEEK[0]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 w-80 max-w-full relative">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-medium text-gray-900">Duplica orari</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleziona il giorno da copiare:
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>
                {DAY_LABELS[day as keyof typeof DAY_LABELS]}
              </option>
            ))}
          </select>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-md mb-4">
          <div className="flex items-center">
            <Info className="w-4 h-4 text-blue-500 mr-2" />
            <p className="text-xs text-blue-700">
              Gli orari del giorno selezionato verranno copiati su tutti gli altri giorni della settimana.
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" onClick={onClose}>Annulla</Button>
          <Button size="sm" onClick={() => {
            onDuplicate(selectedDay);
            onClose();
          }}>Applica a tutti i giorni</Button>
        </div>
      </div>
    </div>
  );
};

// Modal per visualizzare storico orari
interface HistoryModalProps {
  store: Store;
  onClose: () => void;
  currentWeek: Date;
  setCurrentWeek: (week: Date) => void;
  formatWeekRange: (start: Date, end: Date) => string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  store,
  onClose,
  currentWeek,
  setCurrentWeek,
  formatWeekRange
}) => {
  const [selectedSchedule, setSelectedSchedule] = useState<WeeklyStoreSchedule | null>(null);
  
  const weeklySchedules = (store.weeklySchedules || [])
    .filter(schedule => schedule.isActive)
    .sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime());
  
  const handleLoadSchedule = (schedule: WeeklyStoreSchedule) => {
    setCurrentWeek(new Date(schedule.weekStartDate));
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-xl font-medium text-gray-900">Storico Orari - {store.name}</h3>
              <p className="text-sm text-gray-600">Visualizza e carica orari delle settimane precedenti</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {weeklySchedules.length > 0 ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {weeklySchedules.map(schedule => {
              const weekEnd = addDays(schedule.weekStartDate, 6);
              const isCurrentWeek = schedule.weekStartDate.toDateString() === currentWeek.toDateString();
              
              const openDays = Object.values(schedule.openingHours).filter(hours => hours).length;
              const totalHours = Object.values(schedule.openingHours).reduce((sum, hours) => {
                if (!hours) return sum;
                const [openHour, openMin] = hours.open.split(':').map(Number);
                const [closeHour, closeMin] = hours.close.split(':').map(Number);
                const dailyHours = (closeHour * 60 + closeMin - openHour * 60 - openMin) / 60;
                return sum + dailyHours;
              }, 0);
              
              return (
                <div
                  key={schedule.id}
                  className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                    isCurrentWeek 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedSchedule(selectedSchedule?.id === schedule.id ? null : schedule)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium text-gray-900">
                          {formatWeekRange(schedule.weekStartDate, weekEnd)}
                        </div>
                        {isCurrentWeek && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                            Settimana Corrente
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        <span>{openDays}/7 giorni aperti</span>
                        <span>{totalHours.toFixed(1)}h totali</span>
                        <span>Creato: {schedule.createdAt.toLocaleDateString('it-IT')}</span>
                      </div>
                      
                      {schedule.notes && (
                        <div className="mt-2 text-sm text-gray-500 italic">
                          "{schedule.notes}"
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {!isCurrentWeek && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSchedule(schedule);
                          }}
                        >
                          Carica Orari
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        icon={selectedSchedule?.id === schedule.id ? ChevronLeft : Eye}
                      >
                        {selectedSchedule?.id === schedule.id ? 'Chiudi' : 'Dettagli'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Dettagli espansi */}
                  {selectedSchedule?.id === schedule.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-7 gap-2">
                        {DAYS_OF_WEEK.map(day => {
                          const hours = schedule.openingHours[day];
                          return (
                            <div key={day} className="text-center bg-white rounded p-2 border">
                              <div className="text-xs font-medium text-gray-700 mb-1">
                                {DAY_LABELS[day as keyof typeof DAY_LABELS].slice(0, 3)}
                              </div>
                              <div className="text-xs text-gray-600">
                                {hours ? `${hours.open}-${hours.close}` : 'Chiuso'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Nessuno Storico</h4>
            <p className="text-gray-500">
              Non sono ancora stati salvati orari personalizzati per settimane specifiche.
            </p>
          </div>
        )}
        
        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
          <Button onClick={onClose}>Chiudi</Button>
        </div>
      </div>
    </div>
  );
};