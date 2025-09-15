import React, { useState, useMemo } from 'react';
import { Shift, Employee, Store, ShiftValidationStatus } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Lock, Unlock, Shield, AlertTriangle, CheckCircle, User, PlayCircle } from 'lucide-react';
import {
  ShiftWorkflowEngine,
  createWorkflowEngine,
  STATUS_CONFIG,
  WORKFLOW_TRANSITIONS,
  getWorkflowStatistics
} from '../../utils/workflowEngine';

interface ShiftValidationPanelProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
  userRole: 'admin' | 'manager' | 'user';
  userName: string;
  onWorkflowTransition: (shifts: Shift[], targetStatus: ShiftValidationStatus, reason?: string) => Promise<void>;
  selectedDate?: Date;
}

export const ShiftValidationPanel: React.FC<ShiftValidationPanelProps> = ({
  shifts,
  employees,
  stores,
  userRole,
  userName,
  onWorkflowTransition,
  selectedDate
}) => {
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowReason, setWorkflowReason] = useState('');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [targetStatus, setTargetStatus] = useState<ShiftValidationStatus | null>(null);

  // Create workflow engine instance
  const workflowEngine = useMemo(() => {
    return createWorkflowEngine({
      employees,
      stores,
      allShifts: shifts,
      selectedDate,
      bulkOperation: true
    });
  }, [employees, stores, shifts, selectedDate]);

  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  const storeMap = new Map(stores.map(store => [store.id, store]));

  const filteredShifts = selectedDate
    ? shifts.filter(shift => shift.date.toDateString() === selectedDate.toDateString())
    : shifts;

  // Group shifts by workflow status
  const shiftsByStatus = workflowEngine.getShiftsByStatus(filteredShifts);
  const workflowStats = getWorkflowStatistics(filteredShifts);

  // Get available workflow transitions for bulk actions
  const availableTransitions = useMemo(() => {
    if (selectedShifts.length === 0) return [];

    const selectedShiftObjects = filteredShifts.filter(shift => selectedShifts.includes(shift.id));
    if (selectedShiftObjects.length === 0) return [];

    // Get common transitions available for all selected shifts
    const firstShiftStatus = (selectedShiftObjects[0] as any).validationStatus || 'draft';
    let commonTransitions = workflowEngine.getAvailableTransitions(firstShiftStatus, userRole);

    // Filter transitions that are available for ALL selected shifts
    for (const shift of selectedShiftObjects.slice(1)) {
      const shiftStatus = (shift as any).validationStatus || 'draft';
      const shiftTransitions = workflowEngine.getAvailableTransitions(shiftStatus, userRole);
      commonTransitions = commonTransitions.filter(ct =>
        shiftTransitions.some(st => st.to === ct.to)
      );
    }

    return commonTransitions;
  }, [selectedShifts, filteredShifts, workflowEngine, userRole]);

  const handleWorkflowAction = (status: ShiftValidationStatus) => {
    setTargetStatus(status);
    const transition = WORKFLOW_TRANSITIONS.find(t => t.to === status);

    if (transition?.confirmationMessage) {
      setShowWorkflowModal(true);
    } else {
      executeWorkflowAction(status, '');
    }
  };

  const executeWorkflowAction = async (status: ShiftValidationStatus, reason: string) => {
    const selectedShiftObjects = filteredShifts.filter(shift => selectedShifts.includes(shift.id));

    console.log(`🔄 Executing workflow transition to ${status} for ${selectedShiftObjects.length} shifts`);

    try {
      await onWorkflowTransition(selectedShiftObjects, status, reason);
      console.log(`✅ Workflow transition completed successfully`);
    } catch (error) {
      console.error('❌ Workflow transition failed:', error);
    }

    setSelectedShifts([]);
    setTargetStatus(null);
  };

  const handleWorkflowConfirm = () => {
    if (targetStatus) {
      executeWorkflowAction(targetStatus, workflowReason);
    }
    setShowWorkflowModal(false);
    setWorkflowReason('');
  };

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShifts(prev => 
      prev.includes(shiftId) 
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
    );
  };

  const selectAllDraft = () => {
    setSelectedShifts(shiftsByStatus.draft.map(shift => shift.id));
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
              <h3 className="text-lg font-semibold text-gray-900">Workflow Validation</h3>
              <p className="text-sm text-gray-500">
                Gestisci lo stato di validazione e il flusso di approvazione dei turni
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={selectAllDraft}
              disabled={shiftsByStatus.draft.length === 0}
            >
              Seleziona Bozze
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
        </div>

        {/* Workflow Stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{workflowEngine.getStatusIcon('draft')}</span>
              <span className="text-sm font-medium text-gray-900">Bozze</span>
            </div>
            <div className="text-xl font-bold text-gray-600 mt-1">
              {shiftsByStatus.draft.length}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{workflowEngine.getStatusIcon('validated')}</span>
              <span className="text-sm font-medium text-green-900">Validati</span>
            </div>
            <div className="text-xl font-bold text-green-600 mt-1">
              {shiftsByStatus.validated.length}
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{workflowEngine.getStatusIcon('published')}</span>
              <span className="text-sm font-medium text-purple-900">Pubblicati</span>
            </div>
            <div className="text-xl font-bold text-purple-600 mt-1">
              {shiftsByStatus.published.length}
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{workflowEngine.getStatusIcon('locked_final')}</span>
              <span className="text-sm font-medium text-red-900">Bloccati</span>
            </div>
            <div className="text-xl font-bold text-red-600 mt-1">
              {shiftsByStatus.locked_final.length}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Workflow Actions */}
      {selectedShifts.length > 0 && (
        <div className="p-4 bg-blue-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedShifts.length} turni selezionati
            </span>
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((transition) => (
                <Button
                  key={transition.to}
                  size="sm"
                  variant={transition.to === 'validated' ? 'success' :
                           transition.to === 'published' ? 'primary' :
                           transition.to === 'locked_final' ? 'danger' : 'outline'}
                  onClick={() => handleWorkflowAction(transition.to)}
                >
                  {transition.icon} {transition.label}
                </Button>
              ))}
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
            const shiftStatus = (shift as any).validationStatus || 'draft';
            const statusConfig = STATUS_CONFIG[shiftStatus];
            const canEdit = workflowEngine.canEditShift(shift);

            return (
              <div
                key={shift.id}
                className={`p-4 rounded-lg border transition-colors ${statusConfig.bgColor} ${statusConfig.borderColor} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleShiftSelection(shift.id)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />

                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{statusConfig.icon}</span>
                      <User className="h-4 w-4 text-gray-500" />
                    </div>

                    <div>
                      <div className="font-medium text-gray-900">
                        {employee ? `${employee.firstName} ${employee.lastName}` : 'Dipendente Sconosciuto'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {shift.date.toLocaleDateString('it-IT')} • {shift.startTime} - {shift.endTime} • {shift.actualHours.toFixed(1)}h
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border`}>
                          {statusConfig.icon} {statusConfig.label}
                        </span>
                        {!canEdit && (
                          <span className="text-xs text-gray-500">
                            🔒 Non modificabile
                          </span>
                        )}
                      </div>
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

                    {/* Individual workflow actions */}
                    {workflowEngine.getAvailableTransitions(shiftStatus, userRole).slice(0, 1).map((transition) => (
                      <Button
                        key={transition.to}
                        size="sm"
                        variant={transition.to === 'validated' ? 'success' :
                                 transition.to === 'published' ? 'primary' :
                                 transition.to === 'locked_final' ? 'danger' : 'outline'}
                        onClick={() => {
                          setSelectedShifts([shift.id]);
                          handleWorkflowAction(transition.to);
                        }}
                      >
                        {transition.icon} {transition.label}
                      </Button>
                    ))}
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

      {/* Workflow Modal */}
      <Modal
        isOpen={showWorkflowModal}
        onClose={() => {
          setShowWorkflowModal(false);
          setTargetStatus(null);
          setWorkflowReason('');
        }}
        title={`Conferma Transizione Workflow`}
      >
        <div className="space-y-4">
          {targetStatus && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <PlayCircle className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Transizione Workflow</span>
                </div>
                <p className="text-sm text-blue-700 mt-2">
                  Stai per cambiare lo stato di {selectedShifts.length} turno/i a:
                  <span className="font-semibold"> {STATUS_CONFIG[targetStatus]?.label}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {STATUS_CONFIG[targetStatus]?.description}
                </p>
              </div>

              <Input
                label="Motivo della transizione (opzionale)"
                value={workflowReason}
                onChange={setWorkflowReason}
                placeholder="es. Approvazione manager, validazione completata..."
              />

              <div className="flex justify-end space-x-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowWorkflowModal(false);
                    setTargetStatus(null);
                    setWorkflowReason('');
                  }}
                >
                  Annulla
                </Button>
                <Button
                  variant={targetStatus === 'validated' ? 'success' :
                           targetStatus === 'published' ? 'primary' :
                           targetStatus === 'locked_final' ? 'danger' : 'primary'}
                  onClick={handleWorkflowConfirm}
                >
                  {STATUS_CONFIG[targetStatus]?.icon} Conferma
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};