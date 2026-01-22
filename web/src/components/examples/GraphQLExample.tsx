'use client';

import React from 'react';
import { useQuery, gql } from '@apollo/client';
import { useAuth } from '@/hooks/useAuth';
import { ConditionalRender } from '@/components/auth';

// Example GraphQL query
const GET_EXAMPLE_DATA = gql`
  query GetExampleData {
    currentUser {
      id
      email
      firstName
      lastName
    }
  }
`;

/**
 * Example component demonstrating GraphQL client usage with authentication
 * Shows how Apollo Client integrates with the authentication system
 */
export function GraphQLExample() {
  const { isAuthenticated, user, getAccessToken } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_EXAMPLE_DATA, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
    skip: !isAuthenticated, // Skip query if not authenticated
  });

  const handleTestAuth = async () => {
    const token = await getAccessToken();
    console.log('Current access token:', token ? 'Present' : 'None');
  };

  if (!isAuthenticated) {
    return (
      <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
        <h3 className="text-yellow-800 font-medium">Authentication Required</h3>
        <p className="text-yellow-600 text-sm mt-1">
          Please log in to test GraphQL queries with authentication.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <h3 className="text-red-800 font-medium">GraphQL Error</h3>
        <p className="text-red-600 text-sm mt-1">
          {error.message || 'An error occurred while fetching data'}
        </p>
        <p className="text-gray-500 text-xs mt-2">
          This is expected since no backend is running. The Apollo Client is properly configured with authentication.
        </p>
        <div className="mt-3 space-x-2">
          <button
            onClick={() => refetch()}
            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
          <button
            onClick={handleTestAuth}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Auth Token
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 border border-green-200 rounded-lg bg-green-50">
        <h3 className="text-green-800 font-medium">GraphQL Success</h3>
        <p className="text-green-600 text-sm mt-1">
          Data loaded successfully with authentication!
        </p>
        {data && (
          <pre className="text-xs mt-2 text-gray-600 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>

      <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
        <h3 className="text-blue-800 font-medium">Authentication Status</h3>
        <div className="text-sm text-blue-700 mt-2 space-y-1">
          <p>User: {user?.email}</p>
          <p>Authenticated: ✓</p>
          <p>Permissions: {user?.permissions?.length || 0}</p>
        </div>
        
        <div className="mt-3 space-x-2">
          <button
            onClick={handleTestAuth}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Check Token
          </button>
          <button
            onClick={() => refetch()}
            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Refetch Data
          </button>
        </div>
      </div>

      {/* Permission-based content */}
      <ConditionalRender 
        permission="users.read"
        fallback={
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-gray-800 font-medium">Protected GraphQL Content</h3>
            <p className="text-gray-600 text-sm mt-1">
              You need 'users.read' permission to see additional GraphQL examples.
            </p>
          </div>
        }
      >
        <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
          <h3 className="text-purple-800 font-medium">Advanced GraphQL Features</h3>
          <p className="text-purple-600 text-sm mt-1">
            This content shows advanced GraphQL features available to users with proper permissions.
          </p>
          <ul className="text-xs text-purple-700 mt-2 space-y-1">
            <li>• Authenticated queries with automatic token refresh</li>
            <li>• Permission-based query filtering</li>
            <li>• Tenant-specific data isolation</li>
            <li>• Real-time subscriptions with auth</li>
          </ul>
        </div>
      </ConditionalRender>
    </div>
  );
}

export default GraphQLExample;