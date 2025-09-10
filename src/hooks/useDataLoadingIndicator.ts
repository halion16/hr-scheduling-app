import { useState, useEffect } from 'react';

export const useDataLoadingIndicator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  useEffect(() => {
    // Simula il tempo di caricamento dei dati
    const timer = setTimeout(() => {
      setIsLoading(false);
      setDataLoaded(true);
      console.log('✅ Initial data loading completed');
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  return { isLoading, dataLoaded };
};