import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

// ============================================================================
// SECURITY EVENT & SETTINGS TYPES
// ============================================================================

// Enums
export enum SecurityEventType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  DATA_ACCESS = 'DATA_ACCESS',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  THREAT_DETECTED = 'THREAT_DETECTED',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
}

export enum ThreatSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ThreatStatus {
  ACTIVE = 'ACTIVE',
  MITIGATED = 'MITIGATED',
  RESOLVED = 'RESOLVED',
}

export enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  PENDING = 'PENDING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

registerEnumType(SecurityEventType, { name: 'SecurityEventType' });
registerEnumType(ThreatSeverity, { name: 'ThreatSeverity' });
registerEnumType(ThreatStatus, { name: 'ThreatStatus' });
registerEnumType(ComplianceStatus, { name: 'ComplianceStatus' });

// Security Settings
@ObjectType()
export class SecuritySettings {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  passwordMinLength!: number;

  @Field()
  passwordRequireUppercase!: boolean;

  @Field()
  passwordRequireLowercase!: boolean;

  @Field()
  passwordRequireNumbers!: boolean;

  @Field()
  passwordRequireSpecialChars!: boolean;

  @Field()
  passwordExpiryDays!: number;

  @Field()
  mfaRequired!: boolean;

  @Field()
  sessionTimeoutMinutes!: number;

  @Field()
  maxLoginAttempts!: number;

  @Field()
  lockoutDurationMinutes!: number;

  @Field()
  ipWhitelistEnabled!: boolean;

  @Field(() => [String])
  ipWhitelist!: string[];

  @Field()
  auditLogRetentionDays!: number;

  @Field()
  encryptSensitiveData!: boolean;

  @Field()
  updatedAt!: Date;

  @Field({ nullable: true })
  updatedBy?: string;
}

// Security Event
@ObjectType()
export class SecurityEvent {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field(() => SecurityEventType)
  type!: SecurityEventType;

  @Field()
  description!: string;

  @Field(() => ThreatSeverity)
  severity!: ThreatSeverity;

  @Field()
  timestamp!: Date;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  resource?: string;

  @Field({ nullable: true })
  resourceId?: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;

  @Field({ nullable: true })
  investigated!: boolean;

  @Field({ nullable: true })
  investigatedBy?: string;

  @Field({ nullable: true })
  investigatedAt?: Date;

  @Field({ nullable: true })
  resolution?: string;
}

// Security Threat
@ObjectType()
export class SecurityThreat {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field(() => ThreatSeverity)
  severity!: ThreatSeverity;

  @Field()
  description!: string;

  @Field()
  source!: string;

  @Field()
  firstDetected!: Date;

  @Field()
  lastSeen!: Date;

  @Field()
  count!: number;

  @Field(() => ThreatStatus)
  status!: ThreatStatus;

  @Field(() => [String])
  affectedResources!: string[];

  @Field(() => [String])
  recommendedActions!: string[];
}

// Audit Log
@ObjectType()
export class AuditLog {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true })
  tenantId?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field()
  action!: string;

  @Field()
  resource!: string;

  @Field({ nullable: true })
  resourceId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  oldValues?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  newValues?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;

  @Field()
  timestamp!: Date;

  @Field({ nullable: true })
  severity?: string;

  @Field({ nullable: true })
  category?: string;
}

// Compliance Framework
@ObjectType()
export class ComplianceFramework {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  enabled!: boolean;
}

// Compliance Requirement
@ObjectType()
export class ComplianceRequirement {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  category!: string;

  @Field(() => ThreatSeverity)
  severity!: ThreatSeverity;

  @Field(() => ComplianceStatus)
  status!: ComplianceStatus;

  @Field()
  lastAssessed!: Date;

  @Field()
  nextAssessment!: Date;

  @Field(() => [String])
  evidence!: string[];

  @Field({ nullable: true })
  remediation?: string;
}

// Compliance Report
@ObjectType()
export class ComplianceReport {
  @Field()
  frameworkId!: string;

  @Field()
  tenantId!: string;

  @Field()
  generatedAt!: Date;

  @Field()
  overallStatus!: string;

  @Field()
  complianceScore!: number;

  @Field(() => [ComplianceRequirement])
  requirements!: ComplianceRequirement[];

  @Field(() => [String])
  recommendations!: string[];

  @Field()
  nextAuditDate!: Date;
}

// Compliance Violation
@ObjectType()
export class ComplianceViolation {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  description!: string;

  @Field(() => ThreatSeverity)
  severity!: ThreatSeverity;

  @Field()
  detectedAt!: Date;

  @Field({ nullable: true })
  acknowledgedAt?: Date;

  @Field({ nullable: true })
  acknowledgedBy?: string;

  @Field({ nullable: true })
  resolution?: string;

  @Field({ nullable: true })
  resolvedAt?: Date;
}

// Security Dashboard
@ObjectType()
export class SecurityDashboard {
  @Field()
  tenantId!: string;

  @Field()
  timestamp!: Date;

  @Field()
  threatLevel!: string;

  @Field()
  activeThreats!: number;

  @Field()
  failedLogins!: number;

  @Field()
  successfulLogins!: number;

  @Field()
  dataAccessAttempts!: number;

  @Field()
  suspiciousActivities!: number;

  @Field(() => [SecurityThreat])
  recentThreats!: SecurityThreat[];

  @Field(() => [SecurityEvent])
  recentEvents!: SecurityEvent[];
}

// Security Metrics
@ObjectType()
export class SecurityMetrics {
  @Field()
  tenantId!: string;

  @Field()
  period!: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  totalEvents!: number;

  @Field()
  criticalEvents!: number;

  @Field()
  highSeverityEvents!: number;

  @Field()
  mediumSeverityEvents!: number;

  @Field()
  lowSeverityEvents!: number;

  @Field()
  failedLoginAttempts!: number;

  @Field()
  successfulLogins!: number;

  @Field()
  dataAccessEvents!: number;

  @Field()
  configurationChanges!: number;

  @Field()
  threatsDetected!: number;

  @Field()
  threatsResolved!: number;
}

// Threat Analysis
@ObjectType()
export class ThreatAnalysis {
  @Field()
  tenantId!: string;

  @Field()
  period!: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  totalThreats!: number;

  @Field()
  activeThreats!: number;

  @Field()
  resolvedThreats!: number;

  @Field(() => [String])
  topThreatTypes!: string[];

  @Field(() => [String])
  topTargetedResources!: string[];

  @Field(() => [String])
  topSourceIPs!: string[];

  @Field()
  averageResolutionTime!: number;

  @Field(() => [SecurityThreat])
  criticalThreats!: SecurityThreat[];
}

// Access Pattern
@ObjectType()
export class AccessPattern {
  @Field()
  userId!: string;

  @Field()
  tenantId!: string;

  @Field()
  period!: string;

  @Field()
  totalAccesses!: number;

  @Field()
  uniqueResources!: number;

  @Field(() => [String])
  mostAccessedResources!: string[];

  @Field(() => [String])
  accessTimes!: string[];

  @Field(() => [String])
  accessLocations!: string[];

  @Field()
  suspiciousActivityScore!: number;

  @Field(() => [String])
  anomalies!: string[];
}
