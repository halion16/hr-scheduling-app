import React, { useState } from 'react';
import { Employee } from '../../types';
import { ShiftAssignment, SubstitutionRequest } from '../../types/rotation';
import { useShiftRotation } from '../../hooks/useShiftRotation';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { 
  RefreshCw, 
  Plus, 
  Check, 
  X, 
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface SubstitutionManagerProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  requests: SubstitutionRequest[];
}

export const SubstitutionManager: React.FC<SubstitutionManagerProps> = ({
  employees,
  assignments,
  requests
}) => {
  const {
    createSubstitutionRequest,
    updateSubstitutionRequest,
    approveSubstitutionRequest
  } = useShiftRotation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SubstitutionRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const statusOptions = [
    { value: 'all', label: 'Tutti gli Stati' },
    { value: 'pending', label: 'In Attesa' },
    { value: 'approved', label: 'Approvati' },
    { value: 'rejected', label: 'Rifiutati' }
  ];

  const filteredRequests = requests.filter(request => 
    filterStatus === 'all' || request.status === filterStatus
  );

  const pendingRequests = requests.filter(req => req.status === 'pending');

  const getStatusIcon = (status: SubstitutionRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'completed':
        return <Check className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: SubstitutionRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: SubstitutionRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'In Attesa';
      case 'approved':
        return 'Approvato';
      case 'rejected':
        return 'Rifiutato';
      case 'completed':
        return 'Completato';
      default:
        return 'Sconosciuto';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Gestione Sostituzioni</h2>
            <p className="text-gray-600">Richieste di cambio turno e sostituzioni</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {pendingRequests.length > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              {pendingRequests.length} richieste in attesa
            </div>
          )}
          
          <Button
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
          >
            Nuova Richiesta
          </Button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex items-center space-x-4">
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusOptions}
          className="min-w-[150px]"
        />
      </div>

      {/* Lista richieste */}
      <div className="space-y-4">
        {filteredRequests.length > 0 ? (
          filteredRequests.map(request => {
            const assignment = assignments.find(a => a.id === request.originalAssignmentId);
            const requestingEmployee = employees.find(emp => emp.id === request.requestedBy);
            const substituteEmployee = request.proposedSubstitute 
              ? employees.find(emp => emp.id === request.proposedSubstitute)
              : null;

            return (
              <div
                key={request.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      {getStatusIcon(request.status)}
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Richiesta il {request.requestedAt.toLocaleDateString('it-IT')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Richiedente
                        </label>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {requestingEmployee ? `${requestingEmployee.firstName} ${requestingEmployee.lastName}` : 'Sconosciuto'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Turno Originale
                        </label>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>
                            {assignment ? (
                              `${assignment.date.toLocaleDateString('it-IT')} - ${assignment.shiftType.name}`
                            ) : (
                              'Turno non trovato'
                            )}
                          </span>
                        </div>
                      </div>

                      {substituteEmployee && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sostituto Proposto
                          </label>
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              {substituteEmployee.firstName} {substituteEmployee.lastName}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                        {request.reason}
                      </p>
                    </div>

                    {request.notes && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Note
                        </label>
                        <p className="text-gray-600 text-sm">
                          {request.notes}
                        </p>
                      </div>
                    )}

                    {request.approvedBy && request.approvedAt && (
                      <div className="text-sm text-gray-500">
                        Approvato da {request.approvedBy} il {request.approvedAt.toLocaleDateString('it-IT')} alle {request.approvedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* Azioni */}
                  <div className="flex flex-col space-y-2 ml-4">
                    {request.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          icon={Check}
                          onClick={() => approveSubstitutionRequest(request.id, 'admin')}
                        >
                          Approva
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={X}
                          onClick={() => updateSubstitutionRequest(request.id, { 
                            status: 'rejected',
                            notes: 'Rifiutato dall\'amministratore'
                          })}
                        >
                          Rifiuta
                        </Button>
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedRequest(request)}
                    >
                      Dettagli
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nessuna richiesta di sostituzione
            </h3>
            <p className="text-gray-500 mb-6">
              {filterStatus === 'all' 
                ? 'Non ci sono richieste di sostituzione al momento.'
                : `Non ci sono richieste con stato "${statusOptions.find(opt => opt.value === filterStatus)?.label}".`
              }
            </p>
            <Button
              icon={Plus}
              onClick={() => setShowCreateModal(true)}
            >
              Crea Prima Richiesta
            </Button>
          </div>
        )}
      </div>

      {/* Modal per creare nuova richiesta */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuova Richiesta di Sostituzione"
        size="lg"
      >
        <CreateSubstitutionModal
          employees={employees}
          assignments={assignments}
          onSubmit={(requestData) => {
            createSubstitutionRequest(requestData);
            setShowCreateModal(false);
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Modal dettagli richiesta */}
      {selectedRequest && (
        <Modal
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          title="Dettagli Richiesta di Sostituzione"
          size="md"
        >
          <SubstitutionDetailsModal
            request={selectedRequest}
            employees={employees}
            assignments={assignments}
            onClose={() => setSelectedRequest(null)}
          />
        </Modal>
      )}
    </div>
  );
};

// Componente per creare nuova richiesta
interface CreateSubstitutionModalProps {
  employees: Employee[];
  assignments: ShiftAssignment[];
  onSubmit: (data: Omit<SubstitutionRequest, 'id'>) => void;
  onCancel: () => void;
}

const CreateSubstitutionModal: React.FC<CreateSubstitutionModalProps> = ({
  employees,
  assignments,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    originalAssignmentId: '',
    requestedBy: '',
    reason: '',
    proposedSubstitute: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filtra solo i turni futuri
  const futureAssignments = assignments.filter(assignment => 
    assignment.date > new Date() && assignment.status !== 'substituted'
  );

  const assignmentOptions = futureAssignments.map(assignment => {
    const employee = employees.find(emp => emp.id === assignment.employeeId);
    return {
      value: assignment.id,
      label: `${assignment.date.toLocaleDateString('it-IT')} - ${assignment.shiftType.name} - ${employee ? `${employee.firstName} ${employee.lastName}` : 'Sconosciuto'}`
    };
  });

  const employeeOptions = employees.map(emp => ({
    value: emp.id,
    label: `${emp.firstName} ${emp.lastName}`
  }));

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.originalAssignmentId) {
      newErrors.originalAssignmentId = 'Seleziona il turno da sostituire';
    }

    if (!formData.requestedBy) {
      newErrors.requestedBy = 'Seleziona chi richiede la sostituzione';
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Inserisci il motivo della richiesta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        originalAssignmentId: formData.originalAssignmentId,
        requestedBy: formData.requestedBy,
        requestedAt: new Date(),
        reason: formData.reason.trim(),
        status: 'pending',
        proposedSubstitute: formData.proposedSubstitute || undefined,
        notes: formData.notes.trim() || undefined
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-blue-900">Informazioni</span>
        </div>
        <p className="text-sm text-blue-800">
          Le richieste di sostituzione devono essere approvate prima di essere applicate. 
          Puoi proporre un sostituto specifico o lasciare che sia l'amministratore a decidere.
        </p>
      </div>

      <Select
        label="Turno da Sostituire"
        value={formData.originalAssignmentId}
        onChange={(value) => setFormData(prev => ({ ...prev, originalAssignmentId: value }))}
        options={[
          { value: '', label: 'Seleziona un turno...' },
          ...assignmentOptions
        ]}
        required
        error={errors.originalAssignmentId}
      />

      <Select
        label="Richiedente"
        value={formData.requestedBy}
        onChange={(value) => setFormData(prev => ({ ...prev, requestedBy: value }))}
        options={[
          { value: '', label: 'Seleziona dipendente...' },
          ...employeeOptions
        ]}
        required
        error={errors.requestedBy}
      />

      <Input
        label="Motivo della Richiesta"
        value={formData.reason}
        onChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}
        placeholder="es. Impegno familiare, malattia, altro..."
        required
        error={errors.reason}
      />

      <Select
        label="Sostituto Proposto (opzionale)"
        value={formData.proposedSubstitute}
        onChange={(value) => setFormData(prev => ({ ...prev, proposedSubstitute: value }))}
        options={[
          { value: '', label: 'Nessun sostituto specifico' },
          ...employeeOptions
        ]}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Note Aggiuntive (opzionale)
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Informazioni aggiuntive sulla richiesta..."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Annulla
        </Button>
        <Button
          type="submit"
          icon={Plus}
        >
          Crea Richiesta
        </Button>
      </div>
    </form>
  );
};

// Componente per dettagli richiesta
interface SubstitutionDetailsModalProps {
  request: SubstitutionRequest;
  employees: Employee[];
  assignments: ShiftAssignment[];
  onClose: () => void;
}

const SubstitutionDetailsModal: React.FC<SubstitutionDetailsModalProps> = ({
  request,
  employees,
  assignments,
  onClose
}) => {
  const assignment = assignments.find(a => a.id === request.originalAssignmentId);
  const requestingEmployee = employees.find(emp => emp.id === request.requestedBy);
  const substituteEmployee = request.proposedSubstitute 
    ? employees.find(emp => emp.id === request.proposedSubstitute)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stato
          </label>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            request.status === 'approved' ? 'bg-green-100 text-green-800' :
            request.status === 'rejected' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {request.status === 'pending' ? 'In Attesa' :
             request.status === 'approved' ? 'Approvato' :
             request.status === 'rejected' ? 'Rifiutato' :
             'Completato'}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Richiesta
          </label>
          <div className="text-gray-900">
            {request.requestedAt.toLocaleDateString('it-IT')} alle {request.requestedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Richiedente
        </label>
        <div className="text-lg font-semibold text-gray-900">
          {requestingEmployee ? `${requestingEmployee.firstName} ${requestingEmployee.lastName}` : 'Sconosciuto'}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Turno Originale
        </label>
        {assignment ? (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">Data:</span>
                <div className="font-medium">
                  {assignment.date.toLocaleDateString('it-IT', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Turno:</span>
                <div className="font-medium">{assignment.shiftType.name}</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Orario:</span>
                <div className="font-medium">
                  {assignment.shiftType.startTime} - {assignment.shiftType.endTime}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Durata:</span>
                <div className="font-medium">
                  {((new Date(`2000-01-01T${assignment.shiftType.endTime}`).getTime() - 
                     new Date(`2000-01-01T${assignment.shiftType.startTime}`).getTime()) / 
                    (1000 * 60 * 60)).toFixed(1)}h
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-red-600">Turno non trovato</div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motivo
        </label>
        <div className="bg-gray-50 p-4 rounded-lg">
          {request.reason}
        </div>
      </div>

      {substituteEmployee && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sostituto Proposto
          </label>
          <div className="text-lg font-semibold text-gray-900">
            {substituteEmployee.firstName} {substituteEmployee.lastName}
          </div>
        </div>
      )}

      {request.notes && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note
          </label>
          <div className="bg-gray-50 p-4 rounded-lg text-sm">
            {request.notes}
          </div>
        </div>
      )}

      {request.approvedBy && request.approvedAt && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-800">
            <strong>Approvato da:</strong> {request.approvedBy}
          </div>
          <div className="text-sm text-green-700">
            <strong>Data approvazione:</strong> {request.approvedAt.toLocaleDateString('it-IT')} alle {request.approvedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <Button onClick={onClose}>
          Chiudi
        </Button>
      </div>
    </div>
  );
};