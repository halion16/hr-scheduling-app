import React, { useState } from 'react';
import { Employee, Store } from '../../types';
import { ShiftAssignment, ShiftType } from '../../types/rotation';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User, 
  Clock,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Eye,
  Store as StoreIcon,
  MapPin
} from 'lucide-react';
import { addDays, formatDate, getDayOfWeek, timeToDateObject } from '../../utils/timeUtils';

interface RotationCalendarProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  shiftTypes: ShiftType[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onEmployeeSelect: (employee: Employee | null) => void;
  selectedStore?: Store; // Nuovo prop per il negozio selezionato
}

// Move timeToMinutes function to the top to avoid hoisting issues
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const RotationCalendar: React.FC<RotationCalendarProps> = ({
  employees,
  assignments,
  shiftTypes,
  currentWeek,
  onWeekChange,
  onEmployeeSelect,
  selectedStore
}) => {
  const [selectedAssignment, setSelectedAssignment] = useState<ShiftAssignment | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const weekEnd = addDays(currentWeek, 6);

  const goToPreviousWeek = () => {
    onWeekChange(addDays(currentWeek, -7));
  };

  const goToNextWeek = () => {
    onWeekChange(addDays(currentWeek, 7));
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lunedì
    onWeekChange(startOfWeek);
  };

  const getAssignmentsForDay = (date: Date) => {
    return assignments.filter(assignment =>
      assignment.date.toDateString() === date.toDateString()
    );
  };

  const getEmployeeAssignmentForDay = (employeeId: string, date: Date) => {
    return assignments.find(assignment =>
      assignment.employeeId === employeeId &&
      assignment.date.toDateString() === date.toDateString()
    );
  };

  // Ottieni orari del negozio per un giorno specifico
  const getStoreHoursForDay = (date: Date) => {
    if (!selectedStore) return null;
    const dayOfWeek = getDayOfWeek(date);
    return selectedStore.openingHours[dayOfWeek] || null;
  };

  // Verifica se un turno è compatibile con gli orari del negozio
  const isShiftCompatibleWithStore = (assignment: ShiftAssignment, date: Date): boolean => {
    const storeHours = getStoreHoursForDay(date);
    if (!storeHours) return false; // Negozio chiuso

    const shiftStart = timeToMinutes(assignment.shiftType.startTime);
    const shiftEnd = timeToMinutes(assignment.shiftType.endTime);
    const storeOpen = timeToMinutes(storeHours.open);
    const storeClose = timeToMinutes(storeHours.close);

    // Verifica sovrapposizione significativa (almeno 2 ore)
    const overlapStart = Math.max(shiftStart, storeOpen);
    const overlapEnd = Math.min(shiftEnd, storeClose);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    return overlapDuration >= 120; // Almeno 2 ore di sovrapposizione
  };


  const getShiftTypeColor = (category: ShiftType['category']) => {
    const colors = {
      morning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      afternoon: 'bg-blue-100 text-blue-800 border-blue-200',
      evening: 'bg-purple-100 text-purple-800 border-purple-200',
      night: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: ShiftAssignment['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'requested_change':
        return <AlertTriangle className="h-3 w-3 text-yellow-600" />;
      case 'substituted':
        return <RotateCcw className="h-3 w-3 text-blue-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header del calendario */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              onClick={goToPreviousWeek}
            />
            <div className="text-center min-w-[200px]">
              <div className="font-semibold text-gray-900">
                {currentWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - {weekEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div className="text-sm text-gray-500">
                Settimana {Math.ceil((currentWeek.getTime() - new Date(currentWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}
                {selectedStore && ` • ${selectedStore.name}`}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={ChevronRight}
              onClick={goToNextWeek}
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            icon={Calendar}
            onClick={goToCurrentWeek}
          >
            Oggi
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Griglia
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'timeline' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Vista Griglia */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              {/* Header giorni */}
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 min-w-[160px]">
                    Dipendente
                  </th>
                  {weekDays.map(date => {
                    const storeHours = getStoreHoursForDay(date);
                    const dayAssignments = getAssignmentsForDay(date);
                    
                    return (
                      <th key={date.toISOString()} className="px-3 py-3 text-center text-sm font-semibold text-gray-900 min-w-[140px] border-r border-gray-200">
                        <div className="space-y-1">
                          <div>{formatDate(date)}</div>
                          
                          {/* Orari negozio */}
                          {selectedStore && (
                            <div className={`text-xs px-2 py-1 rounded ${
                              storeHours 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {storeHours ? `${storeHours.open}-${storeHours.close}` : 'Chiuso'}
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500">
                            {dayAssignments.length} turni
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[100px]">
                    Totale
                  </th>
                </tr>
              </thead>

              {/* Righe dipendenti */}
              <tbody className="divide-y divide-gray-100">
                {employees.map((employee, index) => {
                  const weekAssignments = assignments.filter(a => a.employeeId === employee.id);
                  const totalHours = weekAssignments.reduce((sum, assignment) => {
                    const start = timeToDateObject(assignment.shiftType.startTime);
                    const end = timeToDateObject(assignment.shiftType.endTime);
                    return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  }, 0);

                  return (
                    <tr 
                      key={employee.id} 
                      className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                    >
                      {/* Colonna dipendente */}
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-200">
                        <button
                          onClick={() => onEmployeeSelect(employee)}
                          className="text-left hover:text-blue-600 transition-colors"
                        >
                          <div className="font-medium text-sm text-gray-900">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center space-x-1">
                            <span>{employee.contractHours}h contratto</span>
                            {employee.storeId && selectedStore && employee.storeId === selectedStore.id && (
                              <StoreIcon className="h-3 w-3 text-green-600" title="Assegnato a questo negozio" />
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Celle giorni */}
                      {weekDays.map(date => {
                        const assignment = getEmployeeAssignmentForDay(employee.id, date);
                        const storeHours = getStoreHoursForDay(date);
                        const isStoreOpen = !!storeHours;
                        const isCompatible = assignment ? isShiftCompatibleWithStore(assignment, date) : true;
                        
                        return (
                          <td key={`${employee.id}-${date.toISOString()}`} className="p-2 border-r border-gray-100">
                            {assignment ? (
                              <button
                                onClick={() => setSelectedAssignment(assignment)}
                                className={`w-full p-2 rounded-lg border text-left hover:shadow-md transition-all ${
                                  getShiftTypeColor(assignment.shiftType.category)
                                } ${
                                  !isCompatible ? 'ring-2 ring-red-400' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium">
                                    {assignment.shiftType.name}
                                  </span>
                                  <div className="flex items-center space-x-1">
                                    {getStatusIcon(assignment.status)}
                                    {!isCompatible && (
                                      <AlertTriangle className="h-3 w-3 text-red-600" title="Turno non compatibile con orari negozio" />
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs">
                                  {assignment.shiftType.startTime} - {assignment.shiftType.endTime}
                                </div>
                                <div className="text-xs mt-1 opacity-75">
                                  Score: {assignment.rotationScore}
                                </div>
                              </button>
                            ) : (
                              <div className={`w-full h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 ${
                                !isStoreOpen ? 'bg-red-50 border-red-200' : 'border-gray-200'
                              }`}>
                                <span className="text-xs">
                                  {!isStoreOpen ? 'Chiuso' : 'Libero'}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Colonna totale ore */}
                      <td className="px-4 py-3 text-center">
                        <div className="space-y-1">
                          <div className="text-lg font-bold text-gray-900">
                            {totalHours.toFixed(1)}h
                          </div>
                          <div className={`text-xs ${
                            totalHours > employee.contractHours ? 'text-red-600' :
                            totalHours < employee.fixedHours ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {totalHours > employee.contractHours ? 'Straordinario' :
                             totalHours < employee.fixedHours ? 'Sotto minimo' :
                             'Nei limiti'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista Timeline */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {weekDays.map(date => {
            const dayAssignments = getAssignmentsForDay(date);
            const storeHours = getStoreHoursForDay(date);
            const isStoreOpen = !!storeHours;
            
            return (
              <div key={date.toISOString()} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    
                    {/* Orari negozio */}
                    {selectedStore && (
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                        isStoreOpen 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <StoreIcon className="h-4 w-4" />
                        <span>
                          {isStoreOpen ? `${storeHours.open} - ${storeHours.close}` : 'Chiuso'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <span className="text-sm text-gray-500">
                    {dayAssignments.length} turni programmati
                  </span>
                </div>

                {dayAssignments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dayAssignments.map(assignment => {
                      const employee = employees.find(emp => emp.id === assignment.employeeId);
                      const isCompatible = isShiftCompatibleWithStore(assignment, date);
                      
                      return (
                        <button
                          key={assignment.id}
                          onClick={() => setSelectedAssignment(assignment)}
                          className={`p-3 rounded-lg border text-left hover:shadow-md transition-all ${
                            getShiftTypeColor(assignment.shiftType.category)
                          } ${
                            !isCompatible ? 'ring-2 ring-red-400' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">
                              {assignment.shiftType.name}
                            </span>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(assignment.status)}
                              {!isCompatible && (
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-sm">
                              {assignment.shiftType.startTime} - {assignment.shiftType.endTime}
                            </div>
                            <div className="text-sm font-medium">
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Dipendente sconosciuto'}
                            </div>
                            <div className="text-xs opacity-75">
                              Score rotazione: {assignment.rotationScore}
                            </div>
                            {!isCompatible && (
                              <div className="text-xs text-red-600 font-medium">
                                ⚠️ Non compatibile con orari negozio
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>
                      {!isStoreOpen 
                        ? 'Negozio chiuso - Nessun turno necessario' 
                        : 'Nessun turno programmato per questo giorno'
                      }
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal dettagli assignment */}
      {selectedAssignment && (
        <Modal
          isOpen={!!selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          title="Dettagli Turno"
          size="md"
        >
          <AssignmentDetailsModal
            assignment={selectedAssignment}
            employee={employees.find(emp => emp.id === selectedAssignment.employeeId)}
            selectedStore={selectedStore}
            onClose={() => setSelectedAssignment(null)}
          />
        </Modal>
      )}
    </div>
  );
};

// Componente per i dettagli dell'assignment - AGGIORNATO
interface AssignmentDetailsModalProps {
  assignment: ShiftAssignment;
  employee?: Employee;
  selectedStore?: Store;
  onClose: () => void;
}

const AssignmentDetailsModal: React.FC<AssignmentDetailsModalProps> = ({
  assignment,
  employee,
  selectedStore,
  onClose
}) => {
  // Safe duration calculation with error handling
  let duration = 0;
  try {
    const start = timeToDateObject(assignment.shiftType.startTime);
    const end = timeToDateObject(assignment.shiftType.endTime);
    if (start && end && start instanceof Date && end instanceof Date && 
        !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    } else {
      // Fallback calculation using time strings
      const startMinutes = timeToMinutes(assignment.shiftType.startTime);
      const endMinutes = timeToMinutes(assignment.shiftType.endTime);
      duration = (endMinutes - startMinutes) / 60;
    }
  } catch (error) {
    console.error('Error calculating shift duration:', error);
    // Fallback calculation
    const startMinutes = timeToMinutes(assignment.shiftType.startTime);
    const endMinutes = timeToMinutes(assignment.shiftType.endTime);
    duration = (endMinutes - startMinutes) / 60;
  }

  // Verifica compatibilità con orari negozio
  const storeCompatibility = selectedStore ? (() => {
    const dayOfWeek = getDayOfWeek(assignment.date);
    const storeHours = selectedStore.openingHours[dayOfWeek];
    
    if (!storeHours) {
      return { isCompatible: false, reason: 'Negozio chiuso in questo giorno' };
    }

    const shiftStart = timeToMinutes(assignment.shiftType.startTime);
    const shiftEnd = timeToMinutes(assignment.shiftType.endTime);
    const storeOpen = timeToMinutes(storeHours.open);
    const storeClose = timeToMinutes(storeHours.close);

    const overlapStart = Math.max(shiftStart, storeOpen);
    const overlapEnd = Math.min(shiftEnd, storeClose);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    if (overlapDuration < 120) {
      return { 
        isCompatible: false, 
        reason: `Sovrapposizione insufficiente con orari negozio (${Math.round(overlapDuration / 60 * 10) / 10}h < 2h richieste)` 
      };
    }

    return { 
      isCompatible: true, 
      reason: `Compatibile - Sovrapposizione di ${Math.round(overlapDuration / 60 * 10) / 10}h con orari negozio` 
    };
  })() : null;


  const statusLabels = {
    assigned: 'Assegnato',
    confirmed: 'Confermato',
    requested_change: 'Richiesta Modifica',
    substituted: 'Sostituito'
  };

  const statusColors = {
    assigned: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-green-100 text-green-800',
    requested_change: 'bg-yellow-100 text-yellow-800',
    substituted: 'bg-purple-100 text-purple-800'
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dipendente
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {employee ? `${employee.firstName} ${employee.lastName}` : 'Sconosciuto'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {assignment.date.toLocaleDateString('it-IT', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo Turno
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {assignment.shiftType.name}
          </div>
          <div className="text-sm text-gray-500">
            Categoria: {assignment.shiftType.category}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stato
          </label>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusColors[assignment.status]}`}>
            {statusLabels[assignment.status]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Orario
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {assignment.shiftType.startTime} - {assignment.shiftType.endTime}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Durata
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {duration.toFixed(1)}h
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Score Rotazione
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {assignment.rotationScore}
          </div>
        </div>
      </div>

      {/* Compatibilità con orari negozio */}
      {selectedStore && storeCompatibility && (
        <div className={`p-4 rounded-lg border ${
          storeCompatibility.isCompatible 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2 mb-2">
            <StoreIcon className={`h-5 w-5 ${
              storeCompatibility.isCompatible ? 'text-green-600' : 'text-red-600'
            }`} />
            <span className={`font-medium ${
              storeCompatibility.isCompatible ? 'text-green-900' : 'text-red-900'
            }`}>
              Compatibilità con {selectedStore.name}
            </span>
          </div>
          <p className={`text-sm ${
            storeCompatibility.isCompatible ? 'text-green-800' : 'text-red-800'
          }`}>
            {storeCompatibility.reason}
          </p>
          
          {/* Mostra orari negozio */}
          <div className="mt-2 text-sm text-gray-600">
            <strong>Orari negozio:</strong> {
              selectedStore.openingHours[getDayOfWeek(assignment.date)]
                ? `${selectedStore.openingHours[getDayOfWeek(assignment.date)]!.open} - ${selectedStore.openingHours[getDayOfWeek(assignment.date)]!.close}`
                : 'Chiuso'
            }
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Informazioni Assegnazione</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Assegnato da:</span>
            <div className="font-medium">{assignment.assignedBy}</div>
          </div>
          <div>
            <span className="text-gray-600">Data assegnazione:</span>
            <div className="font-medium">
              {assignment.assignedAt.toLocaleDateString('it-IT')} alle {assignment.assignedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {assignment.confirmedAt && (
            <div>
              <span className="text-gray-600">Confermato il:</span>
              <div className="font-medium">
                {assignment.confirmedAt.toLocaleDateString('it-IT')} alle {assignment.confirmedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>
          Chiudi
        </Button>
      </div>
    </div>
  );
};