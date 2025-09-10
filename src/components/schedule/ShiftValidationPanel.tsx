import React, { useState } from 'react';
import { Shift, Employee, Store } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Lock, Unlock, Shield, AlertTriangle, CheckCircle, User } from 'lucide-react';

interface ShiftValidationPanelProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
  userRole: 'admin' | 'manager' | 'user';
  onToggleLock: (shiftId: string, reason?: string) => void;
  onBulkLock: (shiftIds: string[], reason?: string) => void;
  selectedDate?: Date;
}

export const ShiftValidationPanel: React.FC<ShiftValidationPanelProps> = ({
  shifts,
  employees,
  stores,
  userRole,
  onToggleLock,
  onBulkLock,
  selectedDate
}) => {
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'lock' | 'unlock' | null>(null);

  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  const storeMap = new Map(stores.map(store => [store.id, store]));

  const filteredShifts = selectedDate 
    ? shifts.filter(shift => shift.date.toDateString() === selectedDate.toDateString())
    : shifts;

  const lockedShifts = filteredShifts.filter(shift => shift.isLocked);
  const unlockedShifts = filteredShifts.filter(shift => !shift.isLocked);

  const canModifyLocks = userRole === 'admin' || userRole === 'manager';

  const handleBulkAction = (action: 'lock' | 'unlock') => {
    if (!canModifyLocks) return;
    
    setBulkAction(action);
    if (action === 'lock') {
      setShowLockModal(true);
    } else {
      onBulkLock(selectedShifts);
      setSelectedShifts([]);
    }
  };

  const handleLockConfirm = () => {
    if (bulkAction === 'lock') {
      onBulkLock(selectedShifts, lockReason);
      console.log(`✅ Inviata richiesta di blocco per ${selectedShifts.length} turni con motivo: "${lockReason || 'Nessun motivo'}"`);
    }
    setShowLockModal(false);
    setLockReason('');
    setSelectedShifts([]);
    setBulkAction(null);
  };

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShifts(prev => 
      prev.includes(shiftId) 
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
    );
  };

  const selectAllUnlocked = () => {
    setSelectedShifts(unlockedShifts.map(shift => shift.id));
  };

  const clearSelection = () => {
    setSelectedShifts([]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Convalida Turni</h3>
              <p className="text-sm text-gray-500">
                Gestisci il blocco e la convalida dei turni pianificati
              </p>
            </div>
          </div>

          {canModifyLocks && (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllUnlocked}
                disabled={unlockedShifts.length === 0}
              >
                Seleziona Tutti
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelection}
                disabled={selectedShifts.length === 0}
              >
                Deseleziona
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Turni Totali</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {filteredShifts.length}
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Bloccati</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {lockedShifts.length}
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Unlock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-900">Da Bloccare</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {unlockedShifts.length}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {canModifyLocks && selectedShifts.length > 0 && (
        <div className="p-4 bg-blue-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedShifts.length} turni selezionati
            </span>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="success"
                icon={Lock}
                onClick={() => handleBulkAction('lock')}
              >
                Blocca Selezionati
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={Unlock}
                onClick={() => handleBulkAction('unlock')}
              >
                Sblocca Selezionati
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shifts List */}
      <div className="p-6">
        <div className="space-y-3">
          {filteredShifts.map(shift => {
            const employee = employeeMap.get(shift.employeeId);
            const isSelected = selectedShifts.includes(shift.id);

            return (
              <div
                key={shift.id}
                className={`p-4 rounded-lg border transition-colors ${
                  shift.isLocked 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {canModifyLocks && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleShiftSelection(shift.id)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    )}
                    
                    <div className="flex items-center space-x-2">
                      {shift.isLocked ? (
                        <Lock className="h-4 w-4 text-green-600" />
                      ) : (
                        <Unlock className="h-4 w-4 text-yellow-600" />
                      )}
                      <User className="h-4 w-4 text-gray-500" />
                    </div>

                    <div>
                      <div className="font-medium text-gray-900">
                        {employee ? `${employee.firstName} ${employee.lastName}` : 'Dipendente Sconosciuto'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {shift.date.toLocaleDateString('it-IT')} • {shift.startTime} - {shift.endTime} • {shift.actualHours.toFixed(1)}h
                      </div>
                      {shift.isLocked && shift.lockedAt && (
                        <div className="text-xs text-green-600 mt-1">
                          Bloccato il {shift.lockedAt.toLocaleDateString('it-IT')} alle {shift.lockedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      shift.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      shift.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      shift.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {shift.status === 'scheduled' ? 'Programmato' :
                       shift.status === 'confirmed' ? 'Confermato' :
                       shift.status === 'completed' ? 'Completato' :
                       'Annullato'}
                    </span>

                    {canModifyLocks && (
                      <Button
                        size="sm"
                        variant={shift.isLocked ? 'outline' : 'success'}
                        icon={shift.isLocked ? Unlock : Lock}
                        onClick={() => {
                          if (shift.isLocked) {
                            onToggleLock(shift.id);
                          } else {
                            setSelectedShifts([shift.id]);
                            setBulkAction('lock');
                            setShowLockModal(true);
                          }
                        }}
                      >
                        {shift.isLocked ? 'Sblocca' : 'Blocca'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredShifts.length === 0 && (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun turno trovato</h3>
            <p className="text-gray-500">
              Non ci sono turni da convalidare per il periodo selezionato.
            </p>
          </div>
        )}
      </div>

      {/* Lock Modal */}
      <Modal
        isOpen={showLockModal}
        onClose={() => {
          setShowLockModal(false);
          setBulkAction(null);
          setLockReason('');
        }}
        title="Conferma Blocco Turni"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Attenzione</span>
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              Stai per bloccare {selectedShifts.length} turno/i. Una volta bloccati, 
              i turni non potranno essere modificati da utenti non autorizzati.
            </p>
          </div>

          <Input
            label="Motivo del blocco (opzionale)"
            value={lockReason}
            onChange={setLockReason}
            placeholder="es. Turni confermati con i dipendenti"
          />

          <div className="flex justify-end space-x-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowLockModal(false);
                setBulkAction(null);
                setLockReason('');
              }}
            >
              Annulla
            </Button>
            <Button
              variant="success"
              icon={Lock}
              onClick={handleLockConfirm}
            >
              Conferma Blocco
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};