import React, { useState } from 'react';
import { UserProfile } from '../../hooks/useAuth';
import { NavigationItem } from './NavigationBar';
import { Button } from '../common/Button';
import { RefreshDataButton } from '../common/RefreshDataButton';
import { 
  LogOut, 
  User, 
  Shield, 
  Settings, 
  Database, 
  Bug,
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

interface SidebarSection {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  items: NavigationItem[];
  defaultExpanded?: boolean;
}

interface SidebarProps {
  profile: UserProfile;
  currentView: string;
  navigation: NavigationItem[];
  onViewChange: (view: string) => void;
  onSignOut: () => void;
  onOpenPreferences: () => void;
  onOpenApiSettings?: () => void;
  onOpenDebug?: () => void;
  onOpenValidationConfig?: () => void;
  onRefreshData: () => void;
  dataStats: {
    employees: number;
    stores: number;
    shifts: number;
  };
  dataLoaded: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  profile,
  currentView,
  navigation,
  onViewChange,
  onSignOut,
  onOpenPreferences,
  onOpenApiSettings,
  onOpenDebug,
  onOpenValidationConfig,
  onRefreshData,
  dataStats,
  dataLoaded
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['planning', 'reports']) // Default expanded sections
  );

  // 🏗️ ORGANIZZA NAVIGATION ITEMS IN SEZIONI LOGICHE
  const sections: SidebarSection[] = [
    {
      id: 'planning',
      name: 'Pianificazione',
      icon: Settings,
      defaultExpanded: true,
      items: navigation.filter(item => 
        ['schedule', 'timeline', 'validation'].includes(item.id)
      )
    },
    {
      id: 'reports',
      name: 'Reports & Analytics',
      icon: Settings,
      defaultExpanded: true,
      items: navigation.filter(item =>
        ['workload-dashboard', 'weekend-report', 'testing'].includes(item.id)
      )
    },
    {
      id: 'management',
      name: 'Gestione',
      icon: Settings,
      items: navigation.filter(item => 
        ['unavailability', 'hour-bank'].includes(item.id)
      )
    },
    {
      id: 'administration',
      name: 'Amministrazione',
      icon: Shield,
      items: navigation.filter(item => 
        ['employees', 'stores', 'users'].includes(item.id)
      )
    }
  ].filter(section => section.items.length > 0);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <Settings className="h-6 w-6 text-blue-400" />
              <div>
                <h1 className="text-lg font-bold">Gestione HR</h1>
                <span className="text-xs text-gray-400">v3.0</span>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
        
        {/* User Profile */}
        {!isCollapsed && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                  profile.role === 'admin' ? 'bg-red-900 text-red-200' :
                  profile.role === 'manager' ? 'bg-blue-900 text-blue-200' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {profile.role === 'admin' ? '👑 Admin' : 
                   profile.role === 'manager' ? '🛡️ Manager' : 
                   '👤 User'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Stats */}
        {!isCollapsed && dataLoaded && (
          <div className="mt-3 text-xs text-gray-400 bg-gray-800 p-2 rounded">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Sistema Online</span>
            </div>
            <div>
              {dataStats.employees} dipendenti • {dataStats.stores} negozi • {dataStats.shifts} turni
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2">
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const SectionIcon = section.icon;
            
            return (
              <div key={section.id} className="mb-2">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-2 text-left rounded hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <SectionIcon className="h-4 w-4 text-gray-400 group-hover:text-white" />
                    {!isCollapsed && (
                      <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                        {section.name}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="text-gray-400 group-hover:text-white">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </button>

                {/* Section Items */}
                {(isExpanded || isCollapsed) && (
                  <div className={`space-y-1 ${isCollapsed ? 'mt-1' : 'ml-6 mt-1'}`}>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      const hasAlerts = item.alertCount && item.alertCount > 0;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => onViewChange(item.id)}
                          className={`relative w-full flex items-center space-x-3 p-2 rounded text-left transition-colors group ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }`}
                          title={isCollapsed ? item.name : undefined}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="text-sm">{item.name}</span>
                              {hasAlerts && (
                                <span className={`ml-auto min-w-[1.25rem] h-5 flex items-center justify-center text-xs font-bold rounded-full px-1 ${
                                  item.alertCount > 5 
                                    ? 'bg-red-500 text-white'
                                    : 'bg-orange-500 text-white'
                                }`}>
                                  {item.alertCount > 99 ? '99+' : item.alertCount}
                                </span>
                              )}
                            </>
                          )}
                          {isCollapsed && hasAlerts && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-700 p-4 space-y-2">
        {!isCollapsed && (
          <>
            {/* Refresh Button */}
            <RefreshDataButton 
              onRefresh={onRefreshData}
              className="w-full justify-center bg-gray-800 hover:bg-gray-700 text-gray-300"
            />
            
            {/* Admin Actions */}
            {(onOpenApiSettings || onOpenValidationConfig || onOpenDebug) && (
              <div className="space-y-1">
                {onOpenApiSettings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Database}
                    onClick={onOpenApiSettings}
                    className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    Impostazioni API
                  </Button>
                )}

                {onOpenValidationConfig && profile?.role === 'admin' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Shield}
                    onClick={onOpenValidationConfig}
                    className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    Configurazione Validazione
                  </Button>
                )}

                {onOpenDebug && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Bug}
                    onClick={onOpenDebug}
                    className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
                  >
                    Debug Dipendenti
                  </Button>
                )}
              </div>
            )}

            {/* User Actions */}
            <div className="pt-2 space-y-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                onClick={onOpenPreferences}
                className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
              >
                Preferenze
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                icon={LogOut}
                onClick={onSignOut}
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                Esci
              </Button>
            </div>
          </>
        )}

        {/* Collapsed Actions */}
        {isCollapsed && (
          <div className="space-y-2 flex flex-col items-center">
            <RefreshDataButton 
              onRefresh={onRefreshData}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300"
              showText={false}
            />
            
            <button
              onClick={onOpenPreferences}
              className="p-2 rounded hover:bg-gray-800 text-gray-300 hover:text-white"
              title="Preferenze"
            >
              <Settings className="h-4 w-4" />
            </button>
            
            <button
              onClick={onSignOut}
              className="p-2 rounded hover:bg-red-900/20 text-red-400 hover:text-red-300"
              title="Esci"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-gray-900`}>
        {sidebarContent}
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
          
          {/* Mobile Sidebar */}
          <div className="fixed left-0 top-0 bottom-0 w-64 z-50 md:hidden">
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};