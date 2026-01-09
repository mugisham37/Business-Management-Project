import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, sql, gte, lte, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { supplierCommunications } from '../../database/schema/supplier.schema';
import { CreateSupplierCommunicationDto } from '../dto/supplier.dto';

@Injectable()
export class SupplierCommunicationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(
    tenantId: string,
    data: CreateSupplierCommunicationDto,
    userId: string,
  ): Promise<typeof supplierCommunications.$inferSelect> {
    const [communication] = await this.drizzle.db
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

    return communication;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<typeof supplierCommunications.$inferSelect | null> {
    const [communication] = await this.drizzle.db
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
    const [{ count }] = await this.drizzle.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierCommunications)
      .where(
        and(
          eq(supplierCommunications.tenantId, tenantId),
          eq(supplierCommunications.supplierId, supplierId),
          isNull(supplierCommunications.deletedAt),
        ),
      );

    // Get paginated communications
    const communications = await this.drizzle.db
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
    return await this.drizzle.db
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

    return await this.drizzle.db
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

    return await this.drizzle.db
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
      eq(supplierCommunications.type, type),
      isNull(supplierCommunications.deletedAt),
    ];

    if (supplierId) {
      conditions.push(eq(supplierCommunications.supplierId, supplierId));
    }

    return await this.drizzle.db
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

    const [communication] = await this.drizzle.db
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
    const [communication] = await this.drizzle.db
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
    const [communication] = await this.drizzle.db
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

    const stats = await this.drizzle.db
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

    return {
      totalCommunications: result.totalCommunications,
      byType: {
        email: result.emailCount,
        phone: result.phoneCount,
        meeting: result.meetingCount,
      },
      byDirection: {
        inbound: result.inboundCount,
        outbound: result.outboundCount,
      },
      pendingFollowUps: result.pendingFollowUps,
      averageResponseTime: null, // This would require more complex calculation
    };
  }

  async getRecentCommunications(
    tenantId: string,
    limit = 10,
  ): Promise<(typeof supplierCommunications.$inferSelect)[]> {
    return await this.drizzle.db
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