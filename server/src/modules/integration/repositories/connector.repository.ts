import { Injectable } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';

import { DrizzleService } from '../../database/drizzle.service';
import { connectors } from '../../database/schema/integration.schema';

import { Connector } from '../entities/connector.entity';
import { ConnectorFilterInput } from '../inputs/connector.input';

@Injectable()
export class ConnectorRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async upsert(data: Partial<Connector>): Promise<Connector> {
    // Implementation for upserting connector metadata
    const [connector] = await this.drizzle.db!
      .insert(connectors)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .onConflictDoUpdate({
        target: connectors.name,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();

    return connector as Connector;
  }

  async findAll(filters?: ConnectorFilterInput): Promise<Connector[]> {
    const db = this.drizzle.db;
    if (!db) {
      throw new Error('Database not initialized');
    }

    let query = db.select().from(connectors);

    // Build where conditions
    const conditions = [];
    if (filters?.type) {
      conditions.push(eq(connectors.type, filters.type));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(connectors.isActive, filters.isActive));
    }

    // Apply conditions if any
    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(connectors.createdAt));
    return results as Connector[];
  }

  async findByName(name: string): Promise<Connector | null> {
    const [connector] = await this.drizzle.db!
      .select()
      .from(connectors)
      .where(eq(connectors.name, name))
      .limit(1);

    return connector as Connector || null;
  }

  async update(id: string, data: Partial<Connector>): Promise<Connector> {
    const [connector] = await this.drizzle.db!
      .update(connectors)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(eq(connectors.id, id))
      .returning();

    return connector as Connector;
  }
}
