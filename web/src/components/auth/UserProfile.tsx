/**
 * User Profile Component
 * Demonstrates authentication state usage
 */

'use client';

import React from 'react';
import { useAuth, useMFA } from '@/hooks/useAuth';

export function UserProfile() {
  const { 
    user, 
    logout, 
    isLoading,
    hasPermission,
    getUserPermissions 
  } = useAuth();
  
  const { 
    isEnabled: mfaEnabled, 
    setupMFA, 
    disableMFA 
  } = useMFA();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSetupMFA = async () => {
    try {
      const result = await setupMFA('TOTP');
      if (result.success) {
        console.log('MFA setup initiated:', result);
        // In a real app, you'd show the QR code and setup flow
      }
    } catch (error) {
      console.error('MFA setup failed:', error);
    }
  };

  const handleDisableMFA = async () => {
    const password = prompt('Enter your password to disable MFA:');
    if (!password) return;

    try {
      const result = await disableMFA(password);
      if (result.success) {
        console.log('MFA disabled successfully');
      }
    } catch (error) {
      console.error('MFA disable failed:', error);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Please log in to view your profile.</p>
      </div>
    );
  }

  const userPermissions = getUserPermissions();

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">User Profile</h2>
        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
        >
          {isLoading ? 'Logging out...' : 'Logout'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <p className="mt-1 text-sm text-gray-900">
            {user.firstName} {user.lastName}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <p className="mt-1 text-sm text-gray-900">{user.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">User ID</label>
          <p className="mt-1 text-sm text-gray-900 font-mono">{user.id}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Multi-Factor Authentication
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              mfaEnabled 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {mfaEnabled ? 'Enabled' : 'Disabled'}
            </span>
            
            {mfaEnabled ? (
              <button
                onClick={handleDisableMFA}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Disable MFA
              </button>
            ) : (
              <button
                onClick={handleSetupMFA}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Setup MFA
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Permissions ({userPermissions.length})
          </label>
          <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
            {userPermissions.length > 0 ? (
              <ul className="space-y-1">
                {userPermissions.map((permission, index) => (
                  <li key={index} className="text-xs text-gray-600 font-mono">
                    {permission}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No permissions assigned</p>
            )}
          </div>
        </div>

        {/* Permission Examples */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Permission Examples
          </label>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Can read users:</span>
              <span className={hasPermission('users.read') ? 'text-green-600' : 'text-red-600'}>
                {hasPermission('users.read') ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Can create users:</span>
              <span className={hasPermission('users.create') ? 'text-green-600' : 'text-red-600'}>
                {hasPermission('users.create') ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Can manage tenants:</span>
              <span className={hasPermission('tenants.manage') ? 'text-green-600' : 'text-red-600'}>
                {hasPermission('tenants.manage') ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Admin access:</span>
              <span className={hasPermission('admin.*') ? 'text-green-600' : 'text-red-600'}>
                {hasPermission('admin.*') ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>

        {user.createdAt && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Member Since</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}