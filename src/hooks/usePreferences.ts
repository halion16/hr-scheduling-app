import { useLocalStorage } from './useLocalStorage';
import { Preferences } from '../types';

const defaultPreferences: Preferences = {
  defaultBreakDuration: 30,
  language: 'it',
  theme: 'light',
  dateFormat: 'dd/mm/yyyy',
  userRole: 'admin' // Default come admin per la demo
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useLocalStorage<Preferences>('hr-preferences', defaultPreferences);

  const updatePreferences = (updates: Partial<Preferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences
  };
};