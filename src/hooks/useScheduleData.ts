import { useState, useEffect } from 'react';
import { Employee, Store, Shift, EmployeeUnavailability } from '../types';
import { ccnlValidator } from '../utils/ccnlValidation';
import { useLocalStorage } from './useLocalStorage';

// Hook per rilevare quando l'app diventa visibile (cambio tab)
const useVisibilityChange = () => {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  return isVisible;
};

export const useScheduleData = () => {
  const [employees, setEmployees, refreshEmployees] = useLocalStorage<Employee[]>('hr-employees', []);
  const [stores, setStores, refreshStores] = useLocalStorage<Store[]>('hr-stores', []);
  const [shifts, setShifts, refreshShifts] = useLocalStorage<Shift[]>('hr-shifts', []);
  const [unavailabilities, setUnavailabilities, refreshUnavailabilities] = useLocalStorage<EmployeeUnavailability[]>('hr-unavailabilities', []);

  // Force initial data load on mount (only once)
  useEffect(() => {
    refreshEmployees();
    refreshStores(); 
    refreshShifts();
    refreshUnavailabilities();
  }, []); // Empty dependency array - only run once on mount

  // Function to refresh all data from localStorage
  const refreshAllData = () => {
    refreshEmployees();
    refreshStores();
    refreshShifts();
    refreshUnavailabilities();
  };
  
  const isVisible = useVisibilityChange();

  // Data integrity check - only when data actually changes
  useEffect(() => {
    
    // Check for data corruption and repair if needed
    const corruptedShifts = shifts.filter(shift => {
      return !shift || !shift.id || !shift.date || 
             !(shift.date instanceof Date) || 
             isNaN(shift.date.getTime()) ||
             !shift.employeeId || !shift.storeId;
    });
    
    if (corruptedShifts.length > 0) {
      const repairedShifts = shifts.map(shift => {
        if (!shift || !shift.id) return null;
        
        // Repair corrupted dates
        const repaired = { ...shift };
        if (!shift.date || !(shift.date instanceof Date) || isNaN(shift.date.getTime())) {
          repaired.date = new Date();
        }
        
        if (!shift.createdAt || !(shift.createdAt instanceof Date) || isNaN(shift.createdAt.getTime())) {
          repaired.createdAt = new Date();
        }
        
        if (!shift.updatedAt || !(shift.updatedAt instanceof Date) || isNaN(shift.updatedAt.getTime())) {
          repaired.updatedAt = new Date();
        }
        
        if (shift.lockedAt && (!(shift.lockedAt instanceof Date) || isNaN(shift.lockedAt.getTime()))) {
          repaired.lockedAt = undefined;
        }
        
        // Ensure required fields
        if (!shift.employeeId || !shift.storeId) {
          return null;
        }
        
        return repaired;
      }).filter(Boolean) as Shift[];
      
      if (repairedShifts.length !== shifts.length) {
        setShifts(repairedShifts);
      }
    }
  }, [shifts.length]); // Only run when shifts array length changes

  // Force refresh when tab becomes visible (but not on initial mount)
  const [hasInitialized, setHasInitialized] = useState(false);
  useEffect(() => {
    if (isVisible && hasInitialized) {
      refreshAllData();
    } else if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [isVisible, hasInitialized]);

  // Helper function to validate shift data before operations
  const validateShiftData = (shiftData: any): boolean => {
    if (!shiftData || typeof shiftData !== 'object') {
      return false;
    }
    
    if (!shiftData.employeeId || !shiftData.storeId) {
      return false;
    }
    
    if (!shiftData.startTime || !shiftData.endTime) {
      console.error('❌ Invalid shift data: missing time fields');
      return false;
    }
    
    // CRITICAL: Validate date property exists and is a valid Date
    if (!shiftData.date) {
      console.error('❌ Invalid shift data: missing date property');
      return false;
    }
    
    if (!(shiftData.date instanceof Date)) {
      console.error('❌ Invalid shift data: date is not a Date instance');
      return false;
    }
    
    if (isNaN(shiftData.date.getTime())) {
      console.error('❌ Invalid shift data: date is invalid (NaN)');
      return false;
    }
    
    return true;
  };

  const addEmployee = (employee: Omit<Employee, 'createdAt' | 'updatedAt'>) => {
    const newEmployee: Employee = {
      ...employee,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('➕ Adding employee:', newEmployee.firstName, newEmployee.lastName);
    setEmployees(prev => [...prev, newEmployee]);
    return newEmployee;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    console.log('🔄 Updating employee:', id, updates);
    setEmployees(prev => prev.map(emp => 
      emp.id === id ? { ...emp, ...updates, updatedAt: new Date() } : emp
    ));
  };

  const deleteEmployee = (id: string) => {
    console.log('🗑️ Deleting employee:', id);
    setEmployees(prev => prev.filter(emp => emp.id !== id));
    setShifts(prev => prev.filter(shift => shift.employeeId !== id));
    setUnavailabilities(prev => prev.filter(unavail => unavail.employeeId !== id));
  };

  const addStore = (store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newStore: Store = {
      ...store,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('➕ Adding store:', newStore.name);
    setStores(prev => [...prev, newStore]);
    return newStore;
  };

  const updateStore = (id: string, updates: Partial<Store>) => {
    console.log('🔄 Updating store:', id, updates);
    setStores(prev => prev.map(store => 
      store.id === id ? { ...store, ...updates, updatedAt: new Date() } : store
    ));
  };

  const deleteStore = (id: string) => {
    console.log('🗑️ Deleting store:', id);
    setStores(prev => prev.filter(store => store.id !== id));
    setShifts(prev => prev.filter(shift => shift.storeId !== id));
    setEmployees(prev => prev.map(emp => 
      emp.storeId === id ? { ...emp, storeId: undefined } : emp
    ));
  };

  const addUnavailability = (unavailability: Omit<EmployeeUnavailability, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newUnavailability: EmployeeUnavailability = {
      ...unavailability,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('➕ Adding unavailability:', newUnavailability.employeeId, newUnavailability.startDate.toLocaleDateString(), '-', newUnavailability.endDate.toLocaleDateString());
    setUnavailabilities(prev => [...prev, newUnavailability]);
    return newUnavailability;
  };

  const updateUnavailability = (id: string, updates: Partial<EmployeeUnavailability>) => {
    console.log('🔄 Updating unavailability:', id, updates);
    setUnavailabilities(prev => prev.map(unavail => 
      unavail.id === id ? { ...unavail, ...updates, updatedAt: new Date() } : unavail
    ));
  };

  const deleteUnavailability = (id: string) => {
    console.log('🗑️ Deleting unavailability:', id);
    setUnavailabilities(prev => prev.filter(unavail => unavail.id !== id));
  };

  const addShift = (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!validateShiftData(shift)) {
      console.error('❌ Cannot add invalid shift data');
      return null;
    }
    
    // 🏛️ VERIFICA CCNL COMPLIANCE PRIMA DELL'AGGIUNTA
    const employee = employees.find(e => e.id === shift.employeeId);
    const store = stores.find(s => s.id === shift.storeId);
    if (employee) {
      const employeeShifts = shifts.filter(s => s.employeeId === employee.id);
      const { canAssign, violations } = ccnlValidator.canAssignShiftSafely(shift, employee, employeeShifts, store);
      
      if (!canAssign) {
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
          console.error('❌ CCNL VIOLATION: Cannot add shift due to mandatory rest period violations:', criticalViolations);
          
          // Show user-friendly error
          const violationMessages = criticalViolations.map(v => v.description).join('\n');
          alert(`🏛️ VIOLAZIONE CCNL del Commercio\n\nImpossibile assegnare il turno:\n\n${violationMessages}\n\nIl sistema non può violare i riposi obbligatori previsti dalla normativa.`);
          return null;
        }
      }
    }
    
    const newShift: Shift = {
      ...shift,
      id: crypto.randomUUID(),
      date: shift.date instanceof Date ? shift.date : new Date(shift.date),
      isLocked: shift.isLocked || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('➕ Adding new shift:', {
      id: newShift.id,
      employee: newShift.employeeId,
      time: `${newShift.startTime}-${newShift.endTime}`,
      date: newShift.date.toISOString()
    });
    
    setShifts(prev => {
      const newShifts = [...prev, newShift];
      console.log('📊 Total shifts after addition:', newShifts.length);
      return newShifts;
    });
    
    return newShift;
  };

  // COMPLETELY REWRITTEN updateShift function with robust error handling
  const updateShift = (id: string | any, updates: Partial<Shift>) => {
    // Handle case where entire shift object is passed as ID (common error case)
    let actualId: string;
    let actualUpdates: Partial<Shift>;
    
    if (typeof id === 'object' && id !== null && id.id) {
      console.warn('🔧 Received shift object as ID parameter, extracting actual ID');
      actualId = id.id;
      actualUpdates = updates;
    } else if (typeof id === 'string') {
      actualId = id;
      actualUpdates = updates;
    } else {
      console.error('❌ Invalid ID parameter for updateShift:', typeof id, id);
      return;
    }
    
    console.log('🔄 STARTING shift update:', { id: actualId, updates: actualUpdates });
    
    if (!actualId) {
      console.error('❌ Cannot update shift: missing or invalid ID');
      return;
    }
    
    // CRITICAL: Validate updates object before proceeding
    if (!actualUpdates || typeof actualUpdates !== 'object') {
      console.error('❌ Invalid updates object:', actualUpdates);
      return;
    }
    
    // 🔧 AUTOMATIC HOURS RECALCULATION when time or break changes
    if (actualUpdates.startTime || actualUpdates.endTime || actualUpdates.breakDuration !== undefined) {
      const existingShift = shifts.find(shift => shift.id === actualId);
      if (existingShift) {
        const startTime = actualUpdates.startTime || existingShift.startTime;
        const endTime = actualUpdates.endTime || existingShift.endTime;
        const breakDuration = actualUpdates.breakDuration !== undefined ? actualUpdates.breakDuration : existingShift.breakDuration;
        
        // Recalculate hours automatically
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const startTotalMin = startHour * 60 + startMin;
        const endTotalMin = endHour * 60 + endMin;
        const workingMinutes = Math.max(0, endTotalMin - startTotalMin - Number(breakDuration));
        const recalculatedHours = workingMinutes / 60;
        
        actualUpdates.actualHours = recalculatedHours;
        
        console.log('🧮 Auto-recalculated hours:', {
          startTime,
          endTime,
          breakDuration,
          oldHours: existingShift.actualHours,
          newHours: recalculatedHours
        });
      }
    }
    
    setShifts(prev => {
      // Filter out null/undefined elements first to prevent array corruption
      const validShifts = prev.filter(shift => shift && shift.id);
      
      console.log('🔍 Filtering shifts:', {
        original: prev.length,
        valid: validShifts.length,
        removed: prev.length - validShifts.length
      });
      
      // Find the shift index with detailed logging
      const shiftIndex = validShifts.findIndex(shift => {
        const matches = shift.id === actualId;
        return matches;
      });
      
      if (shiftIndex === -1) {
        console.error('❌ SHIFT NOT FOUND! Available shift IDs:');
        validShifts.forEach((shift, index) => {
          console.log(`  ${index}: ${shift.id}`);
        });
        console.error('❌ Wanted ID:', actualId);
        console.error('❌ Updates:', actualUpdates);
        
        // Try to find by other properties if ID search fails
        const alternativeMatch = validShifts.find(shift => 
          shift.employeeId === actualUpdates.employeeId && 
          shift.storeId === actualUpdates.storeId &&
          shift.date && actualUpdates.date &&
          shift.date.toDateString() === new Date(actualUpdates.date).toDateString()
        );
        
        if (alternativeMatch) {
          console.log('🔍 Found alternative match by properties:', alternativeMatch.id);
          // Recursively call with the correct ID
          setTimeout(() => updateShift(alternativeMatch.id, actualUpdates), 0);
        }
        
        return validShifts; // Return cleaned array even if no match found
      }
      
      const existingShift = validShifts[shiftIndex];
      console.log('📋 Found existing shift:', {
        id: existingShift.id,
        currentTime: `${existingShift.startTime}-${existingShift.endTime}`,
        currentDate: existingShift.date && existingShift.date instanceof Date && !isNaN(existingShift.date.getTime()) 
          ? existingShift.date.toISOString() 
          : 'INVALID DATE'
      });
      
      // CRITICAL: Ensure date is always valid before creating updated shift
      let validDate: Date;
      if (actualUpdates.date) {
        if (actualUpdates.date instanceof Date && !isNaN(actualUpdates.date.getTime())) {
          validDate = actualUpdates.date;
        } else {
          try {
            validDate = new Date(actualUpdates.date);
            if (isNaN(validDate.getTime())) {
              throw new Error('Invalid date');
            }
          } catch {
            console.warn('🔧 Invalid date in updates, using current date');
            validDate = new Date();
          }
        }
      } else if (existingShift.date && existingShift.date instanceof Date && !isNaN(existingShift.date.getTime())) {
        validDate = existingShift.date;
      } else {
        console.warn('🔧 Both new and existing dates are invalid, using current date as fallback');
        validDate = new Date();
      }
      
      // CRITICAL: Validate all required fields in actualUpdates
      const safeUpdates = { ...actualUpdates };
      
      // Ensure employeeId and storeId are preserved
      if (!safeUpdates.employeeId && existingShift.employeeId) {
        safeUpdates.employeeId = existingShift.employeeId;
      }
      if (!safeUpdates.storeId && existingShift.storeId) {
        safeUpdates.storeId = existingShift.storeId;
      }
      
      // Create updated shift with careful date handling
      const updatedShift: Shift = { 
        ...existingShift, 
        ...safeUpdates,
        date: validDate,
        updatedAt: new Date()
      };
      
      // Validate the updated shift
      if (!validateShiftData(updatedShift)) {
        console.error('❌ Updated shift data is invalid, aborting update');
        return validShifts;
      }
      
      console.log('✨ Created updated shift:', {
        id: updatedShift.id,
        newTime: `${updatedShift.startTime}-${updatedShift.endTime}`,
        newDate: updatedShift.date.toISOString()
      });
      
      // Create new array with updated shift
      const newShifts = [
        ...validShifts.slice(0, shiftIndex),
        updatedShift,
        ...validShifts.slice(shiftIndex + 1)
      ];
      
      console.log('✅ Update completed successfully. Total shifts:', newShifts.length);
      
      // Validate the new array
      const invalidShifts = newShifts.filter(s => !validateShiftData(s));
      if (invalidShifts.length > 0) {
        console.error('🚨 Invalid shifts detected after update:', invalidShifts.length);
        return validShifts; // Rollback to valid shifts
      }
      
      return newShifts;
    });
  };

  const deleteShift = (id: string) => {
    console.log('🗑️ Deleting shift:', id);
    setShifts(prev => {
      const filtered = prev.filter(shift => shift && shift.id !== id);
      console.log('📊 Shifts remaining after deletion:', filtered.length);
      return filtered;
    });
  };

  // Debug function to clear all data (useful for testing)
  const clearAllData = () => {
    console.log('🧹 CLEARING ALL DATA');
    setEmployees([]);
    setStores([]);
    setShifts([]);
    setUnavailabilities([]);
    localStorage.removeItem('hr-employees');
    localStorage.removeItem('hr-stores');
    localStorage.removeItem('hr-shifts');
    localStorage.removeItem('hr-unavailabilities');
  };

  // Add debug method to the returned object
  return {
    employees,
    stores,
    shifts,
    unavailabilities,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addStore,
    updateStore,
    deleteStore,
    addShift,
    updateShift,
    deleteShift,
    addUnavailability,
    updateUnavailability,
    deleteUnavailability,
    clearAllData,
    refreshAllData // 🆕 Manual refresh function
  };
};