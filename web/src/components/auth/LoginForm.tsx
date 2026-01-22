/**
 * Login Form Component
 * Demonstrates authentication system usage
 */

'use client';

import React, { useState } from 'react';
import { useAuth, useMFA } from '@/hooks/useAuth';
import type { LoginCredentials } from '@/lib/auth';

interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const { login, isLoading } = useAuth();
  const { verifyMFA, isVerificationRequired } = useMFA();
  
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await login(credentials);
      
      if (!result.success) {
        const errorMessage = result.message || 'Login failed';
        setError(errorMessage);
        onError?.(errorMessage);
        return;
      }

      if (result.mfaRequired) {
        // MFA verification required, form will show MFA input
        return;
      }

      // Login successful
      onSuccess?.();
    } catch (error) {
      const errorMessage = (error as Error).message || 'Login failed';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await verifyMFA(mfaCode);
      
      if (!result.success) {
        const errorMessage = result.message || 'MFA verification failed';
        setError(errorMessage);
        onError?.(errorMessage);
        return;
      }

      // MFA verification successful
      onSuccess?.();
    } catch (error) {
      const errorMessage = (error as Error).message || 'MFA verification failed';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  if (isVerificationRequired) {
    return (
      <form onSubmit={handleMFASubmit} className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-4">Multi-Factor Authentication</h2>
          <p className="text-gray-600 mb-4">
            Please enter the verification code from your authenticator app.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700">
            Verification Code
          </label>
          <input
            type="text"
            id="mfaCode"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || mfaCode.length !== 6}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-4">Sign In</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={credentials.email}
          onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={credentials.password}
          onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}