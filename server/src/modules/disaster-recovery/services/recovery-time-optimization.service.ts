import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';
import { DisasterRecoveryPlan, DisasterRecoveryExecution } from '../entities/disaster-recovery.entity';
import { 
  RTOAnalysisData, 
  RTOExecutionData, 
  RTORecommendation, 
  RTOTrendData, 
  RTOImprovementPlan,
  RTOImprovementStep
} from '../types/disaster-recovery.types';

@Injectable()
export class RecoveryTimeOptimizationService {
  private readonly logger = new Logger(RecoveryTimeOptimizationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly drRepository: DisasterRecoveryRepository,
  ) {}

  /**
   * Analyze RTO performance and provide optimization recommendations
   */
  async analyzeRTOPerformance(tenantId: string, planId: string): Promise<RTOAnalysisData> {
    this.logger.log(`Analyzing RTO performance for plan ${planId}`);

    try {
      const plan = await this.drRepository.findPlanById(planId);
      if (!plan || plan.tenantId !== tenantId) {
        throw new Error(`DR plan ${planId} not found`);
      }

      // Get recent executions for analysis
      const executions = await this.drRepository.findExecutionsByPlan(planId, 10);
      
      // Calculate current average RTO
      const averageRtoMinutes = this.calculateAverageRTO(executions);
      
      // Generate recommendations
      const recommendations = await this.generateRTORecommendations(plan, executions);
      
      // Convert executions to RTOExecutionData
      const recentExecutions: RTOExecutionData[] = executions.map(exec => ({
        executionId: exec.id,
        executedAt: exec.detectedAt,
        actualRtoMinutes: exec.actualRtoMinutes,
        targetRtoMinutes: plan.rtoMinutes,
        variance: exec.actualRtoMinutes - plan.rtoMinutes,
        isTest: exec.isTest,
      }));

      // Calculate performance score (0-100)
      const performanceScore = Math.max(0, Math.min(100, 
        100 - ((averageRtoMinutes - plan.rtoMinutes) / plan.rtoMinutes) * 100
      ));

      return {
        planId,
        averageRtoMinutes,
        targetRtoMinutes: plan.rtoMinutes,
        performanceScore,
        recentExecutions,
        recommendations,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to analyze RTO performance: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Optimize recovery procedures for better RTO
   */
  async optimizeRecoveryProcedures(tenantId: string, planId: string): Promise<{
    optimizedSteps: any[];
    estimatedRtoImprovement: number;
  }> {
    this.logger.log(`Optimizing recovery procedures for plan ${planId}`);

    try {
      const plan = await this.drRepository.findPlanById(planId);
      if (!plan || plan.tenantId !== tenantId) {
        throw new Error(`DR plan ${planId} not found`);
      }

      // Analyze current procedures
      const currentSteps = plan.configuration.recoverySteps || [];
      
      // Optimize step order and parallelization
      const optimizedSteps = this.optimizeStepExecution(currentSteps);
      
      // Calculate estimated improvement
      const estimatedRtoImprovement = this.calculateRTOImprovement(currentSteps, optimizedSteps);

      return {
        optimizedSteps,
        estimatedRtoImprovement,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to optimize recovery procedures: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Monitor RTO trends and identify degradation
   */
  async monitorRTOTrends(tenantId: string): Promise<RTOTrendData[]> {
    this.logger.log(`Monitoring RTO trends for tenant ${tenantId}`);

    try {
      const plans = await this.drRepository.findPlansByTenant(tenantId);
      const trends: RTOTrendData[] = [];

      // Get trend data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const plan of plans) {
        const executions = await this.drRepository.findExecutionsByPlan(plan.id, 50);
        
        // Group executions by day
        const dailyData = new Map<string, { rtoSum: number; count: number; successCount: number }>();
        
        executions.forEach(exec => {
          if (exec.detectedAt >= thirtyDaysAgo) {
            const dateKey = exec.detectedAt.toISOString().split('T')[0];
            if (dateKey) {
              const existing = dailyData.get(dateKey) || { rtoSum: 0, count: 0, successCount: 0 };
              
              existing.rtoSum += exec.actualRtoMinutes;
              existing.count += 1;
              if (exec.status === 'completed') {
                existing.successCount += 1;
              }
              
              dailyData.set(dateKey, existing);
            }
          }
        });

        // Convert to trend data
        dailyData.forEach((data, dateKey) => {
          trends.push({
            timestamp: new Date(dateKey + 'T00:00:00Z'),
            averageRtoMinutes: data.rtoSum / data.count,
            executionCount: data.count,
            successRate: data.successCount / data.count,
          });
        });
      }

      // Sort by timestamp
      trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return trends;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to monitor RTO trends: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Generate RTO improvement plan
   */
  async generateRTOImprovementPlan(tenantId: string, planId: string): Promise<RTOImprovementPlan> {
    this.logger.log(`Generating RTO improvement plan for plan ${planId}`);

    try {
      const analysis = await this.analyzeRTOPerformance(tenantId, planId);
      
      // Group recommendations into improvement steps
      const steps = this.convertRecommendationsToSteps(analysis.recommendations);
      
      // Calculate totals
      const potentialImprovementMinutes = steps.reduce((sum, step) => sum + step.estimatedTimeReduction, 0);
      const totalEstimatedCost = steps.reduce((sum, step) => sum + step.estimatedCost, 0);
      
      return {
        planId,
        currentRtoMinutes: analysis.averageRtoMinutes,
        targetRtoMinutes: analysis.targetRtoMinutes,
        potentialImprovementMinutes,
        steps,
        totalEstimatedCost,
        estimatedImplementationWeeks: Math.max(...steps.map(s => this.getImplementationWeeks(s.priority))),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to generate RTO improvement plan: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private calculateAverageRTO(executions: DisasterRecoveryExecution[]): number {
    if (executions.length === 0) return 0;
    
    const totalRto = executions.reduce((sum, exec) => sum + exec.actualRtoMinutes, 0);
    return totalRto / executions.length;
  }

  private async generateRTORecommendations(
    plan: DisasterRecoveryPlan, 
    executions: DisasterRecoveryExecution[]
  ): Promise<RTORecommendation[]> {
    const recommendations: RTORecommendation[] = [];

    // Analyze execution patterns
    const avgRto = this.calculateAverageRTO(executions);
    
    // Infrastructure recommendations
    if (avgRto > plan.rtoMinutes * 1.5) {
      recommendations.push({
        category: 'Infrastructure',
        priority: 'high',
        description: 'Consider upgrading to faster storage (NVMe SSDs) for database recovery',
        estimatedImprovementMinutes: Math.min(5, avgRto * 0.2),
        implementationEffort: 'medium',
      });
    }

    // Replication recommendations
    if (plan.secondaryRegions.length < 2) {
      recommendations.push({
        category: 'Replication',
        priority: 'medium',
        description: 'Add additional secondary regions to reduce failover distance',
        estimatedImprovementMinutes: 3,
        implementationEffort: 'high',
      });
    }

    // Automation recommendations
    if (!plan.automaticFailover) {
      recommendations.push({
        category: 'Automation',
        priority: 'high',
        description: 'Enable automatic failover to eliminate manual intervention delays',
        estimatedImprovementMinutes: Math.min(10, avgRto * 0.4),
        implementationEffort: 'low',
      });
    }

    // Procedure optimization
    const procedureComplexity = plan.configuration.recoverySteps?.length || 0;
    if (procedureComplexity > 10) {
      recommendations.push({
        category: 'Procedures',
        priority: 'medium',
        description: 'Simplify and parallelize recovery procedures',
        estimatedImprovementMinutes: 2,
        implementationEffort: 'medium',
      });
    }

    // Monitoring recommendations
    recommendations.push({
      category: 'Monitoring',
      priority: 'medium',
      description: 'Implement predictive failure detection to reduce detection time',
      estimatedImprovementMinutes: 1,
      implementationEffort: 'medium',
    });

    return recommendations;
  }

  private convertRecommendationsToSteps(recommendations: RTORecommendation[]): RTOImprovementStep[] {
    return recommendations.map((rec, index) => ({
      stepNumber: index + 1,
      title: `${rec.category} Improvement`,
      description: rec.description,
      estimatedTimeReduction: rec.estimatedImprovementMinutes,
      priority: rec.priority,
      dependencies: [], // Could be enhanced to include actual dependencies
      estimatedCost: this.estimateCost(rec.category, rec.implementationEffort),
    }));
  }

  private estimateCost(category: string, effort: string): number {
    const baseCosts: Record<string, number> = {
      'Infrastructure': 10000,
      'Replication': 5000,
      'Automation': 2000,
      'Procedures': 1000,
      'Monitoring': 3000,
    };

    const effortMultipliers: Record<string, number> = {
      'low': 0.5,
      'medium': 1.0,
      'high': 2.0,
    };

    const baseCost = baseCosts[category] ?? 1000;
    const multiplier = effortMultipliers[effort] ?? 1.0;

    return baseCost * multiplier;
  }

  private getImplementationWeeks(priority: string): number {
    const priorityWeeks: Record<string, number> = {
      'high': 2,
      'medium': 4,
      'low': 8,
    };

    return priorityWeeks[priority] ?? 4;
  }

  private optimizeStepExecution(steps: any[]): any[] {
    // Analyze dependencies and parallelize where possible
    const optimizedSteps = [...steps];
    
    // Sort by priority and dependencies
    optimizedSteps.sort((a, b) => {
      const priorityA = a.priority || 5;
      const priorityB = b.priority || 5;
      return priorityA - priorityB;
    });

    // Add parallelization hints
    optimizedSteps.forEach((step, index) => {
      if (!step.dependencies || step.dependencies.length === 0) {
        step.canParallelize = true;
      }
    });

    return optimizedSteps;
  }

  private calculateRTOImprovement(currentSteps: any[], optimizedSteps: any[]): number {
    // Estimate improvement based on parallelization opportunities
    const parallelizableSteps = optimizedSteps.filter(step => step.canParallelize).length;
    const totalSteps = optimizedSteps.length;
    
    // Rough estimate: 20% improvement for every 25% of parallelizable steps
    const parallelizationRatio = parallelizableSteps / totalSteps;
    return Math.floor(parallelizationRatio * 0.8 * 5); // Up to 4 minutes improvement
  }
}