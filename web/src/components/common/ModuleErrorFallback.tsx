/**
 * ModuleErrorFallback - Error fallback component for failed module loads
 */

'use client';

import { ComponentType } from 'react';

interface ModuleErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ModuleErrorFallback: ComponentType<ModuleErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 text-red-600 dark:text-red-400">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="w-full h-full"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
          Module Loading Failed
        </h3>
        
        <p className="text-sm text-red-700 dark:text-red-300 mb-4 max-w-md">
          {error.message || 'An unexpected error occurred while loading this module.'}
        </p>
        
        <div className="space-y-2">
          <button
            onClick={resetError}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-600"
          >
            Try Again
          </button>
          
          <div className="text-xs text-red-600 dark:text-red-400">
            If this problem persists, please contact support.
          </div>
        </div>
      </div>
    </div>
  );
};