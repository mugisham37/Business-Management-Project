import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { sql } from 'drizzle-orm';

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata: Record<string, any>;
}

export interface SavedQuery {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sql: string;
  parameters: any[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
}

@Injectable()
export class AnalyticsRepository {
  private readonly logger = new Logger(AnalyticsRepository.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cacheService: IntelligentCacheService,
  ) {}

  /**
   * Store analytics event
   */
  async storeEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const db = this.drizzle.getDb();
      await db.execute(sql`
        INSERT INTO analytics_events (
          id, tenant_id, event_type, entity_type, entity_id, 
          timestamp, data, metadata, created_at
        ) VALUES (
          ${event.id}, ${event.tenantId}, ${event.eventType}, 
          ${event.entityType}, ${event.entityId}, ${event.timestamp},
          ${JSON.stringify(event.data)}, ${JSON.stringify(event.metadata)},
          NOW()
        )
      `);

      this.logger.debug(`Analytics event stored: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to store analytics event: ${event.id}`, error);
      throw error;
    }
  }

  /**
   * Get events by tenant and time range
   */
  async getEvents(
    tenantId: string,
    startTime: Date,
    endTime: Date,
    eventTypes?: string[],
    limit: number = 1000
  ): Promise<AnalyticsEvent[]> {
    try {
      const db = this.drizzle.getDb();
      let query = sql`
        SELECT id, tenant_id, event_type, entity_type, entity_id,
               timestamp, data, metadata
        FROM analytics_events
        WHERE tenant_id = ${tenantId}
          AND timestamp >= ${startTime}
          AND timestamp <= ${endTime}
      `;

      if (eventTypes && eventTypes.length > 0) {
        query = sql`${query} AND event_type = ANY(${eventTypes})`;
      }

      query = sql`${query} ORDER BY timestamp DESC LIMIT ${limit}`;

      const results = await db.execute(query);

      return (Array.isArray(results) ? results : []).map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        eventType: row.event_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        timestamp: row.timestamp,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      }));
    } catch (error) {
      this.logger.error(`Failed to get analytics events for tenant: ${tenantId}`, error);
      throw error;
    }
  }

  /**
   * Additional repository methods can be added here
   */
}
