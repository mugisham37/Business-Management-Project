/**
 * Inventory Utility Functions
 * Helper functions for inventory calculations and operations
 */

import {
  Product,
  InventoryLevel,
  InventoryMovement,
  BatchTracking,
  StockStatus,
  InventoryValuationMethod,
  ProductStatus,
  UnitOfMeasure,
  InventoryMovementType,
  BatchStatus,
} from '@/types/inventory';

// ===== STOCK STATUS CALCULATIONS =====

/**
 * Calculate stock status based on current level and thresholds
 */
export function calculateStockStatus(
  currentLevel: number,
  reorderPoint: number,
  maxStockLevel?: number
): StockStatus {
  if (currentLevel <= 0) {
    return { status: 'out_of_stock', level: currentLevel, reorderPoint };
  }
  
  if (currentLevel <= reorderPoint) {
    return { status: 'low_stock', level: currentLevel, reorderPoint };
  }
  
  if (maxStockLevel && currentLevel > maxStockLevel) {
    return { status: 'overstocked', level: currentLevel, reorderPoint };
  }
  
  return { status: 'in_stock', level: currentLevel, reorderPoint };
}

/**
 * Calculate days of stock remaining based on average consumption
 */
export function calculateDaysOfStock(
  currentLevel: number,
  averageDailyConsumption: number
): number | null {
  if (averageDailyConsumption <= 0) return null;
  return Math.floor(currentLevel / averageDailyConsumption);
}

/**
 * Calculate reorder quantity based on various factors
 */
export function calculateReorderQuantity(
  currentLevel: number,
  reorderPoint: number,
  maxStockLevel: number,
  averageDailyConsumption: number,
  leadTimeDays: number
): number {
  const safetyStock = averageDailyConsumption * leadTimeDays;
  const targetLevel = Math.min(maxStockLevel, reorderPoint + safetyStock);
  return Math.max(0, targetLevel - currentLevel);
}

// ===== INVENTORY VALUATION =====

/**
 * Calculate inventory value using different methods
 */
export function calculateInventoryValue(
  movements: InventoryMovement[],
  method: InventoryValuationMethod = InventoryValuationMethod.AVERAGE
): { totalValue: number; averageCost: number; totalQuantity: number } {
  if (movements.length === 0) {
    return { totalValue: 0, averageCost: 0, totalQuantity: 0 };
  }

  let totalValue = 0;
  let totalQuantity = 0;
  let averageCost = 0;

  switch (method) {
    case InventoryValuationMethod.FIFO:
      return calculateFIFOValue(movements);
    
    case InventoryValuationMethod.LIFO:
      return calculateLIFOValue(movements);
    
    case InventoryValuationMethod.AVERAGE:
      return calculateAverageValue(movements);
    
    case InventoryValuationMethod.SPECIFIC:
      return calculateSpecificValue(movements);
    
    default:
      return calculateAverageValue(movements);
  }
}

function calculateFIFOValue(movements: InventoryMovement[]) {
  // Sort by date (oldest first)
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let totalQuantity = 0;
  let totalValue = 0;
  const inventory: Array<{ quantity: number; unitCost: number }> = [];

  for (const movement of sortedMovements) {
    if (movement.quantity > 0) {
      // Incoming stock
      inventory.push({
        quantity: movement.quantity,
        unitCost: movement.unitCost || 0,
      });
      totalQuantity += movement.quantity;
    } else {
      // Outgoing stock
      let remainingToRemove = Math.abs(movement.quantity);
      
      while (remainingToRemove > 0 && inventory.length > 0) {
        const batch = inventory[0];
        const removeFromBatch = Math.min(remainingToRemove, batch.quantity);
        
        batch.quantity -= removeFromBatch;
        remainingToRemove -= removeFromBatch;
        totalQuantity -= removeFromBatch;
        
        if (batch.quantity <= 0) {
          inventory.shift();
        }
      }
    }
  }

  // Calculate total value from remaining inventory
  totalValue = inventory.reduce((sum, batch) => sum + (batch.quantity * batch.unitCost), 0);
  const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  return { totalValue, averageCost, totalQuantity };
}

function calculateLIFOValue(movements: InventoryMovement[]) {
  // Sort by date (newest first)
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  let totalQuantity = 0;
  let totalValue = 0;
  const inventory: Array<{ quantity: number; unitCost: number }> = [];

  for (const movement of sortedMovements) {
    if (movement.quantity > 0) {
      // Incoming stock
      inventory.unshift({
        quantity: movement.quantity,
        unitCost: movement.unitCost || 0,
      });
      totalQuantity += movement.quantity;
    } else {
      // Outgoing stock
      let remainingToRemove = Math.abs(movement.quantity);
      
      while (remainingToRemove > 0 && inventory.length > 0) {
        const batch = inventory[0];
        const removeFromBatch = Math.min(remainingToRemove, batch.quantity);
        
        batch.quantity -= removeFromBatch;
        remainingToRemove -= removeFromBatch;
        totalQuantity -= removeFromBatch;
        
        if (batch.quantity <= 0) {
          inventory.shift();
        }
      }
    }
  }

  // Calculate total value from remaining inventory
  totalValue = inventory.reduce((sum, batch) => sum + (batch.quantity * batch.unitCost), 0);
  const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  return { totalValue, averageCost, totalQuantity };
}

function calculateAverageValue(movements: InventoryMovement[]) {
  let totalQuantity = 0;
  let totalCost = 0;

  for (const movement of movements) {
    if (movement.quantity > 0 && movement.unitCost) {
      // Incoming stock
      totalQuantity += movement.quantity;
      totalCost += movement.quantity * movement.unitCost;
    } else if (movement.quantity < 0) {
      // Outgoing stock
      totalQuantity += movement.quantity; // quantity is negative
    }
  }

  const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
  const totalValue = totalQuantity * averageCost;

  return { totalValue, averageCost, totalQuantity };
}

function calculateSpecificValue(movements: InventoryMovement[]) {
  // For specific identification, we need batch/lot tracking
  // This is a simplified version
  return calculateAverageValue(movements);
}

// ===== BATCH TRACKING UTILITIES =====

/**
 * Check if a batch is expired
 */
export function isBatchExpired(batch: BatchTracking): boolean {
  if (!batch.expiryDate) return false;
  return new Date(batch.expiryDate) < new Date();
}

/**
 * Check if a batch is expiring soon
 */
export function isBatchExpiringSoon(batch: BatchTracking, warningDays = 7): boolean {
  if (!batch.expiryDate) return false;
  const expiryDate = new Date(batch.expiryDate);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + warningDays);
  return expiryDate <= warningDate && expiryDate > new Date();
}

/**
 * Calculate days until batch expiry
 */
export function getDaysUntilExpiry(batch: BatchTracking): number | null {
  if (!batch.expiryDate) return null;
  const expiryDate = new Date(batch.expiryDate);
  const today = new Date();
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Sort batches by FIFO order (oldest first)
 */
export function sortBatchesFIFO(batches: BatchTracking[]): BatchTracking[] {
  return [...batches].sort((a, b) => {
    // First by received date
    const receivedDateDiff = new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
    if (receivedDateDiff !== 0) return receivedDateDiff;
    
    // Then by expiry date if available
    if (a.expiryDate && b.expiryDate) {
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    }
    
    return 0;
  });
}

/**
 * Get batches to consume for a given quantity (FIFO)
 */
export function getBatchesToConsume(
  batches: BatchTracking[],
  quantityNeeded: number
): Array<{ batch: BatchTracking; quantity: number }> {
  const sortedBatches = sortBatchesFIFO(batches.filter(b => b.currentQuantity > 0));
  const result: Array<{ batch: BatchTracking; quantity: number }> = [];
  let remainingQuantity = quantityNeeded;

  for (const batch of sortedBatches) {
    if (remainingQuantity <= 0) break;
    
    const quantityFromBatch = Math.min(remainingQuantity, batch.currentQuantity);
    result.push({ batch, quantity: quantityFromBatch });
    remainingQuantity -= quantityFromBatch;
  }

  return result;
}

// ===== PRODUCT UTILITIES =====

/**
 * Check if a product is active and available
 */
export function isProductActive(product: Product): boolean {
  return product.status === ProductStatus.ACTIVE && product.isActive;
}

/**
 * Check if a product requires batch tracking
 */
export function requiresBatchTracking(product: Product): boolean {
  return product.requiresBatchTracking || product.requiresExpiryDate;
}

/**
 * Format product SKU with variant information
 */
export function formatProductSKU(product: Product, variantId?: string): string {
  if (!variantId || !product.variants) return product.sku;
  
  const variant = product.variants.find(v => v.id === variantId);
  return variant ? `${product.sku}-${variant.sku}` : product.sku;
}

/**
 * Calculate product dimensions volume
 */
export function calculateProductVolume(product: Product): number | null {
  if (!product.dimensions?.length || !product.dimensions?.width || !product.dimensions?.height) {
    return null;
  }
  
  return product.dimensions.length * product.dimensions.width * product.dimensions.height;
}

// ===== FORMATTING UTILITIES =====

/**
 * Format quantity with unit of measure
 */
export function formatQuantity(quantity: number, unitOfMeasure: UnitOfMeasure): string {
  const unitLabels: Record<UnitOfMeasure, string> = {
    [UnitOfMeasure.PIECE]: 'pcs',
    [UnitOfMeasure.KILOGRAM]: 'kg',
    [UnitOfMeasure.GRAM]: 'g',
    [UnitOfMeasure.LITER]: 'L',
    [UnitOfMeasure.MILLILITER]: 'mL',
    [UnitOfMeasure.METER]: 'm',
    [UnitOfMeasure.CENTIMETER]: 'cm',
    [UnitOfMeasure.SQUARE_METER]: 'm²',
    [UnitOfMeasure.CUBIC_METER]: 'm³',
    [UnitOfMeasure.HOUR]: 'hrs',
    [UnitOfMeasure.DAY]: 'days',
    [UnitOfMeasure.MONTH]: 'months',
    [UnitOfMeasure.YEAR]: 'years',
  };

  const unit = unitLabels[unitOfMeasure] || unitOfMeasure;
  return `${quantity.toLocaleString()} ${unit}`;
}

/**
 * Format currency value
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format movement type for display
 */
export function formatMovementType(type: InventoryMovementType): string {
  const typeLabels: Record<InventoryMovementType, string> = {
    [InventoryMovementType.SALE]: 'Sale',
    [InventoryMovementType.PURCHASE]: 'Purchase',
    [InventoryMovementType.ADJUSTMENT]: 'Adjustment',
    [InventoryMovementType.TRANSFER_IN]: 'Transfer In',
    [InventoryMovementType.TRANSFER_OUT]: 'Transfer Out',
    [InventoryMovementType.RETURN]: 'Return',
    [InventoryMovementType.DAMAGE]: 'Damage',
    [InventoryMovementType.THEFT]: 'Theft',
    [InventoryMovementType.EXPIRED]: 'Expired',
    [InventoryMovementType.RECOUNT]: 'Recount',
    [InventoryMovementType.PRODUCTION]: 'Production',
    [InventoryMovementType.CONSUMPTION]: 'Consumption',
  };

  return typeLabels[type] || type;
}

/**
 * Format batch status for display
 */
export function formatBatchStatus(status: BatchStatus): string {
  const statusLabels: Record<BatchStatus, string> = {
    [BatchStatus.ACTIVE]: 'Active',
    [BatchStatus.CONSUMED]: 'Consumed',
    [BatchStatus.EXPIRED]: 'Expired',
    [BatchStatus.RECALLED]: 'Recalled',
  };

  return statusLabels[status] || status;
}

// ===== VALIDATION UTILITIES =====

/**
 * Validate inventory adjustment input
 */
export function validateInventoryAdjustment(
  currentLevel: number,
  adjustment: number,
  minLevel = 0
): { isValid: boolean; error?: string } {
  const newLevel = currentLevel + adjustment;
  
  if (newLevel < minLevel) {
    return {
      isValid: false,
      error: `Adjustment would result in negative inventory (${newLevel})`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate inventory transfer
 */
export function validateInventoryTransfer(
  fromLevel: number,
  transferQuantity: number
): { isValid: boolean; error?: string } {
  if (transferQuantity <= 0) {
    return {
      isValid: false,
      error: 'Transfer quantity must be positive',
    };
  }
  
  if (transferQuantity > fromLevel) {
    return {
      isValid: false,
      error: `Insufficient inventory (available: ${fromLevel}, requested: ${transferQuantity})`,
    };
  }
  
  return { isValid: true };
}

/**
 * Validate product SKU format
 */
export function validateSKU(sku: string): { isValid: boolean; error?: string } {
  if (!sku || sku.trim().length === 0) {
    return { isValid: false, error: 'SKU is required' };
  }
  
  if (sku.length < 3) {
    return { isValid: false, error: 'SKU must be at least 3 characters long' };
  }
  
  if (!/^[A-Za-z0-9\-_]+$/.test(sku)) {
    return { isValid: false, error: 'SKU can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return { isValid: true };
}

// ===== SEARCH AND FILTER UTILITIES =====

/**
 * Filter products by search term
 */
export function filterProductsBySearch(products: Product[], searchTerm: string): Product[] {
  if (!searchTerm.trim()) return products;
  
  const term = searchTerm.toLowerCase();
  
  return products.filter(product => 
    product.name.toLowerCase().includes(term) ||
    product.sku.toLowerCase().includes(term) ||
    product.description?.toLowerCase().includes(term) ||
    product.tags?.some(tag => tag.toLowerCase().includes(term))
  );
}

/**
 * Sort products by various criteria
 */
export function sortProducts(
  products: Product[],
  sortBy: 'name' | 'sku' | 'price' | 'created',
  direction: 'asc' | 'desc' = 'asc'
): Product[] {
  const sorted = [...products].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'sku':
        comparison = a.sku.localeCompare(b.sku);
        break;
      case 'price':
        comparison = (a.basePrice || 0) - (b.basePrice || 0);
        break;
      case 'created':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    
    return direction === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

// ===== EXPORT UTILITIES =====

/**
 * Convert inventory data to CSV format
 */
export function convertInventoryToCSV(inventoryLevels: InventoryLevel[]): string {
  const headers = [
    'Product SKU',
    'Product Name',
    'Location',
    'Current Level',
    'Available Level',
    'Reserved Level',
    'Reorder Point',
    'Total Value',
    'Last Updated'
  ];
  
  const rows = inventoryLevels.map(level => [
    level.product?.sku || '',
    level.product?.name || '',
    level.location?.name || '',
    level.currentLevel.toString(),
    level.availableLevel.toString(),
    level.reservedLevel.toString(),
    level.reorderPoint.toString(),
    level.totalValue.toString(),
    new Date(level.updatedAt).toISOString()
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}