import React, { useState } from 'react';
import { Button } from '../common/Button';
import { ExcelImportModal } from './ExcelImportModal';
import { Employee, Store, Shift } from '../../types';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface ImportButtonProps {
  employees: Employee[];
  stores: Store[];
  existingShifts: Shift[];
  onAddShift: (shift: Omit<Shift, 'id' | 'createdAt' | 'updatedAt'>) => Shift | null;
  onAddEmployee: (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Employee;
  onUpdateShift: (id: string, updates: Partial<Shift>) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
}

export const ImportButton: React.FC<ImportButtonProps> = ({
  employees,
  stores,
  existingShifts,
  onAddShift,
  onAddEmployee,
  onUpdateShift,
  className = '',
  size = 'md',
  variant = 'outline'
}) => {
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportSuccess = () => {
    // Chiudi il modal e mostra notifica di successo
    setShowImportModal(false);
    
    // Mostra notifica di successo
    showSuccessNotification('Turni importati con successo! Controlla la griglia per vedere i nuovi turni.');
  };

  return (
    <>
      <Button
        icon={Upload}
        onClick={() => setShowImportModal(true)}
        variant={variant}
        size={size}
        className={`${className} border-green-300 text-green-700 hover:bg-green-50`}
        title="Importa turni da file Excel"
      >
        Importa Excel
      </Button>

      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        employees={employees}
        stores={stores}
        existingShifts={existingShifts}
        onAddShift={onAddShift}
        onAddEmployee={onAddEmployee}
        onUpdateShift={onUpdateShift}
      />
    </>
  );
};

// Utility function for success notification
function showSuccessNotification(message: string) {
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
  
  const style = document.createElement('style');
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
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }, 5000);
}