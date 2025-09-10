import { useLocalStorage } from './useLocalStorage';
import { Preferences } from '../types';
import { useEffect } from 'react';

const defaultPreferences: Preferences = {
  defaultBreakDuration: 30,
  language: 'it',
  theme: 'light',
  dateFormat: 'dd/mm/yyyy',
  userRole: 'admin' // Default come admin per la demo
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useLocalStorage<Preferences>('hr-preferences', defaultPreferences);

  // 🆕 Log quando le preferenze cambiano
  useEffect(() => {
    console.log('⚙️ Preferences updated:', preferences);
  }, [preferences]);
  const updatePreferences = (updates: Partial<Preferences>) => {
    console.log('🔧 Updating preferences:', updates);
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    console.log('🔄 Resetting preferences to default');
    setPreferences(defaultPreferences);
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences
  };
};