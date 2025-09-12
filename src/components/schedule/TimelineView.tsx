import React, { useState, useMemo } from 'react';
import { WeeklySchedule, Preferences, TimelineEvent } from '../../types';
import { Button } from '../common/Button';
import { Calendar, Clock, Lock, Unlock, BarChart3, Grid } from 'lucide-react';
import { formatDate, getDayOfWeek } from '../../utils/timeUtils';

interface TimelineViewProps {
  schedule: WeeklySchedule & { preferences: Preferences };
  onToggleLock?: (shiftId: string) => void;
  onShiftClick?: (shiftId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  schedule,
  onToggleLock,
  onShiftClick
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week'>('week');

  const { weekStart, shifts, employees, store, preferences } = schedule;

  // Genera gli eventi timeline
  const timelineEvents = useMemo(() => {
    const employeeColors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];

    return shifts.map((shift, index) => {
      const employee = employees.find(emp => emp.id === shift.employeeId);
      
      return {
        id: shift.id,
        employeeId: shift.employeeId,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Sconosciuto',
        startTime: shift.startTime,
        endTime: shift.endTime,
        duration: shift.actualHours,
        isLocked: shift.isLocked,
        status: shift.status,
        color: employeeColors[employees.findIndex(emp => emp.id === shift.employeeId) % employeeColors.length],
        date: shift.date
      } as TimelineEvent & { date: Date };
    });
  }, [shifts, employees]);

  // Ore di lavoro (6:00 - 24:00)
  const workingHours = Array.from({ length: 18 }, (_, i) => i + 6);

  // Giorni della settimana
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const getTimePosition = (time: string): number => {
    const [hour, minute] = time.split(':').map(Number);
    return ((hour - 6) * 60 + minute) / (18 * 60) * 100;
  };

  const getEventWidth = (startTime: string, endTime: string): number => {
    const startPos = getTimePosition(startTime);
    const endPos = getTimePosition(endTime);
    return endPos - startPos;
  };

  const filteredEvents = selectedDate 
    ? timelineEvents.filter(event => 
        event.date.toDateString() === selectedDate.toDateString()
      )
    : timelineEvents;

  const getStatusColor = (status: string, baseColor: string) => {
    switch (status) {
      case 'confirmed': return baseColor;
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return `${baseColor}80`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header Controls */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Timeline Turni</h3>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={zoomLevel === 'week' ? 'primary' : 'outline'}
                onClick={() => setZoomLevel('week')}
                icon={Calendar}
              >
                Settimana
              </Button>
              <Button
                size="sm"
                variant={zoomLevel === 'day' ? 'primary' : 'outline'}
                onClick={() => setZoomLevel('day')}
                icon={Clock}
              >
                Giorno
              </Button>
            </div>
          </div>

          {zoomLevel === 'day' && (
            <div className="flex flex-wrap gap-2">
              {weekDays.map(date => (
                <Button
                  key={date.toISOString()}
                  size="sm"
                  variant={selectedDate?.toDateString() === date.toDateString() ? 'primary' : 'outline'}
                  onClick={() => setSelectedDate(
                    selectedDate?.toDateString() === date.toDateString() ? null : date
                  )}
                >
                  {formatDate(date)}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Legenda */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Programmato</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">Completato</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">Annullato</span>
          </div>
          <div className="flex items-center space-x-2">
            <Lock className="w-3 h-3 text-yellow-600" />
            <span className="text-gray-600">Bloccato</span>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="p-6">
        <div className="relative">
          {/* Time Headers */}
          <div className="flex mb-4">
            <div className="w-32 flex-shrink-0"></div>
            <div className="flex-1 flex">
              {workingHours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-gray-500 border-l border-gray-200">
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="space-y-1">
            {zoomLevel === 'week' ? (
              // Vista settimanale - raggruppata per giorno
              weekDays.map(date => {
                const dayEvents = timelineEvents.filter(event => 
                  event.date.toDateString() === date.toDateString()
                );
                const storeHours = store.openingHours?.[getDayOfWeek(date)];

                return (
                  <div key={date.toISOString()} className="relative">
                    <div className="flex items-center min-h-[60px] hover:bg-gray-50 rounded-lg">
                      <div className="w-32 flex-shrink-0 px-3 py-2">
                        <div className="font-medium text-gray-900">{formatDate(date)}</div>
                        <div className="text-xs text-gray-500">
                          {storeHours ? `${storeHours.open} - ${storeHours.close}` : 'Chiuso'}
                        </div>
                      </div>
                      
                     <div className="flex-1 relative h-auto min-h-[100px] border border-gray-200 rounded bg-gray-50">
                        {/* Orari negozio background */}
                        {storeHours && (
                          <div
                            className="absolute top-0 bottom-0 bg-blue-50 border-l-2 border-r-2 border-blue-200"
                            style={{
                              left: `${getTimePosition(storeHours.open)}%`,
                              width: `${getEventWidth(storeHours.open, storeHours.close)}%`
                            }}
                          />
                        )}

                        {/* Eventi turni */}
                        {dayEvents.map((event, eventIndex) => (
                          <div
                            key={event.id}
                            className="absolute rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
                            style={{
                              left: `${getTimePosition(event.startTime)}%`,
                              width: `${getEventWidth(event.startTime, event.endTime)}%`,
                              backgroundColor: getStatusColor(event.status, event.color),
                             top: `${3 + (eventIndex * 22)}px`,
                             height: '18px',
                              zIndex: eventIndex + 1
                            }}
                            onClick={() => onShiftClick?.(event.id)}
                          >
                            <div className="h-full flex items-center justify-between px-2 text-white text-xs font-medium">
                              <span className="truncate">
                                {event.employeeName.split(' ')[0]}
                              </span>
                              <div className="flex items-center space-x-1">
                                <span>{event.startTime}-{event.endTime}</span>
                                {event.isLocked && <Lock className="w-3 h-3" />}
                              </div>
                            </div>
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                              {event.employeeName} • {event.startTime}-{event.endTime} • {event.duration.toFixed(1)}h
                              {event.isLocked && ' • Bloccato'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // Vista giornaliera - raggruppata per dipendente
              employees.filter(emp => emp.isActive).map(employee => {
                const employeeEvents = filteredEvents.filter(event => 
                  event.employeeId === employee.id
                );

                return (
                  <div key={employee.id} className="relative">
                    <div className="flex items-center min-h-[50px] hover:bg-gray-50 rounded-lg">
                      <div className="w-32 flex-shrink-0 px-3 py-2">
                        <div className="font-medium text-gray-900 text-sm">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {employee.contractHours}h contratto
                        </div>
                      </div>
                      
                      <div className="flex-1 relative h-10 border border-gray-200 rounded bg-gray-50">
                        {/* Grid oraria */}
                        {workingHours.map(hour => (
                          <div
                            key={hour}
                            className="absolute top-0 bottom-0 border-l border-gray-200"
                            style={{ left: `${((hour - 6) / 18) * 100}%` }}
                          />
                        ))}

                        {/* Eventi turni dipendente */}
                        {employeeEvents.map((event, eventIndex) => (
                          <div
                            key={event.id}
                            className="absolute rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
                            style={{
                              left: `${getTimePosition(event.startTime)}%`,
                              width: `${getEventWidth(event.startTime, event.endTime)}%`,
                             backgroundColor: getStatusColor(event.status, event.color),
                             top: `${4 + (eventIndex * 22)}px`, 
                             height: '18px'
                            }}
                            onClick={() => onShiftClick?.(event.id)}
                          >
                            <div className="h-full flex items-center justify-between px-2 text-white text-xs font-medium">
                              <span>{event.startTime}</span>
                              <div className="flex items-center space-x-1">
                                <span>{event.endTime}</span>
                                {event.isLocked && <Lock className="w-3 h-3" />}
                              </div>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                              {event.startTime}-{event.endTime} • {event.duration.toFixed(1)}h
                              {event.isLocked && ' • Bloccato'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Turni Totali:</span>
            <span className="ml-2 font-medium">{filteredEvents.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Turni Bloccati:</span>
            <span className="ml-2 font-medium">{filteredEvents.filter(e => e.isLocked).length}</span>
          </div>
          <div>
            <span className="text-gray-500">Ore Totali:</span>
            <span className="ml-2 font-medium">
              {filteredEvents.reduce((sum, e) => sum + e.duration, 0).toFixed(1)}h
            </span>
          </div>
          <div>
            <span className="text-gray-500">Dipendenti Attivi:</span>
            <span className="ml-2 font-medium">
              {new Set(filteredEvents.map(e => e.employeeId)).size}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};