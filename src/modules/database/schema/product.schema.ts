import { pgTable, varchar, text, decimal, integer, jsonb, index, unique, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { baseSchema } from './base.schema';
import { tenants } from './tenant.schema';

// Product status enumeration
export const productStatusEnum = pgEnum('product_status', [
  'active',
  'inactive',
  'discontinued',
  'out_of_stock',
]);

// Product type enumeration
export const productTypeEnum = pgEnum('product_type', [
  'simple',
  'variable',
  'grouped',
  'digital',
  'service',
]);

// Unit of measure enumeration
export const unitOfMeasureEnum = pgEnum('unit_of_measure', [
  'piece',
  'kilogram',
  'gram',
  'liter',
  'milliliter',
  'meter',
  'centimeter',
  'square_meter',
  'cubic_meter',
  'hour',
  'day',
  'month',
  'year',
]);

// Main products table
export const products = pgTable('products', {
  ...baseSchema,
  
  // Basic product information
  sku: varchar('sku', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  shortDescription: varchar('short_description', { length: 500 }),
  
  // Product classification
  type: productTypeEnum('type').default('simple').notNull(),
  status: productStatusEnum('status').default('active').notNull(),
  
  // Categorization
  categoryId: varchar('category_id', { length: 255 }),
  brandId: varchar('brand_id', { length: 255 }),
  tags: jsonb('tags').default([]),
  
  // Pricing information
  basePrice: decimal('base_price', { precision: 12, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
  msrp: decimal('msrp', { precision: 12, scale: 2 }), // Manufacturer's Suggested Retail Price
  
  // Inventory settings
  trackInventory: boolean('track_inventory').default(true).notNull(),
  unitOfMeasure: unitOfMeasureEnum('unit_of_measure').default('piece').notNull(),
  
  // Physical properties
  weight: decimal('weight', { precision: 8, scale: 3 }),
  dimensions: jsonb('dimensions').default({}), // { length, width, height, unit }
  
  // Tax and accounting
  taxable: boolean('taxable').default(true).notNull(),
  taxCategoryId: varchar('tax_category_id', { length: 255 }),
  
  // SEO and marketing
  slug: varchar('slug', { length: 255 }),
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  
  // Media
  images: jsonb('images').default([]),
  primaryImageUrl: varchar('primary_image_url', { length: 500 }),
  
  // Custom attributes and metadata
  attributes: jsonb('attributes').default({}),
  customFields: jsonb('custom_fields').default({}),
  
  // Supplier information
  supplierId: varchar('supplier_id', { length: 255 }),
  supplierSku: varchar('supplier_sku', { length: 100 }),
  
  // Inventory thresholds
  minStockLevel: integer('min_stock_level').default(0),
  maxStockLevel: integer('max_stock_level'),
  reorderPoint: integer('reorder_point').default(0),
  reorderQuantity: integer('reorder_quantity').default(0),
  
  // Batch/lot tracking
  requiresBatchTracking: boolean('requires_batch_tracking').default(false).notNull(),
  requiresExpiryDate: boolean('requires_expiry_date').default(false).notNull(),
  shelfLife: integer('shelf_life'), // in days
  
  // Sales information
  isFeatured: boolean('is_featured').default(false).notNull(),
  allowBackorders: boolean('allow_backorders').default(false).notNull(),
  
  // Timestamps for lifecycle management
  launchedAt: varchar('launched_at', { length: 255 }),
  discontinuedAt: varchar('discontinued_at', { length: 255 }),
}, (table) => ({
  // Unique constraint on tenant_id + sku
  tenantSkuIdx: unique('products_tenant_sku_unique').on(table.tenantId, table.sku),
  
  // Performance indexes
  tenantIdIdx: index('products_tenant_id_idx').on(table.tenantId),
  skuIdx: index('products_sku_idx').on(table.sku),
  nameIdx: index('products_name_idx').on(table.name),
  statusIdx: index('products_status_idx').on(table.status),
  categoryIdIdx: index('products_category_id_idx').on(table.categoryId),
  brandIdIdx: index('products_brand_id_idx').on(table.brandId),
  supplierIdIdx: index('products_supplier_id_idx').on(table.supplierId),
  typeIdx: index('products_type_idx').on(table.type),
  trackInventoryIdx: index('products_track_inventory_idx').on(table.trackInventory),
  
  // Search indexes
  nameSearchIdx: index('products_name_search_idx').on(table.name),
  descriptionSearchIdx: index('products_description_search_idx').on(table.description),
}));

// Product variants table for variable products
export const productVariants = pgTable('product_variants', {
  ...baseSchema,
  productId: varchar('product_id', { length: 255 }).notNull(),
  
  // Variant identification
  sku: varchar('sku', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }),
  
  // Variant attributes (size, color, etc.)
  attributes: jsonb('attributes').notNull(), // { size: 'L', color: 'Red' }
  
  // Pricing overrides
  price: decimal('price', { precision: 12, scale: 2 }),
  costPrice: decimal('cost_price', { precision: 12, scale: 2 }),
  
  // Inventory overrides
  minStockLevel: integer('min_stock_level'),
  maxStockLevel: integer('max_stock_level'),
  reorderPoint: integer('reorder_point'),
  reorderQuantity: integer('reorder_quantity'),
  
  // Physical properties overrides
  weight: decimal('weight', { precision: 8, scale: 3 }),
  dimensions: jsonb('dimensions').default({}),
  
  // Media
  images: jsonb('images').default([]),
  primaryImageUrl: varchar('primary_image_url', { length: 500 }),
  
  // Status
  status: productStatusEnum('status').default('active').notNull(),
  
  // Sort order for display
  sortOrder: integer('sort_order').default(0),
}, (table) => ({
  // Unique constraint on tenant_id + sku
  tenantSkuIdx: unique('product_variants_tenant_sku_unique').on(table.tenantId, table.sku),
  
  // Performance indexes
  tenantIdIdx: index('product_variants_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('product_variants_product_id_idx').on(table.productId),
  skuIdx: index('product_variants_sku_idx').on(table.sku),
  statusIdx: index('product_variants_status_idx').on(table.status),
}));

// Product categories table
export const productCategories = pgTable('product_categories', {
  ...baseSchema,
  
  // Category information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  slug: varchar('slug', { length: 255 }),
  
  // Hierarchy support
  parentId: varchar('parent_id', { length: 255 }),
  level: integer('level').default(0).notNull(),
  path: varchar('path', { length: 1000 }), // /parent/child/grandchild
  
  // Display settings
  sortOrder: integer('sort_order').default(0),
  isVisible: boolean('is_visible').default(true).notNull(),
  
  // Media
  imageUrl: varchar('image_url', { length: 500 }),
  iconUrl: varchar('icon_url', { length: 500 }),
  
  // SEO
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  
  // Custom attributes
  attributes: jsonb('attributes').default({}),
}, (table) => ({
  // Unique constraint on tenant_id + slug
  tenantSlugIdx: unique('product_categories_tenant_slug_unique').on(table.tenantId, table.slug),
  
  // Performance indexes
  tenantIdIdx: index('product_categories_tenant_id_idx').on(table.tenantId),
  parentIdIdx: index('product_categories_parent_id_idx').on(table.parentId),
  levelIdx: index('product_categories_level_idx').on(table.level),
  pathIdx: index('product_categories_path_idx').on(table.path),
  sortOrderIdx: index('product_categories_sort_order_idx').on(table.sortOrder),
}));

// Product brands table
export const productBrands = pgTable('product_brands', {
  ...baseSchema,
  
  // Brand information
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  slug: varchar('slug', { length: 255 }),
  
  // Brand details
  website: varchar('website', { length: 500 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  
  // Contact information
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  
  // SEO
  metaTitle: varchar('meta_title', { length: 255 }),
  metaDescription: text('meta_description'),
  
  // Custom attributes
  attributes: jsonb('attributes').default({}),
}, (table) => ({
  // Unique constraint on tenant_id + slug
  tenantSlugIdx: unique('product_brands_tenant_slug_unique').on(table.tenantId, table.slug),
  
  // Performance indexes
  tenantIdIdx: index('product_brands_tenant_id_idx').on(table.tenantId),
  nameIdx: index('product_brands_name_idx').on(table.name),
}));

// Product attributes table for dynamic attributes
export const productAttributes = pgTable('product_attributes', {
  ...baseSchema,
  
  // Attribute definition
  name: varchar('name', { length: 100 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // text, number, boolean, select, multiselect, date
  
  // Validation rules
  isRequired: boolean('is_required').default(false).notNull(),
  validationRules: jsonb('validation_rules').default({}),
  
  // Options for select/multiselect types
  options: jsonb('options').default([]),
  
  // Display settings
  sortOrder: integer('sort_order').default(0),
  isVisible: boolean('is_visible').default(true).notNull(),
  isFilterable: boolean('is_filterable').default(false).notNull(),
  
  // Grouping
  groupName: varchar('group_name', { length: 100 }),
}, (table) => ({
  // Unique constraint on tenant_id + name
  tenantNameIdx: unique('product_attributes_tenant_name_unique').on(table.tenantId, table.name),
  
  // Performance indexes
  tenantIdIdx: index('product_attributes_tenant_id_idx').on(table.tenantId),
  typeIdx: index('product_attributes_type_idx').on(table.type),
  groupNameIdx: index('product_attributes_group_name_idx').on(table.groupName),
}));