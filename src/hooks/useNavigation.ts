import { useState, useMemo } from 'react';
import { NavigationItem } from '../components/navigation/NavigationBar';
import { UserProfile } from './useAuth';
import { 
  Users, 
  Store as StoreIcon, 
  Calendar, 
  Settings, 
  BarChart3, 
  Grid, 
  Rotate3D as RotateRight, 
  Coffee, 
  CalendarX, 
  Banknote,
  Shield
} from 'lucide-react';

export type View = 'schedule' | 'timeline' | 'validation' | 'rotation' | 'employees' | 'stores' | 'weekend-report' | 'unavailability' | 'hour-bank' | 'users';

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
      id: 'validation', 
      name: 'Convalida', 
      icon: Shield,
      permission: 'approve_requests',
      minRole: 'manager'
    },
    { 
      id: 'rotation', 
      name: 'Rotazione', 
      icon: RotateRight,
      permission: 'generate_schedules',
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
    }
  ], []);

  const filteredNavigation = useMemo(() => {
    if (!profile) return [];

    return navigationItems.filter(item => {
      // Filter navigation items based on user permissions
      if (item.permission && !hasPermission(item.permission)) return false;
      
      if (item.minRole) {
        const roleHierarchy = { admin: 3, manager: 2, user: 1 };
        const userLevel = roleHierarchy[profile.role];
        const requiredLevel = roleHierarchy[item.minRole];
        return userLevel >= requiredLevel;
      }
      
      return true;
    });
  }, [navigationItems, profile, hasPermission]);

  // Check if current view is still accessible after filtering
  const handleViewChange = (view: string) => {
    const availableViews = filteredNavigation.map(item => item.id);
    if (availableViews.includes(view) || view === 'schedule') {
      setCurrentView(view as View);
    } else {
      // Redirect to first available view
      setCurrentView((availableViews[0] || 'schedule') as View);
    }
  };

  return {
    currentView,
    navigation: filteredNavigation,
    setCurrentView: handleViewChange
  };
};