/**
 * Authentication System Example
 * Demonstrates the complete authentication flow
 */

'use client';

import React, { useState } from 'react';
import { 
  LoginForm, 
  UserProfile, 
  ProtectedRoute, 
  ConditionalRender,
  AuthProvider,
  AuthLoading,
  AuthStatus 
} from '@/components/auth';
import { useAuth } from '@/hooks/useAuth';

function AuthExampleContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'login' | 'profile' | 'protected'>('login');

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <LoginForm 
          onSuccess={() => setCurrentView('profile')}
          onError={(error) => console.error('Login error:', error)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Authentication System Demo
        </h1>
        <p className="text-gray-600 mb-4">
          Welcome, {user?.firstName}! This demo shows the authentication system in action.
        </p>
        
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setCurrentView('profile')}
            className={`px-4 py-2 rounded-md ${
              currentView === 'profile' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setCurrentView('protected')}
            className={`px-4 py-2 rounded-md ${
              currentView === 'protected' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Protected Content
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {currentView === 'profile' && <UserProfile />}
      
      {currentView === 'protected' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Permission-Based Content</h2>
          
          {/* Always visible content */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-md">
            <h3 className="font-medium text-green-800 mb-2">✓ Always Visible</h3>
            <p className="text-green-700">This content is visible to all authenticated users.</p>
          </div>

          {/* Permission-based conditional rendering */}
          <ConditionalRender 
            permission="users.read"
            fallback={
              <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                <h3 className="font-medium text-red-800 mb-2">✗ Access Denied</h3>
                <p className="text-red-700">You need 'users.read' permission to view this content.</p>
              </div>
            }
          >
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
              <h3 className="font-medium text-blue-800 mb-2">✓ Users Read Access</h3>
              <p className="text-blue-700">You have permission to read user data!</p>
            </div>
          </ConditionalRender>

          <ConditionalRender 
            permission="users.create"
            fallback={
              <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                <h3 className="font-medium text-red-800 mb-2">✗ Create Users Denied</h3>
                <p className="text-red-700">You need 'users.create' permission to create users.</p>
              </div>
            }
          >
            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
              <h3 className="font-medium text-green-800 mb-2">✓ Users Create Access</h3>
              <p className="text-green-700">You can create new users!</p>
            </div>
          </ConditionalRender>

          <ConditionalRender 
            permission={['admin.access', 'super.admin']}
            fallback={
              <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                <h3 className="font-medium text-red-800 mb-2">✗ Admin Access Denied</h3>
                <p className="text-red-700">You need admin permissions to access this content.</p>
              </div>
            }
          >
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-md">
              <h3 className="font-medium text-purple-800 mb-2">✓ Admin Access</h3>
              <p className="text-purple-700">Welcome to the admin area!</p>
            </div>
          </ConditionalRender>

          {/* Protected route example */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Protected Route Example</h3>
            <ProtectedRoute 
              permissions={['admin.access']}
              fallback={
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                  <h4 className="font-medium text-yellow-800 mb-2">⚠️ Protected Content</h4>
                  <p className="text-yellow-700">
                    This content is protected by the ProtectedRoute component and requires admin access.
                  </p>
                </div>
              }
            >
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-md">
                <h4 className="font-medium text-indigo-800 mb-2">🔒 Super Secret Admin Content</h4>
                <p className="text-indigo-700">
                  This content is only visible to users with admin permissions!
                </p>
              </div>
            </ProtectedRoute>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Complete Authentication Example
 * Shows the full authentication system with provider
 */
export function AuthExample() {
  return (
    <AuthProvider>
      <AuthLoading>
        <AuthExampleContent />
        <AuthStatus />
      </AuthLoading>
    </AuthProvider>
  );
}