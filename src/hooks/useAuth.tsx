import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'user';
  custom_permissions: Permission[];
  assigned_store_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: any }>;
  hasPermission: (permission: Permission) => boolean;
  canAccessStore: (storeId: string) => boolean;
  refreshProfile: () => Promise<void>;
}

export type Permission = 
  | 'view_all_stores'
  | 'manage_stores' 
  | 'manage_employees'
  | 'manage_shifts'
  | 'manage_users'
  | 'approve_requests'
  | 'reset_data'
  | 'view_analytics'
  | 'export_data'
  | 'manage_hour_bank'
  | 'generate_schedules';

// Permission matrix
const ROLE_PERMISSIONS: Record<UserProfile['role'], Permission[]> = {
  admin: [
    'view_all_stores',
    'manage_stores',
    'manage_employees', 
    'manage_shifts',
    'manage_users',
    'approve_requests',
    'reset_data',
    'view_analytics',
    'export_data',
    'manage_hour_bank',
    'generate_schedules'
  ],
  manager: [
    'manage_employees',
    'manage_shifts', 
    'approve_requests',
    'view_analytics',
    'export_data',
    'manage_hour_bank',
    'generate_schedules'
  ],
  user: [
    'view_analytics',
    'export_data'
  ]
};

// Default users for demo
const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    first_name: 'Mario',
    last_name: 'Rossi',
    role: 'admin',
    custom_permissions: [
      'view_all_stores',
      'manage_stores',
      'manage_employees', 
      'manage_shifts',
      'manage_users',
      'approve_requests',
      'reset_data',
      'view_analytics',
      'export_data',
      'manage_hour_bank',
      'generate_schedules'
    ],
    assigned_store_ids: [],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'manager-1', 
    email: 'manager@example.com',
    first_name: 'Giulia',
    last_name: 'Verdi',
    role: 'manager',
    custom_permissions: [
      'manage_employees',
      'manage_shifts', 
      'approve_requests',
      'view_analytics',
      'export_data',
      'manage_hour_bank',
      'generate_schedules'
    ],
    assigned_store_ids: [],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'user-1',
    email: 'user@example.com', 
    first_name: 'Luca',
    last_name: 'Bianchi',
    role: 'user',
    custom_permissions: [
      'view_analytics',
      'export_data'
    ],
    assigned_store_ids: [],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Default passwords (in production, these would be hashed)
const DEFAULT_PASSWORDS: Record<string, string> = {
  'admin@example.com': 'admin123',
  'manager@example.com': 'manager123',
  'user@example.com': 'user123'
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const [users, setUsers] = useLocalStorage<UserProfile[]>('hr-auth-users', DEFAULT_USERS);
  const [currentSession, setCurrentSession] = useLocalStorage<{user: any; profile: UserProfile} | null>('hr-auth-session', null);
  
  const [state, setState] = useState<AuthState>({
    user: currentSession?.user || null,
    profile: currentSession?.profile || null,
    loading: false,
    error: null
  });

  // Initialize users if empty
  useEffect(() => {
    if (users.length === 0) {
      setUsers(DEFAULT_USERS);
    }
  }, [users.length, setUsers]);

  // Load session on mount
  useEffect(() => {
    if (currentSession) {
      setState({
        user: currentSession.user,
        profile: currentSession.profile,
        loading: false,
        error: null
      });
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [currentSession]);

  // Check permissions based on user role (memoized to prevent re-renders)
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!state.profile) {
      console.log('🔍 Permission Debug: No profile available for permission:', permission);
      return false;
    }

    // Check custom permissions first, fallback to role-based permissions
    if (state.profile.custom_permissions && state.profile.custom_permissions.length > 0) {
      const hasCustomPermission = state.profile.custom_permissions.includes(permission);

      if (permission === 'view_analytics') {
        console.log('🔍 Permission Debug (view_analytics):', {
          userRole: state.profile.role,
          customPermissions: state.profile.custom_permissions,
          hasCustomPermission,
          permissionSource: 'custom_permissions'
        });
      }

      return hasCustomPermission;
    }

    // Fallback to role-based permissions for backward compatibility
    const hasRolePermission = ROLE_PERMISSIONS[state.profile.role].includes(permission);

    if (permission === 'view_analytics') {
      console.log('🔍 Permission Debug (view_analytics):', {
        userRole: state.profile.role,
        rolePermissions: ROLE_PERMISSIONS[state.profile.role],
        hasRolePermission,
        permissionSource: 'role_permissions'
      });
    }

    return hasRolePermission;
  }, [state.profile]);

  // Check if user can access specific store (memoized to prevent re-renders)
  const canAccessStore = useCallback((storeId: string): boolean => {
    if (!state.profile) return false;
    
    // Admins can access all stores
    if (state.profile.role === 'admin') return true;
    
    // Managers can access their assigned stores
    if (state.profile.role === 'manager') {
      return state.profile.assigned_store_ids.includes(storeId);
    }
    
    // Users have limited access
    return false;
  }, [state.profile]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // Find user
    const user = users.find(u => u.email === email && u.is_active);
    
    if (!user) {
      setState(prev => ({ ...prev, loading: false, error: 'Utente non trovato o disattivato' }));
      return { error: new Error('Utente non trovato') };
    }

    // Check password - first check stored passwords, then default ones
    const storedPasswords = JSON.parse(localStorage.getItem('hr-auth-passwords') || '{}');
    const expectedPassword = storedPasswords[email] || DEFAULT_PASSWORDS[email];

    if (!expectedPassword || password !== expectedPassword) {
      setState(prev => ({ ...prev, loading: false, error: 'Password non corretta' }));
      return { error: new Error('Password non corretta') };
    }

    // Create session
    const sessionData = {
      user: { 
        id: user.id, 
        email: user.email,
        created_at: user.created_at
      },
      profile: user
    };

    setCurrentSession(sessionData);
    
    setState({
      user: sessionData.user,
      profile: sessionData.profile,
      loading: false,
      error: null
    });

    return { error: null };
  };

  // Sign up new user
  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      setState(prev => ({ ...prev, loading: false, error: 'Un utente con questa email esiste già' }));
      return { error: new Error('Utente già esistente') };
    }

    // Create new user
    const newUser: UserProfile = {
      id: crypto.randomUUID(),
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'user', // Default role
      custom_permissions: [
        'view_analytics',
        'export_data'
      ],
      assigned_store_ids: [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add to users array
    setUsers(prev => [...prev, newUser]);
    
    // Store password (in production this would be hashed on server)
    const currentPasswords = JSON.parse(localStorage.getItem('hr-auth-passwords') || '{}');
    currentPasswords[email] = password;
    localStorage.setItem('hr-auth-passwords', JSON.stringify(currentPasswords));

    setState(prev => ({ ...prev, loading: false }));
    
    return { error: null };
  };

  // Sign out
  const signOut = async () => {
    setCurrentSession(null);
    setState({
      user: null,
      profile: null,
      loading: false,
      error: null
    });
  };

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) return { error: new Error('No user logged in') };

    const updatedProfile = {
      ...state.profile!,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Update in users array
    setUsers(prev => prev.map(u => 
      u.id === state.user.id ? updatedProfile : u
    ));

    // Update current session
    setCurrentSession(prev => prev ? {
      ...prev,
      profile: updatedProfile
    } : null);

    setState(prev => ({ ...prev, profile: updatedProfile }));
    
    return { error: null };
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (!state.user) return;
    
    const user = users.find(u => u.id === state.user.id);
    if (user) {
      setState(prev => ({ ...prev, profile: user }));
      
      // Update session
      setCurrentSession(prev => prev ? {
        ...prev,
        profile: user
      } : null);
    }
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    updateProfile,
    hasPermission,
    canAccessStore,
    refreshProfile
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};