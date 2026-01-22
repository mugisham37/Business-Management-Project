/**
 * Error Handling Demo Component
 * 
 * Demonstrates the comprehensive error handling system with examples
 * of different error types and recovery strategies.
 */

'use client';

import React, { useState } from 'react';
import {
  GlobalErrorBoundary,
  ComponentErrorFallback,
  useNetworkErrorHandler,
  useErrorLogger,
  ErrorHandlingUtils,
  fetchWithRetry,
} from '@/lib/error-handling';

interface ErrorDemoProps {
  className?: string;
}

/**
 * Component that can throw different types of errors for testing
 */
function ErrorThrower({ errorType }: { errorType: string }) {
  React.useEffect(() => {
    if (errorType === 'render') {
      throw new Error('Intentional render error for testing');
    }
  }, [errorType]);

  if (errorType === 'immediate') {
    throw new Error('Immediate error thrown during render');
  }

  return <div>No error thrown</div>;
}

/**
 * Network operation demo component
 */
function NetworkOperationDemo() {
  const { executeWithRetry, errorState, circuitBreakerState, isRetrying } = useNetworkErrorHandler({
    maxRetries: 3,
    baseDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt} for error:`, error.message);
    },
  });

  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const simulateNetworkOperation = async (shouldFail: boolean) => {
    setResult('');
    setError('');

    try {
      const response = await executeWithRetry(async () => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (shouldFail) {
          throw new Error('Simulated network failure');
        }
        
        return 'Network operation successful!';
      });

      setResult(response);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const testFetchWithRetry = async () => {
    setResult('');
    setError('');

    try {
      // This will fail but demonstrate retry logic
      const response = await fetchWithRetry('https://httpstat.us/500', {
        method: 'GET',
      }, {
        maxRetries: 2,
        baseDelay: 500,
      });

      setResult('Fetch successful!');
    } catch (err) {
      setError(`Fetch failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Network Error Handling Demo</h3>
      
      <div className="flex gap-2">
        <button
          onClick={() => simulateNetworkOperation(false)}
          disabled={isRetrying}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Successful Operation
        </button>
        
        <button
          onClick={() => simulateNetworkOperation(true)}
          disabled={isRetrying}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Failing Operation
        </button>

        <button
          onClick={testFetchWithRetry}
          disabled={isRetrying}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Test Fetch Retry
        </button>
      </div>

      {isRetrying && (
        <div className="text-blue-600">
          Retrying... (Attempt {errorState.retryCount})
        </div>
      )}

      {result && (
        <div className="text-green-600 font-medium">{result}</div>
      )}

      {error && (
        <div className="text-red-600 font-medium">{error}</div>
      )}

      <div className="text-sm text-gray-600">
        Circuit Breaker State: <span className="font-mono">{circuitBreakerState}</span>
      </div>
    </div>
  );
}

/**
 * Error logging demo component
 */
function ErrorLoggingDemo() {
  const { logError, logWarning, logInfo, getAnalytics } = useErrorLogger();
  const [analytics, setAnalytics] = useState<any>(null);

  const handleLogError = () => {
    logError(
      new Error('Demo error for testing'),
      { component: 'error-logging-demo' },
      { demoData: 'test-metadata' },
      ['demo', 'test']
    );
  };

  const handleLogWarning = () => {
    logWarning(
      'Demo warning message',
      { component: 'error-logging-demo' },
      { warningType: 'demo' },
      ['demo', 'warning']
    );
  };

  const handleLogInfo = () => {
    logInfo(
      'Demo info message',
      { component: 'error-logging-demo' },
      { infoType: 'demo' },
      ['demo', 'info']
    );
  };

  const handleGetAnalytics = () => {
    const currentAnalytics = getAnalytics();
    setAnalytics(currentAnalytics);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Error Logging Demo</h3>
      
      <div className="flex gap-2">
        <button
          onClick={handleLogError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Log Error
        </button>
        
        <button
          onClick={handleLogWarning}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          Log Warning
        </button>

        <button
          onClick={handleLogInfo}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Log Info
        </button>

        <button
          onClick={handleGetAnalytics}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Get Analytics
        </button>
      </div>

      {analytics && (
        <div className="bg-gray-50 p-4 rounded">
          <h4 className="font-semibold mb-2">Error Analytics</h4>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(analytics, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Main error handling demo component
 */
export function ErrorHandlingDemo({ className = '' }: ErrorDemoProps) {
  const [errorType, setErrorType] = useState<string>('none');
  const [showBoundaryDemo, setShowBoundaryDemo] = useState(false);

  const handleErrorTypeChange = (type: string) => {
    setErrorType(type);
    if (type !== 'none') {
      setShowBoundaryDemo(true);
    }
  };

  const resetDemo = () => {
    setErrorType('none');
    setShowBoundaryDemo(false);
  };

  const exportLogs = () => {
    const logs = ErrorHandlingUtils.exportErrorLogs();
    console.log('Exported error logs:', logs);
    
    // In a real app, you might download this as a file
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'error-logs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSystemStatus = () => {
    const summary = ErrorHandlingUtils.getErrorSummary();
    const circuitBreaker = ErrorHandlingUtils.getCircuitBreakerStatus();
    
    console.log('Error Summary:', summary);
    console.log('Circuit Breaker Status:', circuitBreaker);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-6">Error Handling System Demo</h2>
        
        {/* Error Boundary Demo */}
        <div className="space-y-4 p-4 border rounded-lg mb-6">
          <h3 className="text-lg font-semibold">Error Boundary Demo</h3>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleErrorTypeChange('immediate')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Throw Immediate Error
            </button>
            
            <button
              onClick={() => handleErrorTypeChange('render')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Throw Render Error
            </button>

            <button
              onClick={resetDemo}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Reset Demo
            </button>
          </div>

          {showBoundaryDemo && (
            <GlobalErrorBoundary
              level="component"
              fallback={ComponentErrorFallback}
              onError={(error, errorInfo, errorId) => {
                console.log('Error caught by demo boundary:', { error, errorInfo, errorId });
              }}
            >
              <div className="p-4 bg-blue-50 rounded">
                <ErrorThrower errorType={errorType} />
              </div>
            </GlobalErrorBoundary>
          )}
        </div>

        {/* Network Error Demo */}
        <NetworkOperationDemo />

        {/* Error Logging Demo */}
        <ErrorLoggingDemo />

        {/* System Controls */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="text-lg font-semibold">System Controls</h3>
          
          <div className="flex gap-2">
            <button
              onClick={exportLogs}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export Error Logs
            </button>
            
            <button
              onClick={getSystemStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Get System Status
            </button>

            <button
              onClick={() => ErrorHandlingUtils.clearErrorLogs()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Clear Error Logs
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="font-semibold mb-2">Instructions:</h4>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Use the error boundary demo to see how React errors are caught and handled</li>
            <li>Test network operations to see retry logic and circuit breaker in action</li>
            <li>Try the error logging features to see how errors are tracked and analyzed</li>
            <li>Check the browser console for detailed error information</li>
            <li>Export logs to see the structured error data</li>
          </ul>
        </div>
      </div>
    </div>
  );
}