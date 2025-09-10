import React, { useState, useMemo } from 'react';
import { Store, StaffRole, CalculatedStaffNeed } from '../../types';
import { Button } from '../common/Button';
import { ChevronLeft, ChevronRight, Users, TrendingUp, TrendingDown } from 'lucide-react';

interface StaffCalendarViewProps {
  store: Store;
  calculateStaffNeeds: (storeId: string, date: Date) => CalculatedStaffNeed | null;
  staffRoles: StaffRole[];
}

export const StaffCalendarView: React.FC<StaffCalendarViewProps> = ({
  store,
  calculateStaffNeeds,
  staffRoles
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const roleMap = new Map(staffRoles.map(role => [role.id, role]));

  // Genera giorni del mese corrente
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days: Date[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      // Crea data a mezzogiorno per evitare problemi timezone
      const day = new Date(year, month, i, 12, 0, 0, 0);
      days.push(day);
    }
    
    console.log(`📅 Generated ${days.length} days for ${month + 1}/${year}`);
    return days;
  }, [currentDate]);

  // Calcola requisiti per tutti i giorni del mese
  const monthStaffNeeds = useMemo(() => {
    console.log(`🔄 Calculating staff needs for ${monthDays.length} days...`);
    
    const needs = monthDays.map(date => ({
      date,
      staffNeed: calculateStaffNeeds(store.id, date)
    }));
    
    const daysWithEvents = needs.filter(day => day.staffNeed?.appliedEvents.length > 0);
    console.log(`📊 Days with events: ${daysWithEvents.length}/${needs.length}`);
    
    return needs;
  }, [monthDays, store.id, calculateStaffNeeds]);

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const getIntensityColor = (multiplier: number) => {
    if (multiplier > 1.5) return 'bg-red-100 border-red-300 text-red-800';
    if (multiplier > 1.2) return 'bg-orange-100 border-orange-300 text-orange-800';
    if (multiplier > 1.0) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    if (multiplier < 0.8) return 'bg-green-100 border-green-300 text-green-800';
    if (multiplier < 1.0) return 'bg-blue-100 border-blue-300 text-blue-800';
    return 'bg-gray-100 border-gray-300 text-gray-800';
  };

  const getTotalStaff = (staffNeed: CalculatedStaffNeed | null) => {
    if (!staffNeed) return { min: 0, max: 0, weightedMin: 0, weightedMax: 0 };
    
    return staffNeed.calculatedStaff.reduce((acc, role) => ({
      min: acc.min + role.baseMin,
      max: acc.max + role.baseMax,
      weightedMin: acc.weightedMin + role.weightedMin,
      weightedMax: acc.weightedMax + role.weightedMax
    }), { min: 0, max: 0, weightedMin: 0, weightedMax: 0 });
  };

  const selectedStaffNeed = selectedDate 
    ? monthStaffNeeds.find(item => item.date.toDateString() === selectedDate.toDateString())?.staffNeed
    : null;

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h4 className="text-lg font-medium text-gray-900">
            {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          </h4>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              icon={ChevronLeft}
              onClick={goToPreviousMonth}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={goToCurrentMonth}
            >
              Oggi
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={ChevronRight}
              onClick={goToNextMonth}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Ridotto</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
            <span>Standard</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Aumentato</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Intenso</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Days of week headers */}
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {monthStaffNeeds.map(({ date, staffNeed }) => {
          const isSelected = selectedDate?.toDateString() === date.toDateString();
          const isToday = date.toDateString() === new Date().toDateString();
          const totalStaff = getTotalStaff(staffNeed);
          const multiplier = staffNeed?.finalMultiplier || 1;

          return (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(isSelected ? null : date)}
              className={`p-3 min-h-[80px] border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              } ${isToday ? 'border-blue-500' : 'border-gray-200'} ${
                staffNeed ? getIntensityColor(multiplier) : 'bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                  {date.getDate()}
                </span>
                {multiplier !== 1 && (
                  <span className="text-xs font-bold">
                    {multiplier}x
                  </span>
                )}
              </div>

              {staffNeed ? (
                <div className="space-y-1">
                  <div className="text-xs">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{totalStaff.weightedMin}-{totalStaff.weightedMax}</span>
                    </div>
                  </div>
                  
                  {multiplier !== 1 && (
                    <div className="flex items-center space-x-1 text-xs">
                      {multiplier > 1 ? (
                        <TrendingUp className="w-3 h-3 text-red-500" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-green-500" />
                      )}
                      <span className="text-gray-600">
                        da {totalStaff.min}-{totalStaff.max}
                      </span>
                    </div>
                  )}

                  {staffNeed.appliedEvents.length > 0 && (
                    <div className="text-xs text-gray-500 truncate">
                      {staffNeed.appliedEvents[0].name}
                      {staffNeed.appliedEvents.length > 1 && ` +${staffNeed.appliedEvents.length - 1}`}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  Non configurato
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && selectedStaffNeed && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h5 className="text-lg font-medium text-gray-900 mb-4">
            Dettagli per {selectedDate.toLocaleDateString('it-IT', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </h5>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Staff Requirements */}
            <div>
              <h6 className="font-medium text-gray-900 mb-3">Requisiti Personale</h6>
              <div className="space-y-2">
                {selectedStaffNeed.calculatedStaff.map(role => {
                  const roleInfo = roleMap.get(role.roleId);
                  return (
                    <div key={role.roleId} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span className="font-medium">{roleInfo?.name || 'Ruolo Sconosciuto'}</span>
                      <div className="text-sm space-x-2">
                        <span className="text-gray-500">
                          Base: {role.baseMin}-{role.baseMax}
                        </span>
                        <span className="font-medium text-blue-600">
                          → {role.weightedMin}-{role.weightedMax}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Applied Events */}
            <div>
              <h6 className="font-medium text-gray-900 mb-3">Eventi Applicati</h6>
              {selectedStaffNeed.appliedEvents.length > 0 ? (
                <div className="space-y-2">
                  {selectedStaffNeed.appliedEvents.map(event => (
                    <div key={event.id} className="p-3 bg-blue-50 rounded">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{event.name}</span>
                        <span className="text-sm font-bold text-blue-600">
                          {event.multiplier}x
                        </span>
                      </div>
                      {event.description && (
                        <div className="text-sm text-gray-600 mt-1">
                          {event.description}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Moltiplicatore Finale:</span>
                      <span className="text-lg font-bold text-yellow-700">
                        {selectedStaffNeed.finalMultiplier.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  Nessun evento di ponderazione applicato per questo giorno
                </div>
              )}
            </div>
          </div>

          {selectedStaffNeed.baseRequirement.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <span className="font-medium text-gray-900">Note: </span>
              <span className="text-gray-600">{selectedStaffNeed.baseRequirement.notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};