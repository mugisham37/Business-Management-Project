import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InventoryMovementRepository } from '../repositories/inventory-movement.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

// Enhanced movement tracking DTOs
export interface DetailedMovementQueryDto {
  productId?: string;
  variantId?: string;
  locationId?: string;
  movementType?: string;
  referenceType?: string;
  referenceId?: string;
  batchNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  includeSystemMovements?: boolean;
  includeAdjustments?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'quantity' | 'movementType' | 'newLevel';
  sortOrder?: 'asc' | 'desc';
}

export interface MovementAnalysisDto {
  productId?: string;
  locationId?: string;
  analysisType: 'velocity' | 'patterns' | 'accuracy' | 'trends';
  periodDays?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MovementVelocityAnalysis {
  productId: string;
  locationId: string;
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  velocity: {
    averageDailyMovement: number;
    totalInbound: number;
    totalOutbound: number;
    netMovement: number;
    movementFrequency: number; // movements per day
    peakMovementDay: Date;
    slowestMovementDay: Date;
  };
  patterns: {
    mostCommonMovementType: string;
    averageMovementSize: number;
    largestSingleMovement: number;
    smallestSingleMovement: number;
  };
  accuracy: {
    adjustmentCount: number;
    adjustmentPercentage: number;
    totalAdjustmentValue: number;
    averageAdjustmentSize: number;
  };
}

export interface MovementPatternAnalysis {
  locationId?: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  patterns: {
    hourlyDistribution: { [hour: string]: number };
    dailyDistribution: { [day: string]: number };
    monthlyDistribution: { [month: string]: number };
    movementTypeDistribution: { [type: string]: number };
    userActivityDistribution: { [userId: string]: number };
  };
  trends: {
    increasingMovements: boolean;
    seasonalPatterns: boolean;
    peakHours: string[];
    peakDays: string[];
  };
}

export interface InventoryAccuracyMetrics {
  locationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  accuracy: {
    totalProducts: number;
    productsWithAdjustments: number;
    accuracyPercentage: number;
    totalAdjustments: number;
    totalAdjustmentValue: number;
    averageAdjustmentPerProduct: number;
  };
  categories: {
    categoryId: string;
    categoryName: string;
    accuracyPercentage: number;
    adjustmentCount: number;
    adjustmentValue: number;
  }[];
  topAdjustmentReasons: {
    reason: string;
    count: number;
    totalValue: number;
  }[];
}

// Domain events for enhanced tracking
export class DetailedMovementCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly movementId: string,
    public readonly productId: string,
    public readonly locationId: string,
    public readonly movementType: string,
    public readonly quantity: number,
    public readonly userId: string,
    public readonly metadata: any,
  ) {}
}

export class MovementPatternDetectedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly locationId: string,
    public readonly patternType: string,
    public readonly description: string,
    public readonly severity: 'low' | 'medium' | 'high',
    public readonly metadata: any,
  ) {}
}

export class InventoryAccuracyAlertEvent {
  constructor(
    public readonly tenantId: string,
    public readonly locationId: string,
    public readonly accuracyPercentage: number,
    public readonly threshold: number,
    public readonly period: string,
  ) {}
}

@Injectable()
export class InventoryMovementTrackingService {
  constructor(
    private readonly movementRepository: InventoryMovementRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly cacheService: IntelligentCacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getDetailedMovementHistory(
    tenantId: string,
    query: DetailedMovementQueryDto,
  ): Promise<{
    movements: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: {
      totalInbound: number;
      totalOutbound: number;
      netMovement: number;
      uniqueProducts: number;
      movementTypes: { [type: string]: number };
      valueImpact: number;
    };
  }> {
    const cacheKey = `movement-tracking:${tenantId}:detailed:${JSON.stringify(query)}`;
    let result = await this.cacheService.get<{
      movements: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      summary: {
        totalInbound: number;
        totalOutbound: number;
        netMovement: number;
        uniqueProducts: number;
        movementTypes: { [type: string]: number };
        valueImpact: number;
      };
    }>(cacheKey);

    if (!result) {
      // Get movements with enhanced filtering
      const movementQuery: any = {
        page: query.page || 1,
        limit: query.limit || 100,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
      };

      // Only add optional properties if they are defined
      if (query.productId !== undefined) movementQuery.productId = query.productId;
      if (query.locationId !== undefined) movementQuery.locationId = query.locationId;
      if (query.movementType !== undefined) movementQuery.movementType = query.movementType;
      if (query.dateFrom !== undefined) movementQuery.dateFrom = query.dateFrom;
      if (query.dateTo !== undefined) movementQuery.dateTo = query.dateTo;

      const movements = await this.movementRepository.findMany(tenantId, movementQuery);

      // Calculate summary statistics
      let totalInbound = 0;
      let totalOutbound = 0;
      let valueImpact = 0;
      const uniqueProducts = new Set<string>();
      const movementTypes: { [type: string]: number } = {};

      for (const movement of movements) {
        if (movement.quantity > 0) {
          totalInbound += movement.quantity;
        } else {
          totalOutbound += Math.abs(movement.quantity);
        }

        if (movement.totalCost) {
          valueImpact += movement.totalCost;
        }

        uniqueProducts.add(movement.productId);
        movementTypes[movement.movementType] = (movementTypes[movement.movementType] || 0) + 1;
      }

      const summary = {
        totalInbound,
        totalOutbound,
        netMovement: totalInbound - totalOutbound,
        uniqueProducts: uniqueProducts.size,
        movementTypes,
        valueImpact,
      };

      result = {
        movements,
        total: movements.length,
        page: query.page || 1,
        limit: query.limit || 100,
        totalPages: Math.ceil(movements.length / (query.limit || 100)),
        summary,
      };

      await this.cacheService.set(cacheKey, result, { ttl: 300 }); // 5 minutes
    }

    return result;
  }

  async analyzeMovementVelocity(
    tenantId: string,
    productId: string,
    locationId: string,
    periodDays: number = 30,
  ): Promise<MovementVelocityAnalysis> {
    const cacheKey = `movement-tracking:${tenantId}:velocity:${productId}:${locationId}:${periodDays}`;
    let analysis = await this.cacheService.get<MovementVelocityAnalysis>(cacheKey);

    if (!analysis) {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const movements = await this.movementRepository.findMany(tenantId, {
        productId,
        locationId,
        dateFrom: startDate,
        dateTo: endDate,
        limit: 10000,
      });

      // Calculate velocity metrics
      let totalInbound = 0;
      let totalOutbound = 0;
      let adjustmentCount = 0;
      let totalAdjustmentValue = 0;
      const dailyMovements: { [date: string]: number } = {};
      const movementSizes: number[] = [];
      const movementTypes: { [type: string]: number } = {};

      for (const movement of movements) {
        const dateKey = movement.createdAt?.toISOString().split('T')[0];
        if (dateKey) {
          dailyMovements[dateKey] = (dailyMovements[dateKey] || 0) + 1;
        }

        if (movement.quantity > 0) {
          totalInbound += movement.quantity;
        } else {
          totalOutbound += Math.abs(movement.quantity);
        }

        movementSizes.push(Math.abs(movement.quantity));
        movementTypes[movement.movementType] = (movementTypes[movement.movementType] || 0) + 1;

        if (movement.movementType === 'adjustment') {
          adjustmentCount++;
          if (movement.totalCost) {
            totalAdjustmentValue += Math.abs(movement.totalCost);
          }
        }
      }

      const totalMovements = movements.length;
      const averageDailyMovement = totalMovements / periodDays;
      const netMovement = totalInbound - totalOutbound;

      // Find peak and slowest days
      const sortedDays = Object.entries(dailyMovements).sort((a, b) => b[1] - a[1]);
      const peakMovementDay = sortedDays.length > 0 && sortedDays[0] ? new Date(sortedDays[0][0]) : startDate;
      const slowestMovementDay = sortedDays.length > 0 && sortedDays[sortedDays.length - 1] ? 
        new Date(sortedDays[sortedDays.length - 1]![0]) : startDate;

      // Find most common movement type
      const mostCommonMovementType = Object.entries(movementTypes)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

      analysis = {
        productId,
        locationId,
        period: {
          startDate,
          endDate,
          days: periodDays,
        },
        velocity: {
          averageDailyMovement,
          totalInbound,
          totalOutbound,
          netMovement,
          movementFrequency: averageDailyMovement,
          peakMovementDay,
          slowestMovementDay,
        },
        patterns: {
          mostCommonMovementType,
          averageMovementSize: movementSizes.length > 0 ? 
            movementSizes.reduce((a, b) => a + b, 0) / movementSizes.length : 0,
          largestSingleMovement: Math.max(...movementSizes, 0),
          smallestSingleMovement: Math.min(...movementSizes, 0),
        },
        accuracy: {
          adjustmentCount,
          adjustmentPercentage: totalMovements > 0 ? (adjustmentCount / totalMovements) * 100 : 0,
          totalAdjustmentValue,
          averageAdjustmentSize: adjustmentCount > 0 ? totalAdjustmentValue / adjustmentCount : 0,
        },
      };

      await this.cacheService.set(cacheKey, analysis, { ttl: 600 }); // 10 minutes
    }

    return analysis;
  }

  async analyzeMovementPatterns(
    tenantId: string,
    locationId?: string,
    periodDays: number = 30,
  ): Promise<MovementPatternAnalysis> {
    const cacheKey = `movement-tracking:${tenantId}:patterns:${locationId || 'all'}:${periodDays}`;
    let analysis = await this.cacheService.get<MovementPatternAnalysis>(cacheKey);

    if (!analysis) {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const movementQuery: any = {
        dateFrom: startDate,
        dateTo: endDate,
        limit: 50000,
      };

      // Only add locationId if it's defined
      if (locationId !== undefined) {
        movementQuery.locationId = locationId;
      }

      const movements = await this.movementRepository.findMany(tenantId, movementQuery);

      // Initialize distribution objects
      const hourlyDistribution: { [hour: string]: number } = {};
      const dailyDistribution: { [day: string]: number } = {};
      const monthlyDistribution: { [month: string]: number } = {};
      const movementTypeDistribution: { [type: string]: number } = {};
      const userActivityDistribution: { [userId: string]: number } = {};

      // Analyze patterns
      for (const movement of movements) {
        const date = movement.createdAt;
        const hour = date.getHours().toString();
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        const month = date.toLocaleDateString('en-US', { month: 'long' });

        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
        dailyDistribution[day] = (dailyDistribution[day] || 0) + 1;
        monthlyDistribution[month] = (monthlyDistribution[month] || 0) + 1;
        movementTypeDistribution[movement.movementType] = 
          (movementTypeDistribution[movement.movementType] || 0) + 1;
        
        if (movement.createdBy) {
          userActivityDistribution[movement.createdBy] = 
            (userActivityDistribution[movement.createdBy] || 0) + 1;
        }
      }

      // Identify trends
      const peakHours = Object.entries(hourlyDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => hour);

      const peakDays = Object.entries(dailyDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([day]) => day);

      // Simple trend analysis (increasing movements over time)
      const firstHalf = movements.filter(m => 
        m.createdAt < new Date(startDate.getTime() + (periodDays / 2) * 24 * 60 * 60 * 1000)
      ).length;
      const secondHalf = movements.length - firstHalf;
      const increasingMovements = secondHalf > firstHalf;

      // Basic seasonal pattern detection (more sophisticated analysis could be added)
      const seasonalPatterns = Object.values(monthlyDistribution).some((count, index, arr) => {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        return Math.abs(count - avg) > avg * 0.3; // 30% deviation indicates seasonality
      });

      const analysis: MovementPatternAnalysis = {
        period: {
          startDate,
          endDate,
        },
        patterns: {
          hourlyDistribution,
          dailyDistribution,
          monthlyDistribution,
          movementTypeDistribution,
          userActivityDistribution,
        },
        trends: {
          increasingMovements,
          seasonalPatterns,
          peakHours,
          peakDays,
        },
      };

      // Only add locationId if it's defined
      if (locationId !== undefined) {
        analysis.locationId = locationId;
      }

      await this.cacheService.set(cacheKey, analysis, { ttl: 600 }); // 10 minutes
    }

    return analysis!;
  }

  async calculateInventoryAccuracy(
    tenantId: string,
    locationId: string,
    periodDays: number = 30,
  ): Promise<InventoryAccuracyMetrics> {
    const cacheKey = `movement-tracking:${tenantId}:accuracy:${locationId}:${periodDays}`;
    let metrics = await this.cacheService.get<InventoryAccuracyMetrics>(cacheKey);

    if (!metrics) {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // Get all adjustments in the period
      const adjustments = await this.movementRepository.findMany(tenantId, {
        locationId,
        movementType: 'adjustment',
        dateFrom: startDate,
        dateTo: endDate,
        limit: 10000,
      });

      // Get all products in location
      const inventoryLevels = await this.inventoryRepository.findMany(tenantId, {
        locationId,
        limit: 10000,
      });

      const totalProducts = inventoryLevels.inventoryLevels.length;
      const productsWithAdjustments = new Set(adjustments.map(adj => adj.productId)).size;
      const totalAdjustments = adjustments.length;
      let totalAdjustmentValue = 0;

      // Calculate adjustment reasons
      const adjustmentReasons: { [reason: string]: { count: number; totalValue: number } } = {};

      for (const adjustment of adjustments) {
        if (adjustment.totalCost) {
          totalAdjustmentValue += Math.abs(adjustment.totalCost);
        }

        const reason = adjustment.reason || 'unknown';
        if (!adjustmentReasons[reason]) {
          adjustmentReasons[reason] = { count: 0, totalValue: 0 };
        }
        adjustmentReasons[reason]!.count++;
        if (adjustment.totalCost) {
          adjustmentReasons[reason]!.totalValue += Math.abs(adjustment.totalCost);
        }
      }

      const accuracyPercentage = totalProducts > 0 ? 
        ((totalProducts - productsWithAdjustments) / totalProducts) * 100 : 100;

      const topAdjustmentReasons = Object.entries(adjustmentReasons)
        .map(([reason, data]) => ({
          reason,
          count: data.count,
          totalValue: data.totalValue,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate category-level accuracy (simplified - would need product categories)
      const categories = [{
        categoryId: 'all',
        categoryName: 'All Products',
        accuracyPercentage,
        adjustmentCount: totalAdjustments,
        adjustmentValue: totalAdjustmentValue,
      }];

      metrics = {
        locationId,
        period: {
          startDate,
          endDate,
        },
        accuracy: {
          totalProducts,
          productsWithAdjustments,
          accuracyPercentage,
          totalAdjustments,
          totalAdjustmentValue,
          averageAdjustmentPerProduct: totalProducts > 0 ? totalAdjustments / totalProducts : 0,
        },
        categories,
        topAdjustmentReasons,
      };

      // Emit accuracy alert if below threshold
      const accuracyThreshold = 95; // 95% accuracy threshold
      if (accuracyPercentage < accuracyThreshold) {
        this.eventEmitter.emit('inventory.accuracy.alert', new InventoryAccuracyAlertEvent(
          tenantId,
          locationId,
          accuracyPercentage,
          accuracyThreshold,
          `${periodDays} days`,
        ));
      }

      await this.cacheService.set(cacheKey, metrics, { ttl: 600 }); // 10 minutes
    }

    return metrics;
  }

  async getMovementAuditTrail(
    tenantId: string,
    productId: string,
    locationId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<{
    movements: any[];
    summary: {
      totalMovements: number;
      periodStart: Date;
      periodEnd: Date;
      startingLevel: number;
      endingLevel: number;
      netChange: number;
      adjustmentCount: number;
    };
  }> {
    const cacheKey = `movement-tracking:${tenantId}:audit:${productId}:${locationId || 'all'}:${dateFrom?.getTime()}:${dateTo?.getTime()}`;
    let result = await this.cacheService.get<{
      movements: any[];
      summary: {
        totalMovements: number;
        periodStart: Date;
        periodEnd: Date;
        startingLevel: number;
        endingLevel: number;
        netChange: number;
        adjustmentCount: number;
      };
    }>(cacheKey);

    if (!result) {
      const movementQuery: any = {
        productId,
        sortBy: 'createdAt',
        sortOrder: 'asc',
        limit: 10000,
      };

      // Only add optional properties if they are defined
      if (locationId !== undefined) movementQuery.locationId = locationId;
      if (dateFrom !== undefined) movementQuery.dateFrom = dateFrom;
      if (dateTo !== undefined) movementQuery.dateTo = dateTo;

      const movements = await this.movementRepository.findMany(tenantId, movementQuery);

      let startingLevel = 0;
      let endingLevel = 0;
      let adjustmentCount = 0;

      if (movements.length > 0) {
        startingLevel = movements[0]?.previousLevel ?? 0;
        endingLevel = movements[movements.length - 1]?.newLevel ?? 0;
        adjustmentCount = movements.filter(m => m.movementType === 'adjustment').length;
      }

      const summary = {
        totalMovements: movements.length,
        periodStart: dateFrom || (movements.length > 0 ? movements[0]?.createdAt ?? new Date() : new Date()),
        periodEnd: dateTo || (movements.length > 0 ? movements[movements.length - 1]?.createdAt ?? new Date() : new Date()),
        startingLevel,
        endingLevel,
        netChange: endingLevel - startingLevel,
        adjustmentCount,
      };

      result = {
        movements,
        summary,
      };

      await this.cacheService.set(cacheKey, result, { ttl: 300 }); // 5 minutes
    }

    return result;
  }

  async detectAnomalousMovements(
    tenantId: string,
    locationId?: string,
    lookbackDays: number = 7,
  ): Promise<{
    anomalies: any[];
    summary: {
      totalAnomalies: number;
      severityDistribution: { [severity: string]: number };
      mostCommonAnomalyType: string;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

    const movementQuery: any = {
      dateFrom: startDate,
      dateTo: endDate,
      limit: 10000,
    };

    // Only add locationId if it's defined
    if (locationId !== undefined) {
      movementQuery.locationId = locationId;
    }

    const movements = await this.movementRepository.findMany(tenantId, movementQuery);

    const anomalies: any[] = [];
    const severityDistribution: { [severity: string]: number } = {};

    // Detect various types of anomalies
    for (const movement of movements) {
      const anomaly = await this.analyzeMovementForAnomalies(tenantId, movement);
      if (anomaly) {
        anomalies.push(anomaly);
        severityDistribution[anomaly.severity] = (severityDistribution[anomaly.severity] || 0) + 1;
      }
    }

    // Find most common anomaly type
    const anomalyTypes: { [type: string]: number } = {};
    anomalies.forEach(anomaly => {
      anomalyTypes[anomaly.type] = (anomalyTypes[anomaly.type] || 0) + 1;
    });

    const mostCommonAnomalyType = Object.entries(anomalyTypes)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      anomalies,
      summary: {
        totalAnomalies: anomalies.length,
        severityDistribution,
        mostCommonAnomalyType,
      },
    };
  }

  private async analyzeMovementForAnomalies(tenantId: string, movement: any): Promise<any | null> {
    // Large quantity movements
    if (Math.abs(movement.quantity) > 1000) {
      return {
        movementId: movement.id,
        type: 'large_quantity',
        severity: 'medium',
        description: `Unusually large quantity movement: ${movement.quantity}`,
        movement,
      };
    }

    // Frequent adjustments
    if (movement.movementType === 'adjustment') {
      const recentAdjustments = await this.movementRepository.findMany(tenantId, {
        productId: movement.productId,
        locationId: movement.locationId,
        movementType: 'adjustment',
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        limit: 10,
      });

      if (recentAdjustments.length > 3) {
        return {
          movementId: movement.id,
          type: 'frequent_adjustments',
          severity: 'high',
          description: `Multiple adjustments in 24 hours: ${recentAdjustments.length}`,
          movement,
        };
      }
    }

    // Off-hours movements (outside 6 AM - 10 PM)
    const hour = movement.createdAt.getHours();
    if (hour < 6 || hour > 22) {
      return {
        movementId: movement.id,
        type: 'off_hours_movement',
        severity: 'low',
        description: `Movement outside normal hours: ${hour}:00`,
        movement,
      };
    }

    return null;
  }
}
