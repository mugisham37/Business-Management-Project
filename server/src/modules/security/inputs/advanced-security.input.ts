import { InputType, Field } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  IsDate,
  IsEmail,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ThreatSeverity,
  ThreatStatus,
  ComplianceStatus,
} from '../types/security.types';
import {
  KeyStatus,
  SSOProvider,
  TestStatus,
  DeletionStatus,
  DeletionReason,
  AlertStatus,
} from '../types/advanced-security.types';

// ============================================================================
// THREAT PATTERN INPUTS
// ============================================================================

@InputType()
export class AddThreatPatternInput {
  @Field()
  @IsString()
  @MinLength(3)
  name!: string;

  @Field()
  @IsString()
  description!: string;

  @Field()
  @IsString()
  severity!: string;

  @Field()
  @IsNumber()
  @Min(0)
  timeWindowMs!: number;

  @Field()
  @IsNumber()
  @Min(1)
  threshold!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class UpdateThreatPatternInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeWindowMs?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  threshold?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class ThreatPatternFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  searchTerm?: string;
}

// ============================================================================
// KEY MANAGEMENT INPUTS
// ============================================================================

@InputType()
export class GenerateKeyInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  keyType!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  algorithm?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class RotateKeyInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  keyType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}

@InputType()
export class RevokeKeyInput {
  @Field()
  @IsString()
  keyId!: string;

  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  reason!: string;
}

@InputType()
export class KeyHistoryFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  keyType?: string;

  @Field(() => KeyStatus, { nullable: true })
  @IsOptional()
  @IsEnum(KeyStatus)
  status?: KeyStatus;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// ============================================================================
// BEHAVIORAL ANALYSIS INPUTS
// ============================================================================

@InputType()
export class BehavioralAnalysisFilterInput {
  @Field()
  @IsString()
  userId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  analysisType?: string;
}

@InputType()
export class CheckAccountCompromiseInput {
  @Field()
  @IsString()
  userId!: string;

  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  performDeepAnalysis?: boolean;
}

// ============================================================================
// ENTERPRISE AUTHENTICATION INPUTS
// ============================================================================

@InputType()
export class ConfigureSAMLInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  entityId!: string;

  @Field()
  @IsString()
  ssoUrl!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sloUrl?: string;

  @Field()
  @IsString()
  certificate!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nameIdFormat?: string;

  @Field(() => String)
  @IsArray()
  @IsString({ each: true })
  attributeMappings!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class ConfigureLDAPInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  url!: string;

  @Field()
  @IsString()
  bindDN!: string;

  @Field()
  @IsString()
  bindPassword!: string;

  @Field()
  @IsString()
  baseDN!: string;

  @Field()
  @IsString()
  userSearchFilter!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  groupSearchFilter?: string;

  @Field(() => String)
  @IsArray()
  @IsString({ each: true })
  attributeMappings!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  useTLS?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class ConfigureOAuth2Input {
  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  clientId!: string;

  @Field()
  @IsString()
  clientSecret!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  redirectUris!: string[];

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  scopes!: string[];

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  grantTypes!: string[];

  @Field()
  @IsString()
  tokenEndpointAuthMethod!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class ManageSSOSessionInput {
  @Field()
  @IsString()
  sessionId!: string;

  @Field()
  @IsString()
  action!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============================================================================
// PENETRATION TESTING INPUTS
// ============================================================================

@InputType()
export class InitiatePenetrationTestInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  testType!: string;

  @Field()
  @IsString()
  category!: string;

  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  description!: string;

  @Field()
  @IsString()
  methodology!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  targetEndpoints!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  autoSchedule?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  scheduleCron?: string;
}

@InputType()
export class PenetrationTestFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  testType?: string;

  @Field(() => TestStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TestStatus)
  status?: TestStatus;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

@InputType()
export class VulnerabilityFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// ============================================================================
// DATA DELETION INPUTS
// ============================================================================

@InputType()
export class ScheduleDataDeletionInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field()
  @IsString()
  dataType!: string;

  @Field()
  @IsEnum(DeletionReason)
  reason!: DeletionReason;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledFor?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;
}

@InputType()
export class CancelDataDeletionInput {
  @Field()
  @IsString()
  requestId!: string;

  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @IsString()
  reason!: string;
}

@InputType()
export class DeletionHistoryFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  dataType?: string;

  @Field(() => DeletionReason, { nullable: true })
  @IsOptional()
  @IsEnum(DeletionReason)
  reason?: DeletionReason;

  @Field(() => DeletionStatus, { nullable: true })
  @IsOptional()
  @IsEnum(DeletionStatus)
  status?: DeletionStatus;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// ============================================================================
// SECURITY ALERT INPUTS
// ============================================================================

@InputType()
export class ManageSecurityAlertInput {
  @Field()
  @IsString()
  alertId!: string;

  @Field()
  @IsString()
  action!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  resolution?: string;
}

@InputType()
export class SecurityAlertFilterInput {
  @Field(() => AlertStatus, { nullable: true })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  type?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

// ============================================================================
// AUDIT REPORT INPUTS
// ============================================================================

@InputType()
export class GenerateAuditReportInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field()
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Field()
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  format?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeAnalysis?: boolean;
}

@InputType()
export class AuditPatternFilterInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  timeWindowDays?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  analysisType?: string;
}

// ============================================================================
// ADVANCED MONITORING INPUTS
// ============================================================================

@InputType()
export class AccessPatternFilterInput {
  @Field()
  @IsString()
  userId!: string;

  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  period?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  anomalyThreshold?: number;
}

@InputType()
export class SecurityIncidentFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  type?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

@InputType()
export class ComplianceGapFilterInput {
  @Field()
  @IsString()
  tenantId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  framework?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}
