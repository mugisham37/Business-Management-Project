import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AuditService } from './audit.service';
import { EncryptionService } from './encryption.service';

export interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  requirements: ComplianceRequirement[];
  enabled: boolean;
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  controls: ComplianceControl[];
  status: 'compliant' | 'non_compliant' | 'pending' | 'not_applicable';
  lastAssessed: Date;
  nextAssessment: Date;
  evidence: string[];
  remediation?: string;
}

export interface ComplianceControl {
  id: string;
  description: string;
  implemented: boolean;
  automatedCheck: boolean;
  checkFunction?: string;
  evidence: string[];
}

export interface ComplianceReport {
  frameworkId: string;
  tenantId: string;
  generatedAt: Date;
  overallStatus: 'compliant' | 'non_compliant' | 'partial';
  complianceScore: number; // 0-100
  requirements: ComplianceRequirement[];
  summary: {
    totalRequirements: number;
    compliantRequirements: number;
    nonCompliantRequirements: number;
    pendingRequirements: number;
  };
  recommendations: string[];
  nextAuditDate: Date;
}

export interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  dataTypes: string[];
  retentionPeriod: number; // in days
  deletionMethod: 'soft' | 'hard' | 'encrypted';
  legalHoldExemptions: boolean;
  enabled: boolean;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);
  private readonly frameworks: Map<string, ComplianceFramework> = new Map();
  private readonly retentionPolicies: Map<string, DataRetentionPolicy> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeComplianceFrameworks();
    this.initializeRetentionPolicies();
  }

  /**
   * Get compliance status for a tenant
   */
  async getComplianceStatus(tenantId: string): Promise<any> {
    const reports: ComplianceReport[] = [];

    for (const framework of this.frameworks.values()) {
      if (framework.enabled) {
        const report = await this.generateComplianceReport(tenantId, framework.id);
        reports.push(report);
      }
    }

    return {
      tenantId,
      frameworks: reports,
      overallScore: this.calculateOverallScore(reports),
      lastUpdated: new Date(),
    };
  }

  /**
   * Generate compliance report for a specific framework
   */
  async generateComplianceReport(
    tenantId: string,
    frameworkId: string,
  ): Promise<ComplianceReport> {
    const framework = this.frameworks.get(frameworkId);
    if (!framework) {
      throw new Error(`Framework not found: ${frameworkId}`);
    }

    const assessedRequirements: ComplianceRequirement[] = [];

    for (const requirement of framework.requirements) {
      const assessedRequirement = await this.assessRequirement(tenantId, requirement);
      assessedRequirements.push(assessedRequirement);
    }

    const summary = this.calculateSummary(assessedRequirements);
    const complianceScore = (summary.compliantRequirements / summary.totalRequirements) * 100;

    return {
      frameworkId,
      tenantId,
      generatedAt: new Date(),
      overallStatus: this.determineOverallStatus(complianceScore),
      complianceScore,
      requirements: assessedRequirements,
      summary,
      recommendations: this.generateRecommendations(assessedRequirements),
      nextAuditDate: this.calculateNextAuditDate(),
    };
  }

  /**
   * Assess a specific compliance requirement
   */
  async assessRequirement(
    tenantId: string,
    requirement: ComplianceRequirement,
  ): Promise<ComplianceRequirement> {
    const assessedControls: ComplianceControl[] = [];

    for (const control of requirement.controls) {
      const assessedControl = await this.assessControl(tenantId, control);
      assessedControls.push(assessedControl);
    }

    const allControlsImplemented = assessedControls.every(c => c.implemented);
    const status = allControlsImplemented ? 'compliant' : 'non_compliant';

    return {
      ...requirement,
      controls: assessedControls,
      status,
      lastAssessed: new Date(),
      nextAssessment: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    };
  }

  /**
   * Assess a specific compliance control
   */
  async assessControl(tenantId: string, control: ComplianceControl): Promise<ComplianceControl> {
    let implemented = control.implemented;

    if (control.automatedCheck && control.checkFunction) {
      try {
        implemented = await this.runAutomatedCheck(tenantId, control.checkFunction);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to run automated check for control ${control.id}: ${errorMessage}`,
        );
        implemented = false;
      }
    }

    return {
      ...control,
      implemented,
    };
  }

  /**
   * Run automated compliance check
   */
  async runAutomatedCheck(tenantId: string, checkFunction: string): Promise<boolean> {
    switch (checkFunction) {
      case 'checkEncryptionAtRest':
        return this.checkEncryptionAtRest(tenantId);
      case 'checkEncryptionInTransit':
        return this.checkEncryptionInTransit(tenantId);
      case 'checkAuditLogging':
        return this.checkAuditLogging(tenantId);
      case 'checkAccessControls':
        return this.checkAccessControls(tenantId);
      case 'checkDataRetention':
        return this.checkDataRetention(tenantId);
      case 'checkPasswordPolicy':
        return this.checkPasswordPolicy(tenantId);
      case 'checkMfaEnforcement':
        return this.checkMfaEnforcement(tenantId);
      default:
        this.logger.warn(`Unknown check function: ${checkFunction}`);
        return false;
    }
  }

  /**
   * Apply data retention policies
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async applyDataRetentionPolicies(): Promise<void> {
    this.logger.log('Starting data retention policy enforcement');

    try {
      for (const policy of this.retentionPolicies.values()) {
        if (policy.enabled) {
          await this.enforceRetentionPolicy(policy);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to apply retention policies: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Enforce a specific retention policy
   */
  async enforceRetentionPolicy(policy: DataRetentionPolicy): Promise<void> {
    const cutoffDate = new Date(Date.now() - policy.retentionPeriod * 24 * 60 * 60 * 1000);

    this.logger.log(
      `Enforcing retention policy: ${policy.name} (cutoff: ${cutoffDate.toISOString()})`,
    );

    // Get expired data based on policy
    const expiredData = await this.getExpiredData(policy, cutoffDate);

    for (const data of expiredData) {
      try {
        await this.deleteExpiredData(data, policy.deletionMethod);
        
        // Log retention action
        await this.auditService.logEvent({
          tenantId: data.tenantId,
          userId: 'system',
          action: 'data_retention',
          resource: data.type,
          metadata: {
            policyId: policy.id,
            deletionMethod: policy.deletionMethod,
            recordId: data.id,
            originalDate: data.createdAt,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Failed to delete expired data ${data.id}: ${errorMessage}`,
          errorStack,
        );
      }
    }
  }

  /**
   * Generate GDPR data export
   */
  async generateGdprDataExport(tenantId: string, userId: string): Promise<any> {
    this.logger.log(`Generating GDPR data export for user ${userId} in tenant ${tenantId}`);

    // Collect all user data across the system
    const userData = {
      personalInfo: await this.getUserPersonalInfo(tenantId, userId),
      auditLogs: await this.getUserAuditLogs(tenantId, userId),
      transactions: await this.getUserTransactions(tenantId, userId),
      preferences: await this.getUserPreferences(tenantId, userId),
      exportedAt: new Date().toISOString(),
    };

    // Log GDPR export request
    await this.auditService.logEvent({
      tenantId,
      userId: 'system',
      action: 'gdpr_export',
      resource: 'user_data',
      metadata: {
        subjectUserId: userId,
        dataTypes: Object.keys(userData),
        recordCount: this.countRecords(userData),
      },
    });

    return userData;
  }

  /**
   * Process GDPR data deletion request
   */
  async processGdprDeletionRequest(tenantId: string, userId: string): Promise<void> {
    this.logger.log(`Processing GDPR deletion request for user ${userId} in tenant ${tenantId}`);

    // Delete or anonymize user data
    await this.deleteUserPersonalInfo(tenantId, userId);
    await this.anonymizeUserAuditLogs(tenantId, userId);
    await this.anonymizeUserTransactions(tenantId, userId);

    // Log GDPR deletion
    await this.auditService.logEvent({
      tenantId,
      userId: 'system',
      action: 'gdpr_deletion',
      resource: 'user_data',
      metadata: {
        subjectUserId: userId,
        deletionMethod: 'anonymization',
        processedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Initialize compliance frameworks
   */
  private initializeComplianceFrameworks(): void {
    const frameworks: ComplianceFramework[] = [
      {
        id: 'soc2',
        name: 'SOC 2 Type II',
        description: 'Service Organization Control 2 Type II compliance',
        enabled: true,
        requirements: [
          {
            id: 'soc2_cc6_1',
            title: 'Logical and Physical Access Controls',
            description: 'The entity implements logical and physical access controls',
            category: 'Access Control',
            severity: 'high',
            status: 'pending',
            lastAssessed: new Date(),
            nextAssessment: new Date(),
            evidence: [],
            controls: [
              {
                id: 'access_control_implementation',
                description: 'Access controls are implemented and enforced',
                implemented: false,
                automatedCheck: true,
                checkFunction: 'checkAccessControls',
                evidence: [],
              },
            ],
          },
          {
            id: 'soc2_cc6_7',
            title: 'Data Transmission and Disposal',
            description: 'The entity restricts the transmission and disposal of data',
            category: 'Data Protection',
            severity: 'high',
            status: 'pending',
            lastAssessed: new Date(),
            nextAssessment: new Date(),
            evidence: [],
            controls: [
              {
                id: 'encryption_in_transit',
                description: 'Data is encrypted during transmission',
                implemented: false,
                automatedCheck: true,
                checkFunction: 'checkEncryptionInTransit',
                evidence: [],
              },
              {
                id: 'encryption_at_rest',
                description: 'Data is encrypted at rest',
                implemented: false,
                automatedCheck: true,
                checkFunction: 'checkEncryptionAtRest',
                evidence: [],
              },
            ],
          },
        ],
      },
      {
        id: 'gdpr',
        name: 'GDPR',
        description: 'General Data Protection Regulation compliance',
        enabled: true,
        requirements: [
          {
            id: 'gdpr_art_32',
            title: 'Security of Processing',
            description: 'Appropriate technical and organizational measures',
            category: 'Security',
            severity: 'critical',
            status: 'pending',
            lastAssessed: new Date(),
            nextAssessment: new Date(),
            evidence: [],
            controls: [
              {
                id: 'data_encryption',
                description: 'Personal data is encrypted',
                implemented: false,
                automatedCheck: true,
                checkFunction: 'checkEncryptionAtRest',
                evidence: [],
              },
            ],
          },
        ],
      },
    ];

    frameworks.forEach(framework => {
      this.frameworks.set(framework.id, framework);
    });

    this.logger.log(`Initialized ${frameworks.length} compliance frameworks`);
  }

  /**
   * Initialize data retention policies
   */
  private initializeRetentionPolicies(): void {
    const policies: DataRetentionPolicy[] = [
      {
        id: 'audit_logs',
        name: 'Audit Log Retention',
        description: 'Retain audit logs for compliance requirements',
        dataTypes: ['audit_log'],
        retentionPeriod: 2555, // 7 years
        deletionMethod: 'hard',
        legalHoldExemptions: true,
        enabled: true,
      },
      {
        id: 'user_data',
        name: 'User Data Retention',
        description: 'Retain user data as per privacy policy',
        dataTypes: ['user_profile', 'user_preferences'],
        retentionPeriod: 1095, // 3 years
        deletionMethod: 'soft',
        legalHoldExemptions: false,
        enabled: true,
      },
      {
        id: 'transaction_data',
        name: 'Transaction Data Retention',
        description: 'Retain transaction data for financial compliance',
        dataTypes: ['transaction', 'payment'],
        retentionPeriod: 2555, // 7 years
        deletionMethod: 'encrypted',
        legalHoldExemptions: true,
        enabled: true,
      },
    ];

    policies.forEach(policy => {
      this.retentionPolicies.set(policy.id, policy);
    });

    this.logger.log(`Initialized ${policies.length} data retention policies`);
  }

  // Automated check implementations
  private async checkEncryptionAtRest(tenantId: string): Promise<boolean> {
    // Check if sensitive data is encrypted at rest
    // This would query the database to verify encryption
    return true; // Simplified for now
  }

  private async checkEncryptionInTransit(tenantId: string): Promise<boolean> {
    // Check if HTTPS is enforced and TLS is properly configured
    return true; // Simplified for now
  }

  private async checkAuditLogging(tenantId: string): Promise<boolean> {
    // Check if audit logging is enabled and functioning
    const recentLogs = await this.auditService.queryLogs({
      tenantId,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    });
    return recentLogs.length > 0;
  }

  private async checkAccessControls(tenantId: string): Promise<boolean> {
    // Check if proper access controls are in place
    return true; // Simplified for now
  }

  private async checkDataRetention(tenantId: string): Promise<boolean> {
    // Check if data retention policies are being enforced
    return this.retentionPolicies.size > 0;
  }

  private async checkPasswordPolicy(tenantId: string): Promise<boolean> {
    // Check if strong password policy is enforced
    return true; // Simplified for now
  }

  private async checkMfaEnforcement(tenantId: string): Promise<boolean> {
    // Check if MFA is enforced for appropriate users
    return true; // Simplified for now
  }

  // Helper methods
  private calculateOverallScore(reports: ComplianceReport[]): number {
    if (reports.length === 0) return 0;
    const totalScore = reports.reduce((sum, report) => sum + report.complianceScore, 0);
    return totalScore / reports.length;
  }

  private calculateSummary(requirements: ComplianceRequirement[]): any {
    return {
      totalRequirements: requirements.length,
      compliantRequirements: requirements.filter(r => r.status === 'compliant').length,
      nonCompliantRequirements: requirements.filter(r => r.status === 'non_compliant').length,
      pendingRequirements: requirements.filter(r => r.status === 'pending').length,
    };
  }

  private determineOverallStatus(score: number): 'compliant' | 'non_compliant' | 'partial' {
    if (score >= 95) return 'compliant';
    if (score >= 70) return 'partial';
    return 'non_compliant';
  }

  private generateRecommendations(requirements: ComplianceRequirement[]): string[] {
    const recommendations: string[] = [];
    
    requirements.forEach(req => {
      if (req.status === 'non_compliant' && req.remediation) {
        recommendations.push(req.remediation);
      }
    });

    return recommendations;
  }

  private calculateNextAuditDate(): Date {
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  }

  // Mock implementations for data operations
  private async getExpiredData(policy: DataRetentionPolicy, cutoffDate: Date): Promise<any[]> {
    // This would query the database for expired data
    return [];
  }

  private async deleteExpiredData(data: any, method: string): Promise<void> {
    // This would perform the actual deletion based on the method
    this.logger.log(`Deleting expired data ${data.id} using method: ${method}`);
  }

  private async getUserPersonalInfo(tenantId: string, userId: string): Promise<any> {
    return {}; // Mock implementation
  }

  private async getUserAuditLogs(tenantId: string, userId: string): Promise<any[]> {
    return this.auditService.queryLogs({ tenantId, userId });
  }

  private async getUserTransactions(tenantId: string, userId: string): Promise<any[]> {
    return []; // Mock implementation
  }

  private async getUserPreferences(tenantId: string, userId: string): Promise<any> {
    return {}; // Mock implementation
  }

  private countRecords(data: any): number {
    let count = 0;
    Object.values(data).forEach(value => {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (typeof value === 'object' && value !== null) {
        count += 1;
      }
    });
    return count;
  }

  private async deleteUserPersonalInfo(tenantId: string, userId: string): Promise<void> {
    // Mock implementation
    this.logger.log(`Deleting personal info for user ${userId}`);
  }

  private async anonymizeUserAuditLogs(tenantId: string, userId: string): Promise<void> {
    // Mock implementation
    this.logger.log(`Anonymizing audit logs for user ${userId}`);
  }

  private async anonymizeUserTransactions(tenantId: string, userId: string): Promise<void> {
    // Mock implementation
    this.logger.log(`Anonymizing transactions for user ${userId}`);
  }
}