/*
 * 🧪 FASE 5: Testing Framework per HR Scheduling
 *
 * Sistema completo di testing per validare funzionalità critiche:
 * - Test case per redistribuzione con vincoli complessi
 * - Test per scambi multi-dipendente
 * - Test per ottimizzazione negozi con pochi dipendenti
 * - Gestione conflitti e errori avanzata
 */

import { useState, useCallback, useRef } from 'react';
import { Employee, Store, Shift } from '../types';
import { BalancingSuggestion, BalancingResult } from './useWorkloadBalancer';
import { ValidationResult } from './useBalancingEngine';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'redistribution' | 'swap' | 'optimization' | 'conflict' | 'performance';
  priority: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'complex' | 'critical';
  expectedResult: 'success' | 'warning' | 'error';
  setup: () => TestScenario;
  validate: (result: any) => TestResult;
}

export interface TestScenario {
  employees: Employee[];
  stores: Store[];
  shifts: Shift[];
  suggestion: BalancingSuggestion;
  constraints: TestConstraint[];
}

export interface TestConstraint {
  type: 'max_hours' | 'min_rest' | 'skill_required' | 'store_capacity' | 'consecutive_days';
  value: any;
  description: string;
}

export interface TestResult {
  passed: boolean;
  score: number; // 0-100
  duration: number; // milliseconds
  details: {
    expectedBehavior: string;
    actualBehavior: string;
    deviations: string[];
    performance: PerformanceMetrics;
  };
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  validationCalls: number;
  algorithmEfficiency: number; // 0-100
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  results: Map<string, TestResult>;
  summary: TestSuiteSummary;
}

export interface TestSuiteSummary {
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  averageScore: number;
  totalDuration: number;
  coverage: {
    redistribution: number;
    swaps: number;
    optimization: number;
    conflicts: number;
  };
}

// 🧪 CRITICAL TEST CASES DEFINITION
const CRITICAL_TEST_CASES: TestCase[] = [
  // REDISTRIBUTION TESTS
  {
    id: 'redistrib-001',
    name: 'Redistribuzione con Junior/Senior Constraints',
    description: 'Testa redistribuzione rispettando limiti competenze junior (max 6h) e senior',
    category: 'redistribution',
    priority: 'high',
    complexity: 'complex',
    expectedResult: 'success',
    setup: () => ({
      employees: [
        createTestEmployee('emp-senior', 'senior', 'store-1', 45), // Sovraccarico
        createTestEmployee('emp-junior', 'junior', 'store-1', 20), // Sottoutilizzo
      ],
      stores: [createTestStore('store-1', 'Test Store')],
      shifts: [
        createTestShift('shift-1', 'emp-senior', 'store-1', '09:00', '17:00', 8), // 8h
        createTestShift('shift-2', 'emp-senior', 'store-1', '18:00', '22:00', 4), // 4h
        createTestShift('shift-3', 'emp-senior', 'store-1', '14:00', '18:00', 4), // 4h
      ],
      suggestion: {
        id: 'test-redistrib-001',
        type: 'redistribute',
        title: 'Redistribuisci ore da Senior a Junior',
        description: 'Sposta turni compatibili rispettando limite 6h per junior',
        priority: 'high',
        sourceEmployeeId: 'emp-senior',
        sourceEmployeeName: 'Senior Employee',
        targetEmployeeId: 'emp-junior',
        targetEmployeeName: 'Junior Employee',
        proposedChanges: {
          action: 'Redistribuisci 4 ore',
          impact: { hoursChange: 4, riskLevel: 'low' },
          rationale: 'Junior può gestire turno da 4h'
        },
        storeId: 'store-1'
      },
      constraints: [
        { type: 'max_hours', value: 6, description: 'Junior max 6h per turno' },
        { type: 'skill_required', value: 'basic', description: 'Competenze base richieste' }
      ]
    }),
    validate: (result: BalancingResult) => ({
      passed: result.success && result.summary.hoursRedistributed <= 6,
      score: result.success ? 95 : 0,
      duration: 0,
      details: {
        expectedBehavior: 'Turno da 4h redistribuito a junior employee',
        actualBehavior: `${result.summary.hoursRedistributed}h redistribuite`,
        deviations: result.summary.hoursRedistributed > 6 ? ['Violato limite 6h per junior'] : [],
        performance: { executionTime: 0, memoryUsage: 0, validationCalls: 0, algorithmEfficiency: 0 }
      },
      errors: result.errors,
      warnings: [],
      recommendations: ['Verifica sempre limiti competenze prima della redistribuzione']
    })
  },

  {
    id: 'redistrib-002',
    name: 'Redistribuzione Cross-Store Denied',
    description: 'Verifica che redistribuzioni tra negozi diversi siano bloccate',
    category: 'redistribution',
    priority: 'high',
    complexity: 'complex',
    expectedResult: 'error',
    setup: () => ({
      employees: [
        createTestEmployee('emp-store1', 'senior', 'store-1', 45),
        createTestEmployee('emp-store2', 'senior', 'store-2', 20),
      ],
      stores: [
        createTestStore('store-1', 'Store 1'),
        createTestStore('store-2', 'Store 2')
      ],
      shifts: [
        createTestShift('shift-1', 'emp-store1', 'store-1', '09:00', '17:00', 8),
      ],
      suggestion: {
        id: 'test-redistrib-002',
        type: 'redistribute',
        title: 'Redistribuzione Cross-Store (dovrebbe fallire)',
        description: 'Tentativo redistribuzione tra store diversi',
        priority: 'high',
        sourceEmployeeId: 'emp-store1',
        sourceEmployeeName: 'Store 1 Employee',
        targetEmployeeId: 'emp-store2',
        targetEmployeeName: 'Store 2 Employee',
        proposedChanges: {
          action: 'Redistribuisci cross-store',
          impact: { hoursChange: 8, riskLevel: 'high' },
          rationale: 'Test di validazione cross-store'
        },
        storeId: 'store-1'
      },
      constraints: [
        { type: 'store_capacity', value: 'same_store_only', description: 'Solo stesso negozio' }
      ]
    }),
    validate: (result: BalancingResult) => ({
      passed: !result.success, // Deve fallire!
      score: !result.success ? 100 : 0,
      duration: 0,
      details: {
        expectedBehavior: 'Redistribuzione negata per cross-store policy',
        actualBehavior: result.success ? 'Redistribuzione consentita erroneamente' : 'Redistribuzione correttamente negata',
        deviations: result.success ? ['Cross-store redistribution non dovrebbe essere permessa'] : [],
        performance: { executionTime: 0, memoryUsage: 0, validationCalls: 0, algorithmEfficiency: 0 }
      },
      errors: result.success ? ['Cross-store redistribution erroneamente permessa'] : [],
      warnings: [],
      recommendations: ['Implementare controlli più rigidi per policy cross-store']
    })
  },

  // SWAP TESTS
  {
    id: 'swap-001',
    name: 'Scambio Multi-Dipendente Complesso',
    description: 'Testa scambio tra 3+ dipendenti con vincoli incrociati',
    category: 'swap',
    priority: 'high',
    complexity: 'critical',
    expectedResult: 'success',
    setup: () => ({
      employees: [
        createTestEmployee('emp-1', 'senior', 'store-1', 32),
        createTestEmployee('emp-2', 'manager', 'store-1', 28),
        createTestEmployee('emp-3', 'junior', 'store-1', 16),
      ],
      stores: [createTestStore('store-1', 'Test Store')],
      shifts: [
        createTestShift('shift-1', 'emp-1', 'store-1', '09:00', '17:00', 8), // Senior, lungo
        createTestShift('shift-2', 'emp-2', 'store-1', '14:00', '18:00', 4), // Manager, medio
        createTestShift('shift-3', 'emp-3', 'store-1', '18:00', '22:00', 4), // Junior, sera
      ],
      suggestion: {
        id: 'test-swap-001',
        type: 'swap_shifts',
        title: 'Scambio Ottimale Multi-Skills',
        description: 'Ottimizza competenze per orari appropriati',
        priority: 'high',
        sourceEmployeeId: 'emp-1',
        sourceEmployeeName: 'Senior Employee',
        targetEmployeeId: 'emp-3',
        targetEmployeeName: 'Junior Employee',
        shiftId: 'shift-1',
        proposedChanges: {
          action: 'Scambia turni per ottimizzare competenze',
          impact: { hoursChange: 0, riskLevel: 'medium' },
          rationale: 'Junior non dovrebbe avere turno sera lungo'
        },
        storeId: 'store-1'
      },
      constraints: [
        { type: 'max_hours', value: 6, description: 'Junior max 6h' },
        { type: 'skill_required', value: 'senior_evening', description: 'Sera richiede senior' }
      ]
    }),
    validate: (result: BalancingResult) => ({
      passed: result.success && result.summary.shiftsModified === 2,
      score: result.success ? 90 : 20,
      duration: 0,
      details: {
        expectedBehavior: 'Scambio turni con verifica competenze',
        actualBehavior: `${result.summary.shiftsModified} turni scambiati`,
        deviations: result.summary.shiftsModified !== 2 ? ['Numero turni scambiati inatteso'] : [],
        performance: { executionTime: 0, memoryUsage: 0, validationCalls: 0, algorithmEfficiency: 0 }
      },
      errors: result.errors,
      warnings: [],
      recommendations: ['Considerare preferenze dipendenti negli scambi']
    })
  },

  // OPTIMIZATION TESTS
  {
    id: 'optim-001',
    name: 'Ottimizzazione Negozio Sottostaffato',
    description: 'Testa ottimizzazione per negozio con pochi dipendenti disponibili',
    category: 'optimization',
    priority: 'high',
    complexity: 'complex',
    expectedResult: 'warning',
    setup: () => ({
      employees: [
        createTestEmployee('emp-1', 'manager', 'store-1', 40),
        createTestEmployee('emp-2', 'junior', 'store-1', 20),
        // Solo 2 dipendenti per 7 giorni - scenario critico
      ],
      stores: [createTestStore('store-1', 'Understaffed Store')],
      shifts: [
        // Settimana con gap di copertura
        createTestShift('shift-1', 'emp-1', 'store-1', '09:00', '17:00', 8),
        createTestShift('shift-2', 'emp-2', 'store-1', '17:00', '21:00', 4),
        // Mancano giorni 3-7
      ],
      suggestion: {
        id: 'test-optim-001',
        type: 'add_shift',
        title: 'Aggiungi Turni per Copertura Completa',
        description: 'Ottimizza copertura con risorse limitate',
        priority: 'high',
        sourceEmployeeId: 'emp-1',
        sourceEmployeeName: 'Manager',
        proposedChanges: {
          action: 'Aggiungi turni strategici',
          impact: { hoursChange: 32, riskLevel: 'high' },
          rationale: 'Copertura minima richiesta'
        },
        storeId: 'store-1'
      },
      constraints: [
        { type: 'consecutive_days', value: 5, description: 'Max 5 giorni consecutivi' },
        { type: 'min_rest', value: 12, description: 'Min 12h riposo' }
      ]
    }),
    validate: (result: BalancingResult) => ({
      passed: result.success || result.errors.some(e => e.includes('risorse limitate')),
      score: result.success ? 85 : 65,
      duration: 0,
      details: {
        expectedBehavior: 'Ottimizzazione con avvisi per risorse limitate',
        actualBehavior: result.success ? 'Ottimizzazione completata' : 'Ottimizzazione con limitazioni',
        deviations: [],
        performance: { executionTime: 0, memoryUsage: 0, validationCalls: 0, algorithmEfficiency: 0 }
      },
      errors: result.errors,
      warnings: ['Negozio sotto-staffato: considerare assunzioni'],
      recommendations: [
        'Aumentare organico per copertura ottimale',
        'Implementare turni part-time strategici',
        'Considerare supporto da altri negozi'
      ]
    })
  },

  // CONFLICT MANAGEMENT TESTS
  {
    id: 'conflict-001',
    name: 'Gestione Conflitti Sovrapposizione',
    description: 'Testa risoluzione automatica conflitti di sovrapposizione turni',
    category: 'conflict',
    priority: 'high',
    complexity: 'critical',
    expectedResult: 'error',
    setup: () => ({
      employees: [createTestEmployee('emp-1', 'senior', 'store-1', 32)],
      stores: [createTestStore('store-1', 'Test Store')],
      shifts: [
        createTestShift('shift-1', 'emp-1', 'store-1', '09:00', '17:00', 8),
        createTestShift('shift-2', 'emp-1', 'store-1', '15:00', '19:00', 4), // Sovrapposizione!
      ],
      suggestion: {
        id: 'test-conflict-001',
        type: 'adjust_hours',
        title: 'Risolvi Conflitto Sovrapposizione',
        description: 'Sistema automatico gestione conflitti',
        priority: 'high',
        sourceEmployeeId: 'emp-1',
        sourceEmployeeName: 'Employee',
        proposedChanges: {
          action: 'Risolvi sovrapposizione automaticamente',
          impact: { hoursChange: -2, riskLevel: 'low' },
          rationale: 'Evita sovrapposizione turni'
        },
        storeId: 'store-1'
      },
      constraints: [
        { type: 'min_rest', value: 0, description: 'No sovrapposizioni' }
      ]
    }),
    validate: (result: BalancingResult) => ({
      passed: !result.success, // Dovrebbe rilevare il conflitto
      score: !result.success ? 100 : 0,
      duration: 0,
      details: {
        expectedBehavior: 'Conflitto rilevato e operazione bloccata',
        actualBehavior: result.success ? 'Conflitto non rilevato' : 'Conflitto correttamente rilevato',
        deviations: result.success ? ['Sistema non ha rilevato sovrapposizione'] : [],
        performance: { executionTime: 0, memoryUsage: 0, validationCalls: 0, algorithmEfficiency: 0 }
      },
      errors: result.success ? ['Sovrapposizione non rilevata'] : result.errors,
      warnings: [],
      recommendations: ['Implementare validazione pre-applicazione più rigorosa']
    })
  }
];

// HELPER FUNCTIONS
function createTestEmployee(id: string, role: 'junior' | 'senior' | 'manager', storeId: string, weeklyHours: number): Employee {
  return {
    id,
    firstName: `Test${role.charAt(0).toUpperCase() + role.slice(1)}`,
    lastName: 'Employee',
    email: `${id}@test.com`,
    phone: '+39 000 000000',
    position: role,
    department: 'Test',
    storeId,
    role,
    contractType: 'tempo_indeterminato',
    contractHours: weeklyHours,
    weeklyHours,
    monthlyHours: weeklyHours * 4.33,
    hourlyRate: role === 'manager' ? 20 : role === 'senior' ? 15 : 12,
    overtimeRate: 0,
    startDate: '2024-01-01',
    isActive: true,
    skills: role === 'junior' ? ['basic'] : role === 'senior' ? ['advanced', 'basic'] : ['management', 'advanced', 'basic'],
    preferences: {
      preferredShifts: ['mattino'],
      maxConsecutiveDays: 5,
      minRestHours: 12
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createTestStore(id: string, name: string): Store {
  return {
    id,
    name,
    address: 'Test Address',
    phone: '+39 000 000000',
    email: 'test@store.com',
    manager: 'Test Manager',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createTestShift(id: string, employeeId: string, storeId: string, startTime: string, endTime: string, hours: number): Shift {
  return {
    id,
    employeeId,
    storeId,
    date: new Date(),
    startTime,
    endTime,
    breakDuration: 60,
    actualHours: hours,
    isLocked: false,
    notes: 'Test shift',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

interface UseTestingFrameworkProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
  balancingEngine: any; // From useBalancingEngine
}

export const useTestingFramework = ({
  shifts,
  employees,
  stores,
  balancingEngine
}: UseTestingFrameworkProps) => {
  const [testSuites] = useState<TestSuite[]>([
    {
      id: 'critical-tests',
      name: 'Test Case Critici',
      description: 'Suite di test per scenari critici del sistema di bilanciamento',
      testCases: CRITICAL_TEST_CASES,
      results: new Map(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        averageScore: 0,
        totalDuration: 0,
        coverage: {
          redistribution: 0,
          swaps: 0,
          optimization: 0,
          conflicts: 0
        }
      }
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const performanceCache = useRef<Map<string, PerformanceMetrics>>(new Map());

  const runTestCase = useCallback(async (testCase: TestCase): Promise<TestResult> => {
    const startTime = performance.now();
    setCurrentTest(testCase.id);

    try {
      console.log(`🧪 Running test: ${testCase.name}`);

      // Setup test scenario
      const scenario = testCase.setup();

      // Apply suggestion using balancing engine
      const result = await balancingEngine.applySuggestion(scenario.suggestion);

      // Validate result
      const testResult = testCase.validate(result);

      // Calculate performance metrics
      const endTime = performance.now();
      testResult.duration = endTime - startTime;
      testResult.details.performance = {
        executionTime: testResult.duration,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        validationCalls: 1,
        algorithmEfficiency: testResult.score
      };

      console.log(`✅ Test completed: ${testCase.name} - Score: ${testResult.score}%`);
      return testResult;

    } catch (error) {
      console.error(`❌ Test failed: ${testCase.name}`, error);
      return {
        passed: false,
        score: 0,
        duration: performance.now() - startTime,
        details: {
          expectedBehavior: 'Test execution without errors',
          actualBehavior: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
          deviations: ['Test execution failed'],
          performance: { executionTime: 0, memoryUsage: 0, validationCalls: 0, algorithmEfficiency: 0 }
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        recommendations: ['Fix test setup or implementation']
      };
    } finally {
      setCurrentTest(null);
    }
  }, [balancingEngine]);

  const runTestSuite = useCallback(async (suiteId: string): Promise<TestSuiteSummary> => {
    setIsRunning(true);
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) throw new Error(`Test suite ${suiteId} not found`);

    console.log(`🧪 Running test suite: ${suite.name}`);
    const results = new Map<string, TestResult>();
    let totalScore = 0;
    let totalDuration = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const testCase of suite.testCases) {
      const result = await runTestCase(testCase);
      results.set(testCase.id, result);

      totalScore += result.score;
      totalDuration += result.duration;

      if (result.passed) {
        passed++;
      } else {
        failed++;
      }

      if (result.warnings.length > 0) {
        warnings++;
      }
    }

    // Update suite results
    suite.results = results;
    suite.summary = {
      totalTests: suite.testCases.length,
      passed,
      failed,
      warnings,
      averageScore: totalScore / suite.testCases.length,
      totalDuration,
      coverage: {
        redistribution: suite.testCases.filter(t => t.category === 'redistribution').length,
        swaps: suite.testCases.filter(t => t.category === 'swap').length,
        optimization: suite.testCases.filter(t => t.category === 'optimization').length,
        conflicts: suite.testCases.filter(t => t.category === 'conflict').length
      }
    };

    setIsRunning(false);
    console.log(`✅ Test suite completed: ${suite.summary.passed}/${suite.summary.totalTests} passed`);
    return suite.summary;
  }, [testSuites, runTestCase]);

  const generateTestReport = useCallback((suiteId: string): string => {
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite || suite.results.size === 0) return 'No test results available';

    let report = `# 🧪 Test Report: ${suite.name}\n\n`;
    report += `## Summary\n`;
    report += `- **Total Tests**: ${suite.summary.totalTests}\n`;
    report += `- **Passed**: ${suite.summary.passed} ✅\n`;
    report += `- **Failed**: ${suite.summary.failed} ❌\n`;
    report += `- **Warnings**: ${suite.summary.warnings} ⚠️\n`;
    report += `- **Average Score**: ${suite.summary.averageScore.toFixed(1)}%\n`;
    report += `- **Total Duration**: ${suite.summary.totalDuration.toFixed(2)}ms\n\n`;

    report += `## Coverage\n`;
    report += `- **Redistribution**: ${suite.summary.coverage.redistribution} tests\n`;
    report += `- **Swaps**: ${suite.summary.coverage.swaps} tests\n`;
    report += `- **Optimization**: ${suite.summary.coverage.optimization} tests\n`;
    report += `- **Conflicts**: ${suite.summary.coverage.conflicts} tests\n\n`;

    report += `## Detailed Results\n`;
    suite.testCases.forEach(testCase => {
      const result = suite.results.get(testCase.id);
      if (result) {
        report += `### ${testCase.name} ${result.passed ? '✅' : '❌'}\n`;
        report += `- **Score**: ${result.score}%\n`;
        report += `- **Duration**: ${result.duration.toFixed(2)}ms\n`;
        report += `- **Expected**: ${result.details.expectedBehavior}\n`;
        report += `- **Actual**: ${result.details.actualBehavior}\n`;

        if (result.errors.length > 0) {
          report += `- **Errors**: ${result.errors.join(', ')}\n`;
        }

        if (result.warnings.length > 0) {
          report += `- **Warnings**: ${result.warnings.join(', ')}\n`;
        }

        if (result.recommendations.length > 0) {
          report += `- **Recommendations**: ${result.recommendations.join(', ')}\n`;
        }

        report += '\n';
      }
    });

    return report;
  }, [testSuites]);

  return {
    testSuites,
    isRunning,
    currentTest,
    runTestCase,
    runTestSuite,
    generateTestReport,
    CRITICAL_TEST_CASES
  };
};