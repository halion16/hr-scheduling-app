import React from 'react';
import { useAuth, Permission } from '../../hooks/useAuth';
import { ShieldX, Lock, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requiredRole?: 'admin' | 'manager' | 'user';
  storeId?: string; // For store-specific access control
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  storeId,
  fallback
}) => {
  const { profile, hasPermission, canAccessStore, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return fallback || (
      <div className="text-center py-12">
        <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accesso Richiesto</h3>
        <p className="text-gray-500">Devi effettuare il login per accedere a questa sezione.</p>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole) {
    const roleHierarchy = { admin: 3, manager: 2, user: 1 };
    const userLevel = roleHierarchy[profile.role];
    const requiredLevel = roleHierarchy[requiredRole];
    
    if (userLevel < requiredLevel) {
      return fallback || (
        <div className="text-center py-12">
          <ShieldX className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Permessi Insufficienti</h3>
          <p className="text-gray-500">
            Questa funzionalità richiede ruolo {requiredRole === 'admin' ? 'Amministratore' : 'Manager'} o superiore.
          </p>
          <p className="text-sm text-gray-400 mt-2">Il tuo ruolo: {profile.role === 'admin' ? 'Amministratore' : profile.role === 'manager' ? 'Manager' : 'Utente'}</p>
        </div>
      );
    }
  }

  // Check specific permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || (
      <div className="text-center py-12">
        <ShieldX className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accesso Negato</h3>
        <p className="text-gray-500">Non hai i permessi necessari per accedere a questa funzionalità.</p>
        <p className="text-sm text-gray-400 mt-2">Permesso richiesto: {requiredPermission}</p>
      </div>
    );
  }

  // Check store-specific access
  if (storeId && !canAccessStore(storeId)) {
    return fallback || (
      <div className="text-center py-12">
        <ShieldX className="h-12 w-12 text-orange-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accesso Negozio Negato</h3>
        <p className="text-gray-500">Non hai accesso a questo negozio specifico.</p>
        <p className="text-sm text-gray-400 mt-2">Contatta un amministratore per richiedere l'accesso.</p>
      </div>
    );
  }

  return <>{children}</>;
};

// Hook for conditional rendering based on permissions
export const usePermissionGuard = () => {
  const { hasPermission, canAccessStore, profile } = useAuth();

  const renderIfPermission = (permission: Permission, children: React.ReactNode) => {
    return hasPermission(permission) ? children : null;
  };

  const renderIfRole = (role: 'admin' | 'manager' | 'user', children: React.ReactNode) => {
    if (!profile) return null;
    
    const roleHierarchy = { admin: 3, manager: 2, user: 1 };
    const userLevel = roleHierarchy[profile.role];
    const requiredLevel = roleHierarchy[role];
    
    return userLevel >= requiredLevel ? children : null;
  };

  const renderIfStoreAccess = (storeId: string, children: React.ReactNode) => {
    return canAccessStore(storeId) ? children : null;
  };

  return {
    renderIfPermission,
    renderIfRole,
    renderIfStoreAccess,
    hasPermission,
    canAccessStore,
    currentRole: profile?.role
  };
};