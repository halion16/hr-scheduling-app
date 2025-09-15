/*
 * 🧪 FASE 5: Testing & Performance Panel
 *
 * Pannello completo per:
 * - Esecuzione test case critici
 * - Monitoraggio performance in tempo reale
 * - Analisi cache e ottimizzazioni
 * - Report dettagliati
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Database,
  Zap,
  BarChart3,
  FileText,
  Settings,
  RefreshCw,
  Activity,
  Target
} from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useTestingFramework } from '../../hooks/useTestingFramework';
import { usePerformanceOptimization } from '../../hooks/usePerformanceOptimization';
import { useBalancingEngine } from '../../hooks/useBalancingEngine';
import { Employee, Store, Shift } from '../../types';

interface TestingPanelProps {
  shifts: Shift[];
  employees: Employee[];
  stores: Store[];
  onUpdateShifts: (updates: { id: string; data: Partial<Shift> }[]) => void;
}

export const TestingPanel: React.FC<TestingPanelProps> = ({
  shifts,
  employees,
  stores,
  onUpdateShifts
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'performance' | 'cache' | 'reports'>('tests');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportContent, setReportContent] = useState('');

  // Initialize hooks
  const balancingEngine = useBalancingEngine({
    shifts,
    employees,
    stores,
    onUpdateShifts,
    onAddShift: undefined,
    onDeleteShift: undefined
  });

  const testingFramework = useTestingFramework({
    shifts,
    employees,
    stores,
    balancingEngine
  });

  const performanceOptimization = usePerformanceOptimization({
    shifts,
    employees,
    stores
  });

  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Run test suite
  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await testingFramework.runTestSuite('critical-tests');
      setTestResults(results);
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Generate and show report
  const handleGenerateReport = () => {
    const report = testingFramework.generateTestReport('critical-tests');
    setReportContent(report);
    setShowReportModal(true);
  };

  // Performance analysis
  const performanceAnalysis = performanceOptimization.getPerformanceAnalysis();
  const cacheStats = performanceOptimization.getCacheStats();

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 rounded-lg p-2">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Testing & Performance</h2>
              <p className="text-sm text-gray-600">Sistema completo di testing e ottimizzazione - FASE 5</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              onClick={handleRunTests}
              disabled={isRunningTests}
              icon={isRunningTests ? RefreshCw : Play}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isRunningTests ? 'Testing in corso...' : 'Esegui Test'}
            </Button>

            <Button
              onClick={performanceOptimization.clearCaches}
              variant="outline"
              icon={Database}
              size="sm"
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'tests', name: 'Test Case', icon: Target },
            { id: 'performance', name: 'Performance', icon: TrendingUp },
            { id: 'cache', name: 'Cache Stats', icon: Database },
            { id: 'reports', name: 'Reports', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            {/* Test Results Summary */}
            {testResults && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-900">Passed</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-1">{testResults.passed}</p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <XCircle className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-sm font-medium text-red-900">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600 mt-1">{testResults.failed}</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                    <span className="text-sm font-medium text-yellow-900">Warnings</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">{testResults.warnings}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Avg Score</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {testResults.averageScore.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Test Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🔄 Test Redistribuzione
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Vincoli Junior/Senior</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Cross-Store Policy</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Competenze Base</span>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🔀 Test Scambi
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Multi-Dipendente</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Vincoli Orari</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Skill Matching</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ⚡ Test Ottimizzazione
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Negozi Sottostaffati</span>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Copertura Completa</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Risorse Limitate</span>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ⚠️ Test Conflitti
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Sovrapposizioni</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Validazione Pre-Apply</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Auto-Resolution</span>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Performance Metrics */}
            {performanceAnalysis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-900">Avg Execution</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {performanceAnalysis.averageExecutionTime.toFixed(1)}ms
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Zap className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-900">Throughput</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {performanceAnalysis.averageThroughput.toFixed(0)}/s
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-purple-900">Score</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {performanceAnalysis.performanceScore.toFixed(0)}%
                  </p>
                </div>
              </div>
            )}

            {/* Performance Issues */}
            {performanceAnalysis && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📊 Analisi Performance
                </h3>

                {performanceAnalysis.criticalOperationsCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center">
                      <XCircle className="h-4 w-4 text-red-600 mr-2" />
                      <span className="text-sm font-medium text-red-900">
                        {performanceAnalysis.criticalOperationsCount} operazioni critiche rilevate
                      </span>
                    </div>
                  </div>
                )}

                {performanceAnalysis.slowOperationsCount > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                      <span className="text-sm font-medium text-yellow-900">
                        {performanceAnalysis.slowOperationsCount} operazioni lente rilevate
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Raccomandazioni:</h4>
                  {performanceAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-600">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cache Tab */}
        {activeTab === 'cache' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Validation Cache */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  🛡️ Validation Cache
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entries:</span>
                    <span className="text-sm font-medium">{cacheStats.validation.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Memory:</span>
                    <span className="text-sm font-medium">{(cacheStats.validation.totalMemory / 1024).toFixed(1)}KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Hit Rate:</span>
                    <span className="text-sm font-medium">{cacheStats.validation.averageAccess.toFixed(1)}x</span>
                  </div>
                </div>
              </div>

              {/* Workload Cache */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  ⚖️ Workload Cache
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entries:</span>
                    <span className="text-sm font-medium">{cacheStats.workload.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Memory:</span>
                    <span className="text-sm font-medium">{(cacheStats.workload.totalMemory / 1024).toFixed(1)}KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Hit Rate:</span>
                    <span className="text-sm font-medium">{cacheStats.workload.averageAccess.toFixed(1)}x</span>
                  </div>
                </div>
              </div>

              {/* Conflict Cache */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  ⚠️ Conflict Cache
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entries:</span>
                    <span className="text-sm font-medium">{cacheStats.conflict.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Memory:</span>
                    <span className="text-sm font-medium">{(cacheStats.conflict.totalMemory / 1024).toFixed(1)}KB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Hit Rate:</span>
                    <span className="text-sm font-medium">{cacheStats.conflict.averageAccess.toFixed(1)}x</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cache Configuration */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ⚙️ Configurazione Cache
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cache Enabled
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={performanceOptimization.config.enableCaching}
                      onChange={(e) => performanceOptimization.setConfig(prev => ({
                        ...prev,
                        enableCaching: e.target.checked
                      }))}
                      className="h-4 w-4 text-purple-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600">
                      {performanceOptimization.config.enableCaching ? 'Attivo' : 'Disattivo'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timeout (minuti)
                  </label>
                  <input
                    type="number"
                    value={performanceOptimization.config.cacheTimeoutMs / (1000 * 60)}
                    onChange={(e) => performanceOptimization.setConfig(prev => ({
                      ...prev,
                      cacheTimeoutMs: parseInt(e.target.value) * 1000 * 60
                    }))}
                    className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                    min="1"
                    max="60"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Report di Testing</h3>
              <p className="text-gray-600 mb-4">
                Genera report dettagliati sui risultati dei test e performance
              </p>
              <Button
                onClick={handleGenerateReport}
                icon={FileText}
                disabled={!testResults}
              >
                Genera Report Completo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="📊 Report Testing Completo"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
              {reportContent}
            </pre>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowReportModal(false)}
            >
              Chiudi
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(reportContent);
                alert('Report copiato negli appunti!');
              }}
              icon={FileText}
            >
              Copia Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};