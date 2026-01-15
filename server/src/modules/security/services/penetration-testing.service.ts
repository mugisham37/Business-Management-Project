import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { AuditService } from './audit.service';
import { SecurityMonitoringService } from './security-monitoring.service';

export interface PenetrationTest {
  id: string;
  tenantId: string;
  testType: 'automated' | 'manual' | 'external';
  category: 'authentication' | 'authorization' | 'injection' | 'xss' | 'csrf' | 'data_exposure' | 'configuration';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  name: string;
  description: string;
  methodology: string;
  targetEndpoints: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  findings: PenetrationTestFinding[];
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface PenetrationTestFinding {
  id: string;
  testId: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  endpoint: string;
  method: string;
  payload?: string;
  response?: string;
  evidence: string[];
  cwe?: string; // Common Weakness Enumeration
  cvss?: number; // Common Vulnerability Scoring System
  remediation: string;
  status: 'open' | 'acknowledged' | 'fixed' | 'false_positive' | 'accepted_risk';
  discoveredAt: Date;
  fixedAt?: Date;
}

export interface SecurityScanConfig {
  tenantId: string;
  enabled: boolean;
  schedule: string; // Cron expression
  testTypes: string[];
  excludeEndpoints: string[];
  maxConcurrentTests: number;
  timeoutMinutes: number;
  notificationSettings: {
    onStart: boolean;
    onComplete: boolean;
    onHighSeverityFindings: boolean;
    recipients: string[];
  };
}

export interface VulnerabilityReport {
  tenantId: string;
  reportId: string;
  generatedAt: Date;
  generatedBy: string;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  infoFindings: number;
  findings: PenetrationTestFinding[];
  riskScore: number;
  status: 'draft' | 'final' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PenetrationTestingService {
  private readonly logger = new Logger(PenetrationTestingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    private readonly securityMonitoringService: SecurityMonitoringService,
  ) {}
}