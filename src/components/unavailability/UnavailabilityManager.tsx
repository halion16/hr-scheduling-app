import React, { useState, useMemo } from 'react';
import { Employee, EmployeeUnavailability } from '../../types';
import { useScheduleData } from '../../hooks/useScheduleData';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { 
  CalendarX, 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Users,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Coffee,
  Stethoscope,
  Home,
  GraduationCap,
  HelpCircle,
  TestTube
} from 'lucide-react';

interface UnavailabilityManagerProps {
  employees: Employee[];
  unavailabilities?: EmployeeUnavailability[];
  onAddUnavailability?: (unavailability: Omit<EmployeeUnavailability, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateUnavailability?: (id: string, updates: Partial<EmployeeUnavailability>) => void;
  onDeleteUnavailability?: (id: string) => void;
}

export const UnavailabilityManager: React.FC<UnavailabilityManagerProps> = ({ 
  employees, 
  unavailabilities: propUnavailabilities,
  onAddUnavailability,
  onUpdateUnavailability,
  onDeleteUnavailability
}) => {
  // Only call useScheduleData if props are not provided (for backwards compatibility)
  const scheduleData = !propUnavailabilities ? useScheduleData() : null;
  
  const unavailabilities = propUnavailabilities ?? scheduleData?.unavailabilities ?? [];
  const addUnavailability = onAddUnavailability ?? scheduleData?.addUnavailability ?? (() => {});
  const updateUnavailability = onUpdateUnavailability ?? scheduleData?.updateUnavailability ?? (() => {});
  const deleteUnavailability = onDeleteUnavailability ?? scheduleData?.deleteUnavailability ?? (() => {});

  const [showModal, setShowModal] = useState(false);
  const [editingUnavailability, setEditingUnavailability] = useState<EmployeeUnavailability | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showDetailedList, setShowDetailedList] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    original: EmployeeUnavailability;
    conflicting: EmployeeUnavailability[];
  } | null>(null);

  // Form state for new/edit unavailability
  const [formData, setFormData] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    type: 'holiday' as EmployeeUnavailability['type'],
    reason: '',
    notes: '',
    isApproved: false
  });

  const employeeMap = useMemo(() => 
    new Map(employees.map(emp => [emp.id, emp])), 
    [employees]
  );

  const activeEmployees = employees.filter(emp => emp.isActive);

  // Improved data validation and counting
  const unavailabilityStats = useMemo(() => {
    
    // Filter for current and future unavailabilities (not expired)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const relevantUnavailabilities = unavailabilities.filter(unavail => {
      const endDate = new Date(unavail.endDate);
      endDate.setHours(23, 59, 59, 999);
      const isNotExpired = endDate >= now;
      
      console.log(`   Checking unavailability ${unavail.id}:`, {
        employee: employeeMap.get(unavail.employeeId)?.firstName,
        endDate: endDate.toLocaleDateString(),
        isNotExpired,
        type: unavail.type,
        isApproved: unavail.isApproved
      });
      
      return isNotExpired;
    });
    
    const approved = relevantUnavailabilities.filter(u => u.isApproved);
    const pending = relevantUnavailabilities.filter(u => !u.isApproved);
    const uniqueEmployees = new Set(relevantUnavailabilities.map(u => u.employeeId));
    
    return {
      total: relevantUnavailabilities.length,
      approved: approved.length,
      pending: pending.length,
      employees: uniqueEmployees.size,
      relevantUnavailabilities
    };
  }, [unavailabilities, employeeMap, activeEmployees]);

  // 🔍 DUPLICATE DETECTION
  const checkForDuplicates = (newUnavailability: Omit<EmployeeUnavailability, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newStart = new Date(newUnavailability.startDate);
    const newEnd = new Date(newUnavailability.endDate);
    
    const conflicting = unavailabilities.filter(existing => {
      if (existing.employeeId !== newUnavailability.employeeId) return false;
      if (editingUnavailability && existing.id === editingUnavailability.id) return false;
      
      const existingStart = new Date(existing.startDate);
      const existingEnd = new Date(existing.endDate);
      
      // Check for any overlap
      return newStart <= existingEnd && newEnd >= existingStart;
    });
    
    return conflicting;
  };

  // 📋 DETAILED EMPLOYEE UNAVAILABILITIES
  const employeeUnavailabilityList = useMemo(() => {
    const employeeGroups = new Map<string, EmployeeUnavailability[]>();
    
    unavailabilityStats.relevantUnavailabilities.forEach(unavail => {
      const employeeId = unavail.employeeId;
      if (!employeeGroups.has(employeeId)) {
        employeeGroups.set(employeeId, []);
      }
      employeeGroups.get(employeeId)!.push(unavail);
    });
    
    // Sort by employee name and unavailabilities by date
    const result = Array.from(employeeGroups.entries())
      .map(([employeeId, unavails]) => {
        const employee = employeeMap.get(employeeId);
        if (!employee) return null;
        
        const sortedUnavails = unavails.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        
        return {
          employee,
          unavailabilities: sortedUnavails,
          totalDays: sortedUnavails.reduce((sum, u) => {
            const start = new Date(u.startDate);
            const end = new Date(u.endDate);
            return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }, 0),
          approved: sortedUnavails.filter(u => u.isApproved).length,
          pending: sortedUnavails.filter(u => !u.isApproved).length
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.employee.firstName.localeCompare(b!.employee.firstName));
    
    return result as NonNullable<typeof result[0]>[];
  }, [unavailabilityStats.relevantUnavailabilities, employeeMap]);
  const employeeOptions = [
    { value: '', label: 'Tutti i Dipendenti' },
    ...activeEmployees.map(emp => ({
      value: emp.id,
      label: `${emp.firstName} ${emp.lastName}`
    }))
  ];

  const statusOptions = [
    { value: 'all', label: 'Tutti gli Stati' },
    { value: 'pending', label: 'In Attesa di Approvazione' },
    { value: 'approved', label: 'Approvate' },
    { value: 'rejected', label: 'Respinte' }
  ];

  const typeOptions = [
    { value: 'holiday', label: '🏖️ Ferie', icon: Coffee },
    { value: 'sick', label: '🤒 Malattia', icon: Stethoscope },
    { value: 'personal', label: '🏠 Motivi Personali', icon: Home },
    { value: 'training', label: '📚 Formazione', icon: GraduationCap },
    { value: 'other', label: '❓ Altro', icon: HelpCircle }
  ];

  // Filter unavailabilities
  const filteredUnavailabilities = useMemo(() => {
    return unavailabilities.filter(unavail => {
      const employeeMatch = !selectedEmployee || unavail.employeeId === selectedEmployee;
      const statusMatch = filterStatus === 'all' || 
        (filterStatus === 'pending' && !unavail.isApproved) ||
        (filterStatus === 'approved' && unavail.isApproved) ||
        (filterStatus === 'rejected' && unavail.isApproved === false);
      
      return employeeMatch && statusMatch;
    });
  }, [unavailabilityStats.relevantUnavailabilities, selectedEmployee, filterStatus]);

  // Sort filtered unavailabilities by date
  const sortedUnavailabilities = useMemo(() => {
    return filteredUnavailabilities.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [filteredUnavailabilities]);

  const handleAdd = () => {
    setEditingUnavailability(null);
    setFormData({
      employeeId: '',
      startDate: '',
      endDate: '',
      type: 'holiday',
      reason: '',
      notes: '',
      isApproved: false
    });
    setShowModal(true);
  };

  const handleEdit = (unavailability: EmployeeUnavailability) => {
    setEditingUnavailability(unavailability);
    setFormData({
      employeeId: unavailability.employeeId,
      startDate: unavailability.startDate.toISOString().split('T')[0],
      endDate: unavailability.endDate.toISOString().split('T')[0],
      type: unavailability.type,
      reason: unavailability.reason || '',
      notes: unavailability.notes || '',
      isApproved: unavailability.isApproved
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (startDate > endDate) {
      alert('La data di fine deve essere successiva alla data di inizio');
      return;
    }

    // 🔍 CHECK FOR DUPLICATES
    const newUnavailabilityData = {
      employeeId: formData.employeeId,
      startDate,
      endDate,
      type: formData.type,
      reason: formData.reason.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      isApproved: formData.isApproved,
      approvedBy: formData.isApproved ? 'admin' : undefined,
      approvedAt: formData.isApproved ? new Date() : undefined
    };
    
    const conflicting = checkForDuplicates(newUnavailabilityData);
    
    if (conflicting.length > 0) {
      const employee = employeeMap.get(formData.employeeId);
      setDuplicateInfo({
        original: newUnavailabilityData as EmployeeUnavailability,
        conflicting
      });
      setShowDuplicateModal(true);
      return;
    }
    if (editingUnavailability) {
      updateUnavailability(editingUnavailability.id, newUnavailabilityData);
    } else {
      addUnavailability(newUnavailabilityData);
    }

    setShowModal(false);
    setEditingUnavailability(null);
  };

  const handleDelete = (id: string) => {
    const unavail = unavailabilities.find(u => u.id === id);
    const employee = unavail ? employeeMap.get(unavail.employeeId) : null;
    
    if (confirm(`Eliminare l'indisponibilità di ${employee?.firstName} ${employee?.lastName}?`)) {
      deleteUnavailability(id);
    }
  };

  const handleApproval = (id: string, approved: boolean) => {
    updateUnavailability(id, {
      isApproved: approved,
      approvedBy: approved ? 'admin' : undefined,
      approvedAt: approved ? new Date() : undefined
    });
  };

  // Function to add test data
  const addTestData = () => {
    if (!activeEmployees.length) {
      alert('Aggiungi prima alcuni dipendenti per testare le indisponibilità');
      return;
    }

    // Clear existing test data first
    console.log('🧹 Clearing existing unavailabilities for clean test...');
    unavailabilities.forEach(unavail => {
      if (unavail.reason?.includes('Dati di test') || unavail.notes?.includes('Test data')) {
        deleteUnavailability(unavail.id);
      }
    });
    const testData = [
      {
        employeeId: activeEmployees[0].id,
        startDate: new Date(Date.now() + 86400000 * 3), // 3 giorni da oggi
        endDate: new Date(Date.now() + 86400000 * 7),   // 7 giorni da oggi
        type: 'holiday' as const,
        reason: 'Ferie programmate - Dati di test',
        notes: 'Test data: Viaggio in famiglia già prenotato',
        isApproved: true,
        approvedBy: 'admin',
        approvedAt: new Date()
      },
      {
        employeeId: activeEmployees[Math.min(1, activeEmployees.length - 1)].id,
        startDate: new Date(Date.now() + 86400000 * 10), // 10 giorni da oggi
        endDate: new Date(Date.now() + 86400000 * 12),   // 12 giorni da oggi
        type: 'sick' as const,
        reason: 'Malattia certificata - Dati di test',
        notes: 'Test data: Certificato medico presentato',
        isApproved: true,
        approvedBy: 'admin',
        approvedAt: new Date()
      },
      {
        employeeId: activeEmployees[0].id,
        startDate: new Date(Date.now() + 86400000 * 15), // 15 giorni da oggi
        endDate: new Date(Date.now() + 86400000 * 17),   // 17 giorni da oggi
        type: 'personal' as const,
        reason: 'Appuntamenti medici - Dati di test',
        notes: 'Test data: Visite specialistiche programmate',
        isApproved: false, // In attesa di approvazione
        approvedBy: undefined,
        approvedAt: undefined
      },
      {
        employeeId: activeEmployees[Math.min(2, activeEmployees.length - 1)].id,
        startDate: new Date(Date.now() + 86400000 * 20), // 20 giorni da oggi
        endDate: new Date(Date.now() + 86400000 * 22),   // 22 giorni da oggi
        type: 'training' as const,
        reason: 'Corso di formazione - Dati di test',
        notes: 'Test data: Formazione obbligatoria aziendale',
        isApproved: true,
        approvedBy: 'admin',
        approvedAt: new Date()
      }
    ];

    console.log('📝 Adding test data:', testData.length, 'unavailabilities');
    testData.forEach(data => addUnavailability(data));
    
    // Force immediate update
    setTimeout(() => {
      alert(`✅ Aggiunti ${testData.length} periodi di indisponibilità di test!\n\nControlla i contatori aggiornati e vai alla vista "Griglia" per vedere gli effetti nella pianificazione turni.`);
    }, 100);
  };

  const handleDuplicateConfirm = () => {
    if (!duplicateInfo) return;
    
    // Proceed with creating/updating despite conflicts
    if (editingUnavailability) {
      updateUnavailability(editingUnavailability.id, duplicateInfo.original);
    } else {
      addUnavailability(duplicateInfo.original);
    }
    
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setShowModal(false);
    setEditingUnavailability(null);
  };

  const getTypeIcon = (type: EmployeeUnavailability['type']) => {
    const config = typeOptions.find(opt => opt.value === type);
    const Icon = config?.icon || HelpCircle;
    return <Icon className="h-4 w-4" />;
  };

  const getTypeLabel = (type: EmployeeUnavailability['type']) => {
    return typeOptions.find(opt => opt.value === type)?.label || '❓ Altro';
  };

  const getStatusColor = (isApproved: boolean, isPast: boolean) => {
    if (isPast) return 'bg-gray-100 text-gray-600';
    if (isApproved) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusIcon = (isApproved: boolean, isPast: boolean) => {
    if (isPast) return <Clock className="h-4 w-4" />;
    if (isApproved) return <CheckCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 rounded-lg p-2" title="Gestione Indisponibilità Dipendenti">
              <CalendarX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gestione Indisponibilità</h1>
              <p className="text-sm text-gray-600">Gestisci periodi di assenza e indisponibilità dei dipendenti</p>
            </div>
          </div>
        
          <div className="flex space-x-2">
            <Button
              size="sm"
              icon={TestTube}
              onClick={addTestData}
              variant="outline"
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
              title="Aggiungi dati di esempio per testare la funzionalità"
            >
              Dati Test
            </Button>
            
            <Button
              size="sm"
              icon={Users}
              onClick={() => setShowDetailedList(!showDetailedList)}
              variant={showDetailedList ? "primary" : "outline"}
              className={showDetailedList ? "bg-blue-600 text-white" : "border-blue-300 text-blue-600 hover:bg-blue-50"}
              title="Mostra lista dettagliata per dipendente"
            >
              {showDetailedList ? 'Nascondi' : 'Dettagli'}
            </Button>
          
            <Button
              size="sm"
              icon={Plus}
              onClick={handleAdd}
              title="Crea una nuova indisponibilità per un dipendente"
            >
              Nuova Indisponibilità
            </Button>
          </div>
        </div>

        {/* Stats compatte */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center" title="Numero totale di indisponibilità registrate nel sistema">
            <div className="text-xl font-bold text-blue-900">{unavailabilityStats.total}</div>
            <div className="text-xs text-blue-700">Totali</div>
          </div>

          <div className="bg-green-50 rounded-lg p-3 text-center" title="Indisponibilità approvate che bloccano l'assegnazione di turni">
            <div className="text-xl font-bold text-green-900">
                {unavailabilityStats.approved}
            </div>
            <div className="text-xs text-green-700">Approvate</div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-3 text-center" title="Indisponibilità in attesa di approvazione">
            <div className="text-xl font-bold text-yellow-900">
                {unavailabilityStats.pending}
            </div>
            <div className="text-xs text-yellow-700">In Attesa</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3 text-center" title="Numero di dipendenti con almeno una indisponibilità">
            <div className="text-xl font-bold text-purple-900">
                {unavailabilityStats.employees}
            </div>
            <div className="text-xs text-purple-700">Dipendenti</div>
          </div>
        </div>

        {/* Filters integrati */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Filtra per Dipendente"
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              options={employeeOptions}
            />
            
            <Select
              label="Filtra per Stato"
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusOptions}
            />
          </div>
        </div>

        {/* Instructions collassabili */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <TestTube className="h-4 w-4 text-blue-600" title="Istruzioni per testare la funzionalità" />
              <span className="text-sm font-medium text-blue-900">Come Testare la Funzionalità</span>
            </div>
            <div className="text-blue-600">
              {showInstructions ? '−' : '+'}
            </div>
          </button>
          
          {showInstructions && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-blue-800 mb-2">🧪 Test Base:</h4>
                <ol className="space-y-1 text-blue-700 text-xs">
                  <li>1. Clicca "Dati Test" per creare esempi</li>
                  <li>2. Vai alla vista "Griglia"</li>
                  <li>3. Cerca celle rosse con icona "👤❌"</li>
                  <li>4. Prova a creare turni nelle celle evidenziate</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-blue-800 mb-2">✅ Cosa Verificare:</h4>
                <ul className="space-y-1 text-blue-700 text-xs">
                  <li>• Celle rosse per indisponibilità</li>
                  <li>• Blocco inserimento turni</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Employee List */}
      {showDetailedList && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                📋 Lista Dettagliata per Dipendente
              </h3>
              <div className="text-sm text-gray-600">
                {employeeUnavailabilityList.length} dipendenti con indisponibilità
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {employeeUnavailabilityList.map(({ employee, unavailabilities, totalDays, approved, pending }) => (
              <div key={employee.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {employee.contractHours}h contratto • {totalDays} giorni totali indisponibilità
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {approved > 0 && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                        {approved} approvate
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                        {pending} in attesa
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unavailabilities.map(unavail => {
                    const dayCount = Math.ceil((unavail.endDate.getTime() - unavail.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const isPast = unavail.endDate < new Date();
                    
                    return (
                      <div
                        key={unavail.id}
                        className={`p-3 rounded-lg border ${
                          isPast ? 'bg-gray-50 border-gray-200' :
                          unavail.isApproved ? 'bg-green-50 border-green-200' :
                          'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getTypeIcon(unavail.type)}
                            <span className="text-sm font-medium">
                              {getTypeLabel(unavail.type).replace(/[🏖️🤒🏠📚❓]\s*/, '')}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(unavail.isApproved, isPast)}
                            <span className="text-xs">
                              {isPast ? 'Passata' : unavail.isApproved ? 'Attiva' : 'In Attesa'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            {unavail.startDate.toLocaleDateString('it-IT')} - {unavail.endDate.toLocaleDateString('it-IT')}
                          </div>
                          <div className="text-xs text-gray-600">
                            {dayCount} giorni • {unavail.reason || 'Nessun motivo specificato'}
                          </div>
                          {unavail.notes && (
                            <div className="text-xs text-gray-500 italic">
                              {unavail.notes}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-end space-x-1 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Edit}
                            onClick={() => handleEdit(unavail)}
                            className="!p-1"
                          />
                          <Button
                            size="sm"
                            variant="danger"
                            icon={Trash2}
                            onClick={() => handleDelete(unavail.id)}
                            className="!p-1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {employeeUnavailabilityList.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <CalendarX className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nessuna indisponibilità registrata per i dipendenti attivi</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={addTestData}
                  icon={TestTube}
                >
                  Aggiungi Dati Test
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Add/Edit */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUnavailability(null);
        }}
        title={editingUnavailability ? 'Modifica Indisponibilità' : 'Nuova Indisponibilità'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Importante</span>
            </div>
            <p className="text-sm text-yellow-800">
              Le indisponibilità approvate bloccheranno automaticamente l'assegnazione di turni 
              nei periodi specificati durante la compilazione manuale della griglia.
            </p>
          </div>

          <Select
            label="Seleziona Dipendente *"
            value={formData.employeeId}
            onChange={(value) => setFormData(prev => ({ ...prev, employeeId: value }))}
            options={[
              { value: '', label: 'Seleziona dipendente...' },
              ...activeEmployees.map(emp => ({
                value: emp.id,
                label: `${emp.firstName} ${emp.lastName}`
              }))
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data Inizio *"
              type="date"
              value={formData.startDate}
              onChange={(value) => setFormData(prev => ({ ...prev, startDate: value }))}
              required
            />
            
            <Input
              label="Data Fine *"
              type="date"
              value={formData.endDate}
              onChange={(value) => setFormData(prev => ({ ...prev, endDate: value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Indisponibilità *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {typeOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <label key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={option.value}
                        checked={formData.type === option.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as EmployeeUnavailability['type'] }))}
                        className="h-4 w-4 text-blue-600"
                      />
                      <Icon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Motivo"
                value={formData.reason}
                onChange={(value) => setFormData(prev => ({ ...prev, reason: value }))}
                placeholder="Descrizione breve del motivo..."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note Aggiuntive
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dettagli aggiuntivi, documenti necessari, etc..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isApproved"
                  checked={formData.isApproved}
                  onChange={(e) => setFormData(prev => ({ ...prev, isApproved: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="isApproved" className="text-sm font-medium text-gray-700">
                  Approva Immediatamente
                </label>
              </div>

              {formData.isApproved && (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <p className="text-sm text-green-800">
                    ✅ L'indisponibilità sarà immediatamente attiva e bloccherà 
                    l'assegnazione di turni nel periodo specificato.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingUnavailability(null);
              }}
            >
              Annulla
            </Button>
            <Button
              type="submit"
            >
              {editingUnavailability ? 'Aggiorna' : 'Crea'} Indisponibilità
            </Button>
          </div>
        </form>
      </Modal>

      {/* Duplicate Detection Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateInfo(null);
        }}
        title="⚠️ Conflitto Indisponibilità"
        size="lg"
      >
        {duplicateInfo && (
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-900">Conflitto Rilevato</span>
              </div>
              <p className="text-sm text-red-800">
                Il periodo che stai cercando di creare si sovrappone con indisponibilità esistenti.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Nuova Indisponibilità</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  {getTypeIcon(duplicateInfo.original.type)}
                  <span className="font-medium">{getTypeLabel(duplicateInfo.original.type)}</span>
                </div>
                <div className="text-sm text-gray-700">
                  📅 {duplicateInfo.original.startDate.toLocaleDateString('it-IT')} - {duplicateInfo.original.endDate.toLocaleDateString('it-IT')}
                </div>
                <div className="text-sm text-gray-600">
                  {duplicateInfo.original.reason || 'Nessun motivo specificato'}
                </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Indisponibilità in Conflitto</h4>
              <div className="space-y-2">
                {duplicateInfo.conflicting.map(conflict => (
                  <div key={conflict.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          {getTypeIcon(conflict.type)}
                          <span className="font-medium">{getTypeLabel(conflict.type)}</span>
                          {conflict.isApproved && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <div className="text-sm text-gray-700">
                          📅 {conflict.startDate.toLocaleDateString('it-IT')} - {conflict.endDate.toLocaleDateString('it-IT')}
                        </div>
                        <div className="text-sm text-gray-600">
                          {conflict.reason || 'Nessun motivo specificato'}
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Edit}
                        onClick={() => {
                          setShowDuplicateModal(false);
                          handleEdit(conflict);
                        }}
                      >
                        Modifica
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                💡 <strong>Cosa puoi fare:</strong>
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                <li>• Modificare le date per evitare sovrapposizioni</li>
                <li>• Procedere comunque (sconsigliato)</li>
                <li>• Modificare le indisponibilità esistenti</li>
              </ul>
            </div>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateInfo(null);
                }}
              >
                Annulla
              </Button>
              <Button
                variant="danger"
                onClick={handleDuplicateConfirm}
                icon={AlertTriangle}
              >
                Procedi Comunque
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};