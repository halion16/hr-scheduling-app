import { useState, useMemo, useCallback } from 'react';
import { NavigationItem } from '../components/navigation/NavigationBar';
import { UserProfile } from './useAuth';
import {
  Users,
  Store as StoreIcon,
  Calendar,
  Settings,
  BarChart3,
  Grid,
  Coffee,
  CalendarX,
  Banknote,
  Shield,
  PieChart,
  Brain,
  Activity
} from 'lucide-react';

export type View = 'schedule' | 'timeline' | 'validation' | 'employees' | 'stores' | 'weekend-report' | 'unavailability' | 'hour-bank' | 'users' | 'workload-dashboard' | 'testing'; // | 'analytics'; // DISABLED: AI Analytics non era nella roadmap originale

interface UseNavigationProps {
  profile: UserProfile | null;
  hasPermission: (permission: string) => boolean;
}

export const useNavigation = ({ profile, hasPermission }: UseNavigationProps) => {
  const [currentView, setCurrentView] = useState<View>('schedule');

  const navigationItems: NavigationItem[] = useMemo(() => [
    { 
      id: 'schedule', 
      name: 'Griglia', 
      icon: Grid,
      permission: 'manage_shifts',
      minRole: 'user'
    },
    { 
      id: 'timeline', 
      name: 'Timeline', 
      icon: BarChart3,
      permission: 'view_analytics',
      minRole: 'user'
    },
    {
      id: 'workload-dashboard',
      name: 'Workload',
      icon: PieChart,
      permission: 'view_analytics',
      minRole: 'manager'
    },
    // DISABLED: AI Analytics non era nella roadmap originale - funzionalità aggiunta erroneamente
    // {
    //   id: 'analytics',
    //   name: 'AI Analytics',
    //   icon: Brain,
    //   permission: 'view_analytics',
    //   minRole: 'manager'
    // },
    { 
      id: 'validation', 
      name: 'Convalida', 
      icon: Shield,
      permission: 'approve_requests',
      minRole: 'manager'
    },
    { 
      id: 'weekend-report', 
      name: 'Report Weekend', 
      icon: Coffee,
      permission: 'view_analytics',
      minRole: 'user'
    },
    { 
      id: 'unavailability', 
      name: 'Indisponibilità', 
      icon: CalendarX,
      permission: 'approve_requests',
      minRole: 'user'
    },
    { 
      id: 'hour-bank', 
      name: 'Banca Ore', 
      icon: Banknote,
      permission: 'manage_hour_bank',
      minRole: 'manager'
    },
    { 
      id: 'employees', 
      name: 'Dipendenti', 
      icon: Users,
      permission: 'manage_employees',
      minRole: 'manager'
    },
    { 
      id: 'stores', 
      name: 'Negozi', 
      icon: StoreIcon,
      permission: 'manage_stores',
      minRole: 'manager'
    },
    {
      id: 'users',
      name: 'Utenti',
      icon: Shield,
      permission: 'manage_users',
      minRole: 'admin'
    },
    {
      id: 'testing',
      name: 'Testing & Performance',
      icon: Activity,
      permission: 'view_analytics',
      minRole: 'admin'
    }
  ], []);

  const filteredNavigation = useMemo(() => {
    if (!profile) {
      console.log('🔍 Navigation Debug: No profile available');
      return [];
    }

    console.log('🔍 Navigation Debug:', {
      profileName: `${profile.first_name} ${profile.last_name}`,
      profileRole: profile.role,
      profilePermissions: profile.custom_permissions,
      totalNavigationItems: navigationItems.length
    });

    const filtered = navigationItems.filter(item => {
      // Filter navigation items based on user permissions
      if (item.permission && !hasPermission(item.permission)) {
        if (item.id === 'testing') {
          console.log('❌ Testing item filtered out due to permission:', {
            permission: item.permission,
            hasPermission: hasPermission(item.permission),
            profilePermissions: profile.custom_permissions
          });
        }
        return false;
      }

      if (item.minRole) {
        const roleHierarchy = { admin: 3, manager: 2, user: 1 };
        const userLevel = roleHierarchy[profile.role];
        const requiredLevel = roleHierarchy[item.minRole];
        const passesRoleCheck = userLevel >= requiredLevel;

        if (item.id === 'testing') {
          console.log('🧪 Testing item role check:', {
            userRole: profile.role,
            userLevel,
            requiredRole: item.minRole,
            requiredLevel,
            passes: passesRoleCheck
          });
        }

        return passesRoleCheck;
      }

      return true;
    });

    const testingItem = filtered.find(item => item.id === 'testing');
    console.log('🔍 Navigation filtering result:', {
      totalFiltered: filtered.length,
      testingItemIncluded: !!testingItem,
      filteredItemIds: filtered.map(item => item.id)
    });

    return filtered;
  }, [navigationItems, profile, hasPermission]);

  // Check if current view is still accessible after filtering (memoized)
  const handleViewChange = useCallback((view: string) => {
    const availableViews = filteredNavigation.map(item => item.id);
    if (availableViews.includes(view) || view === 'schedule') {
      setCurrentView(view as View);
    } else {
      // Redirect to first available view
      setCurrentView((availableViews[0] || 'schedule') as View);
    }
  }, [filteredNavigation]);

  return {
    currentView,
    navigation: filteredNavigation,
    setCurrentView: handleViewChange
  };
};