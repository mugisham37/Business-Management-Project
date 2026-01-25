/**
 * POS Hook - Core POS Operations
 * Requirements: 11.1, 11.2, 11.3
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useAuth } from './useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useUnifiedCache } from '@/lib/cache';
import {
  GET_POS_SESSION,
  GET_ACTIVE_POS_SESSIONS,
  GET_POS_CONFIGURATION,
  GET_DAILY_SALES_SUMMARY,
} from '@/graphql/queries/pos-queries';
import {
  OPEN_POS_SESSION,
  CLOSE_POS_SESSION,
} from '@/graphql/mutations/pos-mutations';
import {
  POS_SESSION_UPDATED,
  CASH_DRAWER_UPDATED,
} from '@/graphql/subscriptions/pos-subscriptions';
import type {
  POSSession,
  POSConfiguration,
  DailySalesSummary,
  POSSessionStatus,
} from '@/types/pos';

interface UsePOSOptions {
  locationId?: string;
  autoRefresh?: boolean;
  enableSubscriptions?: boolean;
}

interface UsePOSResult {
  // State
  currentSession: POSSession | null;
  activeSessions: POSSession[];
  configuration: POSConfiguration | null;
  dailySummary: DailySalesSummary | null;
  isLoading: boolean;
  error: Error | null;

  // Session Management
  openSession: (input: {
    locationId: string;
    openingCash: number;
    notes?: string;
  }) => Promise<POSSession>;
  closeSession: (sessionId: string, input: {
    closingCash: number;
    notes?: string;
  }) => Promise<POSSession>;
  
  // Data Fetching
  refreshSessions: () => Promise<void>;
  refreshConfiguration: () => Promise<void>;
  refreshDailySummary: (date?: Date) => Promise<void>;
  
  // Utilities
  canOpenSession: boolean;
  hasActiveSession: boolean;
  sessionStatus: POSSessionStatus | null;
}

export function usePOS(options: UsePOSOptions = {}): UsePOSResult {
  const { locationId, autoRefresh = true, enableSubscriptions = true } = options;
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();
  const cache = useUnifiedCache();
  
  const [currentSession, setCurrentSession] = useState<POSSession | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Queries
  const {
    data: activeSessionsData,
    loading: activeSessionsLoading,
    refetch: refetchActiveSessions,
  } = useQuery(GET_ACTIVE_POS_SESSIONS, {
    variables: { locationId: locationId || '' },
    skip: !locationId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onError: (error) => setError(error),
  });

  const {
    data: configurationData,
    loading: configurationLoading,
    refetch: refetchConfiguration,
  } = useQuery(GET_POS_CONFIGURATION, {
    variables: { locationId: locationId || '' },
    skip: !locationId,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all',
    onError: (error) => setError(error),
  });

  const {
    data: dailySummaryData,
    loading: dailySummaryLoading,
    refetch: refetchDailySummary,
  } = useQuery(GET_DAILY_SALES_SUMMARY, {
    variables: { 
      locationId: locationId || '', 
      date: new Date().toISOString().split('T')[0] 
    },
    skip: !locationId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    onError: (error) => setError(error),
  });

  // Mutations
  const [openSessionMutation, { loading: openingSession }] = useMutation(OPEN_POS_SESSION, {
    onCompleted: (data) => {
      if (data.openPOSSession.success) {
        setCurrentSession(data.openPOSSession.session);
        cache.invalidateFromMutation('openPOSSession', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  const [closeSessionMutation, { loading: closingSession }] = useMutation(CLOSE_POS_SESSION, {
    onCompleted: (data) => {
      if (data.closePOSSession.success) {
        setCurrentSession(null);
        cache.invalidateFromMutation('closePOSSession', {}, currentTenant?.id);
      }
    },
    onError: (error) => setError(error),
  });

  // Subscriptions
  useSubscription(POS_SESSION_UPDATED, {
    variables: { locationId: locationId || '' },
    skip: !enableSubscriptions || !locationId,
    onData: ({ data }) => {
      if (data.data?.posSessionUpdated) {
        const updatedSession = data.data.posSessionUpdated;
        if (currentSession?.id === updatedSession.id) {
          setCurrentSession(prev => prev ? { ...prev, ...updatedSession } : null);
        }
        // Refresh active sessions to get updated data
        refetchActiveSessions();
      }
    },
  });

  useSubscription(CASH_DRAWER_UPDATED, {
    variables: { locationId: locationId || '' },
    skip: !enableSubscriptions || !locationId,
    onData: ({ data }) => {
      if (data.data?.cashDrawerUpdated) {
        // Refresh configuration to get updated cash drawer status
        refetchConfiguration();
      }
    },
  });

  // Effects
  useEffect(() => {
    if (activeSessionsData?.activePOSSessions) {
      const sessions = activeSessionsData.activePOSSessions;
      const userSession = sessions.find((session: POSSession) => session.employeeId === user?.id);
      setCurrentSession(userSession || null);
    }
  }, [activeSessionsData, user?.id]);

  useEffect(() => {
    if (autoRefresh && locationId) {
      const interval = setInterval(() => {
        refetchActiveSessions();
        refetchDailySummary();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
    // No cleanup needed if autoRefresh is disabled
    return undefined;
  }, [autoRefresh, locationId, refetchActiveSessions, refetchDailySummary]);

  // Handlers
  const openSession = useCallback(async (input: {
    locationId: string;
    openingCash: number;
    notes?: string;
  }) => {
    try {
      setError(null);
      const result = await openSessionMutation({
        variables: { input },
      });

      if (result.data?.openPOSSession.success) {
        return result.data.openPOSSession.session;
      } else {
        throw new Error(result.data?.openPOSSession.message || 'Failed to open session');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [openSessionMutation]);

  const closeSession = useCallback(async (sessionId: string, input: {
    closingCash: number;
    notes?: string;
  }) => {
    try {
      setError(null);
      const result = await closeSessionMutation({
        variables: { id: sessionId, input },
      });

      if (result.data?.closePOSSession.success) {
        return result.data.closePOSSession.session;
      } else {
        throw new Error(result.data?.closePOSSession.message || 'Failed to close session');
      }
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [closeSessionMutation]);

  const refreshSessions = useCallback(async () => {
    try {
      setError(null);
      await refetchActiveSessions();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchActiveSessions]);

  const refreshConfiguration = useCallback(async () => {
    try {
      setError(null);
      await refetchConfiguration();
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchConfiguration]);

  const refreshDailySummary = useCallback(async (date?: Date) => {
    try {
      setError(null);
      await refetchDailySummary({
        locationId: locationId || '',
        date: (date || new Date()).toISOString().split('T')[0],
      });
    } catch (error) {
      setError(error as Error);
    }
  }, [refetchDailySummary, locationId]);

  // Computed values
  const activeSessions = activeSessionsData?.activePOSSessions || [];
  const configuration = configurationData?.posConfiguration || null;
  const dailySummary = dailySummaryData?.dailySalesSummary || null;
  const isLoading = activeSessionsLoading || configurationLoading || dailySummaryLoading || openingSession || closingSession;
  const canOpenSession = !currentSession && !!locationId && !!user;
  const hasActiveSession = !!currentSession;
  const sessionStatus = currentSession?.status || null;

  return {
    // State
    currentSession,
    activeSessions,
    configuration,
    dailySummary,
    isLoading,
    error,

    // Session Management
    openSession,
    closeSession,
    
    // Data Fetching
    refreshSessions,
    refreshConfiguration,
    refreshDailySummary,
    
    // Utilities
    canOpenSession,
    hasActiveSession,
    sessionStatus,
  };
}

// Specialized hooks for specific POS operations
export function usePOSSession(sessionId?: string) {
  const { data, loading, error, refetch } = useQuery(GET_POS_SESSION, {
    variables: { id: sessionId || '' },
    skip: !sessionId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    session: data?.posSession || null,
    loading,
    error,
    refetch,
  };
}

export function usePOSConfiguration(locationId?: string) {
  const { data, loading, error, refetch } = useQuery(GET_POS_CONFIGURATION, {
    variables: { locationId: locationId || '' },
    skip: !locationId,
    fetchPolicy: 'cache-first',
  });

  return {
    configuration: data?.posConfiguration || null,
    loading,
    error,
    refetch,
  };
}

export function useDailySalesSummary(locationId?: string, date?: Date) {
  const { data, loading, error, refetch } = useQuery(GET_DAILY_SALES_SUMMARY, {
    variables: { 
      locationId: locationId || '', 
      date: (date || new Date()).toISOString().split('T')[0] 
    },
    skip: !locationId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    summary: data?.dailySalesSummary || null,
    loading,
    error,
    refetch,
  };
}