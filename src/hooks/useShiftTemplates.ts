import { useState, useEffect } from 'react';
import { ShiftTemplate, Shift } from '../types';
import { useLocalStorage } from './useLocalStorage';

const defaultTemplates: ShiftTemplate[] = [
  // TEMPLATE APERTURA (06:00 - 12:00)
  {
    id: 'apertura-mattina-presto',
    name: 'Apertura Mattina Presto',
    startTime: '07:00',
    endTime: '13:00',
    breakDuration: 30,
    description: 'Turno apertura mattiniero con pausa pranzo',
    category: 'apertura',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'apertura-standard',
    name: 'Apertura Standard',
    startTime: '08:00',
    endTime: '14:00',
    breakDuration: 30,
    description: 'Turno apertura standard 6 ore',
    category: 'apertura',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'apertura-corto',
    name: 'Apertura Part-Time',
    startTime: '09:00',
    endTime: '13:00',
    breakDuration: 15,
    description: 'Turno apertura part-time 4 ore',
    category: 'apertura',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'apertura-lungo',
    name: 'Apertura Lungo',
    startTime: '08:00',
    endTime: '16:00',
    breakDuration: 60,
    description: 'Turno apertura lungo 8 ore con pausa pranzo',
    category: 'apertura',
    usageCount: 0,
    createdAt: new Date()
  },

  // TEMPLATE MEDIANO (12:00 - 17:00) 
  {
    id: 'mediano-pranzo',
    name: 'Mediano con Pranzo',
    startTime: '12:00',
    endTime: '18:00',
    breakDuration: 30,
    description: 'Turno centrale con pausa pranzo',
    category: 'mediano',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'mediano-pomeriggio',
    name: 'Pomeriggio Standard',
    startTime: '14:00',
    endTime: '18:00',
    breakDuration: 15,
    description: 'Turno pomeridiano 4 ore',
    category: 'mediano',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'mediano-continuo',
    name: 'Continuo Centrale',
    startTime: '11:00',
    endTime: '19:00',
    breakDuration: 60,
    description: 'Turno continuo 8 ore con pausa lunga',
    category: 'mediano',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'mediano-spezzato',
    name: 'Spezzato Pomeriggio',
    startTime: '13:00',
    endTime: '17:00',
    breakDuration: 0,
    description: 'Turno spezzato pomeridiano senza pausa',
    category: 'mediano',
    usageCount: 0,
    createdAt: new Date()
  },

  // TEMPLATE CHIUSURA (17:00 - 24:00)
  {
    id: 'chiusura-serale',
    name: 'Chiusura Serale',
    startTime: '17:00',
    endTime: '21:00',
    breakDuration: 15,
    description: 'Turno chiusura serale 4 ore',
    category: 'chiusura',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'chiusura-tardi',
    name: 'Chiusura Tardi',
    startTime: '18:00',
    endTime: '22:00',
    breakDuration: 15,
    description: 'Turno chiusura tardo 4 ore',
    category: 'chiusura',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'chiusura-lungo',
    name: 'Chiusura Lungo',
    startTime: '15:00',
    endTime: '21:00',
    breakDuration: 30,
    description: 'Turno chiusura lungo 6 ore',
    category: 'chiusura',
    usageCount: 0,
    createdAt: new Date()
  },
  {
    id: 'chiusura-weekend',
    name: 'Weekend Sera',
    startTime: '16:00',
    endTime: '22:00',
    breakDuration: 30,
    description: 'Turno weekend serale 6 ore',
    category: 'chiusura',
    usageCount: 0,
    createdAt: new Date()
  }
];

export const useShiftTemplates = () => {
  const [templates, setTemplates] = useLocalStorage<ShiftTemplate[]>('hr-shift-templates', defaultTemplates);

  // Analizza i turni esistenti per creare template automatici
  const analyzeShiftsForTemplates = (shifts: Shift[]) => {
    const shiftPatterns = new Map<string, { count: number; shift: Omit<ShiftTemplate, 'id' | 'name' | 'createdAt' | 'usageCount'> }>();

    shifts.forEach(shift => {
      const pattern = `${shift.startTime}-${shift.endTime}-${shift.breakDuration}`;
      const existing = shiftPatterns.get(pattern);
      
      if (existing) {
        existing.count++;
      } else {
        shiftPatterns.set(pattern, {
          count: 1,
          shift: {
            startTime: shift.startTime,
            endTime: shift.endTime,
            breakDuration: shift.breakDuration,
            description: `Template auto-generato da pattern ricorrente`,
            category: determineCategory(shift.startTime, shift.endTime)
          }
        });
      }
    });

    // Crea template per pattern usati almeno 5 volte
    const autoTemplates: ShiftTemplate[] = [];
    shiftPatterns.forEach((data, pattern) => {
      if (data.count >= 5) {
        const existingTemplate = templates.find(t => 
          t.startTime === data.shift.startTime && 
          t.endTime === data.shift.endTime && 
          t.breakDuration === data.shift.breakDuration
        );

        if (!existingTemplate) {
          autoTemplates.push({
            id: `auto-${pattern}-${Date.now()}`,
            name: `Auto: ${data.shift.startTime}-${data.shift.endTime}`,
            ...data.shift,
            usageCount: data.count,
            createdAt: new Date()
          });
        }
      }
    });

    if (autoTemplates.length > 0) {
      console.log(`🤖 Creati ${autoTemplates.length} template automatici da pattern ricorrenti`);
      setTemplates(prev => [...prev, ...autoTemplates]);
    }
  };

  /**
   * 🕒 DETERMINA CATEGORIA TURNO BASATA SU FASCE ORARIE LOGICHE
   * 
   * APERTURA: 06:00 - 12:00 (turni che iniziano al mattino)
   * MEDIANO:  12:00 - 17:00 (turni che iniziano nel pomeriggio) 
   * CHIUSURA: 17:00 - 24:00 (turni che iniziano verso sera)
   */
  const determineCategory = (startTime: string, endTime: string): ShiftTemplate['category'] => {
    const startHour = parseInt(startTime.split(':')[0]);
    
    // Logica basata sull'orario di INIZIO del turno
    if (startHour >= 6 && startHour < 12) {
      return 'apertura';
    } else if (startHour >= 12 && startHour < 17) {
      return 'mediano';
    } else if (startHour >= 17 || startHour < 6) {
      return 'chiusura';
    }
    
    return 'custom';
  };

  const addTemplate = (template: Omit<ShiftTemplate, 'id' | 'createdAt' | 'usageCount'>) => {
    const newTemplate: ShiftTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      usageCount: 0,
      createdAt: new Date()
    };
    
    console.log('➕ Aggiunto nuovo template:', newTemplate.name, `(${newTemplate.category})`);
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  };

  const updateTemplate = (id: string, updates: Partial<ShiftTemplate>) => {
    setTemplates(prev => prev.map(template => 
      template.id === id ? { ...template, ...updates } : template
    ));
  };

  const deleteTemplate = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template) {
      console.log('🗑️ Eliminato template:', template.name);
      setTemplates(prev => prev.filter(template => template.id !== id));
    }
  };

  const incrementUsage = (id: string) => {
    console.log('📈 Incremento utilizzo template:', id);
    setTemplates(prev => prev.map(template => 
      template.id === id ? { ...template, usageCount: template.usageCount + 1 } : template
    ));
  };

  const getTemplatesByCategory = () => {
    const categorized = templates.reduce((acc, template) => {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, ShiftTemplate[]>);

    // Ordina per utilizzo all'interno di ogni categoria
    Object.keys(categorized).forEach(category => {
      categorized[category].sort((a, b) => {
        // Prima ordina per utilizzo (decrescente)
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        // Poi per nome alfabetico
        return a.name.localeCompare(b.name);
      });
    });

    return categorized;
  };

  /**
   * 🔍 TROVA TEMPLATE SUGGERITI BASATI SU ORARIO
   */
  const getSuggestedTemplates = (targetTime?: string) => {
    if (!targetTime) return [];
    
    const category = determineCategory(targetTime, targetTime);
    return templates
      .filter(t => t.category === category)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);
  };

  /**
   * 📊 STATISTICHE UTILIZZO TEMPLATE
   */
  const getTemplateStats = () => {
    const totalTemplates = templates.length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
    const customTemplates = templates.filter(t => t.category === 'custom' || t.id.startsWith('custom-')).length;
    const autoTemplates = templates.filter(t => t.id.startsWith('auto-')).length;
    
    const categoryStats = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = { count: 0, usage: 0 };
      }
      acc[template.category].count++;
      acc[template.category].usage += template.usageCount;
      return acc;
    }, {} as Record<string, { count: number; usage: number }>);

    const mostUsed = templates
      .filter(t => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return {
      totalTemplates,
      totalUsage,
      customTemplates,
      autoTemplates,
      avgUsagePerTemplate: totalTemplates > 0 ? (totalUsage / totalTemplates).toFixed(1) : '0',
      categoryStats,
      mostUsed
    };
  };

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    incrementUsage,
    getTemplatesByCategory,
    getSuggestedTemplates,
    getTemplateStats,
    analyzeShiftsForTemplates,
    determineCategory
  };
};