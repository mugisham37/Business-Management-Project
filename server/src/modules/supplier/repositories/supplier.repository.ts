import { Injectable } from '@nestjs/common';
import { eq, and, ilike, desc, asc, sql, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import {
  suppliers,
  supplierContacts,
  supplierCommunications,
  supplierEvaluations,
  supplierPerformanceMetrics,
} from '../../database/schema/supplier.schema';
import { CreateSupplierDto, UpdateSupplierDto, SupplierQueryDto } from '../dto/supplier.dto';

export interface SupplierWithRelations {
  supplier: typeof suppliers.$inferSelect;
  contacts?: (typeof supplierContacts.$inferSelect)[];
  communications?: (typeof supplierCommunications.$inferSelect)[];
  evaluations?: (typeof supplierEvaluations.$inferSelect)[];
  performanceMetrics?: (typeof supplierPerformanceMetrics.$inferSelect)[];
}

@Injectable()
export class SupplierRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.getDb();
  }

  async create(
    tenantId: string,
    data: CreateSupplierDto,
    userId: string,
  ): Promise<typeof suppliers.$inferSelect> {
    const [supplier] = await this.db
      .insert(suppliers)
      .values({
        tenantId,
        supplierCode: data.supplierCode,
        name: data.name,
        legalName: data.legalName,
        supplierType: data.supplierType,
        status: data.status,
        primaryContactName: data.primaryContactName,
        primaryContactTitle: data.primaryContactTitle,
        primaryContactEmail: data.primaryContactEmail,
        primaryContactPhone: data.primaryContactPhone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        taxId: data.taxId,
        businessRegistrationNumber: data.businessRegistrationNumber,
        website: data.website,
        description: data.description,
        paymentTerms: data.paymentTerms,
        creditLimit: data.creditLimit?.toString(),
        currency: data.currency,
        certifications: data.certifications || [],
        tags: data.tags || [],
        customFields: data.customFields || {},
        notes: data.notes,
        preferredCommunicationMethod: data.preferredCommunicationMethod,
        isPreferredSupplier: data.isPreferredSupplier,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (!supplier) {
      throw new Error('Failed to create supplier');
    }

    return supplier;
  }

  async findById(
    tenantId: string,
    id: string,
    includeRelations = false,
  ): Promise<SupplierWithRelations | null> {
    const supplierResult = await this.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .limit(1);

    if (!supplierResult.length || !supplierResult[0]) {
      return null;
    }

    const result: SupplierWithRelations = {
      supplier: supplierResult[0],
    };

    if (includeRelations) {
      // Load contacts
      result.contacts = await this.db
        .select()
        .from(supplierContacts)
        .where(
          and(
            eq(supplierContacts.tenantId, tenantId),
            eq(supplierContacts.supplierId, id),
            isNull(supplierContacts.deletedAt),
          ),
        )
        .orderBy(desc(supplierContacts.isPrimary), asc(supplierContacts.firstName));

      // Load recent communications
      result.communications = await this.db
        .select()
        .from(supplierCommunications)
        .where(
          and(
            eq(supplierCommunications.tenantId, tenantId),
            eq(supplierCommunications.supplierId, id),
            isNull(supplierCommunications.deletedAt),
          ),
        )
        .orderBy(desc(supplierCommunications.communicationDate))
        .limit(10);

      // Load recent evaluations
      result.evaluations = await this.db
        .select()
        .from(supplierEvaluations)
        .where(
          and(
            eq(supplierEvaluations.tenantId, tenantId),
            eq(supplierEvaluations.supplierId, id),
            isNull(supplierEvaluations.deletedAt),
          ),
        )
        .orderBy(desc(supplierEvaluations.evaluationDate))
        .limit(5);

      // Load performance metrics
      result.performanceMetrics = await this.db
        .select()
        .from(supplierPerformanceMetrics)
        .where(
          and(
            eq(supplierPerformanceMetrics.tenantId, tenantId),
            eq(supplierPerformanceMetrics.supplierId, id),
            isNull(supplierPerformanceMetrics.deletedAt),
          ),
        )
        .orderBy(desc(supplierPerformanceMetrics.periodEnd))
        .limit(12); // Last 12 periods
    }

    return result;
  }

  async findByCode(
    tenantId: string,
    supplierCode: string,
  ): Promise<typeof suppliers.$inferSelect | null> {
    const [supplier] = await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.supplierCode, supplierCode),
          isNull(suppliers.deletedAt),
        ),
      )
      .limit(1);

    return supplier || null;
  }

  async findMany(
    tenantId: string,
    query: SupplierQueryDto,
  ): Promise<{
    suppliers: (typeof suppliers.$inferSelect)[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { search, status, supplierType, rating, preferredOnly, tags, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = query;

    // Build where conditions
    const conditions = [eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt)];

    if (search) {
      conditions.push(
        sql`(${ilike(suppliers.name, `%${search}%`)} OR ${ilike(suppliers.supplierCode, `%${search}%`)} OR ${ilike(suppliers.primaryContactName, `%${search}%`)})`,
      );
    }

    if (status) {
      conditions.push(eq(suppliers.status, status));
    }

    if (supplierType) {
      conditions.push(eq(suppliers.supplierType, supplierType));
    }

    if (rating) {
      conditions.push(eq(suppliers.overallRating, rating));
    }

    if (preferredOnly) {
      conditions.push(eq(suppliers.isPreferredSupplier, true));
    }

    if (tags && tags.length > 0) {
      conditions.push(sql`${suppliers.tags} @> ${JSON.stringify(tags)}`);
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(whereClause);
    
    const count = countResult[0]?.count || 0;

    // Build order by clause
    const validSortColumns = ['name', 'supplierCode', 'status', 'supplierType', 'overallRating', 'createdAt'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
    
    let orderByClause;
    if (sortColumn === 'name') {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.name) : asc(suppliers.name);
    } else if (sortColumn === 'supplierCode') {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.supplierCode) : asc(suppliers.supplierCode);
    } else if (sortColumn === 'status') {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.status) : asc(suppliers.status);
    } else if (sortColumn === 'supplierType') {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.supplierType) : asc(suppliers.supplierType);
    } else if (sortColumn === 'overallRating') {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.overallRating) : asc(suppliers.overallRating);
    } else if (sortColumn === 'createdAt') {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.createdAt) : asc(suppliers.createdAt);
    } else {
      orderByClause = sortOrder === 'desc' ? desc(suppliers.name) : asc(suppliers.name);
    }

    // Get paginated results
    const offset = (page - 1) * limit;
    const supplierList = await this.db
      .select()
      .from(suppliers)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(count / limit);

    return {
      suppliers: supplierList,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  async update(
    tenantId: string,
    id: string,
    data: UpdateSupplierDto,
    userId: string,
  ): Promise<typeof suppliers.$inferSelect | null> {
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Map all fields explicitly to handle type conversions
    if (data.name !== undefined) updateData.name = data.name;
    if (data.legalName !== undefined) updateData.legalName = data.legalName;
    if (data.supplierType !== undefined) updateData.supplierType = data.supplierType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.primaryContactName !== undefined) updateData.primaryContactName = data.primaryContactName;
    if (data.primaryContactTitle !== undefined) updateData.primaryContactTitle = data.primaryContactTitle;
    if (data.primaryContactEmail !== undefined) updateData.primaryContactEmail = data.primaryContactEmail;
    if (data.primaryContactPhone !== undefined) updateData.primaryContactPhone = data.primaryContactPhone;
    if (data.addressLine1 !== undefined) updateData.addressLine1 = data.addressLine1;
    if (data.addressLine2 !== undefined) updateData.addressLine2 = data.addressLine2;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.taxId !== undefined) updateData.taxId = data.taxId;
    if (data.businessRegistrationNumber !== undefined) updateData.businessRegistrationNumber = data.businessRegistrationNumber;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
    if (data.creditLimit !== undefined) updateData.creditLimit = data.creditLimit.toString();
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.certifications !== undefined) updateData.certifications = data.certifications;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.customFields !== undefined) updateData.customFields = data.customFields;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.preferredCommunicationMethod !== undefined) updateData.preferredCommunicationMethod = data.preferredCommunicationMethod;
    if (data.isPreferredSupplier !== undefined) updateData.isPreferredSupplier = data.isPreferredSupplier;

    const [supplier] = await this.db
      .update(suppliers)
      .set(updateData)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .returning();

    return supplier || null;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [supplier] = await this.db
      .update(suppliers)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id), isNull(suppliers.deletedAt)))
      .returning();

    return !!supplier;
  }

  async updateRatings(
    tenantId: string,
    supplierId: string,
    ratings: {
      overallRating?: string;
      qualityRating?: number;
      deliveryRating?: number;
      serviceRating?: number;
    },
    userId: string,
  ): Promise<typeof suppliers.$inferSelect | null> {
    const updateData: any = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (ratings.overallRating !== undefined) {
      updateData.overallRating = ratings.overallRating;
    }
    if (ratings.qualityRating !== undefined) {
      updateData.qualityRating = ratings.qualityRating;
    }
    if (ratings.deliveryRating !== undefined) {
      updateData.deliveryRating = ratings.deliveryRating;
    }
    if (ratings.serviceRating !== undefined) {
      updateData.serviceRating = ratings.serviceRating;
    }

    const [supplier] = await this.db
      .update(suppliers)
      .set(updateData)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, supplierId), isNull(suppliers.deletedAt)))
      .returning();

    return supplier || null;
  }

  async findPreferredSuppliers(tenantId: string): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.isPreferredSupplier, true),
          eq(suppliers.status, 'active'),
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(asc(suppliers.name));
  }

  async findByStatus(
    tenantId: string,
    status: string,
  ): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          sql`${suppliers.status} = ${status}`,
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(asc(suppliers.name));
  }

  async getSupplierStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    pendingApproval: number;
    preferred: number;
    averageRating: number;
  }> {
    const stats = await this.db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'active')`,
        inactive: sql<number>`count(*) filter (where status = 'inactive')`,
        pendingApproval: sql<number>`count(*) filter (where status = 'pending_approval')`,
        preferred: sql<number>`count(*) filter (where is_preferred_supplier = true)`,
        averageQualityRating: sql<number>`avg(quality_rating)`,
        averageDeliveryRating: sql<number>`avg(delivery_rating)`,
        averageServiceRating: sql<number>`avg(service_rating)`,
      })
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt)));

    const result = stats[0];
    
    if (!result) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        pendingApproval: 0,
        preferred: 0,
        averageRating: 0,
      };
    }
    
    const averageRating = (
      (result.averageQualityRating || 0) +
      (result.averageDeliveryRating || 0) +
      (result.averageServiceRating || 0)
    ) / 3;

    return {
      total: result.total || 0,
      active: result.active || 0,
      inactive: result.inactive || 0,
      pendingApproval: result.pendingApproval || 0,
      preferred: result.preferred || 0,
      averageRating: Math.round(averageRating * 100) / 100,
    };
  }

  async searchSuppliers(
    tenantId: string,
    searchTerm: string,
    limit = 10,
  ): Promise<(typeof suppliers.$inferSelect)[]> {
    return await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          sql`(${ilike(suppliers.name, `%${searchTerm}%`)} OR ${ilike(suppliers.supplierCode, `%${searchTerm}%`)})`,
          eq(suppliers.status, 'active'),
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(asc(suppliers.name))
      .limit(limit);
  }

  async findSuppliersNeedingEvaluation(tenantId: string): Promise<(typeof suppliers.$inferSelect)[]> {
    // Find suppliers that haven't been evaluated in the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await this.db
      .select({ suppliers })
      .from(suppliers)
      .leftJoin(
        supplierEvaluations,
        and(
          eq(supplierEvaluations.supplierId, suppliers.id),
          eq(supplierEvaluations.tenantId, suppliers.tenantId),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .where(
        and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.status, 'active'),
          isNull(suppliers.deletedAt),
          sql`(${supplierEvaluations.evaluationDate} IS NULL OR ${supplierEvaluations.evaluationDate} < ${sixMonthsAgo})`,
        ),
      )
      .groupBy(suppliers.id)
      .orderBy(asc(suppliers.name));

    return result.map(row => row.suppliers);
  }
}
