import React, { useEffect, useRef } from 'react';
import { Copy, Clipboard, Zap, Edit3, Trash2, Lock, HelpCircle, Info } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
  hasShift: boolean;
  hasClipboard: boolean;
  canEdit?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onAction,
  hasShift,
  hasClipboard,
  canEdit = true
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    ...(hasShift ? [
      {
        icon: Copy,
        label: 'Copia Turno',
        action: 'copy',
        shortcut: 'Ctrl+C',
        disabled: false
      },
      {
        icon: Edit3,
        label: 'Modifica',
        action: 'edit',
        disabled: !canEdit
      }
    ] : []),
    ...(hasClipboard && canEdit ? [
      {
        icon: Clipboard,
        label: 'Incolla Turno',
        action: 'paste',
        shortcut: 'Ctrl+V',
        disabled: false
      }
    ] : []),
    {
      icon: Zap,
      label: 'Applica Template',
      action: 'template',
      shortcut: 'Ctrl+T',
      disabled: !canEdit
    },
    ...(hasShift && canEdit ? [
      {
        icon: Trash2,
        label: 'Elimina Turno',
        action: 'delete',
        className: 'text-red-600 hover:bg-red-50',
        disabled: false
      }
    ] : []),
    // Aggiungi opzione aiuto sempre disponibile
    {
      icon: HelpCircle,
      label: 'Informazioni Stato',
      action: 'help',
      className: 'text-blue-600 hover:bg-blue-50 border-t border-gray-200',
      disabled: false
    }
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -10px)'
      }}
    >
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={() => !item.disabled && onAction(item.action)}
            disabled={item.disabled}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${
              item.className || 'text-gray-700'
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center">
              <Icon className="h-4 w-4 mr-3" />
              <span>{item.label}</span>
            </div>
            {item.shortcut && !item.disabled && (
              <span className="text-xs text-gray-400">{item.shortcut}</span>
            )}
            {item.disabled && (
              <Lock className="h-3 w-3 text-gray-400" />
            )}
          </button>
        );
      })}

      {!canEdit && (
        <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-200 bg-gray-50">
          <Info className="h-3 w-3 inline mr-1" />
          Modifica limitata - Vedi informazioni stato
        </div>
      )}
    </div>
  );
};