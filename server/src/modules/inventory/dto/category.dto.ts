import { 
  IsString, 
  IsOptional, 
  IsBoolean, 
  IsObject, 
  IsUUID,
  IsInt,
  Min,
  Max,
  Length,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Category slug for URLs' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  slug?: string;

  @ApiPropertyOptional({ description: 'Parent category ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether category is visible' })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ description: 'Category image URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Category icon URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  iconUrl?: string;

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

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CategoryQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name or description' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by parent category ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Filter by visibility' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ description: 'Filter by level in hierarchy' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  level?: number;

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

export class CategoryResponseDto {
  @ApiProperty({ description: 'Category ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Category name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Category description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Parent category ID' })
  parentId?: string;

  @ApiProperty({ description: 'Level in hierarchy' })
  level!: number;

  @ApiPropertyOptional({ description: 'Path in hierarchy' })
  path?: string;

  @ApiProperty({ description: 'Sort order' })
  sortOrder!: number;

  @ApiProperty({ description: 'Is visible' })
  isVisible!: boolean;

  @ApiPropertyOptional({ description: 'Image URL' })
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Icon URL' })
  iconUrl?: string;

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

  @ApiPropertyOptional({ description: 'Child categories' })
  children?: CategoryResponseDto[];

  @ApiPropertyOptional({ description: 'Product count in category' })
  productCount?: number;
}