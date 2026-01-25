/**
 * Location Sync Management Hooks
 * Complete hook implementation for real-time synchronization and conflict resolution
 */

import { useCallback } from 'react';
import { 
  useQuery,
  useMutation,
  useSubscription,
  QueryHookOptions,
  MutationHookOptions,
  FetchResult
} from '@apollo/client';
import { 
  GET_SYNC_STATUS,
  GET_SYNC_HISTORY
} from '@/graphql/queries/location-queries';
import {
  TRIGGER_SYNC,
  RESOLVE_SYNC_CONFLICT
} from '@/graphql/mutations/location-mutations';
import {
  SYNC_STATUS_CHANGED
} from '@/graphql/subscriptions/location-subscriptions';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface SyncStatus {
  locationId: string;
  locationName?: string;
  lastSyncTime?: string;
  nextSyncTime?: string;
  syncType: 'FULL' | 'INCREMENTAL' | 'MANUAL';
  status: 'IDLE' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'CONFLICT';
  progress?: number;
  totalItems?: number;
  processedItems?: number;
  failedItems?: number;
  conflicts?: SyncConflict[];
  errors?: SyncError[];
  metadata?: {
    triggeredBy?: string;
    reason?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
  };
}

export interface SyncHistory {
  id: string;
  locationId: string;
  syncType: 'FULL' | 'INCREMENTAL' | 'MANUAL';
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startTime: string;
  endTime: string;
  duration: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  conflictsResolved: number;
  triggeredBy: string;
  reason?: string;
  summary: {
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    errors: number;
  };
  errors?: SyncError[];
}

export interface SyncConflict {
  id: string;
  locationId: string;
  entityType: string;
  entityId: string;
  conflictType: 'UPDATE_CONFLICT' | 'DELETE_CONFLICT' | 'CREATE_CONFLICT';
  localVersion: Record<string, unknown>;
  remoteVersion: Record<string, unknown>;
  conflictFields: string[];
  timestamp: string;
  status: 'PENDING' | 'RESOLVED' | 'IGNORED';
  resolution?: {
    strategy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGE' | 'MANUAL';
    resolvedBy?: string;
    resolvedAt?: string;
    mergedData?: Record<string, unknown>;
  };
}

export interface SyncError {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  error: string;
  details?: Record<string, unknown>;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  retryable: boolean;
  retryCount?: number;
}

export interface ConflictResolution {
  strategy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGE' | 'MANUAL';
  mergedData?: Record<string, unknown>;
  reason?: string;
}

export interface SyncResult {
  id?: string;
  status?: 'IDLE' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'CONFLICT';
  progress?: number;
  totalItems?: number;
  processedItems?: number;
  failedItems?: number;
  conflicts?: SyncConflict[];
  errors?: SyncError[];
}

// Hook for sync status
export function useLocationSyncStatus(locationId: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_SYNC_STATUS, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    pollInterval: 5000, // Poll every 5 seconds for real-time updates
    ...options,
  });

  const syncStatus: SyncStatus | undefined = data?.getSyncStatus;

  return {
    syncStatus,
    loading,
    error,
    refetch,
  };
}

// Hook for sync history
export function useLocationSyncHistory(
  locationId: string,
  limit: number = 50,
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_SYNC_HISTORY, {
    variables: { locationId, limit },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const syncHistory = data?.getSyncHistory || [];

  return {
    syncHistory,
    loading,
    error,
    refetch,
  };
}

// Hook for sync mutations
export function useLocationSyncMutations() {
  const { user } = useAuth();
  const { tenant: currentTenant } = useTenant();

  const [triggerSyncMutation] = useMutation(TRIGGER_SYNC);
  const [resolveSyncConflictMutation] = useMutation(RESOLVE_SYNC_CONFLICT);

  const triggerSync = useCallback(async (
    locationId: string,
    syncType: 'FULL' | 'INCREMENTAL' | 'MANUAL' = 'FULL',
    options?: MutationHookOptions
  ): Promise<FetchResult<SyncResult>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return triggerSyncMutation({
      variables: { locationId, syncType },
      refetchQueries: ['GetSyncStatus', 'GetSyncHistory'],
      ...options,
    });
  }, [triggerSyncMutation, currentTenant?.id, user?.id]);

  const resolveSyncConflict = useCallback(async (
    conflictId: string,
    resolution: ConflictResolution,
    options?: MutationHookOptions
  ): Promise<FetchResult<SyncConflict>> => {
    if (!currentTenant?.id || !user?.id) {
      throw new Error('User must be authenticated and have a current tenant');
    }

    return resolveSyncConflictMutation({
      variables: { conflictId, resolution },
      refetchQueries: ['GetSyncStatus'],
      ...options,
    });
  }, [resolveSyncConflictMutation, currentTenant?.id, user?.id]);

  return {
    triggerSync,
    resolveSyncConflict,
  };
}

// Hook for sync subscriptions
export function useLocationSyncSubscriptions(options?: { enabled?: boolean }) {
  const { tenant: currentTenant } = useTenant();
  const { enabled = true } = options || {};

  const { data: syncStatusData } = useSubscription(SYNC_STATUS_CHANGED, {
    skip: !currentTenant?.id || !enabled,
  });

  return {
    syncStatusData: syncStatusData?.syncStatusChanged,
  };
}

// Hook for conflict resolution
export function useConflictResolution() {
  const analyzeConflict = useCallback((conflict: SyncConflict): {
    recommendation: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGE' | 'MANUAL';
    confidence: number;
    reasoning: string[];
  } => {
    const reasoning: string[] = [];
    let recommendation: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGE' | 'MANUAL' = 'MANUAL';
    let confidence = 0;

    // Analyze timestamps
    const localTimestamp = conflict.localVersion?.updatedAt || conflict.localVersion?.createdAt;
    const remoteTimestamp = conflict.remoteVersion?.updatedAt || conflict.remoteVersion?.createdAt;

    if (localTimestamp && remoteTimestamp) {
      const localDate = new Date(localTimestamp as string | number);
      const remoteDate = new Date(remoteTimestamp as string | number);
      
      if (localDate > remoteDate) {
        recommendation = 'LOCAL_WINS';
        confidence += 0.3;
        reasoning.push('Local version is more recent');
      } else if (remoteDate > localDate) {
        recommendation = 'REMOTE_WINS';
        confidence += 0.3;
        reasoning.push('Remote version is more recent');
      }
    }

    // Analyze conflict fields
    const criticalFields = ['status', 'isActive', 'parentLocationId'];
    const hasCriticalConflicts = conflict.conflictFields.some(field => 
      criticalFields.includes(field)
    );

    if (hasCriticalConflicts) {
      recommendation = 'MANUAL';
      confidence = Math.max(0.8, confidence);
      reasoning.push('Critical fields in conflict require manual review');
    }

    // Analyze data completeness
    const localFieldCount = Object.keys(conflict.localVersion || {}).length;
    const remoteFieldCount = Object.keys(conflict.remoteVersion || {}).length;

    if (localFieldCount > remoteFieldCount * 1.2) {
      if (recommendation !== 'MANUAL') recommendation = 'LOCAL_WINS';
      confidence += 0.2;
      reasoning.push('Local version has more complete data');
    } else if (remoteFieldCount > localFieldCount * 1.2) {
      if (recommendation !== 'MANUAL') recommendation = 'REMOTE_WINS';
      confidence += 0.2;
      reasoning.push('Remote version has more complete data');
    }

    // Check for mergeable conflicts
    const nonConflictingFields = Object.keys({
      ...conflict.localVersion,
      ...conflict.remoteVersion,
    }).filter(field => !conflict.conflictFields.includes(field));

    if (nonConflictingFields.length > conflict.conflictFields.length && recommendation !== 'MANUAL') {
      recommendation = 'MERGE';
      confidence += 0.3;
      reasoning.push('Most fields can be merged automatically');
    }

    return {
      recommendation,
      confidence: Math.min(1, confidence),
      reasoning,
    };
  }, []);

  const createMergedData = useCallback((conflict: SyncConflict): Record<string, unknown> => {
    const merged = { ...conflict.localVersion };

    // For each conflicting field, use a resolution strategy
    conflict.conflictFields.forEach(field => {
      const localValue = conflict.localVersion?.[field];
      const remoteValue = conflict.remoteVersion?.[field];

      // Use remote value for timestamps if it's newer
      if (field.includes('At') || field.includes('Time')) {
        const localDate = localValue ? new Date(localValue as string | number) : new Date(0);
        const remoteDate = remoteValue ? new Date(remoteValue as string | number) : new Date(0);
        merged[field] = remoteDate > localDate ? remoteValue : localValue;
      }
      // Use remote value for status changes
      else if (field === 'status' || field === 'isActive') {
        merged[field] = remoteValue;
      }
      // Use local value for user-modified fields
      else if (field === 'name' || field === 'description') {
        merged[field] = localValue;
      }
      // Default to remote value
      else {
        merged[field] = remoteValue;
      }
    });

    // Add non-conflicting fields from both versions
    Object.keys(conflict.remoteVersion || {}).forEach(field => {
      if (!conflict.conflictFields.includes(field) && !(field in merged)) {
        merged[field] = conflict.remoteVersion[field];
      }
    });

    return merged;
  }, []);

  const validateResolution = useCallback((
    conflict: SyncConflict,
    resolution: ConflictResolution
  ): string[] => {
    const errors: string[] = [];

    if (!resolution.strategy) {
      errors.push('Resolution strategy is required');
    }

    if (resolution.strategy === 'MERGE' && !resolution.mergedData) {
      errors.push('Merged data is required for merge strategy');
    }

    if (resolution.strategy === 'MANUAL' && !resolution.reason) {
      errors.push('Reason is required for manual resolution');
    }

    // Validate merged data if provided
    if (resolution.mergedData) {
      const requiredFields = ['id', 'name', 'code'];
      requiredFields.forEach(field => {
        if (!(resolution.mergedData as Record<string, unknown>)[field]) {
          errors.push(`Required field '${field}' is missing from merged data`);
        }
      });
    }

    return errors;
  }, []);

  return {
    analyzeConflict,
    createMergedData,
    validateResolution,
  };
}

// Hook for sync monitoring
export function useSyncMonitoring() {
  const calculateSyncHealth = useCallback((
    syncHistory: SyncHistory[]
  ): {
    healthScore: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    issues: string[];
    recommendations: string[];
  } => {
    if (syncHistory.length === 0) {
      return {
        healthScore: 0,
        status: 'CRITICAL',
        issues: ['No sync history available'],
        recommendations: ['Perform initial sync'],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    let healthScore = 100;

    // Check recent sync failures
    const recentSyncs = syncHistory.slice(0, 10);
    const failedSyncs = recentSyncs.filter(sync => sync.status === 'FAILED');
    const failureRate = failedSyncs.length / recentSyncs.length;

    if (failureRate > 0.5) {
      healthScore -= 40;
      issues.push(`High failure rate: ${Math.round(failureRate * 100)}%`);
      recommendations.push('Investigate sync failures and resolve underlying issues');
    } else if (failureRate > 0.2) {
      healthScore -= 20;
      issues.push(`Moderate failure rate: ${Math.round(failureRate * 100)}%`);
      recommendations.push('Monitor sync failures and address recurring issues');
    }

    // Check sync frequency
    const lastSync = syncHistory[0];
    const timeSinceLastSync = lastSync ? (Date.now() - new Date(lastSync.endTime as string | number).getTime()) : 0;
    const hoursSinceLastSync = timeSinceLastSync / (1000 * 60 * 60);

    if (hoursSinceLastSync > 24) {
      healthScore -= 30;
      issues.push(`Last sync was ${Math.round(hoursSinceLastSync)} hours ago`);
      recommendations.push('Increase sync frequency or investigate sync scheduling');
    } else if (hoursSinceLastSync > 12) {
      healthScore -= 15;
      issues.push(`Last sync was ${Math.round(hoursSinceLastSync)} hours ago`);
      recommendations.push('Consider more frequent syncing for critical data');
    }

    // Check sync duration trends
    const avgDuration = recentSyncs.reduce((sum, sync) => sum + sync.duration, 0) / recentSyncs.length;
    const longSyncs = recentSyncs.filter(sync => sync.duration > avgDuration * 2);

    if (longSyncs.length > recentSyncs.length * 0.3) {
      healthScore -= 15;
      issues.push('Sync duration is increasing');
      recommendations.push('Optimize sync performance or consider incremental syncing');
    }

    // Check error patterns
    const totalErrors = recentSyncs.reduce((sum, sync) => sum + sync.failedItems, 0);
    if (totalErrors > 0) {
      healthScore -= Math.min(25, totalErrors * 2);
      issues.push(`${totalErrors} items failed to sync in recent operations`);
      recommendations.push('Review and resolve sync errors');
    }

    // Determine status
    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (healthScore < 50) {
      status = 'CRITICAL';
    } else if (healthScore < 80) {
      status = 'WARNING';
    }

    return {
      healthScore: Math.max(0, healthScore),
      status,
      issues,
      recommendations,
    };
  }, []);

  const getSyncMetrics = useCallback((syncHistory: SyncHistory[]): {
    totalSyncs: number;
    successRate: number;
    averageDuration: number;
    totalItemsSynced: number;
    totalErrors: number;
    lastSyncTime?: string;
  } => {
    if (syncHistory.length === 0) {
      return {
        totalSyncs: 0,
        successRate: 0,
        averageDuration: 0,
        totalItemsSynced: 0,
        totalErrors: 0,
      };
    }

    const successfulSyncs = syncHistory.filter(sync => sync.status === 'COMPLETED');
    const successRate = (successfulSyncs.length / syncHistory.length) * 100;
    const averageDuration = syncHistory.reduce((sum, sync) => sum + sync.duration, 0) / syncHistory.length;
    const totalItemsSynced = syncHistory.reduce((sum, sync) => sum + sync.processedItems, 0);
    const totalErrors = syncHistory.reduce((sum, sync) => sum + sync.failedItems, 0);
    const lastSyncTime = syncHistory[0]?.endTime ? (syncHistory[0].endTime as string) : undefined;

    return {
      totalSyncs: syncHistory.length,
      successRate,
      averageDuration,
      totalItemsSynced,
      totalErrors,
      ...(lastSyncTime && { lastSyncTime }),
    };
  }, []);

  return {
    calculateSyncHealth,
    getSyncMetrics,
  };
}

// Hook for sync scheduling
export function useSyncScheduling() {
  const getRecommendedSyncType = useCallback((
    lastSyncTime?: string,
    changesSinceLastSync?: number
  ): 'FULL' | 'INCREMENTAL' => {
    if (!lastSyncTime) return 'FULL';

    const hoursSinceLastSync = (Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60 * 60);
    
    // Full sync if it's been more than 24 hours
    if (hoursSinceLastSync > 24) return 'FULL';
    
    // Full sync if there are many changes
    if (changesSinceLastSync && changesSinceLastSync > 100) return 'FULL';
    
    return 'INCREMENTAL';
  }, []);

  const calculateNextSyncTime = useCallback((
    lastSyncTime: string,
    syncFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY' = 'DAILY'
  ): Date => {
    const lastSync = new Date(lastSyncTime);
    const nextSync = new Date(lastSync);

    switch (syncFrequency) {
      case 'HOURLY':
        nextSync.setHours(nextSync.getHours() + 1);
        break;
      case 'DAILY':
        nextSync.setDate(nextSync.getDate() + 1);
        break;
      case 'WEEKLY':
        nextSync.setDate(nextSync.getDate() + 7);
        break;
    }

    return nextSync;
  }, []);

  return {
    getRecommendedSyncType,
    calculateNextSyncTime,
  };
}

// Main location sync management hook
export function useLocationSyncManagement() {
  const syncMutations = useLocationSyncMutations();
  const conflictResolution = useConflictResolution();
  const syncMonitoring = useSyncMonitoring();
  const syncScheduling = useSyncScheduling();
  const syncSubscriptions = useLocationSyncSubscriptions();

  return {
    ...syncMutations,
    ...conflictResolution,
    ...syncMonitoring,
    ...syncScheduling,
    ...syncSubscriptions,
  };
}