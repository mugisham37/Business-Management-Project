import { Injectable } from '@nestjs/common';
import { SupplierRepository } from '../repositories/supplier.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { SupplierEvaluationRepository } from '../repositories/supplier-evaluation.repository';
import { PurchaseOrderStatus } from '../dto/purchase-order.dto';

export interface SpendAnalysisResult {
  totalSpend: number;
  spendBySupplier: Array<{
    supplierId: string;
    supplierName: string;
    totalSpend: number;
    percentage: number;
    orderCount: number;
    averageOrderValue: number;
  }>;
  spendByCategory: Array<{
    category: string;
    totalSpend: number;
    percentage: number;
    orderCount: number;
  }>;
  spendByMonth: Array<{
    month: string;
    totalSpend: number;
    orderCount: number;
    averageOrderValue: number;
  }>;
  topSuppliers: Array<{
    supplierId: string;
    supplierName: string;
    totalSpend: number;
    percentage: number;
  }>;
}

export interface SupplierPerformanceMetrics {
  supplierId: string;
  supplierName: string;
  overallScore: number;
  qualityScore: number;
  deliveryScore: number;
  serviceScore: number;
  onTimeDeliveryRate: number;
  qualityDefectRate: number;
  averageResponseTime: number;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastEvaluationDate?: Date;
  trend: 'improving' | 'declining' | 'stable';
}

export interface CostOptimizationRecommendation {
  type: 'consolidation' | 'negotiation' | 'alternative_supplier' | 'volume_discount';
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
  suppliersInvolved: string[];
  actionItems: string[];
  estimatedImplementationTime: string;
}

export interface ProcurementReport {
  reportType: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  summary: {
    totalSpend: number;
    totalOrders: number;
    averageOrderValue: number;
    activeSuppliers: number;
    onTimeDeliveryRate: number;
    averageProcessingTime: number;
  };
  spendAnalysis: SpendAnalysisResult;
  supplierPerformance: SupplierPerformanceMetrics[];
  costOptimizations: CostOptimizationRecommendation[];
  trends: {
    spendTrend: 'increasing' | 'decreasing' | 'stable';
    supplierCountTrend: 'increasing' | 'decreasing' | 'stable';
    performanceTrend: 'improving' | 'declining' | 'stable';
  };
}

@Injectable()
export class ProcurementAnalyticsService {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly evaluationRepository: SupplierEvaluationRepository,
  ) {}

  /**
   * Generate comprehensive spend analysis for a tenant
   */
  async generateSpendAnalysis(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SpendAnalysisResult> {
    // Get purchase order statistics for the period
    const poStats = await this.purchaseOrderRepository.getPurchaseOrderStats(
      tenantId,
      startDate,
      endDate,
    );

    // Get spend by supplier
    const spendBySupplier = await this.purchaseOrderRepository.getSpendBySupplier(
      tenantId,
      startDate,
      endDate,
    );

    // Get spend by category (based on supplier type)
    const spendByCategory = await this.purchaseOrderRepository.getSpendByCategory(
      tenantId,
      startDate,
      endDate,
    );

    // Get monthly spend trends
    const spendByMonth = await this.purchaseOrderRepository.getMonthlySpendTrends(
      tenantId,
      startDate,
      endDate,
    );

    // Calculate total spend
    const totalSpend = spendBySupplier.reduce((sum, supplier) => sum + supplier.totalSpend, 0);

    // Calculate percentages and enrich data
    const enrichedSpendBySupplier = spendBySupplier.map(supplier => ({
      ...supplier,
      percentage: totalSpend > 0 ? (supplier.totalSpend / totalSpend) * 100 : 0,
      averageOrderValue: supplier.orderCount > 0 ? supplier.totalSpend / supplier.orderCount : 0,
    }));

    const enrichedSpendByCategory = spendByCategory.map(category => ({
      ...category,
      percentage: totalSpend > 0 ? (category.totalSpend / totalSpend) * 100 : 0,
    }));

    // Get top 10 suppliers by spend
    const topSuppliers = enrichedSpendBySupplier
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10)
      .map(supplier => ({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        totalSpend: supplier.totalSpend,
        percentage: supplier.percentage,
      }));

    return {
      totalSpend,
      spendBySupplier: enrichedSpendBySupplier,
      spendByCategory: enrichedSpendByCategory,
      spendByMonth,
      topSuppliers,
    };
  }

  /**
   * Calculate supplier performance metrics
   */
  async calculateSupplierPerformanceMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    supplierId?: string,
  ): Promise<SupplierPerformanceMetrics[]> {
    // Get suppliers to analyze
    const suppliers = supplierId
      ? [await this.supplierRepository.findById(tenantId, supplierId)]
      : await this.supplierRepository.findByStatus(tenantId, 'active');

    const performanceMetrics: SupplierPerformanceMetrics[] = [];

    for (const supplierData of suppliers) {
      if (!supplierData) continue;
      
      const supplier = 'supplier' in supplierData ? supplierData.supplier : supplierData;

      // Get purchase order statistics for this supplier
      const supplierStats = await this.purchaseOrderRepository.getSupplierPurchaseStats(
        tenantId,
        supplier.id,
        startDate,
        endDate,
      );

      // Get latest evaluation scores
      const latestEvaluation = await this.evaluationRepository.findLatestEvaluation(
        tenantId,
        supplier.id,
      );

      // Calculate performance scores
      const evaluationStats = await this.evaluationRepository.getEvaluationStats(
        tenantId,
        supplier.id,
        startDate,
        endDate,
      );

      // Calculate trend based on recent evaluations
      const trend = await this.calculatePerformanceTrend(tenantId, supplier.id, endDate);

      const metrics: SupplierPerformanceMetrics = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        overallScore: typeof latestEvaluation?.overallScore === 'number' ? latestEvaluation.overallScore : parseFloat(latestEvaluation?.overallScore || '0'),
        qualityScore: typeof latestEvaluation?.qualityScore === 'number' ? latestEvaluation.qualityScore : parseFloat(latestEvaluation?.qualityScore || '0'),
        deliveryScore: typeof latestEvaluation?.deliveryScore === 'number' ? latestEvaluation.deliveryScore : parseFloat(latestEvaluation?.deliveryScore || '0'),
        serviceScore: typeof latestEvaluation?.serviceScore === 'number' ? latestEvaluation.serviceScore : parseFloat(latestEvaluation?.serviceScore || '0'),
        onTimeDeliveryRate: supplierStats.onTimeDeliveryRate || 0,
        qualityDefectRate: typeof latestEvaluation?.qualityDefectRate === 'number' ? latestEvaluation.qualityDefectRate : parseFloat(latestEvaluation?.qualityDefectRate || '0'),
        averageResponseTime: typeof latestEvaluation?.responseTime === 'number' ? latestEvaluation.responseTime : parseFloat(latestEvaluation?.responseTime || '0'),
        totalOrders: supplierStats.totalOrders || 0,
        totalSpend: supplierStats.totalSpend || 0,
        averageOrderValue: supplierStats.averageOrderValue || 0,
        ...(latestEvaluation?.evaluationDate && { lastEvaluationDate: latestEvaluation.evaluationDate }),
        trend,
      };

      performanceMetrics.push(metrics);
    }

    return performanceMetrics.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Generate cost optimization recommendations
   */
  async generateCostOptimizationRecommendations(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Analyze supplier consolidation opportunities
    const consolidationOpportunities = await this.analyzeSupplierConsolidation(
      tenantId,
      startDate,
      endDate,
    );
    recommendations.push(...consolidationOpportunities);

    // Analyze volume discount opportunities
    const volumeDiscountOpportunities = await this.analyzeVolumeDiscountOpportunities(
      tenantId,
      startDate,
      endDate,
    );
    recommendations.push(...volumeDiscountOpportunities);

    // Analyze alternative supplier opportunities
    const alternativeSupplierOpportunities = await this.analyzeAlternativeSuppliers(
      tenantId,
      startDate,
      endDate,
    );
    recommendations.push(...alternativeSupplierOpportunities);

    // Analyze contract negotiation opportunities
    const negotiationOpportunities = await this.analyzeNegotiationOpportunities(
      tenantId,
      startDate,
      endDate,
    );
    recommendations.push(...negotiationOpportunities);

    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Generate comprehensive procurement report
   */
  async generateProcurementReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    reportType: string = 'comprehensive',
  ): Promise<ProcurementReport> {
    // Generate spend analysis
    const spendAnalysis = await this.generateSpendAnalysis(tenantId, startDate, endDate);

    // Calculate supplier performance metrics
    const supplierPerformance = await this.calculateSupplierPerformanceMetrics(
      tenantId,
      startDate,
      endDate,
    );

    // Generate cost optimization recommendations
    const costOptimizations = await this.generateCostOptimizationRecommendations(
      tenantId,
      startDate,
      endDate,
    );

    // Calculate summary metrics
    const summary = {
      totalSpend: spendAnalysis.totalSpend,
      totalOrders: spendAnalysis.spendBySupplier.reduce((sum, s) => sum + s.orderCount, 0),
      averageOrderValue: spendAnalysis.totalSpend / Math.max(1, spendAnalysis.spendBySupplier.reduce((sum, s) => sum + s.orderCount, 0)),
      activeSuppliers: supplierPerformance.length,
      onTimeDeliveryRate: supplierPerformance.length > 0 
        ? supplierPerformance.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / supplierPerformance.length
        : 0,
      averageProcessingTime: await this.calculateAverageProcessingTime(tenantId, startDate, endDate),
    };

    // Calculate trends
    const trends = await this.calculateTrends(tenantId, startDate, endDate);

    return {
      reportType,
      generatedAt: new Date(),
      periodStart: startDate,
      periodEnd: endDate,
      summary,
      spendAnalysis,
      supplierPerformance,
      costOptimizations,
      trends,
    };
  }

  /**
   * Get procurement dashboard metrics
   */
  async getDashboardMetrics(tenantId: string, period: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    const [spendAnalysis, performanceMetrics, recommendations] = await Promise.all([
      this.generateSpendAnalysis(tenantId, startDate, endDate),
      this.calculateSupplierPerformanceMetrics(tenantId, startDate, endDate),
      this.generateCostOptimizationRecommendations(tenantId, startDate, endDate),
    ]);

    return {
      period,
      totalSpend: spendAnalysis.totalSpend,
      totalSuppliers: performanceMetrics.length,
      averagePerformanceScore: performanceMetrics.length > 0 
        ? performanceMetrics.reduce((sum, s) => sum + s.overallScore, 0) / performanceMetrics.length
        : 0,
      topPerformingSuppliers: performanceMetrics.slice(0, 5),
      spendTrends: spendAnalysis.spendByMonth,
      costSavingOpportunities: recommendations.slice(0, 3),
      alerts: await this.generateAlerts(tenantId),
    };
  }

  // Private helper methods

  private async calculatePerformanceTrend(
    tenantId: string,
    supplierId: string,
    endDate: Date,
  ): Promise<'improving' | 'declining' | 'stable'> {
    const sixMonthsAgo = new Date(endDate);
    sixMonthsAgo.setMonth(endDate.getMonth() - 6);

    const threeMonthsAgo = new Date(endDate);
    threeMonthsAgo.setMonth(endDate.getMonth() - 3);

    // Get evaluations for the last 6 months and last 3 months
    const olderEvaluations = await this.evaluationRepository.findByDateRange(
      tenantId,
      sixMonthsAgo,
      threeMonthsAgo,
      supplierId,
    );

    const recentEvaluations = await this.evaluationRepository.findByDateRange(
      tenantId,
      threeMonthsAgo,
      endDate,
      supplierId,
    );

    if (olderEvaluations.length === 0 || recentEvaluations.length === 0) {
      return 'stable';
    }

    const olderAverage = olderEvaluations.reduce((sum, e) => {
      const score = typeof e.overallScore === 'number' ? e.overallScore : parseFloat(e.overallScore || '0');
      return sum + score;
    }, 0) / olderEvaluations.length;
    
    const recentAverage = recentEvaluations.reduce((sum, e) => {
      const score = typeof e.overallScore === 'number' ? e.overallScore : parseFloat(e.overallScore || '0');
      return sum + score;
    }, 0) / recentEvaluations.length;

    const difference = recentAverage - olderAverage;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private async analyzeSupplierConsolidation(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostOptimizationRecommendation[]> {
    const spendAnalysis = await this.generateSpendAnalysis(tenantId, startDate, endDate);
    const recommendations: CostOptimizationRecommendation[] = [];

    // Find suppliers with similar categories but low individual spend
    const lowSpendSuppliers = spendAnalysis.spendBySupplier.filter(
      s => s.totalSpend < spendAnalysis.totalSpend * 0.05 && s.orderCount < 10
    );

    if (lowSpendSuppliers.length >= 3) {
      const totalLowSpend = lowSpendSuppliers.reduce((sum, s) => sum + s.totalSpend, 0);
      const potentialSavings = totalLowSpend * 0.15; // Assume 15% savings from consolidation

      recommendations.push({
        type: 'consolidation',
        title: 'Consolidate Low-Volume Suppliers',
        description: `Consider consolidating ${lowSpendSuppliers.length} low-volume suppliers to reduce administrative costs and potentially negotiate better rates.`,
        potentialSavings,
        priority: potentialSavings > 10000 ? 'high' : 'medium',
        suppliersInvolved: lowSpendSuppliers.map(s => s.supplierId),
        actionItems: [
          'Analyze supplier capabilities and overlap',
          'Negotiate consolidated contracts with top performers',
          'Implement supplier reduction plan',
          'Monitor service levels during transition',
        ],
        estimatedImplementationTime: '3-6 months',
      });
    }

    return recommendations;
  }

  private async analyzeVolumeDiscountOpportunities(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostOptimizationRecommendation[]> {
    const spendAnalysis = await this.generateSpendAnalysis(tenantId, startDate, endDate);
    const recommendations: CostOptimizationRecommendation[] = [];

    // Find high-spend suppliers where volume discounts might apply
    const highSpendSuppliers = spendAnalysis.spendBySupplier.filter(
      s => s.totalSpend > spendAnalysis.totalSpend * 0.1
    );

    for (const supplier of highSpendSuppliers) {
      if (supplier.orderCount > 20) { // Frequent orders suggest volume opportunity
        const potentialSavings = supplier.totalSpend * 0.08; // Assume 8% volume discount

        recommendations.push({
          type: 'volume_discount',
          title: `Volume Discount Opportunity with ${supplier.supplierName}`,
          description: `High spend volume (${supplier.totalSpend.toLocaleString()}) with frequent orders suggests potential for volume discount negotiations.`,
          potentialSavings,
          priority: potentialSavings > 25000 ? 'high' : 'medium',
          suppliersInvolved: [supplier.supplierId],
          actionItems: [
            'Analyze historical spend patterns',
            'Prepare volume commitment proposal',
            'Negotiate tiered discount structure',
            'Implement volume tracking system',
          ],
          estimatedImplementationTime: '2-4 months',
        });
      }
    }

    return recommendations;
  }

  private async analyzeAlternativeSuppliers(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];
    const performanceMetrics = await this.calculateSupplierPerformanceMetrics(tenantId, startDate, endDate);

    // Find underperforming suppliers with significant spend
    const underperformingSuppliers = performanceMetrics.filter(
      s => s.overallScore < 60 && s.totalSpend > 10000
    );

    for (const supplier of underperformingSuppliers) {
      const potentialSavings = supplier.totalSpend * 0.12; // Assume 12% savings from better supplier

      recommendations.push({
        type: 'alternative_supplier',
        title: `Alternative Supplier for ${supplier.supplierName}`,
        description: `Low performance score (${supplier.overallScore}) with significant spend suggests evaluating alternative suppliers.`,
        potentialSavings,
        priority: supplier.overallScore < 40 ? 'high' : 'medium',
        suppliersInvolved: [supplier.supplierId],
        actionItems: [
          'Research alternative suppliers',
          'Request quotes from alternatives',
          'Conduct supplier evaluations',
          'Plan transition strategy',
        ],
        estimatedImplementationTime: '4-8 months',
      });
    }

    return recommendations;
  }

  private async analyzeNegotiationOpportunities(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];
    const spendAnalysis = await this.generateSpendAnalysis(tenantId, startDate, endDate);

    // Find suppliers with increasing spend trends
    const suppliersWithGrowth = spendAnalysis.spendBySupplier.filter(
      s => s.totalSpend > 50000 // Significant spend threshold
    );

    for (const supplier of suppliersWithGrowth) {
      const potentialSavings = supplier.totalSpend * 0.06; // Assume 6% savings from negotiation

      recommendations.push({
        type: 'negotiation',
        title: `Contract Renegotiation with ${supplier.supplierName}`,
        description: `High spend volume provides leverage for contract renegotiation and better terms.`,
        potentialSavings,
        priority: supplier.totalSpend > 100000 ? 'high' : 'medium',
        suppliersInvolved: [supplier.supplierId],
        actionItems: [
          'Analyze current contract terms',
          'Benchmark market rates',
          'Prepare negotiation strategy',
          'Schedule contract review meetings',
        ],
        estimatedImplementationTime: '2-3 months',
      });
    }

    return recommendations;
  }

  private async calculateAverageProcessingTime(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // This would calculate the average time from PO creation to completion
    // For now, return a placeholder value
    return 14; // 14 days average processing time
  }

  private async calculateTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    spendTrend: 'increasing' | 'decreasing' | 'stable';
    supplierCountTrend: 'increasing' | 'decreasing' | 'stable';
    performanceTrend: 'improving' | 'declining' | 'stable';
  }> {
    // Calculate trends by comparing current period with previous period
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = new Date(startDate);

    const [currentSpend, previousSpend] = await Promise.all([
      this.generateSpendAnalysis(tenantId, startDate, endDate),
      this.generateSpendAnalysis(tenantId, previousStartDate, previousEndDate),
    ]);

    const spendChange = (currentSpend.totalSpend - previousSpend.totalSpend) / Math.max(1, previousSpend.totalSpend);
    const supplierCountChange = (currentSpend.spendBySupplier.length - previousSpend.spendBySupplier.length) / Math.max(1, previousSpend.spendBySupplier.length);

    return {
      spendTrend: spendChange > 0.1 ? 'increasing' : spendChange < -0.1 ? 'decreasing' : 'stable',
      supplierCountTrend: supplierCountChange > 0.1 ? 'increasing' : supplierCountChange < -0.1 ? 'decreasing' : 'stable',
      performanceTrend: 'stable', // Would need more complex calculation
    };
  }

  private async generateAlerts(tenantId: string): Promise<Array<{
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>> {
    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      title: string;
      message: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 1);

    // Check for overdue purchase orders
    const overdueOrders = await this.purchaseOrderRepository.findMany(tenantId, {
      status: PurchaseOrderStatus.SENT_TO_SUPPLIER,
      deliveryDateTo: endDate.toISOString(),
      page: 1,
      limit: 100,
    });

    if (overdueOrders.purchaseOrders.length > 0) {
      alerts.push({
        type: 'warning' as const,
        title: 'Overdue Purchase Orders',
        message: `${overdueOrders.purchaseOrders.length} purchase orders are overdue for delivery`,
        priority: 'high' as const,
      });
    }

    // Check for suppliers needing evaluation
    const suppliersNeedingEvaluation = await this.supplierRepository.findSuppliersNeedingEvaluation(tenantId);
    if (suppliersNeedingEvaluation.length > 0) {
      alerts.push({
        type: 'info' as const,
        title: 'Supplier Evaluations Due',
        message: `${suppliersNeedingEvaluation.length} suppliers are due for performance evaluation`,
        priority: 'medium' as const,
      });
    }

    return alerts;
  }
}