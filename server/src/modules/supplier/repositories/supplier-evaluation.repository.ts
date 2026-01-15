import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, sql, gte, lte, isNull } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { supplierEvaluations } from '../../database/schema/supplier.schema';
import { CreateSupplierEvaluationDto } from '../dto/supplier.dto';

@Injectable()
export class SupplierEvaluationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.getDb();
  }

  async create(
    tenantId: string,
    data: CreateSupplierEvaluationDto,
    evaluatorId: string,
  ): Promise<typeof supplierEvaluations.$inferSelect> {
    const [evaluation] = await this.db
      .insert(supplierEvaluations)
      .values({
        tenantId,
        supplierId: data.supplierId,
        evaluationPeriodStart: new Date(data.evaluationPeriodStart),
        evaluationPeriodEnd: new Date(data.evaluationPeriodEnd),
        evaluationDate: data.evaluationDate ? new Date(data.evaluationDate) : new Date(),
        evaluatorId,
        overallScore: data.overallScore.toString(),
        overallRating: data.overallRating,
        qualityScore: data.qualityScore !== undefined ? data.qualityScore.toString() : null,
        deliveryScore: data.deliveryScore !== undefined ? data.deliveryScore.toString() : null,
        pricingScore: data.pricingScore !== undefined ? data.pricingScore.toString() : null,
        serviceScore: data.serviceScore !== undefined ? data.serviceScore.toString() : null,
        reliabilityScore: data.reliabilityScore !== undefined ? data.reliabilityScore.toString() : null,
        complianceScore: data.complianceScore !== undefined ? data.complianceScore.toString() : null,
        onTimeDeliveryRate: data.onTimeDeliveryRate !== undefined ? data.onTimeDeliveryRate.toString() : null,
        qualityDefectRate: data.qualityDefectRate !== undefined ? data.qualityDefectRate.toString() : null,
        responseTime: data.responseTime !== undefined ? data.responseTime : null,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        recommendations: data.recommendations,
        actionItems: data.actionItems || [],
        customScores: data.customScores || {},
        attachments: data.attachments || [],
        createdBy: evaluatorId,
        updatedBy: evaluatorId,
      })
      .returning();

    if (!evaluation) {
      throw new Error('Failed to create evaluation');
    }

    return evaluation;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<typeof supplierEvaluations.$inferSelect | null> {
    const [evaluation] = await this.db
      .select()
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.id, id),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .limit(1);

    return evaluation || null;
  }

  async findBySupplier(
    tenantId: string,
    supplierId: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    evaluations: (typeof supplierEvaluations.$inferSelect)[];
    total: number;
  }> {
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.supplierId, supplierId),
          isNull(supplierEvaluations.deletedAt),
        ),
      );
    
    const count = countResult[0]?.count || 0;

    // Get paginated evaluations
    const evaluations = await this.db
      .select()
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.supplierId, supplierId),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .orderBy(desc(supplierEvaluations.evaluationDate))
      .limit(limit)
      .offset(offset);

    return {
      evaluations,
      total: count,
    };
  }

  async findLatestEvaluation(
    tenantId: string,
    supplierId: string,
  ): Promise<typeof supplierEvaluations.$inferSelect | null> {
    const [evaluation] = await this.db
      .select()
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.supplierId, supplierId),
          eq(supplierEvaluations.isApproved, true),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .orderBy(desc(supplierEvaluations.evaluationDate))
      .limit(1);

    return evaluation || null;
  }

  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    supplierId?: string,
  ): Promise<(typeof supplierEvaluations.$inferSelect)[]> {
    const conditions = [
      eq(supplierEvaluations.tenantId, tenantId),
      gte(supplierEvaluations.evaluationDate, startDate),
      lte(supplierEvaluations.evaluationDate, endDate),
      isNull(supplierEvaluations.deletedAt),
    ];

    if (supplierId) {
      conditions.push(eq(supplierEvaluations.supplierId, supplierId));
    }

    return await this.db
      .select()
      .from(supplierEvaluations)
      .where(and(...conditions))
      .orderBy(desc(supplierEvaluations.evaluationDate));
  }

  async findPendingApproval(
    tenantId: string,
  ): Promise<(typeof supplierEvaluations.$inferSelect)[]> {
    return await this.db
      .select()
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.isApproved, false),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .orderBy(asc(supplierEvaluations.evaluationDate));
  }

  async findByRating(
    tenantId: string,
    rating: string,
  ): Promise<(typeof supplierEvaluations.$inferSelect)[]> {
    return await this.db
      .select()
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          sql`${supplierEvaluations.overallRating} = ${rating}`,
          eq(supplierEvaluations.isApproved, true),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .orderBy(desc(supplierEvaluations.evaluationDate));
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<CreateSupplierEvaluationDto>,
    userId: string,
  ): Promise<typeof supplierEvaluations.$inferSelect | null> {
    const updateData: any = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (data.evaluationPeriodStart) {
      updateData.evaluationPeriodStart = new Date(data.evaluationPeriodStart);
    }

    if (data.evaluationPeriodEnd) {
      updateData.evaluationPeriodEnd = new Date(data.evaluationPeriodEnd);
    }

    if (data.evaluationDate) {
      updateData.evaluationDate = new Date(data.evaluationDate);
    }

    const [evaluation] = await this.db
      .update(supplierEvaluations)
      .set(updateData)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.id, id),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .returning();

    return evaluation || null;
  }

  async approve(
    tenantId: string,
    id: string,
    approverId: string,
  ): Promise<typeof supplierEvaluations.$inferSelect | null> {
    const [evaluation] = await this.db
      .update(supplierEvaluations)
      .set({
        isApproved: true,
        approvedBy: approverId,
        approvedAt: new Date(),
        updatedBy: approverId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.id, id),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .returning();

    return evaluation || null;
  }

  async reject(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<typeof supplierEvaluations.$inferSelect | null> {
    const [evaluation] = await this.db
      .update(supplierEvaluations)
      .set({
        isApproved: false,
        approvedBy: null,
        approvedAt: null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.id, id),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .returning();

    return evaluation || null;
  }

  async delete(tenantId: string, id: string, userId: string): Promise<boolean> {
    const [evaluation] = await this.db
      .update(supplierEvaluations)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.id, id),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .returning();

    return !!evaluation;
  }

  async getEvaluationStats(
    tenantId: string,
    supplierId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvaluations: number;
    averageOverallScore: number;
    averageQualityScore: number;
    averageDeliveryScore: number;
    averageServiceScore: number;
    ratingDistribution: Record<string, number>;
    pendingApproval: number;
  }> {
    const conditions = [
      eq(supplierEvaluations.tenantId, tenantId),
      eq(supplierEvaluations.isApproved, true),
      isNull(supplierEvaluations.deletedAt),
    ];

    if (supplierId) {
      conditions.push(eq(supplierEvaluations.supplierId, supplierId));
    }

    if (startDate) {
      conditions.push(gte(supplierEvaluations.evaluationDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(supplierEvaluations.evaluationDate, endDate));
    }

    const stats = await this.db
      .select({
        totalEvaluations: sql<number>`count(*)`,
        averageOverallScore: sql<number>`avg(overall_score)`,
        averageQualityScore: sql<number>`avg(quality_score)`,
        averageDeliveryScore: sql<number>`avg(delivery_score)`,
        averageServiceScore: sql<number>`avg(service_score)`,
        excellentCount: sql<number>`count(*) filter (where overall_rating = 'excellent')`,
        goodCount: sql<number>`count(*) filter (where overall_rating = 'good')`,
        averageCount: sql<number>`count(*) filter (where overall_rating = 'average')`,
        poorCount: sql<number>`count(*) filter (where overall_rating = 'poor')`,
      })
      .from(supplierEvaluations)
      .where(and(...conditions));

    // Get pending approval count
    const pendingConditions = [
      eq(supplierEvaluations.tenantId, tenantId),
      eq(supplierEvaluations.isApproved, false),
      isNull(supplierEvaluations.deletedAt),
    ];

    if (supplierId) {
      pendingConditions.push(eq(supplierEvaluations.supplierId, supplierId));
    }

    const pendingResult = await this.db
      .select({ pendingCount: sql<number>`count(*)` })
      .from(supplierEvaluations)
      .where(and(...pendingConditions));
    
    const pendingCount = pendingResult[0]?.pendingCount || 0;

    const result = stats[0];

    if (!result) {
      return {
        totalEvaluations: 0,
        averageOverallScore: 0,
        averageQualityScore: 0,
        averageDeliveryScore: 0,
        averageServiceScore: 0,
        ratingDistribution: {
          excellent: 0,
          good: 0,
          average: 0,
          poor: 0,
        },
        pendingApproval: pendingCount,
      };
    }

    return {
      totalEvaluations: result.totalEvaluations || 0,
      averageOverallScore: Math.round((result.averageOverallScore || 0) * 100) / 100,
      averageQualityScore: Math.round((result.averageQualityScore || 0) * 100) / 100,
      averageDeliveryScore: Math.round((result.averageDeliveryScore || 0) * 100) / 100,
      averageServiceScore: Math.round((result.averageServiceScore || 0) * 100) / 100,
      ratingDistribution: {
        excellent: result.excellentCount || 0,
        good: result.goodCount || 0,
        average: result.averageCount || 0,
        poor: result.poorCount || 0,
      },
      pendingApproval: pendingCount,
    };
  }

  async getSupplierTrends(
    tenantId: string,
    supplierId: string,
    months = 12,
  ): Promise<{
    month: string;
    overallScore: number;
    qualityScore: number;
    deliveryScore: number;
    serviceScore: number;
  }[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const trends = await this.db
      .select({
        month: sql<string>`to_char(evaluation_date, 'YYYY-MM')`,
        overallScore: sql<number>`avg(overall_score)`,
        qualityScore: sql<number>`avg(quality_score)`,
        deliveryScore: sql<number>`avg(delivery_score)`,
        serviceScore: sql<number>`avg(service_score)`,
      })
      .from(supplierEvaluations)
      .where(
        and(
          eq(supplierEvaluations.tenantId, tenantId),
          eq(supplierEvaluations.supplierId, supplierId),
          eq(supplierEvaluations.isApproved, true),
          gte(supplierEvaluations.evaluationDate, startDate),
          isNull(supplierEvaluations.deletedAt),
        ),
      )
      .groupBy(sql`to_char(evaluation_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(evaluation_date, 'YYYY-MM')`);

    return trends.map(trend => ({
      month: trend.month,
      overallScore: Math.round((trend.overallScore || 0) * 100) / 100,
      qualityScore: Math.round((trend.qualityScore || 0) * 100) / 100,
      deliveryScore: Math.round((trend.deliveryScore || 0) * 100) / 100,
      serviceScore: Math.round((trend.serviceScore || 0) * 100) / 100,
    }));
  }
}
