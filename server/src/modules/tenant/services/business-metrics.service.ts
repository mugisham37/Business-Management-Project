import { Injectable } from '@nestjs/common';
import { BusinessTier } from '../entities/tenant.entity';
import { BusinessMetricsDto } from '../dto/tenant.dto';
import { CustomLoggerService } from '../../logger/logger.service';

export interface BusinessMetrics {
  employeeCount: number;
  locationCount: number;
  monthlyTransactionVolume: number;
  monthlyRevenue: number;
}

export interface TierThresholds {
  employeeCount: number;
  locationCount: number;
  monthlyTransactionVolume: number;
  monthlyRevenue: number; // in cents
}

@Injectable()
export class BusinessMetricsService {
  private readonly tierThresholds: Record<BusinessTier, TierThresholds> = {
    [BusinessTier.MICRO]: {
      employeeCount: 0,
      locationCount: 1,
      monthlyTransactionVolume: 0,
      monthlyRevenue: 0,
    },
    [BusinessTier.SMALL]: {
      employeeCount: 5,
      locationCount: 1,
      monthlyTransactionVolume: 100,
      monthlyRevenue: 500000, // $5,000
    },
    [BusinessTier.MEDIUM]: {
      employeeCount: 20,
      locationCount: 2,
      monthlyTransactionVolume: 1000,
      monthlyRevenue: 5000000, // $50,000
    },
    [BusinessTier.ENTERPRISE]: {
      employeeCount: 100,
      locationCount: 5,
      monthlyTransactionVolume: 10000,
      monthlyRevenue: 50000000, // $500,000
    },
  };

  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Calculate business tier based on current metrics
   */
  calculateBusinessTier(metrics: BusinessMetrics): BusinessTier {
    const { employeeCount, locationCount, monthlyTransactionVolume, monthlyRevenue } = metrics;

    // Check for Enterprise tier
    if (this.meetsThreshold(metrics, BusinessTier.ENTERPRISE)) {
      return BusinessTier.ENTERPRISE;
    }

    // Check for Medium tier
    if (this.meetsThreshold(metrics, BusinessTier.MEDIUM)) {
      return BusinessTier.MEDIUM;
    }

    // Check for Small tier
    if (this.meetsThreshold(metrics, BusinessTier.SMALL)) {
      return BusinessTier.SMALL;
    }

    // Default to Micro tier
    return BusinessTier.MICRO;
  }

  /**
   * Check if metrics meet the threshold for a specific tier
   */
  private meetsThreshold(metrics: BusinessMetrics, tier: BusinessTier): boolean {
    const threshold = this.tierThresholds[tier];
    
    // Must meet at least 2 out of 4 criteria to qualify for a tier
    let criteriaMetCount = 0;

    if (metrics.employeeCount >= threshold.employeeCount) {
      criteriaMetCount++;
    }

    if (metrics.locationCount >= threshold.locationCount) {
      criteriaMetCount++;
    }

    if (metrics.monthlyTransactionVolume >= threshold.monthlyTransactionVolume) {
      criteriaMetCount++;
    }

    if (metrics.monthlyRevenue >= threshold.monthlyRevenue) {
      criteriaMetCount++;
    }

    return criteriaMetCount >= 2;
  }

  /**
   * Get the next tier and requirements for upgrade
   */
  getUpgradeRequirements(currentTier: BusinessTier): {
    nextTier: BusinessTier | null;
    requirements: TierThresholds | null;
    missingCriteria: string[];
  } {
    const tierOrder = [BusinessTier.MICRO, BusinessTier.SMALL, BusinessTier.MEDIUM, BusinessTier.ENTERPRISE];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
      return {
        nextTier: null,
        requirements: null,
        missingCriteria: [],
      };
    }

    const nextTier = tierOrder[currentIndex + 1] as BusinessTier;
    const requirements = this.tierThresholds[nextTier];

    return {
      nextTier,
      requirements,
      missingCriteria: this.getMissingCriteria(nextTier),
    };
  }

  /**
   * Get missing criteria for a specific tier
   */
  private getMissingCriteria(tier: BusinessTier): string[] {
    const threshold = this.tierThresholds[tier];
    const criteria = [];

    criteria.push(`${threshold.employeeCount}+ employees`);
    criteria.push(`${threshold.locationCount}+ locations`);
    criteria.push(`${threshold.monthlyTransactionVolume}+ monthly transactions`);
    criteria.push(`$${(threshold.monthlyRevenue / 100).toLocaleString()}+ monthly revenue`);

    return criteria;
  }

  /**
   * Calculate tier progression percentage
   */
  calculateTierProgress(metrics: BusinessMetrics, currentTier: BusinessTier): {
    currentTierProgress: number;
    nextTierProgress: number;
  } {
    const tierOrder = [BusinessTier.MICRO, BusinessTier.SMALL, BusinessTier.MEDIUM, BusinessTier.ENTERPRISE];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === -1) {
      return { currentTierProgress: 0, nextTierProgress: 0 };
    }

    // Calculate progress within current tier (always 100% if qualified)
    const currentTierProgress = this.meetsThreshold(metrics, currentTier) ? 100 : 0;

    // Calculate progress toward next tier
    let nextTierProgress = 0;
    if (currentIndex < tierOrder.length - 1) {
      const nextTier = tierOrder[currentIndex + 1] as BusinessTier;
      nextTierProgress = this.calculateProgressTowardTier(metrics, nextTier);
    }

    return { currentTierProgress, nextTierProgress };
  }

  /**
   * Calculate progress percentage toward a specific tier
   */
  private calculateProgressTowardTier(metrics: BusinessMetrics, targetTier: BusinessTier): number {
    const threshold = this.tierThresholds[targetTier];
    let totalProgress = 0;

    // Employee count progress (25% weight)
    const employeeProgress = Math.min(metrics.employeeCount / threshold.employeeCount, 1) * 25;
    totalProgress += employeeProgress;

    // Location count progress (25% weight)
    const locationProgress = Math.min(metrics.locationCount / threshold.locationCount, 1) * 25;
    totalProgress += locationProgress;

    // Transaction volume progress (25% weight)
    const transactionProgress = Math.min(metrics.monthlyTransactionVolume / threshold.monthlyTransactionVolume, 1) * 25;
    totalProgress += transactionProgress;

    // Revenue progress (25% weight)
    const revenueProgress = Math.min(metrics.monthlyRevenue / threshold.monthlyRevenue, 1) * 25;
    totalProgress += revenueProgress;

    return Math.round(totalProgress);
  }

  /**
   * Get tier benefits and features
   */
  getTierBenefits(tier: BusinessTier): {
    features: string[];
    limits: Record<string, number>;
    description: string;
  } {
    const benefits = {
      [BusinessTier.MICRO]: {
        description: 'Perfect for solo entrepreneurs and micro-businesses',
        features: [
          'Basic POS functionality',
          'Simple inventory tracking',
          'Customer management',
          'Basic reporting',
          'Email support',
        ],
        limits: {
          employees: 5,
          locations: 1,
          monthlyTransactions: 1000,
          products: 100,
          customers: 500,
        },
      },
      [BusinessTier.SMALL]: {
        description: 'Ideal for small businesses with growing needs',
        features: [
          'Advanced POS features',
          'Multi-location inventory',
          'Employee management',
          'Advanced reporting',
          'Email & chat support',
          'Basic integrations',
        ],
        limits: {
          employees: 20,
          locations: 3,
          monthlyTransactions: 10000,
          products: 1000,
          customers: 5000,
        },
      },
      [BusinessTier.MEDIUM]: {
        description: 'Comprehensive solution for medium-sized businesses',
        features: [
          'Full POS suite',
          'Advanced inventory management',
          'HR & payroll',
          'Financial management',
          'Custom reporting',
          'Priority support',
          'Advanced integrations',
          'API access',
        ],
        limits: {
          employees: 100,
          locations: 10,
          monthlyTransactions: 100000,
          products: 10000,
          customers: 50000,
        },
      },
      [BusinessTier.ENTERPRISE]: {
        description: 'Enterprise-grade platform for large organizations',
        features: [
          'Complete business platform',
          'Warehouse management',
          'B2B operations',
          'Advanced analytics',
          'Custom integrations',
          'Dedicated support',
          'SLA guarantees',
          'Custom development',
          'White-label options',
        ],
        limits: {
          employees: -1, // Unlimited
          locations: -1, // Unlimited
          monthlyTransactions: -1, // Unlimited
          products: -1, // Unlimited
          customers: -1, // Unlimited
        },
      },
    };

    return benefits[tier];
  }

  /**
   * Validate business metrics
   */
  validateMetrics(metrics: BusinessMetricsDto): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (metrics.employeeCount < 0) {
      errors.push('Employee count cannot be negative');
    }

    if (metrics.locationCount < 1) {
      errors.push('Location count must be at least 1');
    }

    if (metrics.monthlyTransactionVolume < 0) {
      errors.push('Monthly transaction volume cannot be negative');
    }

    if (metrics.monthlyRevenue < 0) {
      errors.push('Monthly revenue cannot be negative');
    }

    // Business logic validations
    if (metrics.employeeCount > 0 && metrics.monthlyRevenue === 0) {
      errors.push('Businesses with employees should have some revenue');
    }

    if (metrics.monthlyTransactionVolume > 0 && metrics.monthlyRevenue === 0) {
      errors.push('Businesses with transactions should have some revenue');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get recommended actions for tier improvement
   */
  getRecommendedActions(metrics: BusinessMetrics, currentTier: BusinessTier): string[] {
    const { nextTier, requirements } = this.getUpgradeRequirements(currentTier);
    
    if (!nextTier || !requirements) {
      return ['You have reached the highest tier! Focus on optimizing your operations.'];
    }

    const actions: string[] = [];

    if (metrics.employeeCount < requirements.employeeCount) {
      const needed = requirements.employeeCount - metrics.employeeCount;
      actions.push(`Hire ${needed} more employee${needed > 1 ? 's' : ''} to reach ${requirements.employeeCount}+ employees`);
    }

    if (metrics.locationCount < requirements.locationCount) {
      const needed = requirements.locationCount - metrics.locationCount;
      actions.push(`Open ${needed} more location${needed > 1 ? 's' : ''} to reach ${requirements.locationCount}+ locations`);
    }

    if (metrics.monthlyTransactionVolume < requirements.monthlyTransactionVolume) {
      const needed = requirements.monthlyTransactionVolume - metrics.monthlyTransactionVolume;
      actions.push(`Increase monthly transactions by ${needed} to reach ${requirements.monthlyTransactionVolume}+`);
    }

    if (metrics.monthlyRevenue < requirements.monthlyRevenue) {
      const needed = (requirements.monthlyRevenue - metrics.monthlyRevenue) / 100;
      actions.push(`Increase monthly revenue by $${needed.toLocaleString()} to reach $${(requirements.monthlyRevenue / 100).toLocaleString()}+`);
    }

    return actions;
  }
}