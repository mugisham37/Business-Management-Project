import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';
import { DisasterRecoveryPlan, DisasterRecoveryExecution } from '../entities/disaster-recovery.entity';

export interface RTOOptimizationRecommendation {
  currentRtoMinutes: number;
  targetRtoMinutes: number;
  recommendations: {
    category: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    estimatedImprovement: number; // minutes
  }[];
  totalPotentialImprovement: number;
}

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
  async analyzeRTOPerformance(tenantId: string, planId: string): Promise<RTOOptimizationRecommendation> {
    this.logger.log(`Analyzing RTO performance for plan ${planId}`);

    try {
      const plan = await this.drRepository.findPlanById(planId);
      if (!plan || plan.tenantId !== tenantId) {
        throw new Error(`DR plan ${planId} not found`);
      }

      // Get recent executions for analysis
      const executions = await this.drRepository.findExecutionsByPlan(planId, 10);
      
      // Calculate current average RTO
      const currentRtoMinutes = this.calculateAverageRTO(executions);
      
      // Generate recommendations
      const recommendations = await this.generateRTORecommendations(plan, executions);
      
      // Calculate total potential improvement
      const totalPotentialImprovement = recommendations.reduce(
        (sum, rec) => sum + rec.estimatedImprovement, 
        0
      );

      return {
        currentRtoMinutes,
        targetRtoMinutes: plan.rtoMinutes,
        recommendations,
        totalPotentialImprovement,
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
  async monitorRTOTrends(tenantId: string): Promise<{
    plans: {
      planId: string;
      planName: string;
      rtoTrend: 'improving' | 'stable' | 'degrading';
      averageRto: number;
      targetRto: number;
      variance: number;
    }[];
    overallTrend: 'improving' | 'stable' | 'degrading';
  }> {
    this.logger.log(`Monitoring RTO trends for tenant ${tenantId}`);

    try {
      const plans = await this.drRepository.findPlansByTenant(tenantId);
      const planTrends = [];

      for (const plan of plans) {
        const executions = await this.drRepository.findExecutionsByPlan(plan.id, 20);
        const trend = this.analyzeTrend(executions);
        
        planTrends.push({
          planId: plan.id,
          planName: plan.name,
          rtoTrend: trend.direction,
          averageRto: trend.averageRto,
          targetRto: plan.rtoMinutes,
          variance: trend.variance,
        });
      }

      // Determine overall trend
      const overallTrend = this.determineOverallTrend(planTrends);

      return {
        plans: planTrends,
        overallTrend,
      };

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
  async generateRTOImprovementPlan(tenantId: string, planId: string): Promise<{
    currentState: {
      averageRto: number;
      targetRto: number;
      gap: number;
    };
    improvementPhases: {
      phase: number;
      name: string;
      actions: string[];
      estimatedImprovement: number;
      effort: 'low' | 'medium' | 'high';
      timeline: string;
    }[];
    totalEstimatedImprovement: number;
  }> {
    this.logger.log(`Generating RTO improvement plan for plan ${planId}`);

    try {
      const analysis = await this.analyzeRTOPerformance(tenantId, planId);
      
      // Group recommendations into phases
      const phases = this.groupRecommendationsIntoPhases(analysis.recommendations);
      
      return {
        currentState: {
          averageRto: analysis.currentRtoMinutes,
          targetRto: analysis.targetRtoMinutes,
          gap: Math.max(0, analysis.currentRtoMinutes - analysis.targetRtoMinutes),
        },
        improvementPhases: phases,
        totalEstimatedImprovement: analysis.totalPotentialImprovement,
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
  ): Promise<RTOOptimizationRecommendation['recommendations']> {
    const recommendations = [];

    // Analyze execution patterns
    const avgRto = this.calculateAverageRTO(executions);
    
    // Infrastructure recommendations
    if (avgRto > plan.rtoMinutes * 1.5) {
      recommendations.push({
        category: 'Infrastructure',
        description: 'Consider upgrading to faster storage (NVMe SSDs) for database recovery',
        impact: 'high' as const,
        effort: 'medium' as const,
        estimatedImprovement: Math.min(5, avgRto * 0.2),
      });
    }

    // Replication recommendations
    if (plan.secondaryRegions.length < 2) {
      recommendations.push({
        category: 'Replication',
        description: 'Add additional secondary regions to reduce failover distance',
        impact: 'medium' as const,
        effort: 'high' as const,
        estimatedImprovement: 3,
      });
    }

    // Automation recommendations
    if (!plan.automaticFailover) {
      recommendations.push({
        category: 'Automation',
        description: 'Enable automatic failover to eliminate manual intervention delays',
        impact: 'high' as const,
        effort: 'low' as const,
        estimatedImprovement: Math.min(10, avgRto * 0.4),
      });
    }

    // Procedure optimization
    const procedureComplexity = plan.configuration.recoverySteps?.length || 0;
    if (procedureComplexity > 10) {
      recommendations.push({
        category: 'Procedures',
        description: 'Simplify and parallelize recovery procedures',
        impact: 'medium' as const,
        effort: 'medium' as const,
        estimatedImprovement: 2,
      });
    }

    // Monitoring recommendations
    recommendations.push({
      category: 'Monitoring',
      description: 'Implement predictive failure detection to reduce detection time',
      impact: 'medium' as const,
      effort: 'medium' as const,
      estimatedImprovement: 1,
    });

    return recommendations;
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

  private analyzeTrend(executions: DisasterRecoveryExecution[]): {
    direction: 'improving' | 'stable' | 'degrading';
    averageRto: number;
    variance: number;
  } {
    if (executions.length < 3) {
      const firstExecution = executions[0];
      return {
        direction: 'stable',
        averageRto: firstExecution ? (firstExecution.actualRtoMinutes ?? 0) : 0,
        variance: 0,
      };
    }

    // Sort by date
    const sortedExecutions = executions.sort((a, b) => 
      a.detectedAt.getTime() - b.detectedAt.getTime()
    );

    // Calculate trend
    const rtoValues = sortedExecutions.map(e => e.actualRtoMinutes ?? 0);
    const averageRto = rtoValues.reduce((sum, rto) => sum + rto, 0) / rtoValues.length;
    
    // Calculate variance
    const variance = rtoValues.reduce((sum, rto) => sum + Math.pow(rto - averageRto, 2), 0) / rtoValues.length;
    
    // Determine trend direction
    const recentAvg = rtoValues.slice(-3).reduce((sum, rto) => sum + rto, 0) / 3;
    const olderAvg = rtoValues.slice(0, 3).reduce((sum, rto) => sum + rto, 0) / 3;
    
    let direction: 'improving' | 'stable' | 'degrading';
    if (recentAvg < olderAvg * 0.9) {
      direction = 'improving';
    } else if (recentAvg > olderAvg * 1.1) {
      direction = 'degrading';
    } else {
      direction = 'stable';
    }

    return {
      direction,
      averageRto,
      variance,
    };
  }

  private determineOverallTrend(planTrends: any[]): 'improving' | 'stable' | 'degrading' {
    if (planTrends.length === 0) return 'stable';
    
    const improvingCount = planTrends.filter(p => p.rtoTrend === 'improving').length;
    const degradingCount = planTrends.filter(p => p.rtoTrend === 'degrading').length;
    
    if (improvingCount > degradingCount) {
      return 'improving';
    } else if (degradingCount > improvingCount) {
      return 'degrading';
    } else {
      return 'stable';
    }
  }

  private groupRecommendationsIntoPhases(recommendations: any[]): any[] {
    // Group by effort and impact
    const quickWins = recommendations.filter(r => r.effort === 'low' && r.impact === 'high');
    const mediumEffort = recommendations.filter(r => r.effort === 'medium');
    const highEffort = recommendations.filter(r => r.effort === 'high');

    const phases = [];

    if (quickWins.length > 0) {
      phases.push({
        phase: 1,
        name: 'Quick Wins',
        actions: quickWins.map(r => r.description),
        estimatedImprovement: quickWins.reduce((sum, r) => sum + r.estimatedImprovement, 0),
        effort: 'low' as const,
        timeline: '1-2 weeks',
      });
    }

    if (mediumEffort.length > 0) {
      phases.push({
        phase: phases.length + 1,
        name: 'Medium-term Improvements',
        actions: mediumEffort.map(r => r.description),
        estimatedImprovement: mediumEffort.reduce((sum, r) => sum + r.estimatedImprovement, 0),
        effort: 'medium' as const,
        timeline: '1-2 months',
      });
    }

    if (highEffort.length > 0) {
      phases.push({
        phase: phases.length + 1,
        name: 'Strategic Initiatives',
        actions: highEffort.map(r => r.description),
        estimatedImprovement: highEffort.reduce((sum, r) => sum + r.estimatedImprovement, 0),
        effort: 'high' as const,
        timeline: '3-6 months',
      });
    }

    return phases;
  }
}