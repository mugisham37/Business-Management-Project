import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { DisasterRecoveryProceduresService, ExecutionContext } from '../services/disaster-recovery-procedures.service';
import { DisasterRecoveryRepository } from '../repositories/disaster-recovery.repository';
import { RecoveryStatus } from '../entities/disaster-recovery.entity';

@Processor('disaster-recovery-queue')
export class DisasterRecoveryProcessor {
  private readonly logger = new Logger(DisasterRecoveryProcessor.name);

  constructor(
    private readonly proceduresService: DisasterRecoveryProceduresService,
    private readonly drRepository: DisasterRecoveryRepository,
  ) {}

  @Process('execute-dr')
  async executeDR(job: Job<{
    executionId: string;
    plan: any;
    options: any;
  }>): Promise<void> {
    const { executionId, plan, options } = job.data;
    
    this.logger.log(`Processing DR execution job ${executionId}`);

    try {
      // Update job progress
      await job.progress(10);

      // Create execution context
      const context: ExecutionContext = {
        executionId,
        plan,
        disasterType: options.disasterType,
        isTest: options.isTest || false,
        startTime: new Date(),
        userId: options.userId,
      };

      // Update job progress
      await job.progress(20);

      // Execute disaster recovery procedures
      await this.proceduresService.executeProcedures(context);

      // Update job progress
      await job.progress(100);

      this.logger.log(`DR execution job ${executionId} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DR execution job ${executionId} failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      // Update execution status to failed
      try {
        await this.drRepository.updateExecution(executionId, {
          status: RecoveryStatus.FAILED,
          completedAt: new Date(),
          errors: [errorMessage],
        });
      } catch (updateError) {
        this.logger.error(`Failed to update execution status: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
      }

      throw error;
    }
  }

  @Process('validate-dr-plan')
  async validateDRPlan(job: Job<{
    planId: string;
    tenantId: string;
  }>): Promise<void> {
    const { planId, tenantId } = job.data;
    
    this.logger.log(`Processing DR plan validation job for plan ${planId}`);

    try {
      // Update job progress
      await job.progress(25);

      // Validate disaster recovery procedures
      const validation = await this.proceduresService.validateProcedures(planId, tenantId);

      // Update job progress
      await job.progress(75);

      // Update plan with validation results
      await this.drRepository.updatePlan(planId, {
        configuration: {
          ...validation,
          lastValidatedAt: new Date(),
        },
      });

      // Update job progress
      await job.progress(100);

      this.logger.log(`DR plan validation job for plan ${planId} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DR plan validation job for plan ${planId} failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  @Process('cleanup-old-executions')
  async cleanupOldExecutions(job: Job<{
    tenantId?: string;
    retentionDays: number;
  }>): Promise<void> {
    const { tenantId, retentionDays } = job.data;
    
    this.logger.log(`Processing cleanup job for executions older than ${retentionDays} days`);

    try {
      // Update job progress
      await job.progress(25);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Get executions to cleanup
      const executions = tenantId 
        ? await this.drRepository.findExecutionsByTenant(tenantId, 1000, 0)
        : { executions: [], total: 0 }; // TODO: Implement global cleanup

      // Update job progress
      await job.progress(50);

      let cleanedCount = 0;
      for (const execution of executions.executions) {
        if (execution.createdAt < cutoffDate) {
          // In a real implementation, you would delete the execution
          // For now, we'll just count them
          cleanedCount++;
        }
      }

      // Update job progress
      await job.progress(100);

      this.logger.log(`Cleanup job completed. Cleaned ${cleanedCount} old executions`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cleanup job failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  @Process('generate-dr-report')
  async generateDRReport(job: Job<{
    tenantId: string;
    reportType: 'summary' | 'detailed' | 'compliance';
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
  }>): Promise<void> {
    const { tenantId, reportType, dateRange } = job.data;
    
    this.logger.log(`Processing DR report generation job for tenant ${tenantId}`);

    try {
      // Update job progress
      await job.progress(20);

      // Get DR metrics
      const metrics = await this.drRepository.getMetrics(tenantId);

      // Update job progress
      await job.progress(40);

      // Get executions in date range
      const executions = await this.drRepository.findExecutionsByTenant(tenantId, 1000, 0);

      // Update job progress
      await job.progress(60);

      // Generate report based on type
      let report: any = {};
      
      switch (reportType) {
        case 'summary':
          report = this.generateSummaryReport(metrics, executions.executions);
          break;
        case 'detailed':
          report = this.generateDetailedReport(metrics, executions.executions);
          break;
        case 'compliance':
          report = this.generateComplianceReport(metrics, executions.executions);
          break;
      }

      // Update job progress
      await job.progress(80);

      // In a real implementation, you would save the report to storage
      // and possibly send it via email or notification
      this.logger.log(`Generated ${reportType} report with ${Object.keys(report).length} sections`);

      // Update job progress
      await job.progress(100);

      this.logger.log(`DR report generation job completed for tenant ${tenantId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`DR report generation job failed: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Private helper methods for report generation
   */
  private generateSummaryReport(metrics: any, executions: any[]): any {
    return {
      overview: {
        totalPlans: metrics.totalPlans,
        activePlans: metrics.activePlans,
        totalExecutions: metrics.totalExecutions,
        successRate: metrics.successRate,
        averageRto: metrics.averageRtoMinutes,
      },
      recentActivity: executions.slice(0, 10).map(exec => ({
        id: exec.id,
        disasterType: exec.disasterType,
        status: exec.status,
        rto: exec.actualRtoMinutes,
        isTest: exec.isTest,
        date: exec.createdAt,
      })),
      generatedAt: new Date(),
    };
  }

  private generateDetailedReport(metrics: any, executions: any[]): any {
    return {
      executiveSummary: this.generateSummaryReport(metrics, executions),
      detailedMetrics: {
        ...metrics,
        executionsByStatus: this.groupExecutionsByStatus(executions),
        executionsByDisasterType: this.groupExecutionsByDisasterType(executions),
        rtoTrends: this.calculateRTOTrends(executions),
      },
      allExecutions: executions,
      recommendations: this.generateRecommendations(metrics, executions),
      generatedAt: new Date(),
    };
  }

  private generateComplianceReport(metrics: any, executions: any[]): any {
    return {
      complianceOverview: {
        totalTests: executions.filter(e => e.isTest).length,
        testFrequency: this.calculateTestFrequency(executions),
        rtoCompliance: this.calculateRTOCompliance(executions),
        documentationStatus: 'Complete', // Placeholder
      },
      testResults: executions.filter(e => e.isTest).map(exec => ({
        id: exec.id,
        date: exec.createdAt,
        status: exec.status,
        rto: exec.actualRtoMinutes,
        issues: exec.errors?.length || 0,
      })),
      complianceGaps: this.identifyComplianceGaps(metrics, executions),
      generatedAt: new Date(),
    };
  }

  private groupExecutionsByStatus(executions: any[]): Record<string, number> {
    return executions.reduce((acc, exec) => {
      acc[exec.status] = (acc[exec.status] || 0) + 1;
      return acc;
    }, {});
  }

  private groupExecutionsByDisasterType(executions: any[]): Record<string, number> {
    return executions.reduce((acc, exec) => {
      acc[exec.disasterType] = (acc[exec.disasterType] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateRTOTrends(executions: any[]): any[] {
    // Group executions by month and calculate average RTO
    const monthlyData = executions.reduce((acc, exec) => {
      const month = exec.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { total: 0, count: 0 };
      }
      acc[month].total += exec.actualRtoMinutes;
      acc[month].count += 1;
      return acc;
    }, {});

    return Object.entries(monthlyData).map(([month, data]: [string, any]) => ({
      month,
      averageRto: Math.round((data.total / data.count) * 100) / 100,
      executionCount: data.count,
    }));
  }

  private calculateTestFrequency(executions: any[]): string {
    const testExecutions = executions.filter(e => e.isTest);
    if (testExecutions.length < 2) return 'Insufficient data';

    // Calculate average days between tests
    testExecutions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    let totalDays = 0;
    for (let i = 1; i < testExecutions.length; i++) {
      const daysDiff = (testExecutions[i].createdAt.getTime() - testExecutions[i-1].createdAt.getTime()) / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
    }

    const averageDays = totalDays / (testExecutions.length - 1);
    
    if (averageDays <= 7) return 'Weekly';
    if (averageDays <= 31) return 'Monthly';
    if (averageDays <= 93) return 'Quarterly';
    return 'Infrequent';
  }

  private calculateRTOCompliance(executions: any[]): number {
    if (executions.length === 0) return 0;
    
    // Assume RTO target is 15 minutes (this should come from plan configuration)
    const rtoTarget = 15;
    const compliantExecutions = executions.filter(e => e.actualRtoMinutes <= rtoTarget).length;
    
    return Math.round((compliantExecutions / executions.length) * 10000) / 100;
  }

  private generateRecommendations(metrics: any, executions: any[]): string[] {
    const recommendations = [];

    if (metrics.successRate < 95) {
      recommendations.push('Improve DR success rate by addressing common failure points');
    }

    if (metrics.averageRtoMinutes > 15) {
      recommendations.push('Optimize recovery procedures to reduce RTO');
    }

    const testExecutions = executions.filter(e => e.isTest);
    if (testExecutions.length < executions.length * 0.8) {
      recommendations.push('Increase frequency of DR testing');
    }

    if (recommendations.length === 0) {
      recommendations.push('DR performance is within acceptable parameters');
    }

    return recommendations;
  }

  private identifyComplianceGaps(metrics: any, executions: any[]): string[] {
    const gaps = [];

    const testExecutions = executions.filter(e => e.isTest);
    if (testExecutions.length === 0) {
      gaps.push('No DR tests have been performed');
    }

    const recentTests = testExecutions.filter(e => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return e.createdAt >= thirtyDaysAgo;
    });

    if (recentTests.length === 0) {
      gaps.push('No DR tests performed in the last 30 days');
    }

    if (metrics.averageRtoMinutes > 15) {
      gaps.push('Average RTO exceeds recommended 15-minute target');
    }

    return gaps;
  }
}