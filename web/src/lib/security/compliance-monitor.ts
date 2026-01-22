/**
 * Compliance Monitoring System
 * Monitors and ensures compliance with GDPR, SOC2, PCI-DSS, HIPAA
 * Requirements: 12.6
 */

import { auditLogger, AuditEvent } from './audit-logger';

export type ComplianceFramework = 'GDPR' | 'SOC2' | 'PCI-DSS' | 'HIPAA';

export interface ComplianceRule {
  id: string;
  framework: ComplianceFramework;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  validator: (event: AuditEvent, context: ComplianceContext) => ComplianceViolation | null;
}

export interface ComplianceViolation {
  ruleId: string;
  framework: ComplianceFramework;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  event: AuditEvent;
  remediation: string;
  timestamp: Date;
}

export interface ComplianceContext {
  tenantId?: string;
  userId?: string;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  processingPurpose?: string;
  legalBasis?: string;
  retentionPeriod?: number;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  period: { start: Date; end: Date };
  totalEvents: number;
  violations: ComplianceViolation[];
  complianceScore: number;
  recommendations: string[];
  certificationStatus: 'compliant' | 'non-compliant' | 'needs-review';
}

export class ComplianceMonitor {
  private rules: Map<string, ComplianceRule> = new Map();
  private violations: ComplianceViolation[] = [];
  private maxViolations: number = 10000;

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Register a compliance rule
   */
  registerRule(rule: ComplianceRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Check event against compliance rules
   */
  async checkCompliance(event: AuditEvent, context: ComplianceContext = {}): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    for (const rule of this.rules.values()) {
      try {
        const violation = rule.validator(event, context);
        if (violation) {
          violations.push(violation);
          this.violations.push(violation);
          
          // Log compliance violation
          await auditLogger.logComplianceEvent(
            'compliance_violation',
            rule.framework,
            event.userId,
            {
              ruleId: rule.id,
              severity: violation.severity,
              description: violation.description
            }
          );
        }
      } catch (error) {
        console.error(`Error checking compliance rule ${rule.id}:`, error);
      }
    }

    // Cleanup old violations
    this.cleanupOldViolations();

    return violations;
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    framework: ComplianceFramework,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const frameworkViolations = this.violations.filter(v => 
      v.framework === framework &&
      v.timestamp >= startDate &&
      v.timestamp <= endDate
    );

    const totalEvents = await this.getTotalEventsCount(startDate, endDate);
    const complianceScore = this.calculateComplianceScore(frameworkViolations, totalEvents);
    const recommendations = this.generateRecommendations(framework, frameworkViolations);
    const certificationStatus = this.determineCertificationStatus(complianceScore, frameworkViolations);

    return {
      framework,
      period: { start: startDate, end: endDate },
      totalEvents,
      violations: frameworkViolations,
      complianceScore,
      recommendations,
      certificationStatus
    };
  }

  /**
   * Get compliance status for all frameworks
   */
  async getComplianceStatus(): Promise<Record<ComplianceFramework, {
    score: number;
    status: 'compliant' | 'non-compliant' | 'needs-review';
    recentViolations: number;
  }>> {
    const frameworks: ComplianceFramework[] = ['GDPR', 'SOC2', 'PCI-DSS', 'HIPAA'];
    const status: any = {};

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const framework of frameworks) {
      const recentViolations = this.violations.filter(v => 
        v.framework === framework && v.timestamp >= thirtyDaysAgo
      );

      const score = this.calculateComplianceScore(recentViolations, 1000); // Assume 1000 events
      const complianceStatus = this.determineCertificationStatus(score, recentViolations);

      status[framework] = {
        score,
        status: complianceStatus,
        recentViolations: recentViolations.length
      };
    }

    return status;
  }

  /**
   * Setup default compliance rules
   */
  private setupDefaultRules(): void {
    // GDPR Rules
    this.registerRule({
      id: 'gdpr-data-retention',
      framework: 'GDPR',
      category: 'Data Retention',
      description: 'Personal data must not be retained longer than necessary',
      severity: 'high',
      validator: (event, context) => {
        if (event.eventType === 'data_access' && context.retentionPeriod) {
          const eventAge = Date.now() - event.timestamp.getTime();
          const maxAge = context.retentionPeriod * 24 * 60 * 60 * 1000;
          
          if (eventAge > maxAge) {
            return {
              ruleId: 'gdpr-data-retention',
              framework: 'GDPR',
              severity: 'high',
              description: 'Data accessed beyond retention period',
              event,
              remediation: 'Delete or anonymize personal data that exceeds retention period',
              timestamp: new Date()
            };
          }
        }
        return null;
      }
    });

    this.registerRule({
      id: 'gdpr-consent-tracking',
      framework: 'GDPR',
      category: 'Consent Management',
      description: 'Processing must have valid legal basis',
      severity: 'critical',
      validator: (event, context) => {
        if (event.eventType === 'data_modification' && 
            event.details.containsPersonalData && 
            !context.legalBasis) {
          return {
            ruleId: 'gdpr-consent-tracking',
            framework: 'GDPR',
            severity: 'critical',
            description: 'Personal data processed without legal basis',
            event,
            remediation: 'Ensure valid legal basis exists before processing personal data',
            timestamp: new Date()
          };
        }
        return null;
      }
    });

    // SOC2 Rules
    this.registerRule({
      id: 'soc2-access-control',
      framework: 'SOC2',
      category: 'Access Control',
      description: 'Access must be properly authorized',
      severity: 'high',
      validator: (event, _context) => {
        if (event.eventType === 'authorization' && event.outcome === 'denied') {
          // Multiple failed authorization attempts
          const recentFailures = this.violations.filter(v => 
            v.event.userId === event.userId &&
            v.timestamp.getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
          ).length;

          if (recentFailures >= 3) {
            return {
              ruleId: 'soc2-access-control',
              framework: 'SOC2',
              severity: 'high',
              description: 'Multiple failed authorization attempts detected',
              event,
              remediation: 'Review user access permissions and implement account lockout',
              timestamp: new Date()
            };
          }
        }
        return null;
      }
    });

    // PCI-DSS Rules
    this.registerRule({
      id: 'pci-dss-cardholder-data',
      framework: 'PCI-DSS',
      category: 'Cardholder Data Protection',
      description: 'Cardholder data must be protected',
      severity: 'critical',
      validator: (event, _context) => {
        if (event.details.containsCardholderData && 
            !event.details.encrypted) {
          return {
            ruleId: 'pci-dss-cardholder-data',
            framework: 'PCI-DSS',
            severity: 'critical',
            description: 'Unencrypted cardholder data detected',
            event,
            remediation: 'Encrypt all cardholder data at rest and in transit',
            timestamp: new Date()
          };
        }
        return null;
      }
    });

    // HIPAA Rules
    this.registerRule({
      id: 'hipaa-phi-access',
      framework: 'HIPAA',
      category: 'PHI Access Control',
      description: 'PHI access must be logged and authorized',
      severity: 'high',
      validator: (event, _context) => {
        if (event.details.containsPHI && 
            event.eventType === 'data_access' &&
            !event.details.authorizedAccess) {
          return {
            ruleId: 'hipaa-phi-access',
            framework: 'HIPAA',
            severity: 'high',
            description: 'Unauthorized PHI access detected',
            event,
            remediation: 'Ensure all PHI access is properly authorized and documented',
            timestamp: new Date()
          };
        }
        return null;
      }
    });
  }

  private calculateComplianceScore(violations: ComplianceViolation[], totalEvents: number): number {
    if (totalEvents === 0) return 100;

    const severityWeights = {
      low: 1,
      medium: 3,
      high: 7,
      critical: 15
    };

    const violationScore = violations.reduce((sum, violation) => 
      sum + severityWeights[violation.severity], 0
    );

    const maxPossibleScore = totalEvents * severityWeights.critical;
    const score = Math.max(0, 100 - (violationScore / maxPossibleScore) * 100);

    return Math.round(score);
  }

  private generateRecommendations(
    framework: ComplianceFramework, 
    violations: ComplianceViolation[]
  ): string[] {
    const recommendations: string[] = [];
    const violationsByCategory = new Map<string, ComplianceViolation[]>();

    // Group violations by category
    violations.forEach(violation => {
      const rule = this.rules.get(violation.ruleId);
      if (rule) {
        const category = rule.category;
        if (!violationsByCategory.has(category)) {
          violationsByCategory.set(category, []);
        }
        violationsByCategory.get(category)!.push(violation);
      }
    });

    // Generate recommendations based on violation patterns
    violationsByCategory.forEach((categoryViolations, category) => {
      if (categoryViolations.length > 0) {
        recommendations.push(
          `Address ${categoryViolations.length} violations in ${category} category`
        );
      }
    });

    // Framework-specific recommendations
    switch (framework) {
      case 'GDPR':
        if (violations.some(v => v.ruleId.includes('consent'))) {
          recommendations.push('Implement comprehensive consent management system');
        }
        break;
      case 'SOC2':
        if (violations.some(v => v.ruleId.includes('access'))) {
          recommendations.push('Strengthen access control and monitoring systems');
        }
        break;
      case 'PCI-DSS':
        if (violations.some(v => v.ruleId.includes('cardholder'))) {
          recommendations.push('Enhance cardholder data protection measures');
        }
        break;
      case 'HIPAA':
        if (violations.some(v => v.ruleId.includes('phi'))) {
          recommendations.push('Improve PHI access controls and audit trails');
        }
        break;
    }

    return recommendations;
  }

  private determineCertificationStatus(
    score: number, 
    violations: ComplianceViolation[]
  ): 'compliant' | 'non-compliant' | 'needs-review' {
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;

    if (criticalViolations > 0) {
      return 'non-compliant';
    }

    if (score < 80 || highViolations > 5) {
      return 'needs-review';
    }

    return 'compliant';
  }

  private async getTotalEventsCount(_startDate: Date, _endDate: Date): Promise<number> {
    // In a real implementation, this would query the audit log
    return 1000; // Placeholder
  }

  private cleanupOldViolations(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.violations = this.violations.filter(v => v.timestamp >= thirtyDaysAgo);

    // Keep only recent violations up to max limit
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(-this.maxViolations);
    }
  }
}

// Default compliance monitor instance
export const complianceMonitor = new ComplianceMonitor();

/**
 * React hook for compliance monitoring
 */
export function useComplianceMonitor() {
  return {
    checkCompliance: complianceMonitor.checkCompliance.bind(complianceMonitor),
    generateReport: complianceMonitor.generateReport.bind(complianceMonitor),
    getComplianceStatus: complianceMonitor.getComplianceStatus.bind(complianceMonitor)
  };
}