import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

// ============================================================================
// KEY MANAGEMENT TYPES
// ============================================================================

export enum KeyStatus {
  ACTIVE = 'ACTIVE',
  ROTATING = 'ROTATING',
  DEPRECATED = 'DEPRECATED',
  REVOKED = 'REVOKED',
}

registerEnumType(KeyStatus, { name: 'KeyStatus' });

@ObjectType()
export class EncryptionKey {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  keyType!: string;

  @Field()
  algorithm!: string;

  @Field()
  version!: number;

  @Field()
  createdAt!: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field({ nullable: true })
  rotatedAt?: Date;

  @Field(() => KeyStatus)
  status!: KeyStatus;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

@ObjectType()
export class KeyRotationPolicy {
  @Field(() => ID)
  id!: string;

  @Field()
  keyType!: string;

  @Field()
  rotationIntervalDays!: number;

  @Field()
  gracePeriodDays!: number;

  @Field()
  autoRotate!: boolean;

  @Field()
  notifyBeforeDays!: number;

  @Field()
  enabled!: boolean;
}

// ============================================================================
// THREAT PATTERN TYPES
// ============================================================================

@ObjectType()
export class ThreatPattern {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  severity!: string;

  @Field()
  timeWindowMs!: number;

  @Field()
  threshold!: number;

  @Field()
  enabled!: boolean;

  @Field(() => GraphQLJSON)
  conditions!: Record<string, any>;
}

@ObjectType()
export class ThreatPatternMatch {
  @Field(() => ID)
  id!: string;

  @Field()
  patternId!: string;

  @Field()
  patternName!: string;

  @Field()
  confidence!: number;

  @Field()
  riskScore!: number;

  @Field(() => [String])
  indicators!: string[];

  @Field(() => [String])
  recommendations!: string[];

  @Field()
  timestamp!: Date;
}

// ============================================================================
// BEHAVIORAL ANALYSIS TYPES
// ============================================================================

@ObjectType()
export class UserBehaviorProfile {
  @Field()
  userId!: string;

  @Field()
  tenantId!: string;

  @Field()
  averageLoginTime!: string;

  @Field(() => [String])
  frequentLocations!: string[];

  @Field(() => [String])
  frequentDevices!: string[];

  @Field()
  averageSessionDuration!: number;

  @Field(() => [String])
  normalAccessPatterns!: string[];

  @Field()
  lastProfileUpdate!: Date;

  @Field()
  riskScore!: number;

  @Field(() => [String])
  anomalies!: string[];
}

@ObjectType()
export class BehavioralAnomaly {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  tenantId!: string;

  @Field()
  type!: string;

  @Field()
  description!: string;

  @Field()
  severity!: string;

  @Field()
  confidence!: number;

  @Field()
  detectedAt!: Date;

  @Field({ nullable: true })
  resolvedAt?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

// ============================================================================
// ENTERPRISE AUTHENTICATION TYPES
// ============================================================================

export enum SSOProvider {
  SAML = 'SAML',
  OAUTH2 = 'OAUTH2',
  LDAP = 'LDAP',
  CUSTOM = 'CUSTOM',
}

registerEnumType(SSOProvider, { name: 'SSOProvider' });

@ObjectType()
export class SAMLConfiguration {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  entityId!: string;

  @Field()
  ssoUrl!: string;

  @Field({ nullable: true })
  sloUrl?: string;

  @Field()
  nameIdFormat!: string;

  @Field(() => GraphQLJSON)
  attributeMapping!: Record<string, any>;

  @Field()
  enabled!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class LDAPConfiguration {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  url!: string;

  @Field()
  baseDN!: string;

  @Field()
  userSearchFilter!: string;

  @Field({ nullable: true })
  groupSearchFilter?: string;

  @Field(() => GraphQLJSON)
  attributeMapping!: Record<string, any>;

  @Field()
  enabled!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class OAuth2Configuration {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  clientId!: string;

  @Field(() => [String])
  redirectUris!: string[];

  @Field(() => [String])
  scopes!: string[];

  @Field(() => [String])
  grantTypes!: string[];

  @Field()
  enabled!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class SSOSession {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  userId!: string;

  @Field(() => SSOProvider)
  provider!: SSOProvider;

  @Field({ nullable: true })
  sessionIndex?: string;

  @Field({ nullable: true })
  nameId?: string;

  @Field(() => GraphQLJSON)
  attributes!: Record<string, any>;

  @Field()
  createdAt!: Date;

  @Field()
  expiresAt!: Date;

  @Field()
  lastAccessedAt!: Date;

  @Field()
  isActive!: boolean;
}

// ============================================================================
// PENETRATION TESTING TYPES
// ============================================================================

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(TestStatus, { name: 'TestStatus' });

@ObjectType()
export class PenetrationTest {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  testType!: string;

  @Field()
  category!: string;

  @Field()
  severity!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  methodology!: string;

  @Field(() => [String])
  targetEndpoints!: string[];

  @Field(() => TestStatus)
  status!: TestStatus;

  @Field({ nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  duration?: number;

  @Field(() => [PenetrationTestFinding])
  findings!: PenetrationTestFinding[];

  @Field(() => [String])
  recommendations!: string[];

  @Field(() => GraphQLJSON)
  metadata!: Record<string, any>;
}

@ObjectType()
export class PenetrationTestFinding {
  @Field(() => ID)
  id!: string;

  @Field()
  testId!: string;

  @Field()
  severity!: string;

  @Field()
  category!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  endpoint!: string;

  @Field()
  method!: string;

  @Field({ nullable: true })
  payload?: string;

  @Field({ nullable: true })
  response?: string;

  @Field(() => [String])
  evidence!: string[];

  @Field({ nullable: true })
  cwe?: string;

  @Field({ nullable: true })
  cvss?: number;

  @Field()
  remediation!: string;

  @Field()
  status!: string;

  @Field()
  discoveredAt!: Date;

  @Field({ nullable: true })
  fixedAt?: Date;
}

@ObjectType()
export class VulnerabilityReport {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  generatedAt!: Date;

  @Field()
  generatedBy!: string;

  @Field()
  totalFindings!: number;

  @Field()
  criticalFindings!: number;

  @Field()
  highFindings!: number;

  @Field()
  mediumFindings!: number;

  @Field()
  lowFindings!: number;

  @Field()
  infoFindings!: number;

  @Field(() => [PenetrationTestFinding])
  findings!: PenetrationTestFinding[];

  @Field()
  riskScore!: number;

  @Field()
  status!: string;
}

// ============================================================================
// DATA DELETION TYPES
// ============================================================================

export enum DeletionReason {
  GDPR = 'GDPR',
  RETENTION_POLICY = 'RETENTION_POLICY',
  USER_REQUEST = 'USER_REQUEST',
  COMPLIANCE = 'COMPLIANCE',
  SECURITY = 'SECURITY',
}

registerEnumType(DeletionReason, { name: 'DeletionReason' });

@ObjectType()
export class DataDeletionRequest {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field({ nullable: true })
  userId?: string;

  @Field()
  dataType!: string;

  @Field(() => DeletionReason)
  reason!: DeletionReason;

  @Field()
  requestedBy!: string;

  @Field({ nullable: true })
  scheduledFor?: Date;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;

  @Field()
  createdAt!: Date;

  @Field({ nullable: true })
  completedAt?: Date;
}

export enum DeletionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

registerEnumType(DeletionStatus, { name: 'DeletionStatus' });

@ObjectType()
export class DeletionResult {
  @Field(() => ID)
  requestId!: string;

  @Field(() => DeletionStatus)
  status!: DeletionStatus;

  @Field()
  deletedRecords!: number;

  @Field(() => [String])
  errors!: string[];

  @Field({ nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  verificationHash?: string;
}

// ============================================================================
// SECURITY ALERT TYPES
// ============================================================================

export enum AlertStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
}

registerEnumType(AlertStatus, { name: 'AlertStatus' });

@ObjectType()
export class SecurityAlert {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  type!: string;

  @Field()
  severity!: string;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field()
  timestamp!: Date;

  @Field()
  source!: string;

  @Field(() => GraphQLJSON)
  metadata!: Record<string, any>;

  @Field(() => AlertStatus)
  status!: AlertStatus;

  @Field({ nullable: true })
  assignedTo?: string;

  @Field({ nullable: true })
  resolvedAt?: Date;

  @Field({ nullable: true })
  resolution?: string;
}

// ============================================================================
// AUDIT & COMPLIANCE REPORT TYPES
// ============================================================================

@ObjectType()
export class SecurityAuditReport {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  totalEvents!: number;

  @Field(() => GraphQLJSON)
  eventsByType!: Record<string, number>;

  @Field(() => GraphQLJSON)
  eventsBySeverity!: Record<string, number>;

  @Field(() => GraphQLJSON)
  eventsByCategory!: Record<string, number>;

  @Field(() => [String])
  topUsers!: string[];

  @Field(() => [String])
  topResources!: string[];

  @Field(() => [String])
  anomalies!: string[];

  @Field()
  generatedAt!: Date;
}

@ObjectType()
export class AuditPatternAnalysis {
  @Field(() => [String])
  topActions!: string[];

  @Field(() => [String])
  topResources!: string[];

  @Field(() => [String])
  topUsers!: string[];

  @Field(() => [String])
  topCategories!: string[];

  @Field(() => GraphQLJSON)
  timeDistribution!: Record<string, number>;

  @Field(() => [String])
  anomalies!: string[];
}

// ============================================================================
// ADVANCED SECURITY MONITORING TYPES
// ============================================================================

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

  @Field()
  normalBehaviorScore!: number;

  @Field()
  lastUpdate!: Date;
}

@ObjectType()
export class SecurityIncident {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  type!: string;

  @Field()
  severity!: string;

  @Field()
  description!: string;

  @Field()
  detectedAt!: Date;

  @Field({ nullable: true })
  resolvedAt?: Date;

  @Field()
  affectedResources!: number;

  @Field(() => [String])
  relatedThreats!: string[];

  @Field(() => [String])
  relatedAlerts!: string[];

  @Field(() => GraphQLJSON)
  timeline!: Record<string, any>;

  @Field()
  status!: string;

  @Field({ nullable: true })
  resolution?: string;
}

@ObjectType()
export class ComplianceGap {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  framework!: string;

  @Field()
  requirement!: string;

  @Field()
  severity!: string;

  @Field()
  description!: string;

  @Field()
  gap!: string;

  @Field(() => [String])
  recommendations!: string[];

  @Field()
  detectedAt!: Date;

  @Field({ nullable: true })
  targetRemediationDate?: Date;

  @Field()
  status!: string;
}
