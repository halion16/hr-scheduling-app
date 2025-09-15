import { useState, useEffect, useCallback, useRef } from 'react';
import { Shift, Employee } from '../types';

// Real-time collaboration interfaces
export interface CollaborationUser {
  id: string;
  name: string;
  role: string;
  isOnline: boolean;
  lastActive: Date;
  currentView?: string;
  avatar?: string;
}

export interface CollaborationEvent {
  id: string;
  type: 'shift_update' | 'shift_create' | 'shift_delete' | 'user_join' | 'user_leave' | 'cursor_move';
  userId: string;
  userName: string;
  timestamp: Date;
  data: any;
  conflictsWith?: string[];
}

export interface LiveEdit {
  shiftId: string;
  userId: string;
  userName: string;
  startTime: Date;
  type: 'editing' | 'viewing';
}

export interface ConflictNotification {
  id: string;
  type: 'concurrent_edit' | 'data_conflict' | 'permission_change';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  userId: string;
  relatedShiftId?: string;
  suggestedAction?: string;
  timestamp: Date;
}

interface UseRealTimeCollaborationProps {
  currentUserId: string;
  currentUserName: string;
  roomId: string; // Usually store ID or week identifier
  onShiftUpdate?: (shift: Shift) => void;
  onConflictDetected?: (conflict: ConflictNotification) => void;
  onUserActivity?: (users: CollaborationUser[]) => void;
}

// Simulated WebSocket connection
class MockWebSocket {
  private listeners: { [key: string]: Function[] } = {};
  private isConnected = false;

  constructor(url: string) {
    // Simulate connection delay
    setTimeout(() => {
      this.isConnected = true;
      this.emit('open', {});
    }, 100);
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  send(data: any) {
    if (this.isConnected) {
      // Simulate network delay
      setTimeout(() => {
        // Echo back for simulation
        this.emit('message', {
          type: 'echo',
          data: JSON.parse(data),
          timestamp: new Date()
        });
      }, 50 + Math.random() * 100);
    }
  }

  close() {
    this.isConnected = false;
    this.emit('close', {});
  }
}

export const useRealTimeCollaboration = ({
  currentUserId,
  currentUserName,
  roomId,
  onShiftUpdate,
  onConflictDetected,
  onUserActivity
}: UseRealTimeCollaborationProps) => {

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<CollaborationUser[]>([]);
  const [activeEdits, setActiveEdits] = useState<LiveEdit[]>([]);
  const [recentEvents, setRecentEvents] = useState<CollaborationEvent[]>([]);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictNotification[]>([]);

  // Refs for WebSocket and cleanup
  const wsRef = useRef<MockWebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const conflictTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔌 CONNECTION MANAGEMENT
  const connect = useCallback(() => {
    console.log('🌐 Connecting to collaboration room:', roomId);

    wsRef.current = new MockWebSocket(`ws://localhost:3001/collaborate/${roomId}`);

    wsRef.current.on('open', () => {
      console.log('🟢 Collaboration connection established');
      setIsConnected(true);

      // Send join event
      wsRef.current?.send(JSON.stringify({
        type: 'user_join',
        userId: currentUserId,
        userName: currentUserName,
        roomId
      }));

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        wsRef.current?.send(JSON.stringify({
          type: 'heartbeat',
          userId: currentUserId,
          timestamp: new Date()
        }));
      }, 30000);
    });

    wsRef.current.on('message', handleMessage);

    wsRef.current.on('close', () => {
      console.log('🔴 Collaboration connection closed');
      setIsConnected(false);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    });
  }, [roomId, currentUserId, currentUserName]);

  // 📨 MESSAGE HANDLING
  const handleMessage = useCallback((message: any) => {
    const event: CollaborationEvent = message.data;

    console.log('📨 Collaboration event received:', event.type, event);

    // Update recent events
    setRecentEvents(prev => [event, ...prev.slice(0, 49)]); // Keep last 50 events

    switch (event.type) {
      case 'user_join':
        setOnlineUsers(prev => {
          const existing = prev.find(u => u.id === event.userId);
          if (existing) return prev;

          const newUser: CollaborationUser = {
            id: event.userId,
            name: event.userName,
            role: event.data?.role || 'user',
            isOnline: true,
            lastActive: new Date()
          };

          const updated = [...prev, newUser];
          onUserActivity?.(updated);
          return updated;
        });
        break;

      case 'user_leave':
        setOnlineUsers(prev => {
          const updated = prev.filter(u => u.id !== event.userId);
          onUserActivity?.(updated);
          return updated;
        });
        break;

      case 'shift_update':
        if (event.userId !== currentUserId) {
          // Detect conflicts
          detectShiftConflict(event);
          onShiftUpdate?.(event.data.shift);
        }
        break;

      case 'shift_create':
      case 'shift_delete':
        if (event.userId !== currentUserId) {
          onShiftUpdate?.(event.data.shift);
        }
        break;
    }
  }, [currentUserId, onShiftUpdate, onUserActivity, onConflictDetected]);

  // ⚡ CONFLICT DETECTION
  const detectShiftConflict = useCallback((event: CollaborationEvent) => {
    const editingShift = activeEdits.find(edit =>
      edit.shiftId === event.data.shift.id &&
      edit.userId === currentUserId &&
      edit.type === 'editing'
    );

    if (editingShift) {
      const conflict: ConflictNotification = {
        id: `conflict-${Date.now()}`,
        type: 'concurrent_edit',
        severity: 'warning',
        title: 'Modifica Concorrente Rilevata',
        message: `${event.userName} ha modificato lo stesso turno che stai editando`,
        userId: event.userId,
        relatedShiftId: event.data.shift.id,
        suggestedAction: 'Ricarica i dati o coordina con l\'altro utente',
        timestamp: new Date()
      };

      setPendingConflicts(prev => [conflict, ...prev]);
      onConflictDetected?.(conflict);

      // Auto-resolve conflict after 30 seconds
      conflictTimeoutRef.current = setTimeout(() => {
        setPendingConflicts(prev => prev.filter(c => c.id !== conflict.id));
      }, 30000);
    }
  }, [activeEdits, currentUserId, onConflictDetected]);

  // 📝 LIVE EDITING MANAGEMENT
  const startEditing = useCallback((shiftId: string) => {
    console.log('✏️ Starting edit for shift:', shiftId);

    const edit: LiveEdit = {
      shiftId,
      userId: currentUserId,
      userName: currentUserName,
      startTime: new Date(),
      type: 'editing'
    };

    setActiveEdits(prev => [...prev.filter(e => e.shiftId !== shiftId || e.userId !== currentUserId), edit]);

    // Broadcast editing state
    wsRef.current?.send(JSON.stringify({
      type: 'start_editing',
      userId: currentUserId,
      userName: currentUserName,
      data: { shiftId },
      timestamp: new Date()
    }));
  }, [currentUserId, currentUserName]);

  const stopEditing = useCallback((shiftId: string) => {
    console.log('💾 Stopping edit for shift:', shiftId);

    setActiveEdits(prev => prev.filter(e => !(e.shiftId === shiftId && e.userId === currentUserId)));

    // Broadcast stop editing
    wsRef.current?.send(JSON.stringify({
      type: 'stop_editing',
      userId: currentUserId,
      userName: currentUserName,
      data: { shiftId },
      timestamp: new Date()
    }));
  }, [currentUserId, currentUserName]);

  // 📤 BROADCAST CHANGES
  const broadcastShiftUpdate = useCallback((shift: Shift, changeType: 'update' | 'create' | 'delete' = 'update') => {
    console.log('📤 Broadcasting shift change:', changeType, shift.id);

    const event = {
      type: `shift_${changeType}` as const,
      userId: currentUserId,
      userName: currentUserName,
      data: { shift },
      timestamp: new Date()
    };

    wsRef.current?.send(JSON.stringify(event));
  }, [currentUserId, currentUserName]);

  // 🔔 NOTIFICATION MANAGEMENT
  const dismissConflict = useCallback((conflictId: string) => {
    setPendingConflicts(prev => prev.filter(c => c.id !== conflictId));
  }, []);

  const getShiftEditingUsers = useCallback((shiftId: string): CollaborationUser[] => {
    const editingUserIds = activeEdits
      .filter(edit => edit.shiftId === shiftId && edit.userId !== currentUserId)
      .map(edit => edit.userId);

    return onlineUsers.filter(user => editingUserIds.includes(user.id));
  }, [activeEdits, onlineUsers, currentUserId]);

  // 🔄 LIFECYCLE MANAGEMENT
  useEffect(() => {
    connect();

    return () => {
      console.log('🧹 Cleaning up collaboration connection');
      wsRef.current?.close();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (conflictTimeoutRef.current) {
        clearTimeout(conflictTimeoutRef.current);
      }
    };
  }, [connect]);

  // 📊 COLLABORATION STATS
  const collaborationStats = {
    totalUsers: onlineUsers.length,
    activeEdits: activeEdits.length,
    recentActivity: recentEvents.length,
    pendingConflicts: pendingConflicts.length
  };

  return {
    // Connection state
    isConnected,
    onlineUsers,

    // Live editing
    activeEdits,
    startEditing,
    stopEditing,
    getShiftEditingUsers,

    // Broadcasting
    broadcastShiftUpdate,

    // Conflicts
    pendingConflicts,
    dismissConflict,

    // Activity
    recentEvents,
    collaborationStats,

    // Connection control
    connect,
    disconnect: () => wsRef.current?.close()
  };
};