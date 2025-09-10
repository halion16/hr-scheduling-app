import React, { useState } from 'react';
import { Button } from './Button';
import { RefreshCw, Database, CheckCircle, AlertTriangle } from 'lucide-react';

interface RefreshDataButtonProps {
  onRefresh: () => void;
  className?: string;
}

export const RefreshDataButton: React.FC<RefreshDataButtonProps> = ({ 
  onRefresh, 
  className = '' 
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      console.log('🔄 Manual data refresh triggered');
      
      // Chiama la funzione di refresh
      onRefresh();
      
      setLastRefresh(new Date());
      
      // Mostra notifica di successo
      showNotification('✅ Dati aggiornati con successo!', 'success');
      
    } catch (error) {
      console.error('❌ Error during manual refresh:', error);
      showNotification('❌ Errore durante l\'aggiornamento', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 3000);
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Button
        size="sm"
        variant="outline"
        icon={isRefreshing ? RefreshCw : Database}
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`${isRefreshing ? 'animate-pulse' : ''} border-blue-300 text-blue-600 hover:bg-blue-50`}
        title="Aggiorna dati da localStorage"
      >
        {isRefreshing ? 'Aggiornando...' : 'Sincronizza'}
      </Button>
      
      {lastRefresh && (
        <div className="text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span>
              {lastRefresh.toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};