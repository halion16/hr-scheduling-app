import { useState, useEffect } from 'react';

// Sistema di broadcast per sincronizzazione cross-domain
const BROADCAST_CHANNEL_NAME = 'hr-app-data-sync';
let broadcastChannel: BroadcastChannel | null = null;

// Inizializza BroadcastChannel se disponibile
const initBroadcastChannel = () => {
  if (typeof BroadcastChannel !== 'undefined' && !broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch (error) {
      console.warn('⚠️ BroadcastChannel not available:', error);
    }
  }
};

// Hook per sincronizzazione cross-tab
const useCrossTabSync = (key: string, setValue: (value: any) => void) => {
  useEffect(() => {
    // Inizializza BroadcastChannel
    initBroadcastChannel();
    
    // Listener per BroadcastChannel (cross-domain)
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data.type === 'storage-update' && event.data.key === key) {
        try {
          const parsed = JSON.parse(event.data.value, (key, value) => {
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
          
          setValue(parsed);
        } catch (error) {
          console.error(`❌ Error parsing broadcast data for "${key}":`, error);
        }
      }
    };
    
    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcastMessage);
    }
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          
          // Enhanced reviver function (same as in main hook)
          const parsed = JSON.parse(e.newValue, (key, value) => {
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
            
            // Handle corrupted date fields
            if (dateFields.includes(key)) {
              if (value === null || value === undefined) {
                console.warn(`🛠️ Repairing null date field "${key}" in cross-tab sync`);
                return new Date();
              }
            }
            
            return value;
          });
          
          // Clean data if it's an array (same validation as main hook)
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
            
            setValue(cleanedArray);
          } else {
            setValue(parsed);
          }
          
        } catch (error) {
          console.error(`❌ Error in cross-tab sync for "${key}":`, error);
        }
      }
    };

    // Listen for storage changes from other tabs
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcastMessage);
      }
    };
  }, [key, setValue]);
};

// Forza refresh dati dal localStorage
const forceRefreshFromStorage = (key: string): any => {
  try {
    const item = window.localStorage.getItem(key);
    if (!item) return null;
    
    return JSON.parse(item, (key, value) => {
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
  } catch (error) {
    console.error(`❌ Error force refreshing "${key}":`, error);
    return null;
  }
};

export function useLocalStorage<T>(key: string, initialValue: T) {
  // 🆕 IMPROVED INITIAL STATE LOADING
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        
        // Enhanced reviver function
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
        
        // Validate and clean array data
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
      
      // Serialization with date conversion
      const serializedValue = JSON.stringify(valueToStore, (key, val) => {
        if (val instanceof Date && !isNaN(val.getTime())) {
          return val.toISOString();
        }
        return val;
      });
      
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, serializedValue);
      
      // 🆕 FORCE CROSS-TAB UPDATE - Trigger storage event manually AND BroadcastChannel
      setTimeout(() => {
        // Trigger storage event for same-domain tabs
        window.dispatchEvent(new StorageEvent('storage', {
          key: key,
          newValue: serializedValue,
          oldValue: null,
          storageArea: localStorage,
          url: window.location.href
        }));
        
        // Broadcast to cross-domain tabs
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: 'storage-update',
            key: key,
            value: serializedValue,
            timestamp: new Date().toISOString()
          });
        }
      }, 0);
      
    } catch (error) {
      console.error(`❌ Error saving "${key}":`, error);
    }
  };

  // 🆕 MANUAL REFRESH FUNCTION
  const refreshFromStorage = () => {
    const freshData = forceRefreshFromStorage(key);
    if (freshData !== null) {
      setStoredValue(freshData);
    }
  };

  // Enable cross-tab synchronization
  useCrossTabSync(key, setStoredValue);

  return [storedValue, setValue, refreshFromStorage] as const;
}