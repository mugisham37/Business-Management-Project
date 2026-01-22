/**
 * Error Handling Demo Page
 * 
 * Demonstrates the comprehensive error handling system capabilities
 */

import { ErrorHandlingDemo } from '@/components/error-handling/ErrorHandlingDemo';

export default function ErrorHandlingDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Error Handling System Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            This page demonstrates the comprehensive error handling system including 
            global error boundaries, network error handling with retry logic, 
            circuit breaker patterns, and secure error logging with PII protection.
          </p>
        </div>
        
        <ErrorHandlingDemo />
      </div>
    </div>
  );
}