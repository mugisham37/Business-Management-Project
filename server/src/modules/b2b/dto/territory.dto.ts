import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsArray, IsUUID, Length, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InputType, Field, Float, Int } from '@nestjs/graphql';

export enum TerritoryType {
  GEOGRAPHIC = 'geographic',
  INDUSTRY = 'industry',
  ACCOUNT_SIZE = 'account_size',
  PRODUCT_LINE = 'product_line',
  CUSTOM = 'custom',
}

@InputType()
export class CreateTerritoryDto {
  @Field()
  @ApiProperty({ description: 'Territory code (unique identifier)' })
  @IsString()
  @Length(1, 50)
  territoryCode!: string;

  @Field()
  @ApiProperty({ description: 'Territory name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Territory description' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field()
  @ApiProperty({ description: 'Territory type', enum: TerritoryType })
  @IsEnum(TerritoryType)
  territoryType!: TerritoryType;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Geographic boundaries (countries, states, zip codes)' })
  @IsOptional()
  geographicBounds?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Industry criteria for industry-based territories', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryCriteria?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Account size criteria (min/max revenue, employee count)' })
  @IsOptional()
  accountSizeCriteria?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Product line criteria', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productLineCriteria?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Custom criteria configuration' })
  @IsOptional()
  customCriteria?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary sales representative ID' })
  @IsOptional()
  @IsUUID()
  primarySalesRepId?: string;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Secondary sales representative IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  secondarySalesRepIds?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Territory manager ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Annual revenue target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenueTarget?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Quarterly revenue target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quarterlyRevenueTarget?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Customer acquisition target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customerAcquisitionTarget?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Commission structure configuration' })
  @IsOptional()
  commissionStructure?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

@InputType()
export class UpdateTerritoryDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Territory name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Territory description' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Territory active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Geographic boundaries' })
  @IsOptional()
  geographicBounds?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Industry criteria', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryCriteria?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Account size criteria' })
  @IsOptional()
  accountSizeCriteria?: Record<string, any>;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Product line criteria', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productLineCriteria?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Custom criteria configuration' })
  @IsOptional()
  customCriteria?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary sales representative ID' })
  @IsOptional()
  @IsUUID()
  primarySalesRepId?: string;

  @Field(() => [String], { nullable: true })
  @ApiPropertyOptional({ description: 'Secondary sales representative IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  secondarySalesRepIds?: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Territory manager ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Annual revenue target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenueTarget?: number;

  @Field(() => Float, { nullable: true })
  @ApiPropertyOptional({ description: 'Quarterly revenue target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quarterlyRevenueTarget?: number;

  @Field(() => Int, { nullable: true })
  @ApiPropertyOptional({ description: 'Customer acquisition target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customerAcquisitionTarget?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Commission structure configuration' })
  @IsOptional()
  commissionStructure?: Record<string, any>;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TerritoryQueryDto {
  @ApiPropertyOptional({ description: 'Search term for territory name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Territory type filter', enum: TerritoryType })
  @IsOptional()
  @IsEnum(TerritoryType)
  territoryType?: TerritoryType;

  @ApiPropertyOptional({ description: 'Active status filter' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Primary sales representative ID filter' })
  @IsOptional()
  @IsUUID()
  primarySalesRepId?: string;

  @ApiPropertyOptional({ description: 'Territory manager ID filter' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Minimum annual revenue target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAnnualRevenueTarget?: number;

  @ApiPropertyOptional({ description: 'Maximum annual revenue target' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAnnualRevenueTarget?: number;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', default: 'territoryCode' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'territoryCode';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}

@InputType()
export class AssignCustomerToTerritoryDto {
  @Field()
  @ApiProperty({ description: 'Customer ID to assign' })
  @IsUUID()
  customerId!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Assignment reason' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  assignmentReason?: string;
}

@InputType()
export class BulkAssignCustomersDto {
  @Field(() => [String])
  @ApiProperty({ description: 'Customer IDs to assign', type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  customerIds!: string[];

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Assignment reason' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  assignmentReason?: string;
}

export class TerritoryPerformanceDto {
  @ApiPropertyOptional({ description: 'Performance period start date' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Performance period end date' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Include customer metrics' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeCustomerMetrics?: boolean;

  @ApiPropertyOptional({ description: 'Include sales metrics' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeSalesMetrics?: boolean;

  @ApiPropertyOptional({ description: 'Include commission metrics' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeCommissionMetrics?: boolean;
}