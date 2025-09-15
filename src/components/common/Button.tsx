import { useAuth } from '../../hooks/useAuth';
import { Permission } from '../../hooks/useAuth';
import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  requirePermission?: Permission;
  requireRole?: 'admin' | 'manager' | 'user';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  type = 'button',
  className = '',
  requirePermission,
  requireRole
}) => {
  const { hasPermission, profile } = useAuth();
  
  // Check permission requirements
  const hasRequiredPermission = !requirePermission || hasPermission(requirePermission);
  
  // Check role requirements
  const hasRequiredRole = !requireRole || (() => {
    if (!profile) return false;
    const roleHierarchy = { admin: 3, manager: 2, user: 1 };
    const userLevel = roleHierarchy[profile.role];
    const requiredLevel = roleHierarchy[requireRole];
    return userLevel >= requiredLevel;
  })();
  
  const isDisabled = disabled || !hasRequiredPermission || !hasRequiredRole;
  
  // Don't render button if user doesn't have required permissions (for cleaner UI)
  if (requirePermission && !hasRequiredPermission) {
    return null;
  }
  
  if (requireRole && !hasRequiredRole) {
    return null;
  }

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-sm',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500'
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      title={
        !hasRequiredPermission ? `Richiede permesso: ${requirePermission}` :
        !hasRequiredRole ? `Richiede ruolo: ${requireRole}` :
        undefined
      }
    >
      {Icon && <Icon className={`${children ? 'mr-2' : ''} h-4 w-4`} />}
      {children}
    </button>
  );
};