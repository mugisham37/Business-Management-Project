import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsBoolean, 
  IsOptional, 
  IsEnum, 
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeatureFlagStatus } from '../entities/feature-flag.entity';
import { BusinessTier } from '../entities/tenant.entity';

@InputType()
export class FeatureRuleDto {
  @Field()
  @ApiProperty({ description: 'Rule condition (e.g., "employeeCount > 10")' })
  @IsString()
  @Length(1, 500)
  condition!: string;

  @Field()
  @ApiProperty({ description: 'Rule value (true/false)' })
  @IsBoolean()
  value!: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Rule description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}

@InputType()
export class CreateFeatureFlagDto {
  @Field()
  @ApiProperty({ description: 'Feature name (kebab-case)' })
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9-]+$/, { 
    message: 'Feature name must contain only lowercase letters, numbers, and hyphens' 
  })
  featureName!: string;

  @Field()
  @ApiProperty({ description: 'Whether the feature is enabled' })
  @IsBoolean()
  isEnabled!: boolean;

  @Field(() => BusinessTier, { nullable: true })
  @ApiPropertyOptional({ enum: BusinessTier, description: 'Required business tier for this feature' })
  @IsOptional()
  @IsEnum(BusinessTier)
  requiredTier?: BusinessTier;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Rollout percentage (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @Field(() => [FeatureRuleDto], { nullable: true })
  @ApiPropertyOptional({ type: [FeatureRuleDto], description: 'Custom rules for feature evaluation' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureRuleDto)
  customRules?: FeatureRuleDto[];

  @Field(() => FeatureFlagStatus, { nullable: true })
  @ApiPropertyOptional({ enum: FeatureFlagStatus, description: 'Feature flag status' })
  @IsOptional()
  @IsEnum(FeatureFlagStatus)
  status?: FeatureFlagStatus;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Feature description' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}

@InputType()
export class UpdateFeatureFlagDto extends PartialType(CreateFeatureFlagDto) {}

export class FeatureFlagQueryDto {
  @ApiPropertyOptional({ description: 'Filter by feature name' })
  @IsOptional()
  @IsString()
  featureName?: string;

  @ApiPropertyOptional({ description: 'Filter by enabled status' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: FeatureFlagStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(FeatureFlagStatus)
  status?: FeatureFlagStatus;

  @ApiPropertyOptional({ enum: BusinessTier, description: 'Filter by required tier' })
  @IsOptional()
  @IsEnum(BusinessTier)
  requiredTier?: BusinessTier;

  @ApiPropertyOptional({ description: 'Search by feature name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class FeatureAccessDto {
  @ApiProperty({ description: 'Feature name to check' })
  @IsString()
  @Length(1, 100)
  featureName!: string;
}

export class BulkFeatureAccessDto {
  @ApiProperty({ description: 'List of feature names to check', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 100, { each: true })
  featureNames!: string[];
}

export class FeatureEvaluationResultDto {
  @ApiProperty({ description: 'Feature name' })
  featureName!: string;

  @ApiProperty({ description: 'Whether the feature is available' })
  hasAccess!: boolean;

  @ApiProperty({ description: 'Reason for access/denial' })
  reason!: string;

  @ApiPropertyOptional({ enum: BusinessTier, description: 'Required tier if access denied' })
  requiredTier?: BusinessTier;

  @ApiPropertyOptional({ description: 'Whether an upgrade is required' })
  upgradeRequired?: boolean;
}