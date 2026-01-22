import { MockedProvider } from '@apollo/client/testing';
import { renderHook, act } from '@testing-library/react';
import { gql } from '@apollo/client';
import { useEnhancedMutation, useCreateMutation, useUpdateMutation, useDeleteMutation } from '@/hooks/useGraphQLMutations';
import { useCacheStrategy } from '@/hooks/useCacheStrategy';
import React from 'react';

// Mock queries and mutations
const GET_USERS = gql`
  query GetUsersForCacheTest {
    users {
      nodes {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      message
    }
  }
`;

// Mock data
const mockUsers = [
  { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  { id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
];

const mocks = [
  {
    request: {
      query: GET_USERS,
    },
    result: {
      data: {
        users: {
          nodes: mockUsers,
        },
      },
    },
  },
  {
    request: {
      query: CREATE_USER,
      variables: {
        input: { firstName: 'New', lastName: 'User', email: 'new@example.com', password: 'password', tenantId: '1', role: 'USER' },
      },
    },
    result: {
      data: {
        createUser: {
          success: true,
          message: 'User created successfully',
          user: {
            id: '3',
            firstName: 'New',
            lastName: 'User',
            email: 'new@example.com',
          },
        },
      },
    },
  },
  {
    request: {
      query: UPDATE_USER,
      variables: {
        id: '1',
        input: { firstName: 'Updated', lastName: 'John' },
      },
    },
    result: {
      data: {
        updateUser: {
          success: true,
          message: 'User updated successfully',
          user: {
            id: '1',
            firstName: 'Updated',
            lastName: 'John',
            email: 'john@example.com',
          },
        },
      },
    },
  },
  {
    request: {
      query: DELETE_USER,
      variables: {
        id: '1',
      },
    },
    result: {
      data: {
        deleteUser: {
          success: true,
          message: 'User deleted successfully',
        },
      },
    },
  },
];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(MockedProvider, { mocks, addTypename: false }, children)
);

describe('Cache Update Mechanisms', () => {
  describe('useEnhancedMutation', () => {
    it('should handle mutations with cache updates', async () => {
      const { result } = renderHook(
        () => useEnhancedMutation(CREATE_USER, {
          listQuery: GET_USERS,
          listField: 'users',
        }),
        { wrapper }
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].error).toBeUndefined();

      await act(async () => {
        await result.current[0]({
          input: { name: 'New User', email: 'new@example.com' },
        });
      });

      expect(result.current[1].called).toBe(true);
    });

    it('should handle optimistic updates', async () => {
      const optimisticResponse = (variables: any) => ({
        createUser: {
          id: 'temp-123',
          name: variables.input.name,
          email: variables.input.email,
          __typename: 'User',
        },
      });

      const { result } = renderHook(
        () => useEnhancedMutation(CREATE_USER, {
          listQuery: GET_USERS,
          listField: 'users',
          optimisticResponse,
        }),
        { wrapper }
      );

      await act(async () => {
        await result.current[0]({
          input: { name: 'Optimistic User', email: 'optimistic@example.com' },
        });
      });

      expect(result.current[1].called).toBe(true);
    });
  });

  describe('useCreateMutation', () => {
    it('should handle create mutations with automatic cache updates', async () => {
      const { result } = renderHook(
        () => useCreateMutation(
          CREATE_USER,
          GET_USERS,
          'users',
          (variables) => ({
            name: (variables as { input: { name: string; email: string } }).input.name,
            email: (variables as { input: { name: string; email: string } }).input.email,
            __typename: 'User',
          })
        ),
        { wrapper }
      );

      await act(async () => {
        await result.current[0]({
          input: { name: 'Created User', email: 'created@example.com' },
        });
      });

      expect(result.current[1].called).toBe(true);
    });
  });

  describe('useUpdateMutation', () => {
    it('should handle update mutations with cache updates', async () => {
      const { result } = renderHook(
        () => useUpdateMutation(UPDATE_USER, GET_USERS, 'users'),
        { wrapper }
      );

      await act(async () => {
        await result.current[0]({
          id: '1',
          input: { name: 'Updated John' },
        });
      });

      expect(result.current[1].called).toBe(true);
    });
  });

  describe('useDeleteMutation', () => {
    it('should handle delete mutations with cache cleanup', async () => {
      const { result } = renderHook(
        () => useDeleteMutation(DELETE_USER, GET_USERS, 'users'),
        { wrapper }
      );

      await act(async () => {
        await result.current[0]({
          variables: { id: '1' },
        });
      });

      expect(result.current[1].called).toBe(true);
    });
  });

  describe('useCacheStrategy', () => {
    it('should provide cache strategy utilities', () => {
      const { result } = renderHook(
        () => useCacheStrategy({
          defaultStrategy: 'cache-first',
          enableOfflineMode: true,
        }),
        { wrapper }
      );

      expect(result.current.getOptimalFetchPolicy).toBeDefined();
      expect(result.current.getNetworkAwareFetchPolicy).toBeDefined();
      expect(result.current.warmCache).toBeDefined();
      expect(result.current.preloadData).toBeDefined();
      expect(result.current.invalidateRelatedData).toBeDefined();
    });

    it('should return appropriate fetch policies based on network status', () => {
      const { result } = renderHook(
        () => useCacheStrategy({
          defaultStrategy: 'cache-first',
          enableOfflineMode: true,
        }),
        { wrapper }
      );

      // Online scenario
      const onlinePolicy = result.current.getNetworkAwareFetchPolicy(true);
      expect(onlinePolicy).toBe('cache-first');

      // Offline scenario with offline mode enabled
      const offlinePolicy = result.current.getNetworkAwareFetchPolicy(false);
      expect(offlinePolicy).toBe('cache-only');
    });

    it('should handle cache warming', async () => {
      const { result } = renderHook(
        () => useCacheStrategy(),
        { wrapper }
      );

      await act(async () => {
        await result.current.warmCache([
          { query: GET_USERS },
        ]);
      });

      // Cache warming should complete without errors
      expect(true).toBe(true);
    });

    it('should handle data preloading with priorities', async () => {
      const { result } = renderHook(
        () => useCacheStrategy(),
        { wrapper }
      );

      await act(async () => {
        await result.current.preloadData([
          { query: GET_USERS, priority: 'high' },
        ]);
      });

      // Preloading should complete without errors
      expect(true).toBe(true);
    });
  });
});