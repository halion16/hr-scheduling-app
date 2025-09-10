import { useCallback } from 'react';

export const useNotifications = () => {
  const showSuccessNotification = useCallback((message: string) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 15px;
      font-weight: 600;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    // Aggiungi animazione CSS se non esiste già
    let style = document.getElementById('notification-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }, []);

  const showErrorNotification = useCallback((message: string) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 15px;
      font-weight: 600;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  }, []);

  return {
    showSuccessNotification,
    showErrorNotification
  };
};