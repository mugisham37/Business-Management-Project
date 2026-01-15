import { 
  IsString, 
  IsOptional, 
  IsObject, 
  Length,
  IsUrl,
  IsEmail,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({ description: 'Brand name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Brand description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Brand slug for URLs' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  slug?: string;

  @ApiPropertyOptional({ description: 'Brand website URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Brand logo URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Meta title for SEO' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'Meta description for SEO' })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'Custom attributes as key-value pairs' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class BrandQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name or description' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Page number (1-based)' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class BrandResponseDto {
  @ApiProperty({ description: 'Brand ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Brand name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Brand description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Brand slug' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  website?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Meta title' })
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'Meta description' })
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'Custom attributes' })
  attributes?: Record<string, any>;

  @ApiProperty({ description: 'Is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  updatedBy?: string;

  @ApiProperty({ description: 'Version number' })
  version!: number;

  @ApiPropertyOptional({ description: 'Product count for brand' })
  productCount?: number;
}