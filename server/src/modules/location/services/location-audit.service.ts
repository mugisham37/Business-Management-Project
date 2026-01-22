import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationRepository } from '../repositories/location.repository';
import { Location } from '../entities/location.entity';

export interface LocationAuditEntry {
  id: string;
  tenantId: string;
  locationId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'PERMISSION_CHANGE' | 'SETTINGS_CHANGE';
  userId: string;
  userName?: string;
  timestamp: Date;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    source: 'WEB' | 'API' | 'MOBILE' | 'SYSTEM';
    reason?: string;
  };
  snapshot?: Partial<Location>; // Full location state after change
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

export interface AuditSummary {
  totalEntries: number;
  actionCounts: Record<string, number>;
  topUsers: Array<{ userId: string; userName: string; count: number }>;
  recentActivity: LocationAuditEntry[];
  changeFrequency: Array<{ date: string; count: number }>;
}

@Injectable()
export class LocationAuditService {
  private readonly logger = new Logger(LocationAuditService.name);
  
  // In-memory storage for demo purposes
  // In production, this would be stored in a database
  private auditEntries: LocationAuditEntry[] = [];

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Listen for location events to create audit entries
    this.setupEventListeners();
  }

  /**
   * Create an audit entry for a location change
   */
  async createAuditEntry(
    tenantId: string,
    locationId: string,
    action: LocationAuditEntry['action'],
    userId: string,
    changes: LocationAuditEntry['changes'],
    metadata: LocationAuditEntry['metadata'],
    snapshot?: Partial<Location>,
  ): Promise<LocationAuditEntry> {
    try {
      const auditEntry: LocationAuditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        locationId,
        action,
        userId,
        timestamp: new Date(),
        changes,
        metadata,
        ...(snapshot && { snapshot }),
      };

      // Store audit entry
      this.auditEntries.push(auditEntry);

      // Emit audit event for further processing
      this.eventEmitter.emit('location.audit.created', auditEntry);

      this.logger.log(`Audit entry created: ${action} for location ${locationId} by user ${userId}`);
      return auditEntry;
    } catch (error: any) {
      this.logger.error(`Failed to create audit entry: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get audit history for a location
   */
  async getLocationAuditHistory(
    tenantId: string,
    locationId: string,
    query: Omit<AuditQuery, 'locationId'> = {},
  ): Promise<{
    entries: LocationAuditEntry[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    try {
      let filteredEntries = this.auditEntries.filter(entry => 
        entry.tenantId === tenantId && entry.locationId === locationId
      );

      // Apply filters
      if (query.userId) {
        filteredEntries = filteredEntries.filter(entry => entry.userId === query.userId);
      }

      if (query.actions && query.actions.length > 0) {
        filteredEntries = filteredEntries.filter(entry => query.actions!.includes(entry.action));
      }

      if (query.startDate) {
        filteredEntries = filteredEntries.filter(entry => entry.timestamp >= query.startDate!);
      }

      if (query.endDate) {
        filteredEntries = filteredEntries.filter(entry => entry.timestamp <= query.endDate!);
      }

      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Pagination
      const page = query.page || 1;
      const limit = query.limit || 50;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

      return {
        entries: paginatedEntries,
        total: filteredEntries.length,
        page,
        limit,
        hasMore: endIndex < filteredEntries.length,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get location audit history: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get audit summary for a location
   */
  async getLocationAuditSummary(
    tenantId: string,
    locationId: string,
    days: number = 30,
  ): Promise<AuditSummary> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const entries = this.auditEntries.filter(entry => 
        entry.tenantId === tenantId && 
        entry.locationId === locationId &&
        entry.timestamp >= startDate
      );

      // Count actions
      const actionCounts: Record<string, number> = {};
      entries.forEach(entry => {
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      });

      // Count by user
      const userCounts: Record<string, { count: number; userName?: string | undefined }> = {};
      entries.forEach(entry => {
        if (!userCounts[entry.userId]) {
          userCounts[entry.userId] = { count: 0, userName: entry.userName ?? undefined };
        }
        userCounts[entry.userId]!.count++;
      });

      const topUsers = Object.entries(userCounts)
        .map(([userId, data]) => ({ 
          userId, 
          userName: data.userName || 'Unknown User', 
          count: data.count 
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent activity (last 10 entries)
      const recentActivity = entries
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);

      // Change frequency by day
      const changeFrequency: Array<{ date: string; count: number }> = [];
      const dailyCounts: Record<string, number> = {};

      entries.forEach(entry => {
        const dateKey = entry.timestamp.toISOString().split('T')[0]!;
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      });

      // Fill in missing days with 0 counts
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0]!;
        changeFrequency.push({
          date: dateKey,
          count: dailyCounts[dateKey] || 0,
        });
      }

      changeFrequency.reverse(); // Oldest to newest

      return {
        totalEntries: entries.length,
        actionCounts,
        topUsers,
        recentActivity,
        changeFrequency,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get location audit summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get audit entries for multiple locations
   */
  async getTenantAuditHistory(
    tenantId: string,
    query: AuditQuery = {},
  ): Promise<{
    entries: LocationAuditEntry[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    try {
      let filteredEntries = this.auditEntries.filter(entry => entry.tenantId === tenantId);

      // Apply filters
      if (query.locationId) {
        filteredEntries = filteredEntries.filter(entry => entry.locationId === query.locationId);
      }

      if (query.userId) {
        filteredEntries = filteredEntries.filter(entry => entry.userId === query.userId);
      }

      if (query.actions && query.actions.length > 0) {
        filteredEntries = filteredEntries.filter(entry => query.actions!.includes(entry.action));
      }

      if (query.startDate) {
        filteredEntries = filteredEntries.filter(entry => entry.timestamp >= query.startDate!);
      }

      if (query.endDate) {
        filteredEntries = filteredEntries.filter(entry => entry.timestamp <= query.endDate!);
      }

      // Sort by timestamp (newest first)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Pagination
      const page = query.page || 1;
      const limit = query.limit || 50;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

      return {
        entries: paginatedEntries,
        total: filteredEntries.length,
        page,
        limit,
        hasMore: endIndex < filteredEntries.length,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get tenant audit history: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Compare two location states and generate change list
   */
  compareLocationStates(oldLocation: Partial<Location>, newLocation: Partial<Location>): LocationAuditEntry['changes'] {
    const changes: LocationAuditEntry['changes'] = [];
    
    // Define fields to track
    const fieldsToTrack = [
      'name', 'description', 'type', 'status', 'address', 'phone', 'email', 'website',
      'parentLocationId', 'timezone', 'currency', 'operatingHours', 'managerId',
      'latitude', 'longitude', 'squareFootage', 'settings', 'taxSettings',
      'inventorySettings', 'posSettings', 'featureFlags', 'capacity'
    ];

    fieldsToTrack.forEach(field => {
      const oldValue = (oldLocation as any)[field];
      const newValue = (newLocation as any)[field];

      // Deep comparison for objects
      if (typeof oldValue === 'object' && typeof newValue === 'object') {
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            field,
            oldValue,
            newValue,
          });
        }
      } else if (oldValue !== newValue) {
        changes.push({
          field,
          oldValue,
          newValue,
        });
      }
    });

    return changes;
  }

  /**
   * Get compliance report for audit trail
   */
  async getComplianceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    period: { startDate: Date; endDate: Date };
    totalChanges: number;
    changesByAction: Record<string, number>;
    changesByUser: Array<{ userId: string; userName?: string; count: number }>;
    changesByLocation: Array<{ locationId: string; locationName?: string; count: number }>;
    criticalChanges: LocationAuditEntry[];
    complianceScore: number;
    recommendations: string[];
  }> {
    try {
      const entries = this.auditEntries.filter(entry => 
        entry.tenantId === tenantId &&
        entry.timestamp >= startDate &&
        entry.timestamp <= endDate
      );

      // Changes by action
      const changesByAction: Record<string, number> = {};
      entries.forEach(entry => {
        changesByAction[entry.action] = (changesByAction[entry.action] || 0) + 1;
      });

      // Changes by user
      const userCounts: Record<string, { count: number; userName?: string | undefined }> = {};
      entries.forEach(entry => {
        if (!userCounts[entry.userId]) {
          userCounts[entry.userId] = { count: 0, userName: entry.userName ?? undefined };
        }
        userCounts[entry.userId]!.count++;
      });

      const changesByUser = Object.entries(userCounts)
        .map(([userId, data]) => ({ 
          userId, 
          userName: data.userName || 'Unknown User', 
          count: data.count 
        }))
        .sort((a, b) => b.count - a.count);

      // Changes by location
      const locationCounts: Record<string, number> = {};
      entries.forEach(entry => {
        locationCounts[entry.locationId] = (locationCounts[entry.locationId] || 0) + 1;
      });

      const changesByLocation = Object.entries(locationCounts)
        .map(([locationId, count]) => ({ locationId, count }))
        .sort((a, b) => b.count - a.count);

      // Critical changes (deletions, status changes, permission changes)
      const criticalChanges = entries.filter(entry => 
        ['DELETE', 'STATUS_CHANGE', 'PERMISSION_CHANGE'].includes(entry.action)
      );

      // Calculate compliance score (simplified)
      let complianceScore = 100;
      
      // Deduct points for missing metadata
      const entriesWithoutReason = entries.filter(entry => !entry.metadata.reason);
      complianceScore -= (entriesWithoutReason.length / entries.length) * 20;

      // Deduct points for bulk changes by single user
      const maxChangesPerUser = Math.max(...Object.values(userCounts).map(u => u.count));
      if (maxChangesPerUser > entries.length * 0.5) {
        complianceScore -= 15;
      }

      // Deduct points for critical changes without proper documentation
      const undocumentedCriticalChanges = criticalChanges.filter(entry => !entry.metadata.reason);
      complianceScore -= undocumentedCriticalChanges.length * 5;

      complianceScore = Math.max(0, complianceScore);

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (entriesWithoutReason.length > 0) {
        recommendations.push(`${entriesWithoutReason.length} changes lack proper reason documentation`);
      }
      
      if (maxChangesPerUser > entries.length * 0.5) {
        recommendations.push('Consider implementing approval workflows for bulk changes');
      }
      
      if (undocumentedCriticalChanges.length > 0) {
        recommendations.push('All critical changes (deletions, status changes) should include detailed reasons');
      }
      
      if (criticalChanges.length > entries.length * 0.3) {
        recommendations.push('High number of critical changes detected - review change management processes');
      }

      return {
        period: { startDate, endDate },
        totalChanges: entries.length,
        changesByAction,
        changesByUser,
        changesByLocation,
        criticalChanges,
        complianceScore,
        recommendations,
      };
    } catch (error: any) {
      this.logger.error(`Failed to generate compliance report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Setup event listeners for automatic audit logging
   */
  private setupEventListeners(): void {
    // Location created
    this.eventEmitter.on('location.created', async (event: any) => {
      await this.createAuditEntry(
        event.tenantId,
        event.locationId,
        'CREATE',
        event.userId,
        [{ field: 'location', oldValue: null, newValue: 'created' }],
        { source: 'API' },
        event.location,
      );
    });

    // Location updated
    this.eventEmitter.on('location.updated', async (event: any) => {
      const changes = this.compareLocationStates(event.oldLocation, event.newLocation);
      await this.createAuditEntry(
        event.tenantId,
        event.locationId,
        'UPDATE',
        event.userId,
        changes,
        { source: 'API', reason: event.reason },
        event.newLocation,
      );
    });

    // Location deleted
    this.eventEmitter.on('location.deleted', async (event: any) => {
      await this.createAuditEntry(
        event.tenantId,
        event.locationId,
        'DELETE',
        event.userId,
        [{ field: 'status', oldValue: 'active', newValue: 'deleted' }],
        { source: 'API', reason: event.reason },
      );
    });

    // Status changed
    this.eventEmitter.on('location.status.changed', async (event: any) => {
      await this.createAuditEntry(
        event.tenantId,
        event.locationId,
        'STATUS_CHANGE',
        event.userId,
        [{ field: 'status', oldValue: event.oldStatus, newValue: event.newStatus }],
        { source: 'API', reason: event.reason },
      );
    });

    // Permission changed
    this.eventEmitter.on('location.permission.granted', async (event: any) => {
      await this.createAuditEntry(
        event.tenantId,
        event.permission.locationId,
        'PERMISSION_CHANGE',
        event.grantedBy,
        [{ 
          field: 'permissions', 
          oldValue: null, 
          newValue: `Granted ${event.permission.role} access to ${event.permission.userId}` 
        }],
        { source: 'API' },
      );
    });

    this.eventEmitter.on('location.permission.revoked', async (event: any) => {
      await this.createAuditEntry(
        event.tenantId,
        event.permission.locationId,
        'PERMISSION_CHANGE',
        event.revokedBy,
        [{ 
          field: 'permissions', 
          oldValue: `${event.permission.role} access`, 
          newValue: null 
        }],
        { source: 'API' },
      );
    });

    // Settings changed
    this.eventEmitter.on('location.settings.updated', async (event: any) => {
      await this.createAuditEntry(
        event.tenantId,
        event.locationId,
        'SETTINGS_CHANGE',
        event.userId,
        event.changes,
        { source: 'API', reason: event.reason },
      );
    });
  }
}