import { useState } from 'react';

// Hook semplificato per localStorage senza cross-tab sync
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Stato iniziale con caricamento dal localStorage
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        
        // Enhanced reviver function per gestire le date
        const parsed = JSON.parse(item, (key, value) => {
          const dateFields = ['date', 'createdAt', 'updatedAt', 'startDate', 'endDate', 'lockedAt'];
          
          if (typeof value === 'string') {
            const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)?$/;
            
            if (isoDatePattern.test(value) || dateFields.includes(key)) {
              const dateObj = new Date(value);
              if (!isNaN(dateObj.getTime())) {
                return dateObj;
              }
            }
          }
          
          return value;
        });
        
        // Valida e pulisci i dati array
        if (Array.isArray(parsed)) {
          const cleanedArray = parsed.filter(item => {
            if (!item || typeof item !== 'object') {
              return false;
            }
            
            if (key === 'hr-shifts' && (!item.id || !item.employeeId || !item.storeId)) {
              return false;
            }
            
            if (key === 'hr-employees' && (!item.id || !item.firstName || !item.lastName)) {
              return false;
            }
            
            if (key === 'hr-stores' && (!item.id || !item.name)) {
              return false;
            }
            
            return true;
          });
          
          return cleanedArray as T;
        }
        
        return parsed;
      }
      
      return initialValue;
    } catch (error) {
      console.error(`❌ Error loading "${key}":`, error);
      
      try {
        window.localStorage.removeItem(key);
      } catch (clearError) {
        console.error(`❌ Failed to clear data:`, clearError);
      }
      
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Serializzazione con conversione date
      const serializedValue = JSON.stringify(valueToStore, (key, val) => {
        if (val instanceof Date && !isNaN(val.getTime())) {
          return val.toISOString();
        }
        return val;
      });
      
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, serializedValue);
      
    } catch (error) {
      console.error(`❌ Error saving "${key}":`, error);
    }
  };

  // Funzione per refresh manuale dal localStorage
  const refreshFromStorage = () => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item, (key, value) => {
          const dateFields = ['date', 'createdAt', 'updatedAt', 'startDate', 'endDate', 'lockedAt'];
          
          if (typeof value === 'string') {
            const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)?$/;
            
            if (isoDatePattern.test(value) || dateFields.includes(key)) {
              const dateObj = new Date(value);
              if (!isNaN(dateObj.getTime())) {
                return dateObj;
              }
            }
          }
          
          return value;
        });
        
        setStoredValue(parsed);
      }
    } catch (error) {
      console.error(`❌ Error refreshing "${key}":`, error);
    }
  };

  return [storedValue, setValue, refreshFromStorage] as const;
}