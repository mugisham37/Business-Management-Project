import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEmail, 
  IsOptional, 
  IsEnum, 
  IsObject, 
  IsPhoneNumber,
  Length,
  Matches,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessTier, SubscriptionStatus } from '../entities/tenant.entity';

@InputType()
export class BusinessMetricsDto {
  @Field()
  @ApiProperty({ description: 'Number of employees', minimum: 0 })
  @IsNumber()
  @Min(0)
  employeeCount!: number;

  @Field()
  @ApiProperty({ description: 'Number of locations', minimum: 1 })
  @IsNumber()
  @Min(1)
  locationCount!: number;

  @Field()
  @ApiProperty({ description: 'Monthly transaction volume', minimum: 0 })
  @IsNumber()
  @Min(0)
  monthlyTransactionVolume!: number;

  @Field()
  @ApiProperty({ description: 'Monthly revenue in cents', minimum: 0 })
  @IsNumber()
  @Min(0)
  monthlyRevenue!: number;
}

@InputType()
export class TenantSettingsDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Default timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Default locale' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  locale?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Default currency code' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Business logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Primary brand color' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Primary color must be a valid hex color' })
  primaryColor?: string;
}

@InputType()
export class CreateTenantDto {
  @Field()
  @ApiProperty({ description: 'Tenant name', minLength: 1, maxLength: 255 })
  @IsString()
  @Length(1, 255)
  name!: string;

  @Field()
  @ApiProperty({ 
    description: 'Unique slug for the tenant (lowercase, alphanumeric, hyphens only)',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z0-9-]+$/, { 
    message: 'Slug must contain only lowercase letters, numbers, and hyphens' 
  })
  slug!: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsPhoneNumber()
  contactPhone?: string;

  @Field(() => TenantSettingsDto, { nullable: true })
  @ApiPropertyOptional({ type: TenantSettingsDto, description: 'Initial tenant settings' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantSettingsDto)
  settings?: TenantSettingsDto;

  @Field(() => BusinessMetricsDto, { nullable: true })
  @ApiPropertyOptional({ type: BusinessMetricsDto, description: 'Initial business metrics' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessMetricsDto)
  metrics?: BusinessMetricsDto;
}

@InputType()
export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @Field(() => BusinessTier, { nullable: true })
  @ApiPropertyOptional({ enum: BusinessTier, description: 'Business tier' })
  @IsOptional()
  @IsEnum(BusinessTier)
  businessTier?: BusinessTier;

  @Field(() => SubscriptionStatus, { nullable: true })
  @ApiPropertyOptional({ enum: SubscriptionStatus, description: 'Subscription status' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Whether the tenant is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class UpdateBusinessMetricsDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Number of employees', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  employeeCount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Number of locations', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  locationCount?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Monthly transaction volume', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyTransactionVolume?: number;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Monthly revenue in cents', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRevenue?: number;
}

export class TenantQueryDto {
  @ApiPropertyOptional({ description: 'Filter by business tier' })
  @IsOptional()
  @IsEnum(BusinessTier)
  businessTier?: BusinessTier;

  @ApiPropertyOptional({ description: 'Filter by subscription status' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search by name or slug' })
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
  limit?: number = 20;
}