import { useState, useEffect } from 'react';
import { StaffRequirement, WeightingEvent, StaffRole, CalculatedStaffNeed } from '../types';
import { useLocalStorage } from './useLocalStorage';

const defaultRoles: StaffRole[] = [
  { id: 'cashier', name: 'Cassiere', description: 'Gestione cassa e clienti', priority: 1 },
  { id: 'sales', name: 'Addetto Vendite', description: 'Assistenza clienti e vendite', priority: 2 },
  { id: 'supervisor', name: 'Supervisore', description: 'Coordinamento e supervisione', priority: 1 },
  { id: 'stockroom', name: 'Magazziniere', description: 'Gestione inventario', priority: 3 },
  { id: 'security', name: 'Addetto Sicurezza', description: 'Sicurezza negozio', priority: 2 }
];

export const useStaffPlanning = () => {
  const [staffRequirements, setStaffRequirements] = useLocalStorage<StaffRequirement[]>('hr-staff-requirements', []);
  const [weightingEvents, setWeightingEvents] = useLocalStorage<WeightingEvent[]>('hr-weighting-events', []);
  const [staffRoles, setStaffRoles] = useLocalStorage<StaffRole[]>('hr-staff-roles', defaultRoles);

  // 🔄 LOG AUTOMATICO PER DEBUG SINCRONIZZAZIONE
  useEffect(() => {
    console.log('📊 Staff requirements updated:', {
      total: staffRequirements.length,
      byStore: staffRequirements.reduce((acc, req) => {
        acc[req.storeId] = (acc[req.storeId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
  }, [staffRequirements]);

  // Staff Requirements CRUD
  const addStaffRequirement = (requirement: Omit<StaffRequirement, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRequirement: StaffRequirement = {
      ...requirement,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log('➕ Adding staff requirement:', {
      id: newRequirement.id,
      storeId: newRequirement.storeId,
      dayOfWeek: newRequirement.dayOfWeek,
      roles: newRequirement.roles.length
    });
    setStaffRequirements(prev => [...prev, newRequirement]);
    return newRequirement;
  };

  const updateStaffRequirement = (id: string, updates: Partial<StaffRequirement>) => {
    console.log('🔄 Updating staff requirement:', {
      id,
      dayOfWeek: updates.dayOfWeek,
      roles: updates.roles?.length || 0
    });
    setStaffRequirements(prev => prev.map(req => 
      req.id === id ? { ...req, ...updates, updatedAt: new Date() } : req
    ));
  };

  const deleteStaffRequirement = (id: string) => {
    setStaffRequirements(prev => prev.filter(req => req.id !== id));
  };

  // Weighting Events CRUD
  const addWeightingEvent = (event: Omit<WeightingEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEvent: WeightingEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setWeightingEvents(prev => [...prev, newEvent]);
    return newEvent;
  };

  const updateWeightingEvent = (id: string, updates: Partial<WeightingEvent>) => {
    setWeightingEvents(prev => prev.map(event => 
      event.id === id ? { ...event, ...updates, updatedAt: new Date() } : event
    ));
  };

  const deleteWeightingEvent = (id: string) => {
    setWeightingEvents(prev => prev.filter(event => event.id !== id));
  };

  // Staff Roles CRUD
  const addStaffRole = (role: Omit<StaffRole, 'id'>) => {
    const newRole: StaffRole = {
      ...role,
      id: crypto.randomUUID()
    };
    setStaffRoles(prev => [...prev, newRole]);
    return newRole;
  };

  const updateStaffRole = (id: string, updates: Partial<StaffRole>) => {
    setStaffRoles(prev => prev.map(role => 
      role.id === id ? { ...role, ...updates } : role
    ));
  };

  const deleteStaffRole = (id: string) => {
    setStaffRoles(prev => prev.filter(role => role.id !== id));
    // Rimuovi il ruolo dai requisiti esistenti
    setStaffRequirements(prev => prev.map(req => ({
      ...req,
      roles: req.roles.filter(r => r.roleId !== id)
    })));
  };

  // Calcolo requisiti ponderati
  const calculateStaffNeeds = (storeId: string, date: Date): CalculatedStaffNeed | null => {
    const dayOfWeek = getDayOfWeek(date);
    const baseRequirement = staffRequirements.find(req => 
      req.storeId === storeId && req.dayOfWeek === dayOfWeek
    );

    if (!baseRequirement) return null;

    // Trova eventi applicabili
    const applicableEvents = weightingEvents.filter(event => {
      if (!event.isActive) return false;
      
      // Controllo date - confronta solo anno, mese, giorno (ignora ore)
      const eventStart = new Date(event.startDate);
      eventStart.setHours(0, 0, 0, 0);
      const eventEnd = new Date(event.endDate);
      eventEnd.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0); // Usa mezzogiorno per evitare problemi timezone
      
      if (checkDate < eventStart || checkDate > eventEnd) return false;
      
      // Controllo negozi
      if (event.storeIds && !event.storeIds.includes(storeId)) return false;
      
      // Controllo giorni della settimana
      if (event.daysOfWeek && !event.daysOfWeek.includes(dayOfWeek)) return false;
      
      return true;
    });

    console.log(`📅 calculateStaffNeeds for ${date.toLocaleDateString()}:`, {
      dayOfWeek,
      storeId,
      baseRequirement: !!baseRequirement,
      applicableEvents: applicableEvents.length,
      eventNames: applicableEvents.map(e => e.name)
    });
    // Calcola moltiplicatore finale (prodotto di tutti i moltiplicatori)
    const finalMultiplier = applicableEvents.reduce((acc, event) => acc * event.multiplier, 1);

    // Calcola staff ponderato per ogni ruolo
    const calculatedStaff = baseRequirement.roles.map(role => ({
      roleId: role.roleId,
      baseMin: role.minStaff,
      baseMax: role.maxStaff,
      weightedMin: Math.ceil(role.minStaff * finalMultiplier),
      weightedMax: Math.ceil(role.maxStaff * finalMultiplier)
    }));

    return {
      storeId,
      date,
      dayOfWeek,
      baseRequirement,
      appliedEvents: applicableEvents,
      finalMultiplier,
      calculatedStaff
    };
  };

  const getDayOfWeek = (date: Date): string => {
    const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    return days[date.getDay()];
  };

  // Get requirements for a store
  const getStoreRequirements = (storeId: string) => {
    return staffRequirements.filter(req => req.storeId === storeId);
  };

  // Get events for a date range
  const getEventsInRange = (startDate: Date, endDate: Date, storeId?: string) => {
    return weightingEvents.filter(event => {
      const eventOverlaps = event.startDate <= endDate && event.endDate >= startDate;
      const storeMatches = !storeId || !event.storeIds || event.storeIds.includes(storeId);
      return eventOverlaps && storeMatches && event.isActive;
    });
  };

  return {
    // Data
    staffRequirements,
    weightingEvents,
    staffRoles,
    setStaffRequirements,
    
    // Staff Requirements
    addStaffRequirement,
    updateStaffRequirement,
    deleteStaffRequirement,
    getStoreRequirements,
    
    // Weighting Events
    addWeightingEvent,
    updateWeightingEvent,
    deleteWeightingEvent,
    getEventsInRange,
    
    // Staff Roles
    addStaffRole,
    updateStaffRole,
    deleteStaffRole,
    
    // Calculations
    calculateStaffNeeds
  };
};