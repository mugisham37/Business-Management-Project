import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsBoolean, IsNumber, IsArray, IsEnum, IsDate, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SecurityEventType, ThreatSeverity, ThreatStatus, ComplianceStatus } from '../types/security.types';

// Security Settings Input
@InputType()
export class UpdateSecuritySettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(128)
  passwordMinLength?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChars?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  passwordExpiryDays?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  mfaRequired?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  sessionTimeoutMinutes?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxLoginAttempts?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  lockoutDurationMinutes?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  ipWhitelistEnabled?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(3650)
  auditLogRetentionDays?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  encryptSensitiveData?: boolean;
}

// Security Event Filter
@InputType()
export class SecurityEventFilterInput {
  @Field(() => SecurityEventType, { nullable: true })
  @IsOptional()
  @IsEnum(SecurityEventType)
  type?: SecurityEventType;

  @Field(() => ThreatSeverity, { nullable: true })
  @IsOptional()
  @IsEnum(ThreatSeverity)
  severity?: ThreatSeverity;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  resource?: string;

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
  @IsBoolean()
  investigated?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

// Investigate Event Input
@InputType()
export class InvestigateEventInput {
  @Field()
  @IsString()
  eventId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  resolution?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

// Audit Log Filter
@InputType()
export class AuditLogFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  action?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  resource?: string;

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
  severity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  orderBy?: string;
}

// Export Audit Logs Input
@InputType()
export class ExportAuditLogsInput {
  @Field(() => AuditLogFilterInput, { nullable: true })
  @IsOptional()
  filter?: AuditLogFilterInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  format?: string;
}

// Compliance Check Input
@InputType()
export class RunComplianceCheckInput {
  @Field()
  @IsString()
  frameworkId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  checkType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  fullAudit?: boolean;
}

// Acknowledge Violation Input
@InputType()
export class AcknowledgeViolationInput {
  @Field()
  @IsString()
  violationId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  resolution?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

// Security Metrics Filter
@InputType()
export class SecurityMetricsFilterInput {
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
}

// Threat Analysis Filter
@InputType()
export class ThreatAnalysisFilterInput {
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

  @Field(() => ThreatSeverity, { nullable: true })
  @IsOptional()
  @IsEnum(ThreatSeverity)
  minSeverity?: ThreatSeverity;

  @Field(() => ThreatStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ThreatStatus)
  status?: ThreatStatus;
}

// Access Pattern Filter
@InputType()
export class AccessPatternFilterInput {
  @Field()
  @IsString()
  userId: string;

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
}
