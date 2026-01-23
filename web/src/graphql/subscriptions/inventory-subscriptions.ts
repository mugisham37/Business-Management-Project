/**
 * Inventory GraphQL Subscriptions
 * Real-time subscriptions for inventory management
 */

import { gql } from '@apollo/client';

// ===== INVENTORY SUBSCRIPTIONS =====

export const INVENTORY_CHANGED = gql`
  subscription InventoryChanged($productId: ID, $locationId: ID) {
    inventoryChanged(productId: $productId, locationId: $locationId) {
      id
      tenantId
      productId
      variantId
      locationId
      currentLevel
      availableLevel
      reservedLevel
      minStockLevel
      maxStockLevel
      reorderPoint
      reorderQuantity
      valuationMethod
      averageCost
      totalValue
      binLocation
      zone
      lastMovementAt
      lastCountAt
      lowStockAlertSent
      lastAlertSentAt
      isActive
      createdAt
      updatedAt
      product {
        id
        sku
        name
        unitOfMeasure
        primaryImageUrl
      }
      location {
        id
        name
        code
      }
    }
  }
`;

export const LOW_STOCK_ALERT = gql`
  subscription LowStockAlert($locationId: ID) {
    lowStockAlert(locationId: $locationId) {
      id
      tenantId
      productId
      variantId
      locationId
      currentLevel
      availableLevel
      reservedLevel
      minStockLevel
      maxStockLevel
      reorderPoint
      reorderQuantity
      valuationMethod
      averageCost
      totalValue
      binLocation
      zone
      lastMovementAt
      lastCountAt
      lowStockAlertSent
      lastAlertSentAt
      isActive
      createdAt
      updatedAt
      product {
        id
        sku
        name
        unitOfMeasure
        primaryImageUrl
      }
      location {
        id
        name
        code
      }
    }
  }
`;

export const INVENTORY_MOVEMENT = gql`
  subscription InventoryMovement($productId: ID, $locationId: ID) {
    inventoryMovement(productId: $productId, locationId: $locationId) {
      id
      tenantId
      productId
      variantId
      locationId
      movementType
      quantity
      unitCost
      totalCost
      previousLevel
      newLevel
      referenceType
      referenceId
      referenceNumber
      batchNumber
      lotNumber
      expiryDate
      reason
      notes
      requiresApproval
      approvedBy
      approvedAt
      fromBinLocation
      toBinLocation
      isActive
      createdAt
      updatedAt
      product {
        id
        sku
        name
        unitOfMeasure
      }
      location {
        id
        name
        code
      }
    }
  }
`;

// ===== PRODUCT SUBSCRIPTIONS =====

export const PRODUCT_CREATED = gql`
  subscription ProductCreated {
    productCreated {
      id
      tenantId
      sku
      name
      description
      type
      status
      categoryId
      brandId
      basePrice
      costPrice
      trackInventory
      unitOfMeasure
      primaryImageUrl
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const PRODUCT_UPDATED = gql`
  subscription ProductUpdated($productId: ID) {
    productUpdated(productId: $productId) {
      id
      tenantId
      sku
      name
      description
      type
      status
      categoryId
      brandId
      basePrice
      costPrice
      trackInventory
      unitOfMeasure
      primaryImageUrl
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const PRODUCT_DELETED = gql`
  subscription ProductDeleted {
    productDeleted {
      id
      tenantId
      sku
      name
      deletedAt
    }
  }
`;

// ===== BATCH TRACKING SUBSCRIPTIONS =====

export const BATCH_EXPIRING_SOON = gql`
  subscription BatchExpiringSoon($locationId: ID, $daysAhead: Int = 7) {
    batchExpiringSoon(locationId: $locationId, daysAhead: $daysAhead) {
      id
      tenantId
      productId
      variantId
      locationId
      batchNumber
      lotNumber
      currentQuantity
      expiryDate
      status
      product {
        id
        sku
        name
        primaryImageUrl
      }
      location {
        id
        name
        code
      }
    }
  }
`;

export const BATCH_STATUS_CHANGED = gql`
  subscription BatchStatusChanged($productId: ID, $locationId: ID) {
    batchStatusChanged(productId: $productId, locationId: $locationId) {
      id
      tenantId
      productId
      variantId
      locationId
      batchNumber
      lotNumber
      originalQuantity
      currentQuantity
      reservedQuantity
      unitCost
      totalCost
      receivedDate
      expiryDate
      status
      notes
      isActive
      createdAt
      updatedAt
    }
  }
`;

// ===== REORDER SUBSCRIPTIONS =====

export const REORDER_SUGGESTION_CREATED = gql`
  subscription ReorderSuggestionCreated($locationId: ID) {
    reorderSuggestionCreated(locationId: $locationId) {
      id
      tenantId
      productId
      variantId
      locationId
      currentLevel
      reorderPoint
      suggestedQuantity
      priority
      status
      notes
      createdBy
      processedBy
      processedAt
      isActive
      createdAt
      updatedAt
      product {
        id
        sku
        name
        primaryImageUrl
      }
      location {
        id
        name
        code
      }
    }
  }
`;

// ===== CYCLE COUNT SUBSCRIPTIONS =====

export const CYCLE_COUNT_COMPLETED = gql`
  subscription CycleCountCompleted($locationId: ID) {
    cycleCountCompleted(locationId: $locationId) {
      id
      tenantId
      locationId
      countDate
      status
      totalItems
      completedItems
      discrepancies
      notes
      createdBy
      completedBy
      completedAt
      isActive
      createdAt
      updatedAt
    }
  }
`;

// ===== VALUATION SUBSCRIPTIONS =====

export const INVENTORY_VALUATION_UPDATED = gql`
  subscription InventoryValuationUpdated($locationId: ID) {
    inventoryValuationUpdated(locationId: $locationId) {
      locationId
      totalValue
      totalItems
      averageCost
      lastUpdated
      method
    }
  }
`;