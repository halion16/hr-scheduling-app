import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Shift, Employee, ShiftConflict, CopiedShift, EmployeeUnavailability, Store, ShiftValidationStatus } from '../../types';
import { Button } from '../common/Button';
import { ContextMenu } from './ContextMenu';
import { TemplateSelector } from './TemplateSelector';
import { useStaffPlanning } from '../../hooks/useStaffPlanning';
import { getDayOfWeek, getStartOfWeek } from '../../utils/timeUtils';
import { STATUS_CONFIG } from '../../utils/workflowEngine';
import { AlertTriangle, Copy, Clipboard, Zap, Lock, Plus, Edit, Check, X, Calculator, AlertCircle, Clock, UserX } from 'lucide-react';

interface ShiftCellProps {
  shift?: Shift;
  employee: Employee;
  date: Date;
  store: Store; // Aggiunta prop store per controlli chiusura
  conflicts: ShiftConflict[];
  employeeUnavailabilities: EmployeeUnavailability[];
  defaultBreakDuration: number;
  userRole: 'admin' | 'manager' | 'user';
  onShiftChange: (shiftData: Partial<Shift>) => void;
  onShiftDelete: () => void;
  onCopyShift?: (shift: CopiedShift) => void;
  onPasteShift?: () => CopiedShift | null;
  onApplyTemplate?: (templateId: string) => void;
  isSourceCell?: boolean;
  hasClipboard?: boolean;
}

export const ShiftCell: React.FC<ShiftCellProps> = ({
  shift,
  employee,
  date,
  store,
  conflicts,
  employeeUnavailabilities,
  defaultBreakDuration,
  userRole,
  onShiftChange,
  onShiftDelete,
  onCopyShift,
  onPasteShift,
  onApplyTemplate,
  isSourceCell = false,
  hasClipboard = false
}) => {
  const { calculateStaffNeeds } = useStaffPlanning();

  // Get workflow validation status
  const validationStatus = (shift as any)?.validationStatus || 'draft';
  const statusConfig = STATUS_CONFIG[validationStatus as ShiftValidationStatus];

  // Helper functions for workflow status styling
  const getValidationBorderStyle = () => {
    if (!shift) return '';

    switch (validationStatus) {
      case 'draft': return 'border-l-4 border-l-gray-400';
      case 'validated': return 'border-l-4 border-l-green-500';
      case 'published': return 'border-l-4 border-l-purple-500';
      case 'locked_final': return 'border-l-4 border-l-red-500';
      default: return 'border-l-4 border-l-gray-300';
    }
  };

  const getValidationIcon = () => {
    if (!shift || validationStatus === 'draft') return null;
    return statusConfig?.icon || '📝';
  };

  const [isEditing, setIsEditing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showError, setShowError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  
  // Local state for temporary editing data
  const [tempData, setTempData] = useState({
    startTime: '',
    endTime: '',
    breakDuration: ''
  });

  const hasErrors = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');
  const isLocked = shift?.isLocked || false;
  const canEdit = !isLocked || userRole === 'admin';
  
  // 🚫 VERIFICA CHIUSURA NEGOZIO
  const isStoreClosed = useMemo(() => {
    // 1. Verifica chiusure straordinarie
    const closureDay = store.closureDays?.find(closure => 
      closure.date.toDateString() === date.toDateString()
    );
    
    if (closureDay?.isFullDay) {
      return { closed: true, reason: `Negozio chiuso: ${closureDay.reason}` };
    }
    
    // 2. Verifica orari settimanali personalizzati
    const weekStart = getStartOfWeek(date);
    const weeklySchedule = store.weeklySchedules?.find(schedule => 
      schedule.weekStartDate.toDateString() === weekStart.toDateString() && schedule.isActive
    );
    
    const dayOfWeek = getDayOfWeek(date);
    let storeHours;
    
    if (weeklySchedule) {
      storeHours = weeklySchedule.openingHours[dayOfWeek];
    } else {
      storeHours = store.openingHours?.[dayOfWeek];
    }
    
    if (!storeHours) {
      return { closed: true, reason: `Negozio chiuso di ${dayOfWeek}` };
    }
    
    return { closed: false, reason: '' };
  }, [store, date]);
  
  // 🚫 CHECK FOR EMPLOYEE UNAVAILABILITY
  const isEmployeeUnavailable = useMemo(() => {
    const shiftDate = new Date(date);
    shiftDate.setHours(12, 0, 0, 0); // Use noon to avoid timezone issues
    
    return employeeUnavailabilities.some(unavail => {
      if (unavail.employeeId !== employee.id || !unavail.isApproved) return false;
      
      const unavailStart = new Date(unavail.startDate);
      unavailStart.setHours(0, 0, 0, 0);
      const unavailEnd = new Date(unavail.endDate);
      unavailEnd.setHours(23, 59, 59, 999);
      
      return shiftDate >= unavailStart && shiftDate <= unavailEnd;
    });
  }, [employeeUnavailabilities, employee.id, date]);
  
  // Get unavailability details for tooltip
  const unavailabilityDetails = useMemo(() => {
    if (!isEmployeeUnavailable) return null;
    
    const shiftDate = new Date(date);
    shiftDate.setHours(12, 0, 0, 0);
    
    return employeeUnavailabilities.find(unavail => {
      if (unavail.employeeId !== employee.id || !unavail.isApproved) return false;
      
      const unavailStart = new Date(unavail.startDate);
      unavailStart.setHours(0, 0, 0, 0);
      const unavailEnd = new Date(unavail.endDate);
      unavailEnd.setHours(23, 59, 59, 999);
      
      return shiftDate >= unavailStart && shiftDate <= unavailEnd;
    });
  }, [isEmployeeUnavailable, employeeUnavailabilities, employee.id, date]);

  // 🆕 VERIFICA REQUISITI PERSONALE E EVENTI
  const staffNeed = calculateStaffNeeds(shift?.storeId || '', date);
  const hasStaffConstraints = staffNeed && staffNeed.calculatedStaff.length > 0;
  const hasActiveEvents = staffNeed && staffNeed.appliedEvents.length > 0;
  const staffMultiplier = staffNeed?.finalMultiplier || 1;

  // CORRUPTION DETECTION: Check if the current shift has corrupted data
  const isShiftCorrupted = shift && (
    !shift.id || 
    !shift.date || 
    !(shift.date instanceof Date) || 
    isNaN(shift.date.getTime()) ||
    !shift.employeeId || 
    !shift.storeId ||
    !shift.startTime ||
    !shift.endTime
  );

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && startTimeRef.current) {
      setTimeout(() => startTimeRef.current?.focus(), 100);
    }
  }, [isEditing]);

  // Show error notification for corrupted shifts
  useEffect(() => {
    if (isShiftCorrupted) {
      setShowError(true);
      console.error('🚨 Corrupted shift detected:', shift);
    }
  }, [isShiftCorrupted]);

  const startEditing = () => {
    console.log('🎬 Starting edit mode for:', shift?.id || 'new shift');
    
    // 🚫 BLOCCO CHIUSURA NEGOZIO
    if (isStoreClosed.closed) {
      alert(`🚫 IMPOSSIBILE ASSEGNARE TURNI\n\n${isStoreClosed.reason}\n\nNon è possibile assegnare turni nei giorni di chiusura del negozio.`);
      return;
    }
    
    if (isShiftCorrupted) {
      console.error('❌ Cannot edit corrupted shift');
      alert('Questo turno contiene dati corrotti e non può essere modificato. Verrà eliminato.');
      if (shift) {
        onShiftDelete();
      }
      return;
    }
    
    if (shift) {
      console.log('📋 Loading existing shift data:', {
        time: `${shift.startTime}-${shift.endTime}`,
        break: shift.breakDuration,
        date: shift.date?.toISOString?.() || 'INVALID'
      });
      
      setTempData({
        startTime: shift.startTime || '',
        endTime: shift.endTime || '',
        breakDuration: shift.breakDuration?.toString() || defaultBreakDuration.toString()
      });
    } else {
      console.log('🆕 Creating new shift');
      setTempData({
        startTime: '',
        endTime: '',
        breakDuration: defaultBreakDuration.toString()
      });
    }
    setIsEditing(true);
  };

  // 🚀 IMPROVED SMART TIME AUTOCOMPLETE - Solo quando richiesto
  const smartFormatTime = (value: string): string => {
    // Rimuovi tutto tranne i numeri
    const digits = value.replace(/\D/g, '');
    
    console.log('🕐 Smart formatting requested for:', { input: value, digits });
    
    if (digits === '') {
      return '';
    }
    
    // Se è già in formato corretto, non toccare
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      return value;
    }
    
    let formatted = '';
    
    switch (digits.length) {
      case 1: {
        // Singola cifra: aggiunge zero davanti e :00
        const hour = parseInt(digits);
        if (hour >= 0 && hour <= 9) {
          formatted = `${hour.toString().padStart(2, '0')}:00`;
        }
        break;
      }
      
      case 2: {
        // Due cifre: interpreta come ora e aggiunge :00
        const hour = parseInt(digits);
        if (hour >= 0 && hour <= 23) {
          formatted = `${hour.toString().padStart(2, '0')}:00`;
        }
        break;
      }
      
      case 3: {
        // Tre cifre: primo numero = ora, ultimi due = minuti
        const hour = parseInt(digits.substring(0, 1));
        const minute = parseInt(digits.substring(1, 3));
        
        if (hour >= 0 && hour <= 9 && minute >= 0 && minute <= 59) {
          formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
        break;
      }
      
      case 4: {
        // Quattro cifre: prime due = ore, ultime due = minuti
        const hour = parseInt(digits.substring(0, 2));
        const minute = parseInt(digits.substring(2, 4));
        
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
        break;
      }
      
      default: {
        // Troppi numeri: prendi solo i primi 4
        if (digits.length > 4) {
          return smartFormatTime(digits.substring(0, 4));
        }
        break;
      }
    }
    
    // Se non riusciamo a formattare, restituisci l'input originale
    const result = formatted || value;
    console.log('✅ Smart format result:', result);
    return result;
  };

  // Validate time format
  const isValidTimeFormat = (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  // 📝 GESTIONE INPUT MIGLIORATA - Non interferire con la digitazione normale
  const handleTimeInputChange = (field: 'startTime' | 'endTime', value: string) => {
    console.log(`🎯 Raw input change - ${field}:`, value);
    
    // Permetti la digitazione libera - NON formattare automaticamente
    setTempData(prev => ({ ...prev, [field]: value }));
  };

  // 🎯 GESTIONE EVENTI TASTIERA INTELLIGENTE
  const handleTimeInputKeyDown = (field: 'startTime' | 'endTime', e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const value = input.value;
    
    console.log(`⌨️ Key pressed: ${e.key} for ${field} with value: "${value}"`);
    
    // Tab: Auto-completa e passa al prossimo campo
    if (e.key === 'Tab') {
      if (value && !isValidTimeFormat(value)) {
        e.preventDefault();
        const smartFormatted = smartFormatTime(value);
        console.log(`📝 Tab autocomplete: "${value}" → "${smartFormatted}"`);
        setTempData(prev => ({ ...prev, [field]: smartFormatted }));
        
        // Focus sul prossimo campo dopo un breve delay
        setTimeout(() => {
          if (field === 'startTime' && endTimeRef.current) {
            endTimeRef.current.focus();
          }
        }, 50);
      }
      return;
    }
    
    // Enter: Auto-completa e procedi con il salvataggio
    if (e.key === 'Enter') {
      if (value && !isValidTimeFormat(value)) {
        const smartFormatted = smartFormatTime(value);
        console.log(`⏎ Enter autocomplete: "${value}" → "${smartFormatted}"`);
        setTempData(prev => ({ ...prev, [field]: smartFormatted }));
      }
      return;
    }
    
    // Escape: Annulla
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }
    
    // Tasti rapidi per orari comuni
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      let quickTime = '';
      
      switch (e.key) {
        case '9': quickTime = '09:00'; break;
        case '1': quickTime = e.shiftKey ? '18:00' : '13:00'; break;
        case '0': quickTime = '08:00'; break;
        default: return;
      }
      
      if (quickTime) {
        console.log(`🚀 Quick time: Ctrl+${e.key} → ${quickTime}`);
        setTempData(prev => ({ ...prev, [field]: quickTime }));
      }
    }
  };

  // 🎯 AUTO-COMPLETE AL BLUR (quando l'utente esce dal campo)
  const handleTimeInputBlur = (field: 'startTime' | 'endTime') => {
    const value = tempData[field];
    
    if (value && !isValidTimeFormat(value)) {
      const smartFormatted = smartFormatTime(value);
      console.log(`👁️ Blur autocomplete: "${value}" → "${smartFormatted}"`);
      setTempData(prev => ({ ...prev, [field]: smartFormatted }));
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cellRef.current || !cellRef.current.contains(document.activeElement)) return;
      
      if (e.key === 'Escape' && isEditing) {
        e.preventDefault();
        handleCancel();
        return;
      }
      
      if (e.key === 'Enter' && isEditing) {
        e.preventDefault();
        handleSave();
        return;
      }
      
      if (e.ctrlKey && e.key === 'c' && shift && onCopyShift && !isEditing && !isShiftCorrupted) {
        e.preventDefault();
        onCopyShift({
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakDuration: shift.breakDuration,
          notes: shift.notes
        });
      }
      
      if (e.ctrlKey && e.key === 'v' && onPasteShift && canEdit && !isEditing) {
        e.preventDefault();
        const copiedShift = onPasteShift();
        if (copiedShift) {
          applyShiftData(copiedShift);
        }
      }
      
      if (e.key === 't' && e.ctrlKey && canEdit && !isEditing) {
        e.preventDefault();
        setShowTemplateSelector(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shift, onCopyShift, onPasteShift, canEdit, isEditing, isShiftCorrupted]);

  const applyShiftData = (shiftData: Partial<CopiedShift>) => {
    if (shiftData.startTime && shiftData.endTime) {
      const breakMinutes = shiftData.breakDuration !== undefined ? shiftData.breakDuration : defaultBreakDuration;
      const actualHours = calculateWorkingHours(shiftData.startTime, shiftData.endTime, breakMinutes);
      
      console.log('📋 Applying shift data:', shiftData);
      
      // CRITICAL: Ensure proper date object
      const safeDate = date instanceof Date ? date : new Date(date);
      
      onShiftChange({
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        breakDuration: breakMinutes,
        actualHours,
        status: 'scheduled',
        notes: shiftData.notes,
        date: safeDate, // Explicitly pass the date
        employeeId: employee.id, // Explicitly pass employee ID
        storeId: shift?.storeId // Use existing store ID if available
      });
    }
  };

  const handleSave = () => {
    if (!canEdit) {
      console.warn('❌ Save blocked: editing not allowed');
      return;
    }
    
    // 🚫 CHECK UNAVAILABILITY BEFORE SAVING
    if (isEmployeeUnavailable) {
      const typeLabels = {
        holiday: 'Ferie',
        sick: 'Malattia', 
        personal: 'Motivi Personali',
        training: 'Formazione',
        other: 'Altro'
      };
      
      const unavailType = unavailabilityDetails?.type || 'other';
      const message = `🚫 INDISPONIBILITÀ DIPENDENTE\n\n${employee.firstName} ${employee.lastName} non è disponibile il ${date.toLocaleDateString()}\n\nMotivo: ${typeLabels[unavailType]}\nPeriodo: ${unavailabilityDetails?.startDate.toLocaleDateString()} - ${unavailabilityDetails?.endDate.toLocaleDateString()}\n\n${unavailabilityDetails?.reason || unavailabilityDetails?.notes || 'Nessun dettaglio aggiuntivo'}`;
      
      alert(message);
      return;
    }
    
    console.log('💾 STARTING handleSave with tempData:', tempData);
    
    // Auto-complete any partial times before saving
    let finalStartTime = tempData.startTime;
    let finalEndTime = tempData.endTime;
    
    if (finalStartTime && !isValidTimeFormat(finalStartTime)) {
      finalStartTime = smartFormatTime(finalStartTime);
      console.log(`💾 Auto-completing start time: "${tempData.startTime}" → "${finalStartTime}"`);
    }
    
    if (finalEndTime && !isValidTimeFormat(finalEndTime)) {
      finalEndTime = smartFormatTime(finalEndTime);
      console.log(`💾 Auto-completing end time: "${tempData.endTime}" → "${finalEndTime}"`);
    }
    
    if (!finalStartTime || !finalEndTime) {
      console.warn('❌ Save blocked: missing required times');
      alert('Inserisci orario di inizio e fine');
      return;
    }

    // Validate time format
    if (!isValidTimeFormat(finalStartTime) || !isValidTimeFormat(finalEndTime)) {
      alert('Formato orario non valido. Usa HH:MM (es: 14:30) o digita solo numeri (es: 1430)');
      return;
    }
    
    // 🔧 CRITICAL FIX: Handle break duration correctly including zero
    let breakMinutes: number;
    
    // Se il campo è vuoto, usa il default
    if (tempData.breakDuration === '') {
      breakMinutes = defaultBreakDuration;
    } else {
      // Altrimenti usa il valore inserito (incluso 0)
      const parsedBreak = parseInt(tempData.breakDuration);
      if (isNaN(parsedBreak)) {
        alert('La durata della pausa deve essere un numero valido');
        return;
      }
      breakMinutes = parsedBreak;
    }
    
    // Validate break duration
    if (breakMinutes < 0 || breakMinutes > 480) {
      console.warn('❌ Save blocked: invalid break duration');
      alert('La durata della pausa deve essere tra 0 e 480 minuti');
      return;
    }
    
    const actualHours = calculateWorkingHours(finalStartTime, finalEndTime, breakMinutes);
    
    if (actualHours < 0) {
      console.warn('❌ Save blocked: invalid working hours');
      alert('L\'orario di fine deve essere dopo l\'orario di inizio');
      return;
    }
    
    console.log('💾 Prepared data for save:', {
      startTime: finalStartTime,
      endTime: finalEndTime,
      breakDuration: breakMinutes,
      actualHours: actualHours.toFixed(2),
      employee: employee.id,
      date: date.toISOString()
    });
    
    // 🔧 CRITICAL FIX: Ensure all required fields are provided and the object is valid
    const safeDate = date instanceof Date ? date : new Date(date);
    
    try {
      const updateData: Partial<Shift> = {
        startTime: finalStartTime,
        endTime: finalEndTime,
        breakDuration: breakMinutes,
        actualHours,
        status: 'scheduled',
        date: safeDate,
        employeeId: employee.id,
        storeId: shift?.storeId || '', // Provide fallback
      };
      
      // 🛡️ VALIDATION: Ensure the object is not undefined and has required properties
      if (!updateData || typeof updateData !== 'object') {
        console.error('❌ CRITICAL: updateData is not a valid object:', updateData);
        alert('Errore interno: dati non validi');
        return;
      }
      
      // Validate required fields
      if (!updateData.employeeId || !updateData.date || !updateData.startTime || !updateData.endTime) {
        console.error('❌ CRITICAL: Missing required fields in updateData:', updateData);
        alert('Errore interno: campi obbligatori mancanti');
        return;
      }
      
      console.log('✅ CALLING onShiftChange with valid updateData:', updateData);
      
      // Call the update function with validated data
      onShiftChange(updateData);
      
      console.log('✅ Save completed, exiting edit mode');
      setIsEditing(false);
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in handleSave:', error);
      alert('Errore durante il salvataggio del turno');
    }
  };

  const handleCancel = () => {
    console.log('❌ Cancelling edit');
    setIsEditing(false);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleContextMenuAction = (action: string) => {
    setShowContextMenu(false);
    
    switch (action) {
      case 'copy':
        if (shift && onCopyShift && !isShiftCorrupted) {
          onCopyShift({
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakDuration: shift.breakDuration,
            notes: shift.notes
          });
        }
        break;
      case 'paste':
        if (onPasteShift && canEdit) {
          const copiedShift = onPasteShift();
          if (copiedShift) {
            applyShiftData(copiedShift);
          }
        }
        break;
      case 'template':
        if (canEdit) {
          setShowTemplateSelector(true);
        }
        break;
      case 'delete':
        if (shift && canEdit) {
          if (isShiftCorrupted) {
            if (confirm('Questo turno contiene dati corrotti. Vuoi eliminarlo?')) {
              onShiftDelete();
            }
          } else {
            onShiftDelete();
          }
        }
        break;
      case 'edit':
        if (canEdit) {
          startEditing();
        }
        break;
      case 'help':
        const helpMessage = `🔍 INFORMAZIONI TURNO
${shift ? '📋 TURNO ESISTENTE' : '🆕 NUOVA CELLA'}
${shift ? `ID: ${shift.id}` : ''}
${shift && isShiftCorrupted ? '🚨 DATI CORROTTI RILEVATI' : ''}
📅 Data: ${date.toLocaleDateString('it-IT')}
👤 Dipendente: ${employee.firstName} ${employee.lastName}
🔒 Modifica: ${canEdit ? '✅ Consentita' : '❌ Bloccata'}
${isLocked ? '🔐 Turno bloccato' : '🔓 Turno sbloccato'}
👥 Ruolo utente: ${userRole}
${hasClipboard ? '📋 Clipboard disponibile (Ctrl+V)' : ''}
${conflicts.length > 0 ? `⚠️ ${conflicts.length} conflitti rilevati` : '✅ Nessun conflitto'}

💡 INSERIMENTO ORARI SMART:
• Digita liberamente: 9, 945, 1530
• Tab o click fuori per auto-completare
• Ctrl+9 = 09:00, Ctrl+1 = 13:00, Ctrl+Shift+1 = 18:00

⏰ PAUSA:
• 0 minuti = Nessuna pausa
• Valore massimo: 480 minuti (8 ore)

🎯 TEMPLATE TURNI:
• Ctrl+T = Apri selezione template
• 🌅 Apertura: 06:00-12:00
• ☀️ Mediano: 12:00-17:00  
• 🌙 Chiusura: 17:00-24:00

✏️ MODIFICA MANUALE:
• Doppio click = Modifica rapida
• Click destro = Menu completo
• Enter = Salva, Esc = Annulla`;
        alert(helpMessage);
        break;
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    if (onApplyTemplate && canEdit) {
      onApplyTemplate(templateId);
    }
    setShowTemplateSelector(false);
  };

  // 🔧 FIXED CALCULATION: Improved working hours calculation
  const calculateWorkingHours = (start: string, end: string, breakMinutes: number): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    
    // CRITICAL: Ensure break minutes is treated as number
    const breakMins = Number(breakMinutes) || 0;
    const workingMinutes = Math.max(0, endTotalMin - startTotalMin - breakMins);
    
    console.log('🧮 Calculating hours:', {
      start: `${startHour}:${startMin}`,
      end: `${endHour}:${endMin}`,
      startMin: startTotalMin,
      endMin: endTotalMin,
      breakMins,
      workingMinutes,
      hours: workingMinutes / 60
    });
    
    return workingMinutes / 60;
  };

  // 🆕 DOPPIO CLICK PER MODIFICA RAPIDA
  const handleCellDoubleClick = () => {
    if (canEdit && !isEditing && !isStoreClosed.closed) {
      startEditing();
    }
  };

  // 🔧 FIXED: Real-time hours calculation with proper zero handling
  const calculateLiveHours = () => {
    if (tempData.startTime && tempData.endTime && 
        isValidTimeFormat(tempData.startTime) && isValidTimeFormat(tempData.endTime)) {
      
      // Handle break duration properly including zero
      let breakMinutes: number;
      if (tempData.breakDuration === '') {
        breakMinutes = 0; // Default to 0 if empty for live calculation
      } else {
        const parsed = parseInt(tempData.breakDuration);
        breakMinutes = isNaN(parsed) ? 0 : parsed;
      }
      
      return calculateWorkingHours(tempData.startTime, tempData.endTime, breakMinutes);
    }
    return 0;
  };

  const liveHours = calculateLiveHours();
  const isValidTime = tempData.startTime && tempData.endTime && 
                     isValidTimeFormat(tempData.startTime) && isValidTimeFormat(tempData.endTime) && 
                     liveHours >= 0;

  // Create tooltip content from conflicts
  const tooltipContent = conflicts.map(conflict => conflict.message).join('\n');

  // EDITING MODE UI - con auto-completamento migliorato e suggerimento template
  if (isEditing && canEdit) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg p-3 space-y-3 min-h-[160px] shadow-lg min-w-[180px] print:hidden">
        <div className="flex items-center justify-between pb-1 border-b border-blue-200">
          <div className="flex items-center space-x-1">
            <Edit className="h-3 w-3 text-blue-600" />
            <span className="text-xs text-blue-800 font-medium">
              {shift ? 'Modifica Turno' : 'Nuovo Turno'}
            </span>
          </div>
          <div className="flex space-x-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isValidTime}
              className="!px-2 !py-1 !text-xs !bg-green-600 !hover:bg-green-700 disabled:!bg-gray-400"
            >
              <Check className="h-2 w-2 mr-1" />
              OK
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="!px-2 !py-1 !text-xs"
            >
              <X className="h-2 w-2" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-gray-700 font-medium">
                🕘 Inizio
              </label>
              <input
                ref={startTimeRef}
                type="text"
                value={tempData.startTime}
                onChange={(e) => handleTimeInputChange('startTime', e.target.value)}
                onKeyDown={(e) => handleTimeInputKeyDown('startTime', e)}
                onBlur={() => handleTimeInputBlur('startTime')}
                className="w-full px-2 py-2 text-sm text-center border-2 border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono transition-all"
                placeholder="9 o 945"
                maxLength={5}
                title="Digita liberamente: 9, 945, 1530. Tab per auto-completare."
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-xs text-gray-700 font-medium">
                🕐 Fine
              </label>
              <input
                ref={endTimeRef}
                type="text"
                value={tempData.endTime}
                onChange={(e) => handleTimeInputChange('endTime', e.target.value)}
                onKeyDown={(e) => handleTimeInputKeyDown('endTime', e)}
                onBlur={() => handleTimeInputBlur('endTime')}
                className="w-full px-2 py-2 text-sm text-center border-2 border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono transition-all"
                placeholder="17 o 1730"
                maxLength={5}
                title="Digita liberamente: 17, 1730. Tab per auto-completare."
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="block text-xs text-gray-700 font-medium">
              ☕ Pausa (min)
            </label>
            <input
              type="number"
              value={tempData.breakDuration}
              onChange={(e) => setTempData(prev => ({ ...prev, breakDuration: e.target.value }))}
              className="w-full px-2 py-2 text-sm text-center border-2 border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              min="0"
              max="480"
              step="5"
              placeholder="0"
              title="0 = Nessuna pausa, Max 480 minuti (8h)"
            />
            <div className="text-xs text-gray-500 text-center">
              {tempData.breakDuration === '0' ? 
                '✅ Nessuna pausa' : 
                tempData.breakDuration && tempData.breakDuration !== '' ? 
                  `${tempData.breakDuration} minuti di pausa` : 
                  'Inserisci minuti di pausa'
              }
            </div>
          </div>
          
          <div className={`p-2 rounded-md border-2 text-center transition-all ${
            isValidTime 
              ? 'bg-green-50 border-green-300 text-green-800' 
              : 'bg-yellow-50 border-yellow-300 text-yellow-800'
          }`}>
            <div className="flex items-center justify-center space-x-1">
              <Calculator className="h-3 w-3" />
              <span className="text-xs font-medium">
                {isValidTime 
                  ? `${liveHours.toFixed(1)}h di lavoro`
                  : 'Completa gli orari'
                }
              </span>
            </div>
          </div>
          
          {/* 🎯 QUICK TEMPLATE BUTTON */}
          <div className="pt-1 border-t border-blue-200">
            <Button
              size="sm"
              variant="outline" 
              icon={Zap}
              onClick={() => setShowTemplateSelector(true)}
              className="w-full !py-1 !text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
            >
              Template Veloci
            </Button>
          </div>
        </div>

        {/* Help compatto */}
        <div className="pt-2 border-t border-blue-200">
          <div className="text-xs text-blue-600 space-y-1">
            <div>💡 <strong>Digitazione libera:</strong> 9 → 09:00, 945 → 09:45</div>
            <div>⌨️ <strong>Auto-complete:</strong> Tab o click fuori campo</div>
            <div>⏰ <strong>Pausa zero:</strong> Inserisci 0 per nessuna pausa</div>
            <div>✏️ <strong>Salva:</strong> Enter o click OK</div>
          </div>
        </div>
      </div>
    );
  }

  // CORRUPTED SHIFT WARNING
  if (isShiftCorrupted) {
    return (
      <div
        ref={cellRef}
        className="relative min-h-[60px] p-2 rounded-lg border-2 border-red-500 bg-red-50 cursor-pointer print:hidden"
        onClick={() => {
          if (confirm('Questo turno contiene dati corrotti. Vuoi eliminarlo?')) {
            onShiftDelete();
          }
        }}
      >
        <div className="flex flex-col items-center justify-center h-full space-y-1">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <div className="text-xs text-red-800 text-center">
            CORROTTO
          </div>
          <div className="text-xs text-red-600 text-center">
            Clicca per eliminare
          </div>
        </div>
      </div>
    );
  }

  // EXISTING SHIFT DISPLAY WITH FIXED ZERO BREAK HANDLING
  if (shift) {
    return (
      <>
        <div
          ref={cellRef}
          className={`
            relative min-h-[60px] p-2 rounded-lg border-2 transition-all duration-200 cursor-pointer print:min-h-[40px] print:p-1
            ${getValidationBorderStyle()}
            ${isEmployeeUnavailable ? 'bg-red-100 border-red-400 ring-1 ring-red-300' : ''}
            ${hasErrors ? 'bg-red-50 border-red-300' : ''}
            ${hasWarnings && !hasErrors ? 'bg-yellow-50 border-yellow-300' : ''}
            ${isSourceCell ? 'bg-green-50 border-green-300 ring-1 ring-green-200' : ''}
            ${isLocked ? 'bg-orange-50 border-orange-300' : ''}
            ${!hasErrors && !hasWarnings && !isSourceCell && !isLocked && !isEmployeeUnavailable ? 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50' : ''}
            ${!canEdit ? 'cursor-not-allowed opacity-75' : ''}
          `}
          onClick={handleCellDoubleClick}
          onDoubleClick={handleCellDoubleClick}
          onContextMenu={handleRightClick}
          tabIndex={0}
          title={
            isEmployeeUnavailable 
              ? `ATTENZIONE: ${employee.firstName} ${employee.lastName} non disponibile (${unavailabilityDetails?.type})` 
              : canEdit 
                ? "Doppio click per modificare" 
                : "Turno bloccato"
          }
        >
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-900 leading-tight print:text-xs font-mono font-semibold">
              {shift.startTime}-{shift.endTime}
            </div>
            <div className="flex space-x-1 no-print">
              {isEmployeeUnavailable && <UserX className="h-2 w-2 text-red-600" />}
              {isSourceCell && <Copy className="h-2 w-2 text-green-600" />}
              {hasClipboard && canEdit && <Clipboard className="h-2 w-2 text-blue-600" />}
              {isLocked && <Lock className="h-2 w-2 text-orange-600" />}
              {getValidationIcon() && (
                <span className="text-xs" title={`Stato: ${statusConfig?.label}`}>
                  {getValidationIcon()}
                </span>
              )}
              {canEdit && <Edit className="h-2 w-2 text-gray-400 opacity-50" />}
            </div>
          </div>

          {/* 🚫 UNAVAILABILITY WARNING BANNER */}
          {isEmployeeUnavailable && (
            <div className="mb-2 p-1 bg-red-200 border border-red-400 rounded text-xs text-red-800 text-center no-print">
              <div className="flex items-center justify-center space-x-1">
                <UserX className="h-3 w-3" />
                <span className="font-medium">NON DISPONIBILE</span>
              </div>
              {unavailabilityDetails && (
                <div className="mt-1 text-xs">
                  {(() => {
                    const typeLabels = {
                      holiday: '🏖️ Ferie',
                      sick: '🤒 Malattia',
                      personal: '🏠 Personale', 
                      training: '📚 Formazione',
                      other: '❓ Altro'
                    };
                    return typeLabels[unavailabilityDetails.type];
                  })()}
                </div>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            <div className="text-xs text-gray-600 print:text-xs">
              {/* 🔧 FIXED: Proper zero break display */}
              {shift.breakDuration === 0 ? (
                <span className="text-blue-600 font-medium">Nessuna pausa</span>
              ) : (
                <span>{shift.breakDuration}min pausa</span>
              )}
              <span className="mx-1">•</span>
              <span className="font-medium">{shift.actualHours.toFixed(1)}h</span>
              
              {/* 🆕 INDICATORI REQUISITI PERSONALE */}
              {hasActiveEvents && (
                <div className="text-xs text-yellow-600 font-medium no-print">
                  ⚡ {staffMultiplier}x evento
                </div>
              )}
            </div>
            
            {/* Status badge - nascosto nel PDF */}
            <div className={`inline-flex items-center px-1 py-0.5 rounded text-xs no-print ${
              shift.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
              shift.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              shift.status === 'completed' ? 'bg-gray-100 text-gray-800' :
              'bg-red-100 text-red-800'
            }`}>
              {shift.status === 'scheduled' ? 'Programmato' :
               shift.status === 'confirmed' ? 'Confermato' :
               shift.status === 'completed' ? 'Completato' :
               'Annullato'}
            </div>
            
            {/* 🆕 INDICATORE CONFORMITÀ REQUISITI PERSONALE */}
            {hasStaffConstraints && (
              <div className="text-xs no-print">
                <span className="text-purple-600">
                  👥 {staffNeed.calculatedStaff.reduce((sum, role) => sum + role.weightedMin, 0)}-{staffNeed.calculatedStaff.reduce((sum, role) => sum + role.weightedMax, 0)} richiesti
                </span>
              </div>
            )}
          </div>

          {(hasErrors || hasWarnings) && (
            <div className="absolute top-1 right-1 group no-print">
              <AlertTriangle 
                className={`h-3 w-3 cursor-help ${
                  hasErrors ? 'text-red-500' : 'text-yellow-500'
                }`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              />
              
              {/* Tooltip compatto e ridimensionato */}
              {showTooltip && (
                <div className="absolute z-50 top-full right-0 mt-1 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg w-56 max-h-24 overflow-y-auto">
                  <div className="mb-1">
                    {hasErrors ? '🚨 Errori:' : '⚠️ Avvisi:'}
                  </div>
                  <div className="space-y-0.5">
                    {conflicts.map((conflict, index) => (
                      <div key={index} className="text-xs leading-tight">
                        {conflict.message.includes('CCNL') ? (
                          <span className="text-red-200 font-medium">🏛️ {conflict.message}</span>
                        ) : (
                          <span>• {conflict.message}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Freccia del tooltip */}
                  <div className="absolute -top-1 right-2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <div className="absolute bottom-1 right-1 no-print">
              <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                ✏️
              </div>
            </div>
          )}
        </div>

        {showContextMenu && (
          <ContextMenu
            x={contextMenuPosition.x}
            y={contextMenuPosition.y}
            onClose={() => setShowContextMenu(false)}
            onAction={handleContextMenuAction}
            hasShift={!!shift}
            hasClipboard={hasClipboard}
            canEdit={canEdit}
          />
        )}

        {showTemplateSelector && canEdit && (
          <TemplateSelector
            onSelect={handleTemplateSelect}
            onClose={() => setShowTemplateSelector(false)}
            suggestedTime={shift.startTime} // Passa l'orario attuale per suggerimenti
          />
        )}
      </>
    );
  }

  // EMPTY CELL - versione compatta con doppio click
  return (
    <>
      <div
        ref={cellRef}
        className={`
          relative min-h-[60px] p-2 rounded-lg border-2 border-dashed transition-all duration-200 print:min-h-[40px] print:p-1 
          ${isEmployeeUnavailable 
            ? 'bg-red-100 border-red-300 cursor-not-allowed' 
            : isStoreClosed.closed
              ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
            : canEdit 
              ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer' 
              : 'border-gray-200 cursor-not-allowed opacity-50'
          }
          ${hasClipboard && canEdit && !isEmployeeUnavailable ? 'bg-blue-25 border-blue-200' : 'bg-gray-25'}
        `}
        onClick={!isEmployeeUnavailable && !isStoreClosed.closed ? handleCellDoubleClick : undefined}
        onDoubleClick={!isEmployeeUnavailable && !isStoreClosed.closed ? handleCellDoubleClick : undefined}
        onContextMenu={handleRightClick}
        tabIndex={0}
        title={
          isEmployeeUnavailable 
            ? `${employee.firstName} ${employee.lastName} non disponibile (${unavailabilityDetails?.type})` 
            : isStoreClosed.closed
              ? isStoreClosed.reason
            : canEdit 
              ? "Doppio click per creare turno" 
              : "Modifica bloccata"
        }
      >
        {isEmployeeUnavailable ? (
          <div className="h-full flex flex-col items-center justify-center space-y-1 text-red-600 print:space-y-0">
            <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center print:w-4 print:h-4">
              <UserX className="h-3 w-3 print:h-2 print:w-2" />
            </div>
            <span className="text-xs text-center print:text-xs">Non Disponibile</span>
            
            {unavailabilityDetails && (
              <div className="text-xs text-center text-red-500 no-print">
                {(() => {
                  const typeLabels = {
                    holiday: '🏖️ Ferie',
                    sick: '🤒 Malattia',
                    personal: '🏠 Personale',
                    training: '📚 Formazione',
                    other: '❓ Altro'
                  };
                  return typeLabels[unavailabilityDetails.type];
                })()}
              </div>
            )}
          </div>
        ) : isStoreClosed.closed ? (
          <div className="h-full flex flex-col items-center justify-center space-y-1 text-gray-500 print:space-y-0">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center print:w-4 print:h-4">
              <X className="h-3 w-3 print:h-2 print:w-2" />
            </div>
            <span className="text-xs text-center print:text-xs">Negozio</span>
            <span className="text-xs text-center print:text-xs">Chiuso</span>
          </div>
        ) : canEdit ? (
          <div className="h-full flex flex-col items-center justify-center space-y-1 text-gray-500 print:space-y-0">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center print:w-4 print:h-4">
              <Plus className="h-3 w-3 print:h-2 print:w-2" />
            </div>
            <span className="text-xs text-center print:text-xs">Doppio click</span>
            
            {hasClipboard && (
              <div className="flex items-center justify-center text-xs text-blue-600 bg-blue-100 rounded px-1 py-0.5 no-print">
                <Clipboard className="h-2 w-2 mr-1" />
                <span>Ctrl+V</span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-1 text-gray-400 print:space-y-0">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center print:w-4 print:h-4">
              <Lock className="h-3 w-3 print:h-2 print:w-2" />
            </div>
            <span className="text-xs text-center print:text-xs">Bloccato</span>
          </div>
        )}
      </div>

      {showContextMenu && (
        <ContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onClose={() => setShowContextMenu(false)}
          onAction={handleContextMenuAction}
          hasShift={false}
          hasClipboard={hasClipboard}
          canEdit={canEdit}
        />
      )}

      {showTemplateSelector && canEdit && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
          suggestedTime={tempData.startTime || '09:00'} // Suggerimento iniziale
        />
      )}
    </>
  );
};