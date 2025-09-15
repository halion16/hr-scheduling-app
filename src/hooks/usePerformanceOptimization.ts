/*
 * 🚀 FASE 5: Performance Optimization & Caching System
 *
 * Sistema di ottimizzazione delle performance per grandi dataset:
 * - Caching intelligente dei risultati di validazione
 * - Algoritmi ottimizzati per grandi volumi di dati
 * - Operazioni batch efficienti
 * - Monitoraggio performance in tempo reale
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { Employee, Store, Shift } from '../types';
import { BalancingSuggestion, BalancingResult } from './useWorkloadBalancer';
import { ValidationResult } from './useBalancingEngine';

export interface PerformanceConfig {
  enableCaching: boolean;
  cacheTimeoutMs: number;
  maxCacheSize: number;
  batchSize: number;
  enableVirtualization: boolean;
  enableWebWorkers: boolean;
  performanceThresholds: {
    warning: number; // ms
    critical: number; // ms
  };
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  size: number; // estimated memory size
}

export interface PerformanceMetrics {
  operationType: string;
  executionTime: number;
  memoryUsage: number;
  cacheHitRatio: number;
  throughput: number; // operations per second
  datasetSize: number;
  algorithmComplexity: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)';
}

export interface BatchOperation<T, R> {
  id: string;
  name: string;
  data: T[];
  processor: (batch: T[], progress?: (completed: number, total: number) => void) => Promise<R[]>;
  batchSize: number;
  priority: 'high' | 'medium' | 'low';
}

class AdvancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessQueue: string[] = [];
  private maxSize: number;
  private timeoutMs: number;

  constructor(maxSize: number = 1000, timeoutMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.timeoutMs = timeoutMs;
  }

  set(key: string, value: T): void {
    const now = Date.now();

    // Remove expired entries
    this.cleanup();

    // If cache is full, remove LRU entry
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const size = this.estimateSize(value);
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      accessCount: 1,
      size
    };

    this.cache.set(key, entry);
    this.updateAccessQueue(key);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.timeoutMs) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    this.updateAccessQueue(key);

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
    this.accessQueue = [];
  }

  getStats() {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const totalAccess = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalMemory: totalSize,
      averageAccess: totalAccess / this.cache.size || 0,
      oldestEntry: Math.min(...Array.from(this.cache.values()).map(e => e.timestamp)),
      newestEntry: Math.max(...Array.from(this.cache.values()).map(e => e.timestamp))
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys = Array.from(this.cache.entries())
      .filter(([_, entry]) => now - entry.timestamp > this.timeoutMs)
      .map(([key, _]) => key);

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.accessQueue = this.accessQueue.filter(k => k !== key);
    });
  }

  private evictLRU(): void {
    if (this.accessQueue.length === 0) return;

    const lruKey = this.accessQueue[0];
    this.cache.delete(lruKey);
    this.accessQueue = this.accessQueue.filter(k => k !== lruKey);
  }

  private updateAccessQueue(key: string): void {
    this.accessQueue = this.accessQueue.filter(k => k !== key);
    this.accessQueue.push(key);
  }

  private estimateSize(value: T): number {
    // Rough estimation of memory usage
    const jsonString = JSON.stringify(value);
    return jsonString.length * 2; // Unicode characters are 2 bytes
  }
}

// Optimized algorithms for large datasets
class OptimizedAlgorithms {
  // O(n log n) - Optimized employee workload calculation
  static calculateWorkloadDistribution(employees: Employee[], shifts: Shift[]): Map<string, number> {
    // Create index for O(1) lookups
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // Group shifts by employee - O(n)
    const workloadMap = new Map<string, number>();

    employees.forEach(emp => workloadMap.set(emp.id, 0));

    // Calculate workload in single pass - O(n)
    shifts.forEach(shift => {
      const currentHours = workloadMap.get(shift.employeeId) || 0;
      const shiftHours = shift.actualHours || this.calculateShiftHours(shift);
      workloadMap.set(shift.employeeId, currentHours + shiftHours);
    });

    return workloadMap;
  }

  // O(n) - Optimized conflict detection
  static detectConflicts(shifts: Shift[]): Array<{employeeId: string, conflicts: Shift[]}> {
    // Group by employee and date for efficient conflict detection
    const employeeShifts = new Map<string, Map<string, Shift[]>>();

    // Build index - O(n)
    shifts.forEach(shift => {
      const empId = shift.employeeId;
      const dateKey = shift.date.toDateString();

      if (!employeeShifts.has(empId)) {
        employeeShifts.set(empId, new Map());
      }

      const empDateShifts = employeeShifts.get(empId)!;
      if (!empDateShifts.has(dateKey)) {
        empDateShifts.set(dateKey, []);
      }

      empDateShifts.get(dateKey)!.push(shift);
    });

    const conflicts: Array<{employeeId: string, conflicts: Shift[]}> = [];

    // Check conflicts - O(n) where n is number of shifts per employee per day (usually small)
    employeeShifts.forEach((dateShifts, employeeId) => {
      dateShifts.forEach((dayShifts, date) => {
        if (dayShifts.length > 1) {
          // Check time overlaps
          const overlapping = this.findOverlappingShifts(dayShifts);
          if (overlapping.length > 0) {
            conflicts.push({ employeeId, conflicts: overlapping });
          }
        }
      });
    });

    return conflicts;
  }

  // O(n log n) - Optimized shift sorting and batching
  static batchShiftsByOptimalCriteria(shifts: Shift[], batchSize: number): Shift[][] {
    // Sort by multiple criteria for optimal processing
    const sortedShifts = [...shifts].sort((a, b) => {
      // Primary: Store ID (for locality)
      if (a.storeId !== b.storeId) return a.storeId.localeCompare(b.storeId);

      // Secondary: Date
      if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime();

      // Tertiary: Start time
      return a.startTime.localeCompare(b.startTime);
    });

    const batches: Shift[][] = [];
    for (let i = 0; i < sortedShifts.length; i += batchSize) {
      batches.push(sortedShifts.slice(i, i + batchSize));
    }

    return batches;
  }

  private static calculateShiftHours(shift: Shift): number {
    const start = new Date(`2000-01-01T${shift.startTime}`);
    const end = new Date(`2000-01-01T${shift.endTime}`);

    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return Math.max(0, (totalMinutes - (shift.breakDuration || 0)) / 60);
  }

  private static findOverlappingShifts(shifts: Shift[]): Shift[] {
    const overlapping: Shift[] = [];

    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        if (this.shiftsOverlap(shifts[i], shifts[j])) {
          if (!overlapping.includes(shifts[i])) overlapping.push(shifts[i]);
          if (!overlapping.includes(shifts[j])) overlapping.push(shifts[j]);
        }
      }
    }

    return overlapping;
  }

  private static shiftsOverlap(shift1: Shift, shift2: Shift): boolean {
    const start1 = new Date(`2000-01-01T${shift1.startTime}`);
    const end1 = new Date(`2000-01-01T${shift1.endTime}`);
    const start2 = new Date(`2000-01-01T${shift2.startTime}`);
    const end2 = new Date(`2000-01-01T${shift2.endTime}`);

    return start1 < end2 && start2 < end1;
  }
}

interface UsePerformanceOptimizationProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
}

export const usePerformanceOptimization = ({
  shifts,
  employees,
  stores
}: UsePerformanceOptimizationProps) => {
  const [config, setConfig] = useState<PerformanceConfig>({
    enableCaching: true,
    cacheTimeoutMs: 5 * 60 * 1000, // 5 minutes
    maxCacheSize: 1000,
    batchSize: 50,
    enableVirtualization: true,
    enableWebWorkers: false, // Disabled by default for compatibility
    performanceThresholds: {
      warning: 100, // 100ms
      critical: 500 // 500ms
    }
  });

  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Caches
  const validationCache = useRef(new AdvancedCache<ValidationResult>(config.maxCacheSize, config.cacheTimeoutMs));
  const workloadCache = useRef(new AdvancedCache<Map<string, number>>(config.maxCacheSize, config.cacheTimeoutMs));
  const conflictCache = useRef(new AdvancedCache<any[]>(config.maxCacheSize, config.cacheTimeoutMs));

  // Performance monitoring
  const performanceObserver = useRef<Map<string, number>>(new Map());

  const startPerformanceTimer = useCallback((operation: string): string => {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    performanceObserver.current.set(timerId, performance.now());
    return timerId;
  }, []);

  const endPerformanceTimer = useCallback((timerId: string, operation: string, dataSize: number = 0): PerformanceMetrics => {
    const startTime = performanceObserver.current.get(timerId);
    if (!startTime) throw new Error(`Timer ${timerId} not found`);

    const executionTime = performance.now() - startTime;
    performanceObserver.current.delete(timerId);

    const metric: PerformanceMetrics = {
      operationType: operation,
      executionTime,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      cacheHitRatio: 0, // Will be calculated by cache
      throughput: dataSize > 0 ? dataSize / (executionTime / 1000) : 0,
      datasetSize: dataSize,
      algorithmComplexity: 'O(n)' // Default, should be specified by operation
    };

    setMetrics(prev => [...prev.slice(-99), metric]); // Keep last 100 metrics

    // Check thresholds
    if (executionTime > config.performanceThresholds.critical) {
      console.warn(`🐌 Critical performance: ${operation} took ${executionTime.toFixed(2)}ms`);
    } else if (executionTime > config.performanceThresholds.warning) {
      console.warn(`⚠️ Slow performance: ${operation} took ${executionTime.toFixed(2)}ms`);
    }

    return metric;
  }, [config.performanceThresholds]);

  // Optimized validation with caching
  const getCachedValidation = useCallback((cacheKey: string, validationFn: () => ValidationResult): ValidationResult => {
    if (!config.enableCaching) {
      return validationFn();
    }

    const cached = validationCache.current.get(cacheKey);
    if (cached) {
      console.log(`🎯 Cache hit for validation: ${cacheKey}`);
      return cached;
    }

    const result = validationFn();
    validationCache.current.set(cacheKey, result);
    console.log(`💾 Cached validation result: ${cacheKey}`);

    return result;
  }, [config.enableCaching]);

  // Optimized workload calculation with caching
  const getOptimizedWorkloadDistribution = useCallback((): Map<string, number> => {
    const cacheKey = `workload_${employees.length}_${shifts.length}_${shifts.map(s => s.id).join(',').slice(0, 50)}`;

    if (config.enableCaching) {
      const cached = workloadCache.current.get(cacheKey);
      if (cached) {
        console.log(`🎯 Cache hit for workload distribution`);
        return cached;
      }
    }

    const timerId = startPerformanceTimer('workload_calculation');
    const result = OptimizedAlgorithms.calculateWorkloadDistribution(employees, shifts);
    endPerformanceTimer(timerId, 'workload_calculation', employees.length + shifts.length);

    if (config.enableCaching) {
      workloadCache.current.set(cacheKey, result);
    }

    return result;
  }, [employees, shifts, config.enableCaching, startPerformanceTimer, endPerformanceTimer]);

  // Optimized conflict detection with caching
  const getOptimizedConflicts = useCallback(() => {
    const cacheKey = `conflicts_${shifts.length}_${shifts.map(s => `${s.employeeId}_${s.date.toDateString()}_${s.startTime}`).join(',').slice(0, 100)}`;

    if (config.enableCaching) {
      const cached = conflictCache.current.get(cacheKey);
      if (cached) {
        console.log(`🎯 Cache hit for conflict detection`);
        return cached;
      }
    }

    const timerId = startPerformanceTimer('conflict_detection');
    const result = OptimizedAlgorithms.detectConflicts(shifts);
    endPerformanceTimer(timerId, 'conflict_detection', shifts.length);

    if (config.enableCaching) {
      conflictCache.current.set(cacheKey, result);
    }

    return result;
  }, [shifts, config.enableCaching, startPerformanceTimer, endPerformanceTimer]);

  // Batch processing system
  const processBatch = useCallback(async <T, R>(
    operation: BatchOperation<T, R>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<R[]> => {
    setIsOptimizing(true);
    const timerId = startPerformanceTimer(`batch_${operation.name}`);

    try {
      const batches = [];
      for (let i = 0; i < operation.data.length; i += operation.batchSize) {
        batches.push(operation.data.slice(i, i + operation.batchSize));
      }

      const results: R[] = [];
      let completed = 0;

      for (const batch of batches) {
        const batchResults = await operation.processor(batch, onProgress);
        results.push(...batchResults);

        completed += batch.length;
        onProgress?.(completed, operation.data.length);

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      return results;
    } finally {
      endPerformanceTimer(timerId, `batch_${operation.name}`, operation.data.length);
      setIsOptimizing(false);
    }
  }, [startPerformanceTimer, endPerformanceTimer]);

  // Cache management
  const clearCaches = useCallback(() => {
    validationCache.current.clear();
    workloadCache.current.clear();
    conflictCache.current.clear();
    console.log('🧹 All caches cleared');
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      validation: validationCache.current.getStats(),
      workload: workloadCache.current.getStats(),
      conflict: conflictCache.current.getStats()
    };
  }, []);

  // Performance analysis
  const getPerformanceAnalysis = useCallback(() => {
    if (metrics.length === 0) return null;

    const recentMetrics = metrics.slice(-20); // Last 20 operations
    const avgExecutionTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length;

    const slowOperations = recentMetrics.filter(m => m.executionTime > config.performanceThresholds.warning);
    const criticalOperations = recentMetrics.filter(m => m.executionTime > config.performanceThresholds.critical);

    return {
      averageExecutionTime: avgExecutionTime,
      averageThroughput: avgThroughput,
      slowOperationsCount: slowOperations.length,
      criticalOperationsCount: criticalOperations.length,
      performanceScore: Math.max(0, 100 - (avgExecutionTime / 10)), // Simple scoring
      recommendations: [
        ...(avgExecutionTime > 200 ? ['Considerare ottimizzazione algoritmi'] : []),
        ...(criticalOperations.length > 3 ? ['Aumentare dimensione cache'] : []),
        ...(slowOperations.length > 5 ? ['Implementare batch processing'] : [])
      ]
    };
  }, [metrics, config.performanceThresholds]);

  // Optimized data access patterns
  const optimizedDataAccess = useMemo(() => {
    // Pre-compute frequently used data structures
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    const storeMap = new Map(stores.map(store => [store.id, store]));
    const shiftsByEmployee = new Map<string, Shift[]>();
    const shiftsByStore = new Map<string, Shift[]>();

    shifts.forEach(shift => {
      // Group by employee
      if (!shiftsByEmployee.has(shift.employeeId)) {
        shiftsByEmployee.set(shift.employeeId, []);
      }
      shiftsByEmployee.get(shift.employeeId)!.push(shift);

      // Group by store
      if (!shiftsByStore.has(shift.storeId)) {
        shiftsByStore.set(shift.storeId, []);
      }
      shiftsByStore.get(shift.storeId)!.push(shift);
    });

    return {
      employeeMap,
      storeMap,
      shiftsByEmployee,
      shiftsByStore,
      getEmployee: (id: string) => employeeMap.get(id),
      getStore: (id: string) => storeMap.get(id),
      getEmployeeShifts: (employeeId: string) => shiftsByEmployee.get(employeeId) || [],
      getStoreShifts: (storeId: string) => shiftsByStore.get(storeId) || []
    };
  }, [employees, stores, shifts]);

  return {
    // Configuration
    config,
    setConfig,

    // Performance monitoring
    metrics,
    isOptimizing,

    // Optimized operations
    getOptimizedWorkloadDistribution,
    getOptimizedConflicts,
    getCachedValidation,

    // Batch processing
    processBatch,

    // Cache management
    clearCaches,
    getCacheStats,

    // Performance analysis
    getPerformanceAnalysis,

    // Data access
    optimizedDataAccess,

    // Utilities
    startPerformanceTimer,
    endPerformanceTimer,

    // Algorithms
    OptimizedAlgorithms
  };
};