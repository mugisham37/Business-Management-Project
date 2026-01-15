import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsArray, 
  IsEnum, 
  IsObject, 
  ValidateNested, 
  Min, 
  Max, 
  Length,
  IsUUID,
  IsInt,
  ArrayMinSize,
  IsUrl,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// Enums
export enum ProductType {
  SIMPLE = 'simple',
  VARIABLE = 'variable',
  GROUPED = 'grouped',
  DIGITAL = 'digital',
  SERVICE = 'service',
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONTINUED = 'discontinued',
  OUT_OF_STOCK = 'out_of_stock',
}

export enum UnitOfMeasure {
  PIECE = 'piece',
  KILOGRAM = 'kilogram',
  GRAM = 'gram',
  LITER = 'liter',
  MILLILITER = 'milliliter',
  METER = 'meter',
  CENTIMETER = 'centimeter',
  SQUARE_METER = 'square_meter',
  CUBIC_METER = 'cubic_meter',
  HOUR = 'hour',
  DAY = 'day',
  MONTH = 'month',
  YEAR = 'year',
}

// Nested DTOs
export class ProductDimensionsDto {
  @ApiPropertyOptional({ description: 'Length in specified unit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @ApiPropertyOptional({ description: 'Width in specified unit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ description: 'Height in specified unit' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ description: 'Unit of measurement for dimensions' })
  @IsOptional()
  @IsString()
  unit?: string;
}

export class ProductImageDto {
  @ApiProperty({ description: 'Image URL' })
  @IsString()
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ description: 'Alt text for the image' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  alt?: string;

  @ApiPropertyOptional({ description: 'Sort order for image display' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether this is the primary image' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ProductVariantAttributeDto {
  @ApiProperty({ description: 'Attribute name (e.g., size, color)' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ description: 'Attribute value (e.g., Large, Red)' })
  @IsString()
  @Length(1, 100)
  value!: string;
}

export class CreateProductVariantDto {
  @ApiProperty({ description: 'Variant SKU' })
  @IsString()
  @Length(1, 100)
  sku!: string;

  @ApiPropertyOptional({ description: 'Variant name' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiProperty({ 
    description: 'Variant attributes',
    type: [ProductVariantAttributeDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeDto)
  @ArrayMinSize(1)
  attributes!: ProductVariantAttributeDto[];

  @ApiPropertyOptional({ description: 'Variant price override' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Variant cost price override' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ description: 'Variant weight override' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ 
    description: 'Variant dimensions override',
    type: ProductDimensionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @ApiPropertyOptional({ 
    description: 'Variant images',
    type: [ProductImageDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiPropertyOptional({ description: 'Variant status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Minimum stock level for this variant' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level for this variant' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Reorder point for this variant' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity for this variant' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;
}

// Main Product DTOs
export class CreateProductDto {
  @ApiProperty({ description: 'Product SKU (Stock Keeping Unit)' })
  @IsString()
  @Length(1, 100)
  sku!: string;

  @ApiProperty({ description: 'Product name' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Short product description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Product type', enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({ description: 'Product status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Brand ID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Product tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Base price' })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Cost price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ description: 'Manufacturer Suggested Retail Price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  msrp?: number;

  @ApiPropertyOptional({ description: 'Whether to track inventory for this product' })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ description: 'Unit of measure', enum: UnitOfMeasure })
  @IsOptional()
  @IsEnum(UnitOfMeasure)
  unitOfMeasure?: UnitOfMeasure;

  @ApiPropertyOptional({ description: 'Product weight' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ 
    description: 'Product dimensions',
    type: ProductDimensionsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @ApiPropertyOptional({ description: 'Whether the product is taxable' })
  @IsOptional()
  @IsBoolean()
  taxable?: boolean;

  @ApiPropertyOptional({ description: 'Tax category ID' })
  @IsOptional()
  @IsUUID()
  taxCategoryId?: string;

  @ApiPropertyOptional({ description: 'Product slug for URLs' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  slug?: string;

  @ApiPropertyOptional({ description: 'Meta title for SEO' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'Meta description for SEO' })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ 
    description: 'Product images',
    type: [ProductImageDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiPropertyOptional({ description: 'Primary image URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  primaryImageUrl?: string;

  @ApiPropertyOptional({ description: 'Custom attributes as key-value pairs' })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom fields as key-value pairs' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Supplier SKU' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  supplierSku?: string;

  @ApiPropertyOptional({ description: 'Minimum stock level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Reorder point' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Whether the product requires batch tracking' })
  @IsOptional()
  @IsBoolean()
  requiresBatchTracking?: boolean;

  @ApiPropertyOptional({ description: 'Whether the product requires expiry date tracking' })
  @IsOptional()
  @IsBoolean()
  requiresExpiryDate?: boolean;

  @ApiPropertyOptional({ description: 'Shelf life in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLife?: number;

  @ApiPropertyOptional({ description: 'Whether the product is featured' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Whether to allow backorders' })
  @IsOptional()
  @IsBoolean()
  allowBackorders?: boolean;

  @ApiPropertyOptional({ description: 'Product launch date' })
  @IsOptional()
  @IsDateString()
  launchedAt?: string;

  @ApiPropertyOptional({ 
    description: 'Product variants (for variable products)',
    type: [CreateProductVariantDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name, SKU, or description' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by brand ID' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Filter by product status', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Filter by product type', enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({ description: 'Filter by tags (comma-separated)' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by featured products' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by inventory tracking' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ description: 'Minimum price filter' })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price filter' })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
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

export class BulkUpdateProductsDto {
  @ApiProperty({ description: 'Array of product IDs to update' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  productIds!: string[];

  @ApiProperty({ description: 'Fields to update' })
  @ValidateNested()
  @Type(() => UpdateProductDto)
  updates!: UpdateProductDto;
}

export class ProductResponseDto {
  @ApiProperty({ description: 'Product ID' })
  id!: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId!: string;

  @ApiProperty({ description: 'Product SKU' })
  sku!: string;

  @ApiProperty({ description: 'Product name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Product description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Short description' })
  shortDescription?: string;

  @ApiProperty({ description: 'Product type', enum: ProductType })
  type!: ProductType;

  @ApiProperty({ description: 'Product status', enum: ProductStatus })
  status!: ProductStatus;

  @ApiPropertyOptional({ description: 'Category ID' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Brand ID' })
  brandId?: string;

  @ApiPropertyOptional({ description: 'Product tags' })
  tags?: string[];

  @ApiProperty({ description: 'Base price' })
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Cost price' })
  costPrice?: number;

  @ApiPropertyOptional({ description: 'MSRP' })
  msrp?: number;

  @ApiProperty({ description: 'Track inventory flag' })
  trackInventory!: boolean;

  @ApiProperty({ description: 'Unit of measure', enum: UnitOfMeasure })
  unitOfMeasure!: UnitOfMeasure;

  @ApiPropertyOptional({ description: 'Product weight' })
  weight?: number;

  @ApiPropertyOptional({ description: 'Product dimensions' })
  dimensions?: ProductDimensionsDto;

  @ApiProperty({ description: 'Taxable flag' })
  taxable!: boolean;

  @ApiPropertyOptional({ description: 'Tax category ID' })
  taxCategoryId?: string;

  @ApiPropertyOptional({ description: 'Product slug' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Meta title' })
  metaTitle?: string;

  @ApiPropertyOptional({ description: 'Meta description' })
  metaDescription?: string;

  @ApiPropertyOptional({ description: 'Product images' })
  images?: ProductImageDto[];

  @ApiPropertyOptional({ description: 'Primary image URL' })
  primaryImageUrl?: string;

  @ApiPropertyOptional({ description: 'Custom attributes' })
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom fields' })
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Supplier SKU' })
  supplierSku?: string;

  @ApiProperty({ description: 'Minimum stock level' })
  minStockLevel!: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  maxStockLevel?: number;

  @ApiProperty({ description: 'Reorder point' })
  reorderPoint!: number;

  @ApiProperty({ description: 'Reorder quantity' })
  reorderQuantity!: number;

  @ApiProperty({ description: 'Requires batch tracking' })
  requiresBatchTracking!: boolean;

  @ApiProperty({ description: 'Requires expiry date' })
  requiresExpiryDate!: boolean;

  @ApiPropertyOptional({ description: 'Shelf life in days' })
  shelfLife?: number;

  @ApiProperty({ description: 'Is featured' })
  isFeatured!: boolean;

  @ApiProperty({ description: 'Allow backorders' })
  allowBackorders!: boolean;

  @ApiProperty({ description: 'Is active' })
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Launch date' })
  launchedAt?: string;

  @ApiPropertyOptional({ description: 'Discontinued date' })
  discontinuedAt?: string;

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
}