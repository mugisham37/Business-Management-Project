import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, sql, gte, lte, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { supplierCommunications } from '../../database/schema/supplier.schema';
import { CreateSupplierCommunicationDto } from '../dto/supplier.dto';

@Injectable()
export class SupplierCommunicationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.getDb();
  }

  async create(
    tenantId: string,
    data: CreateSupplierCommunicationDto,
    userId: string,
  ): Promise<typeof supplierCommunications.$inferSelect> {
    const [communication] = await this.db
      .insert(supplierCommunications)
      .values({
        tenantId,
        ...data,
        communicationDate: data.communicationDate ? new Date(data.communicationDate) : new Date(),
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (!communication) {
      throw new Error('Failed to create communication');
    }

    return communication;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<typeof supplierCommunications.$inferSelect | null> {
    const [communication] = await this.db
      .select()
      .from(supplierCommunications)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.id, id),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .limit(1);

    return communication || null;
  }

  async findBySupplier(
    tenantId: string,
    supplierId: string,
    limit = 50,
    offset = 0,
  ): Promise<{
    communications: (typeof supplierCommunications.$inferSelect)[];
    total: number;
  }> {
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierCommunications)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.supplierId, supplierId),
          isNull(supplierCommunications.deletedAt),
        ),
      );
    
    const count = countResult[0]?.count || 0;

    // Get paginated communications
    const communications = await this.db
      .select()
      .from(supplierCommunications)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.supplierId, supplierId),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .orderBy(desc(supplierCommunications.communicationDate))
      .limit(limit)
      .offset(offset);

    return {
      communications,
      total: count,
    };
  }

  async findByContact(
    tenantId: string,
    contactId: string,
    limit = 50,
  ): Promise<(typeof supplierCommunications.$inferSelect)[]> {
    return await this.db
      .select()
      .from(supplierCommunications)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.contactId, contactId),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .orderBy(desc(supplierCommunications.communicationDate))
      .limit(limit);
  }

  async findPendingFollowUps(
    tenantId: string,
    beforeDate?: Date,
  ): Promise<(typeof supplierCommunications.$inferSelect)[]> {
    const conditions = [
      eq(supplierCommunications.tenantId, tenantId),
      eq(supplierCommunications.followUpRequired, true),
      isNull(supplierCommunications.deletedAt),
    ];

    if (beforeDate) {
      conditions.push(lte(supplierCommunications.followUpDate, beforeDate));
    }

    return await this.db
      .select()
      .from(supplierCommunications)
      .where(and(...conditions))
      .orderBy(asc(supplierCommunications.followUpDate));
  }

  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    supplierId?: string,
  ): Promise<(typeof supplierCommunications.$inferSelect)[]> {
    const conditions = [
      eq(supplierCommunications.tenantId, tenantId),
      gte(supplierCommunications.communicationDate, startDate),
      lte(supplierCommunications.communicationDate, endDate),
      isNull(supplierCommunications.deletedAt),
    ];

    if (supplierId) {
      conditions.push(eq(supplierCommunications.supplierId, supplierId));
    }

    return await this.db
      .select()
      .from(supplierCommunications)
      .where(and(...conditions))
      .orderBy(desc(supplierCommunications.communicationDate));
  }

  async findByType(
    tenantId: string,
    type: string,
    supplierId?: string,
    limit = 50,
  ): Promise<(typeof supplierCommunications.$inferSelect)[]> {
    const conditions = [
      eq(supplierCommunications.tenantId, tenantId),
      sql`${supplierCommunications.type} = ${type}`,
      isNull(supplierCommunications.deletedAt),
    ];

    if (supplierId) {
      conditions.push(eq(supplierCommunications.supplierId, supplierId));
    }

    return await this.db
      .select()
      .from(supplierCommunications)
      .where(and(...conditions))
      .orderBy(desc(supplierCommunications.communicationDate))
      .limit(limit);
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<CreateSupplierCommunicationDto>,
    userId: string,
  ): Promise<typeof supplierCommunications.$inferSelect | null> {
    const updateData: any = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (data.communicationDate) {
      updateData.communicationDate = new Date(data.communicationDate);
    }

    if (data.followUpDate) {
      updateData.followUpDate = new Date(data.followUpDate);
    }

    const [communication] = await this.db
      .update(supplierCommunications)
      .set(updateData)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.id, id),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .returning();

    return communication || null;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [communication] = await this.db
      .update(supplierCommunications)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.id, id),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .returning();

    return !!communication;
  }

  async markFollowUpComplete(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<typeof supplierCommunications.$inferSelect | null> {
    const [communication] = await this.db
      .update(supplierCommunications)
      .set({
        followUpRequired: false,
        followUpDate: null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.id, id),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .returning();

    return communication || null;
  }

  async getCommunicationStats(
    tenantId: string,
    supplierId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalCommunications: number;
    byType: Record<string, number>;
    byDirection: Record<string, number>;
    pendingFollowUps: number;
    averageResponseTime: number | null;
  }> {
    const conditions = [eq(supplierCommunications.tenantId, tenantId), isNull(supplierCommunications.deletedAt)];

    if (supplierId) {
      conditions.push(eq(supplierCommunications.supplierId, supplierId));
    }

    if (startDate) {
      conditions.push(gte(supplierCommunications.communicationDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(supplierCommunications.communicationDate, endDate));
    }

    const stats = await this.db
      .select({
        totalCommunications: sql<number>`count(*)`,
        emailCount: sql<number>`count(*) filter (where type = 'email')`,
        phoneCount: sql<number>`count(*) filter (where type = 'phone')`,
        meetingCount: sql<number>`count(*) filter (where type = 'meeting')`,
        inboundCount: sql<number>`count(*) filter (where direction = 'inbound')`,
        outboundCount: sql<number>`count(*) filter (where direction = 'outbound')`,
        pendingFollowUps: sql<number>`count(*) filter (where follow_up_required = true)`,
      })
      .from(supplierCommunications)
      .where(and(...conditions));

    const result = stats[0];

    if (!result) {
      return {
        totalCommunications: 0,
        byType: {
          email: 0,
          phone: 0,
          meeting: 0,
        },
        byDirection: {
          inbound: 0,
          outbound: 0,
        },
        pendingFollowUps: 0,
        averageResponseTime: null,
      };
    }

    return {
      totalCommunications: result.totalCommunications || 0,
      byType: {
        email: result.emailCount || 0,
        phone: result.phoneCount || 0,
        meeting: result.meetingCount || 0,
      },
      byDirection: {
        inbound: result.inboundCount || 0,
        outbound: result.outboundCount || 0,
      },
      pendingFollowUps: result.pendingFollowUps || 0,
      averageResponseTime: null, // This would require more complex calculation
    };
  }

  async getRecentCommunications(
    tenantId: string,
    limit = 10,
  ): Promise<(typeof supplierCommunications.$inferSelect)[]> {
    return await this.db
      .select()
      .from(supplierCommunications)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          isNull(supplierCommunications.deletedAt),
        ),
      )
      .orderBy(desc(supplierCommunications.communicationDate))
      .limit(limit);
  }
}
