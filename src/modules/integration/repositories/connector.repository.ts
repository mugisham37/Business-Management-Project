import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';

import { DrizzleService } from '../../database/drizzle.service';
import { connectors } from '../../database/schema/integration.schema';

import { Connector } from '../entities/connector.entity';
import { ConnectorListDto } from '../dto/connector.dto';

@Injectable()
export class ConnectorRepository {
  private readonly logger = new Logger(ConnectorRepository.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async upsert(data: Partial<Connector>): Promise<Connector> {
    // Implementation for upserting connector metadata
    const [connector] = await this.drizzle.db
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

  async findAll(filters?: ConnectorListDto): Promise<Connector[]> {
    let query = this.drizzle.db
      .select()
      .from(connectors);

    if (filters?.type) {
      query = query.where(eq(connectors.type, filters.type));
    }

    if (filters?.isActive !== undefined) {
      query = query.where(eq(connectors.isActive, filters.isActive));
    }

    const results = await query.orderBy(desc(connectors.createdAt));
    return results as Connector[];
  }

  async findByName(name: string): Promise<Connector | null> {
    const [connector] = await this.drizzle.db
      .select()
      .from(connectors)
      .where(eq(connectors.name, name))
      .limit(1);

    return connector as Connector || null;
  }

  async update(id: string, data: Partial<Connector>): Promise<Connector> {
    const [connector] = await this.drizzle.db
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