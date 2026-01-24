/**
 * Location Audit Management Hooks
 * Complete hook implementation for audit trails and compliance tracking
 */

import { useCallback } from 'react';
import { 
  useQuery,
  QueryHookOptions
} from '@apollo/client';
import { 
  GET_LOCATION_AUDIT_HISTORY,
  GET_LOCATION_AUDIT_SUMMARY,
  GET_TENANT_AUDIT_HISTORY,
  GET_COMPLIANCE_REPORT
} from '@/graphql/queries/location-queries';
import { useTenantStore } from '@/lib/stores/tenant-store';

// Types
export interface AuditEntry {
  id: string;
  locationId: string;
  locationName?: string;
  userId: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  description: string;
}

export interface AuditSummary {
  locationId: string;
  locationName?: string;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  totalChanges: number;
  changesByAction: Record<string, number>;
  changesByUser: Array<{
    userId: string;
    userName?: string;
    count: number;
    percentage: number;
  }>;
  changesByDay: Array<{
    date: string;
    count: number;
  }>;
  changesByCategory: Record<string, number>;
  criticalChanges: number;
  complianceScore: number;
  trends: {
    dailyAverage: number;
    weeklyTrend: 'increasing' | 'decreasing' | 'stable';
    mostActiveDay: string;
    mostActiveHour: number;
  };
}

export interface ComplianceReport {
  period: {
    startDate: string;
    endDate: string;
  };
  totalChanges: number;
  changesByAction: Record<string, number>;
  changesByUser: Array<{
    userId: string;
    userName?: string;
    count: number;
  }>;
  changesByLocation: Array<{
    locationId: string;
    locationName?: string;
    count: number;
  }>;
  criticalChanges: AuditEntry[];
  complianceScore: number;
  recommendations: string[];
  violations: Array<{
    type: string;
    description: string;
    severity: string;
    count: number;
    examples: AuditEntry[];
  }>;
}

export interface AuditQuery {
  locationId?: string;
  userId?: string;
  actions?: string[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

// Hook for location audit history
export function useLocationAuditHistory(
  locationId: string,
  query?: Omit<AuditQuery, 'locationId'>,
  options?: QueryHookOptions
) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_LOCATION_AUDIT_HISTORY, {
    variables: { 
      locationId,
      userId: query?.userId,
      actions: query?.actions,
      startDate: query?.startDate?.toISOString(),
      endDate: query?.endDate?.toISOString(),
      page: query?.page || 1,
      limit: query?.limit || 50,
    },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const auditHistory = data?.getLocationAuditHistory;

  return {
    entries: auditHistory?.entries || [],
    total: auditHistory?.total || 0,
    page: auditHistory?.page || 1,
    limit: auditHistory?.limit || 50,
    hasMore: auditHistory?.hasMore || false,
    loading,
    error,
    refetch,
  };
}

// Hook for location audit summary
export function useLocationAuditSummary(
  locationId: string,
  days: number = 30,
  options?: QueryHookOptions
) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery(GET_LOCATION_AUDIT_SUMMARY, {
    variables: { locationId, days },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const summary = data?.getLocationAuditSummary;

  return {
    summary,
    loading,
    error,
    refetch,
  };
}

// Hook for tenant audit history
export function useTenantAuditHistory(
  query?: AuditQuery,
  options?: QueryHookOptions
) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery(GET_TENANT_AUDIT_HISTORY, {
    variables: { 
      locationId: query?.locationId,
      userId: query?.userId,
      actions: query?.actions,
      startDate: query?.startDate?.toISOString(),
      endDate: query?.endDate?.toISOString(),
      page: query?.page || 1,
      limit: query?.limit || 50,
    },
    skip: !currentTenant?.id,
    errorPolicy: 'all',
    ...options,
  });

  const auditHistory = data?.getTenantAuditHistory;

  return {
    entries: auditHistory?.entries || [],
    total: auditHistory?.total || 0,
    page: auditHistory?.page || 1,
    limit: auditHistory?.limit || 50,
    hasMore: auditHistory?.hasMore || false,
    loading,
    error,
    refetch,
  };
}

// Hook for compliance report
export function useComplianceReport(
  startDate: Date,
  endDate: Date,
  options?: QueryHookOptions
) {
  const currentTenant = useTenantStore(state => state.currentTenant);

  const { data, loading, error, refetch } = useQuery(GET_COMPLIANCE_REPORT, {
    variables: { 
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    skip: !currentTenant?.id || !startDate || !endDate,
    errorPolicy: 'all',
    ...options,
  });

  const report = data?.getComplianceReport;

  return {
    report,
    loading,
    error,
    refetch,
  };
}

// Hook for audit analysis
export function useAuditAnalysis() {
  const analyzeChangePattern = useCallback((entries: AuditEntry[]): {
    pattern: 'normal' | 'suspicious' | 'bulk_operation';
    confidence: number;
    reasoning: string[];
  } => {
    if (entries.length === 0) {
      return { pattern: 'normal', confidence: 1, reasoning: ['No entries to analyze'] };
    }

    const reasoning: string[] = [];
    let suspiciousScore = 0;

    // Check for bulk operations (many changes in short time)
    const timeWindows = new Map<string, number>();
    entries.forEach(entry => {
      const timeWindow = new Date(entry.timestamp).toISOString().slice(0, 16); // minute precision
      timeWindows.set(timeWindow, (timeWindows.get(timeWindow) || 0) + 1);
    });

    const maxChangesPerMinute = Math.max(...timeWindows.values());
    if (maxChangesPerMinute > 10) {
      suspiciousScore += 0.3;
      reasoning.push(`High frequency: ${maxChangesPerMinute} changes in one minute`);
    }

    // Check for unusual hours
    const hourCounts = new Map<number, number>();
    entries.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    const offHoursChanges = Array.from(hourCounts.entries())
      .filter(([hour]) => hour < 6 || hour > 22)
      .reduce((sum, [, count]) => sum + count, 0);

    if (offHoursChanges > entries.length * 0.3) {
      suspiciousScore += 0.2;
      reasoning.push(`${offHoursChanges} changes during off-hours`);
    }

    // Check for critical changes
    const criticalChanges = entries.filter(entry => entry.severity === 'CRITICAL').length;
    if (criticalChanges > 0) {
      suspiciousScore += 0.3;
      reasoning.push(`${criticalChanges} critical changes detected`);
    }

    // Check for single user making many changes
    const userCounts = new Map<string, number>();
    entries.forEach(entry => {
      userCounts.set(entry.userId, (userCounts.get(entry.userId) || 0) + 1);
    });

    const maxUserChanges = Math.max(...userCounts.values());
    if (maxUserChanges > entries.length * 0.8) {
      suspiciousScore += 0.2;
      reasoning.push(`Single user made ${maxUserChanges} of ${entries.length} changes`);
    }

    // Determine pattern
    let pattern: 'normal' | 'suspicious' | 'bulk_operation' = 'normal';
    if (maxChangesPerMinute > 20) {
      pattern = 'bulk_operation';
    } else if (suspiciousScore > 0.5) {
      pattern = 'suspicious';
    }

    return {
      pattern,
      confidence: Math.min(1, suspiciousScore + 0.5),
      reasoning,
    };
  }, []);

  const calculateComplianceScore = useCallback((summary: AuditSummary): number => {
    let score = 100;

    // Deduct points for critical changes
    if (summary.criticalChanges > 0) {
      score -= Math.min(30, summary.criticalChanges * 5);
    }

    // Deduct points for excessive changes
    const changesPerDay = summary.totalChanges / summary.period.days;
    if (changesPerDay > 50) {
      score -= Math.min(20, (changesPerDay - 50) * 0.5);
    }

    // Deduct points for off-hours activity
    const offHoursChanges = summary.changesByDay
      .reduce((sum, day) => sum + day.count, 0) * 0.1; // Estimate off-hours as 10%
    
    if (offHoursChanges > summary.totalChanges * 0.2) {
      score -= 15;
    }

    // Deduct points for user concentration
    const topUser = summary.changesByUser[0];
    if (topUser && topUser.percentage > 80) {
      score -= 10;
    }

    return Math.max(0, Math.round(score));
  }, []);

  const identifyAnomalies = useCallback((entries: AuditEntry[]): Array<{
    type: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    entries: AuditEntry[];
  }> => {
    const anomalies: Array<{
      type: string;
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      entries: AuditEntry[];
    }> = [];

    // Group by user and time
    const userTimeGroups = new Map<string, Map<string, AuditEntry[]>>();
    entries.forEach(entry => {
      const timeKey = new Date(entry.timestamp).toISOString().slice(0, 13); // hour precision
      if (!userTimeGroups.has(entry.userId)) {
        userTimeGroups.set(entry.userId, new Map());
      }
      const userMap = userTimeGroups.get(entry.userId)!;
      if (!userMap.has(timeKey)) {
        userMap.set(timeKey, []);
      }
      userMap.get(timeKey)!.push(entry);
    });

    // Check for rapid successive changes
    userTimeGroups.forEach((timeGroups, userId) => {
      timeGroups.forEach((hourEntries) => {
        if (hourEntries.length > 20) {
          anomalies.push({
            type: 'RAPID_CHANGES',
            description: `User ${userId} made ${hourEntries.length} changes in one hour`,
            severity: 'HIGH',
            entries: hourEntries,
          });
        }
      });
    });

    // Check for critical changes
    const criticalEntries = entries.filter(entry => entry.severity === 'CRITICAL');
    if (criticalEntries.length > 0) {
      anomalies.push({
        type: 'CRITICAL_CHANGES',
        description: `${criticalEntries.length} critical changes detected`,
        severity: 'HIGH',
        entries: criticalEntries,
      });
    }

    // Check for off-hours activity
    const offHoursEntries = entries.filter(entry => {
      const hour = new Date(entry.timestamp).getHours();
      return hour < 6 || hour > 22;
    });

    if (offHoursEntries.length > entries.length * 0.3) {
      anomalies.push({
        type: 'OFF_HOURS_ACTIVITY',
        description: `${offHoursEntries.length} changes made during off-hours`,
        severity: 'MEDIUM',
        entries: offHoursEntries,
      });
    }

    return anomalies;
  }, []);

  return {
    analyzeChangePattern,
    calculateComplianceScore,
    identifyAnomalies,
  };
}

// Hook for audit filtering and search
export function useAuditFiltering() {
  const getAvailableActions = useCallback((): string[] => {
    return [
      'CREATE',
      'UPDATE',
      'DELETE',
      'ACTIVATE',
      'DEACTIVATE',
      'CLOSE',
      'REOPEN',
      'TRANSFER',
      'MERGE',
      'SPLIT',
      'BULK_UPDATE',
      'BULK_DELETE',
      'IMPORT',
      'EXPORT',
      'SYNC',
      'RESTORE',
    ];
  }, []);

  const getAvailableCategories = useCallback((): string[] => {
    return [
      'LOCATION_MANAGEMENT',
      'PRICING',
      'PROMOTIONS',
      'INVENTORY_POLICY',
      'USER_MANAGEMENT',
      'CONFIGURATION',
      'SECURITY',
      'INTEGRATION',
      'REPORTING',
      'SYSTEM',
    ];
  }, []);

  const getSeverityLevels = useCallback((): Array<{ value: string; label: string; color: string }> => {
    return [
      { value: 'LOW', label: 'Low', color: 'green' },
      { value: 'MEDIUM', label: 'Medium', color: 'yellow' },
      { value: 'HIGH', label: 'High', color: 'orange' },
      { value: 'CRITICAL', label: 'Critical', color: 'red' },
    ];
  }, []);

  const filterEntries = useCallback((
    entries: AuditEntry[],
    filters: {
      actions?: string[];
      categories?: string[];
      severities?: string[];
      users?: string[];
      dateRange?: { start: Date; end: Date };
      searchTerm?: string;
    }
  ): AuditEntry[] => {
    return entries.filter(entry => {
      // Filter by actions
      if (filters.actions?.length && !filters.actions.includes(entry.action)) {
        return false;
      }

      // Filter by categories
      if (filters.categories?.length && !filters.categories.includes(entry.category)) {
        return false;
      }

      // Filter by severities
      if (filters.severities?.length && !filters.severities.includes(entry.severity)) {
        return false;
      }

      // Filter by users
      if (filters.users?.length && !filters.users.includes(entry.userId)) {
        return false;
      }

      // Filter by date range
      if (filters.dateRange) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate < filters.dateRange.start || entryDate > filters.dateRange.end) {
          return false;
        }
      }

      // Filter by search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const searchableText = [
          entry.description,
          entry.userName,
          entry.locationName,
          entry.entityId,
          JSON.stringify(entry.changes),
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, []);

  return {
    getAvailableActions,
    getAvailableCategories,
    getSeverityLevels,
    filterEntries,
  };
}

// Hook for audit export
export function useAuditExport() {
  const exportToCSV = useCallback((entries: AuditEntry[], filename: string = 'audit-log'): void => {
    const headers = [
      'Timestamp',
      'Location',
      'User',
      'Action',
      'Entity Type',
      'Entity ID',
      'Description',
      'Severity',
      'Category',
      'Changes',
    ];

    const rows = entries.map(entry => [
      new Date(entry.timestamp).toLocaleString(),
      entry.locationName || entry.locationId,
      entry.userName || entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.description,
      entry.severity,
      entry.category,
      entry.changes.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => 
          typeof cell === 'string' && cell.includes(',') 
            ? `"${cell.replace(/"/g, '""')}"` 
            : cell
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const exportToJSON = useCallback((entries: AuditEntry[], filename: string = 'audit-log'): void => {
    const jsonContent = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  return {
    exportToCSV,
    exportToJSON,
  };
}

// Main location audit management hook
export function useLocationAuditManagement() {
  const auditAnalysis = useAuditAnalysis();
  const auditFiltering = useAuditFiltering();
  const auditExport = useAuditExport();

  return {
    ...auditAnalysis,
    ...auditFiltering,
    ...auditExport,
  };
}