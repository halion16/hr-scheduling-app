import React from 'react';
import { UserProfile } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { RefreshDataButton } from '../common/RefreshDataButton';
import { LogOut, User, Shield, Settings, Database } from 'lucide-react';

export interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  permission: string;
  minRole: 'admin' | 'manager' | 'user';
}

interface NavigationBarProps {
  profile: UserProfile;
  currentView: string;
  navigation: NavigationItem[];
  onViewChange: (view: string) => void;
  onSignOut: () => void;
  onOpenPreferences: () => void;
  onOpenApiSettings?: () => void;
  onRefreshData: () => void;
  dataStats: {
    employees: number;
    stores: number;
    shifts: number;
  };
  dataLoaded: boolean;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  profile,
  currentView,
  navigation,
  onViewChange,
  onSignOut,
  onOpenPreferences,
  onOpenApiSettings,
  onRefreshData,
  dataStats,
  dataLoaded
}) => {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Prima riga: Logo + Info utente */}
        <div className="flex justify-between items-center h-12 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Settings className="h-6 w-6 text-blue-600" />
              <span className="ml-2 text-lg font-bold text-gray-900">Gestione HR</span>
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">v3.0</span>
            </div>
            
            {/* Indicatori di stato compatti */}
            <div className="flex items-center space-x-2">
              {dataLoaded && (
                <div className="flex items-center space-x-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Online</span>
                </div>
              )}
              
              <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                {dataStats.employees} dip. • {dataStats.stores} neg. • {dataStats.shifts} turni
              </div>
            </div>
          </div>
          
          {/* Controlli utente a destra */}
          <div className="flex items-center space-x-3">
            {/* User Profile Info */}
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3 text-gray-500" />
                <span className="font-medium text-gray-700">{profile.first_name} {profile.last_name}</span>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                profile.role === 'admin' ? 'bg-red-100 text-red-800' :
                profile.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {profile.role === 'admin' ? '👑 Admin' : 
                 profile.role === 'manager' ? '🛡️ Manager' : 
                 '👤 User'}
              </div>
            </div>

            {/* Pulsante refresh dati */}
            <RefreshDataButton 
              onRefresh={onRefreshData}
              className="no-print !text-xs !p-1"
            />
            
            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              icon={LogOut}
              onClick={onSignOut}
              className="text-red-600 hover:text-red-700 border-red-300"
              title="Esci dal sistema"
            >
              Esci
            </Button>
            
            {onOpenApiSettings && (
              <Button
                variant="outline"
                size="sm"
                icon={Database}
                onClick={onOpenApiSettings}
                className="text-green-600 hover:text-green-700 border-green-300"
                title="Impostazioni API Aziendale"
              >
                API
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              icon={Settings}
              onClick={onOpenPreferences}
              className="text-gray-600 hover:text-gray-900"
            >
              Preferenze
            </Button>
          </div>
        </div>
        
        {/* Seconda riga: Navigazione principale */}
        <div className="flex items-center justify-center py-3">
          <nav className="flex flex-wrap items-center justify-center gap-1 max-w-full">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:scale-105 ${
                    currentView === item.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};