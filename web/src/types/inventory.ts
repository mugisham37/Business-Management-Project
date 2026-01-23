/**
 * Inventory Module Types
 * Complete type definitions for inventory management
 */

// ===== ENUMS =====

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

export enum InventoryMovementType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  ADJUSTMENT = 'adjustment',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  RETURN = 'return',
  DAMAGE = 'damage',
  THEFT = 'theft',
  EXPIRED = 'expired',
  RECOUNT = 'recount',
  PRODUCTION = 'production',
  CONSUMPTION = 'consumption',
}

export enum InventoryAdjustmentReason {
  MANUAL_COUNT = 'manual_count',
  CYCLE_COUNT = 'cycle_count',
  DAMAGED_GOODS = 'damaged_goods',
  EXPIRED_GOODS = 'expired_goods',
  THEFT_LOSS = 'theft_loss',
  SUPPLIER_ERROR = 'supplier_error',
  SYSTEM_ERROR = 'system_error',
  RETURN_TO_VENDOR = 'return_to_vendor',
  PROMOTIONAL_USE = 'promotional_use',
  INTERNAL_USE = 'internal_use',
  OTHER = 'other',
}

export enum InventoryValuationMethod {
  FIFO = 'fifo',
  LIFO = 'lifo',
  AVERAGE = 'average',
  SPECIFIC = 'specific',
}

export enum BatchStatus {
  ACTIVE = 'active',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
  RECALLED = 'recalled',
}

export enum CycleCountStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ReorderStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
}

export enum ReorderPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ===== CORE TYPES =====

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
}

export interface ProductImage {
  url: string;
  alt?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface ProductVariantAttribute {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name?: string;
  attributes: ProductVariantAttribute[];
  price?: number;
  costPrice?: number;
  weight?: number;
  dimensions?: ProductDimensions;
  images?: ProductImage[];
  status: ProductStatus;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  reorderQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  type: ProductType;
  status: ProductStatus;
  categoryId?: string;
  brandId?: string;
  tags?: string[];
  basePrice: number;
  costPrice?: number;
  msrp?: number;
  trackInventory: boolean;
  unitOfMeasure: UnitOfMeasure;
  weight?: number;
  dimensions?: ProductDimensions;
  taxable: boolean;
  taxCategoryId?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  images?: ProductImage[];
  primaryImageUrl?: string;
  supplierId?: string;
  supplierSku?: string;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  reorderQuantity: number;
  requiresBatchTracking: boolean;
  requiresExpiryDate: boolean;
  shelfLife?: number;
  isFeatured: boolean;
  allowBackorders: boolean;
  isActive: boolean;
  launchedAt?: Date;
  discontinuedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  variants?: ProductVariant[];
  category?: Category;
  brand?: Brand;
  supplier?: any; // Supplier type from supplier module
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  parent?: Category;
  children?: Category[];
  products?: Product[];
}

export interface Brand {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  slug: string;
  logoUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  products?: Product[];
}

export interface InventoryLevel {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  currentLevel: number;
  availableLevel: number;
  reservedLevel: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  reorderQuantity: number;
  valuationMethod: InventoryValuationMethod;
  averageCost: number;
  totalValue: number;
  binLocation?: string;
  zone?: string;
  lastMovementAt?: Date;
  lastCountAt?: Date;
  lowStockAlertSent: boolean;
  lastAlertSentAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  location?: any; // Location type from location module
}

export interface InventoryMovement {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  movementType: InventoryMovementType;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  previousLevel: number;
  newLevel: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: Date;
  reason?: InventoryAdjustmentReason;
  notes?: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  fromBinLocation?: string;
  toBinLocation?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  location?: any; // Location type from location module
}

export interface BatchTracking {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  batchNumber: string;
  lotNumber?: string;
  originalQuantity: number;
  currentQuantity: number;
  reservedQuantity: number;
  unitCost: number;
  totalCost: number;
  receivedDate: Date;
  expiryDate?: Date;
  status: BatchStatus;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  location?: any; // Location type from location module
}

export interface CycleCount {
  id: string;
  tenantId: string;
  locationId: string;
  countDate: Date;
  status: CycleCountStatus;
  totalItems: number;
  completedItems: number;
  discrepancies: number;
  notes?: string;
  createdBy: string;
  completedBy?: string;
  completedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  location?: any; // Location type from location module
  items?: CycleCountItem[];
}

export interface CycleCountItem {
  id: string;
  cycleCountId: string;
  productId: string;
  variantId?: string;
  expectedQuantity: number;
  countedQuantity?: number;
  discrepancy?: number;
  notes?: string;
  countedBy?: string;
  countedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
}

export interface ReorderSuggestion {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string;
  locationId: string;
  currentLevel: number;
  reorderPoint: number;
  suggestedQuantity: number;
  priority: ReorderPriority;
  status: ReorderStatus;
  notes?: string;
  createdBy: string;
  processedBy?: string;
  processedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  location?: any; // Location type from location module
}

export interface InventoryValuation {
  locationId: string;
  totalValue: number;
  totalItems: number;
  averageCost: number;
  lastUpdated: Date;
  method: InventoryValuationMethod;
}

// ===== INPUT TYPES =====

export interface ProductDimensionsInput {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
}

export interface ProductImageInput {
  url: string;
  alt?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface ProductVariantAttributeInput {
  name: string;
  value: string;
}

export interface CreateProductVariantInput {
  sku: string;
  name?: string;
  attributes: ProductVariantAttributeInput[];
  price?: number;
  costPrice?: number;
  weight?: number;
  dimensions?: ProductDimensionsInput;
  images?: ProductImageInput[];
  status?: ProductStatus;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  shortDescription?: string;
  type?: ProductType;
  status?: ProductStatus;
  categoryId?: string;
  brandId?: string;
  tags?: string[];
  basePrice: number;
  costPrice?: number;
  msrp?: number;
  trackInventory?: boolean;
  unitOfMeasure?: UnitOfMeasure;
  weight?: number;
  dimensions?: ProductDimensionsInput;
  taxable?: boolean;
  taxCategoryId?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  images?: ProductImageInput[];
  primaryImageUrl?: string;
  supplierId?: string;
  supplierSku?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  requiresBatchTracking?: boolean;
  requiresExpiryDate?: boolean;
  shelfLife?: number;
  isFeatured?: boolean;
  allowBackorders?: boolean;
  launchedAt?: string;
  variants?: CreateProductVariantInput[];
  attributes?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  type?: ProductType;
  status?: ProductStatus;
  categoryId?: string;
  brandId?: string;
  tags?: string[];
  basePrice?: number;
  costPrice?: number;
  msrp?: number;
  trackInventory?: boolean;
  unitOfMeasure?: UnitOfMeasure;
  weight?: number;
  dimensions?: ProductDimensionsInput;
  taxable?: boolean;
  taxCategoryId?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  images?: ProductImageInput[];
  primaryImageUrl?: string;
  supplierId?: string;
  supplierSku?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  requiresBatchTracking?: boolean;
  requiresExpiryDate?: boolean;
  shelfLife?: number;
  isFeatured?: boolean;
  allowBackorders?: boolean;
  launchedAt?: string;
  variants?: CreateProductVariantInput[];
  attributes?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface ProductFilterInput {
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  type?: ProductType;
  tags?: string;
  supplierId?: string;
  isFeatured?: boolean;
  trackInventory?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface BulkUpdateProductsInput {
  productIds: string[];
  updates: UpdateProductInput;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  slug?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  slug?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface CategoryFilterInput {
  search?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface CreateBrandInput {
  name: string;
  description?: string;
  slug?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string;
  slug?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface BrandFilterInput {
  search?: string;
  isActive?: boolean;
}

export interface CreateInventoryLevelInput {
  productId: string;
  variantId?: string;
  locationId: string;
  currentLevel?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  valuationMethod?: InventoryValuationMethod;
  averageCost?: number;
  binLocation?: string;
  zone?: string;
  attributes?: Record<string, any>;
}

export interface UpdateInventoryLevelInput {
  currentLevel?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  valuationMethod?: InventoryValuationMethod;
  averageCost?: number;
  binLocation?: string;
  zone?: string;
}

export interface AdjustInventoryInput {
  productId: string;
  variantId?: string;
  locationId: string;
  adjustment: number;
  reason: InventoryAdjustmentReason;
  notes?: string;
  unitCost?: number;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: string;
}

export interface TransferInventoryInput {
  productId: string;
  variantId?: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  notes?: string;
  expectedDeliveryDate?: string;
}

export interface ReserveInventoryInput {
  productId: string;
  variantId?: string;
  locationId: string;
  quantity: number;
  reservedFor: string;
  referenceId: string;
  reservedUntil?: string;
  notes?: string;
}

export interface InventoryFilterInput {
  productId?: string;
  locationId?: string;
  zone?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
}

export interface CreateBatchInput {
  productId: string;
  variantId?: string;
  locationId: string;
  batchNumber: string;
  lotNumber?: string;
  originalQuantity: number;
  unitCost: number;
  receivedDate: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateBatchInput {
  batchNumber?: string;
  lotNumber?: string;
  currentQuantity?: number;
  unitCost?: number;
  expiryDate?: string;
  status?: BatchStatus;
  notes?: string;
}

export interface BatchFilterInput {
  productId?: string;
  locationId?: string;
  status?: BatchStatus;
  expiryDateFrom?: string;
  expiryDateTo?: string;
}

export interface CreateCycleCountInput {
  locationId: string;
  countDate: string;
  notes?: string;
  items?: CreateCycleCountItemInput[];
}

export interface CreateCycleCountItemInput {
  productId: string;
  variantId?: string;
  expectedQuantity: number;
}

export interface UpdateCycleCountInput {
  countDate?: string;
  status?: CycleCountStatus;
  notes?: string;
}

export interface CreateReorderInput {
  productId: string;
  variantId?: string;
  locationId: string;
  suggestedQuantity: number;
  priority?: ReorderPriority;
  notes?: string;
}

export interface RecalculateValuationInput {
  locationId?: string;
  productIds?: string[];
  method?: InventoryValuationMethod;
}

// ===== RESPONSE TYPES =====

export interface ProductsResponse {
  products: Product[];
  totalCount: number;
  hasMore: boolean;
}

export interface CategoriesResponse {
  categories: Category[];
  totalCount: number;
  hasMore: boolean;
}

export interface BrandsResponse {
  brands: Brand[];
  totalCount: number;
  hasMore: boolean;
}

export interface InventoryLevelsResponse {
  inventoryLevels: InventoryLevel[];
  totalCount: number;
  hasMore: boolean;
}

export interface BatchTrackingsResponse {
  batches: BatchTracking[];
  totalCount: number;
  hasMore: boolean;
}

export interface InventorySummary {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  expiringItems: number;
  totalMovements: number;
  lastUpdated: Date;
}

export interface RecalculateValuationResponse {
  success: boolean;
  message: string;
  affectedItems: number;
  totalValue: number;
  processedAt: Date;
}

// ===== UTILITY TYPES =====

export interface InventoryStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
  averageValue: number;
}

export interface StockStatus {
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked';
  level: number;
  reorderPoint: number;
  daysOfStock?: number;
}

export interface InventoryAlert {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'expiring_batch' | 'reorder_suggestion';
  severity: 'info' | 'warning' | 'error' | 'critical';
  productId: string;
  locationId: string;
  message: string;
  data?: any;
  createdAt: Date;
}

// ===== PAGINATION TYPES =====

export interface OffsetPaginationArgs {
  offset?: number;
  limit?: number;
}

export interface CursorPaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

// ===== SORT TYPES =====

export interface SortInput {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface ProductSortInput extends SortInput {
  field: 'name' | 'sku' | 'basePrice' | 'createdAt' | 'updatedAt';
}

export interface InventorySortInput extends SortInput {
  field: 'currentLevel' | 'totalValue' | 'lastMovementAt' | 'createdAt' | 'updatedAt';
}