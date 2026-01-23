/**
 * Inventory GraphQL Mutations
 * Complete set of mutations for inventory management
 */

import { gql } from '@apollo/client';

// ===== PRODUCT MUTATIONS =====

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
      tenantId
      sku
      name
      description
      shortDescription
      type
      status
      categoryId
      brandId
      tags
      basePrice
      costPrice
      msrp
      trackInventory
      unitOfMeasure
      weight
      dimensions {
        length
        width
        height
        unit
      }
      taxable
      taxCategoryId
      slug
      metaTitle
      metaDescription
      images {
        url
        alt
        sortOrder
        isPrimary
      }
      primaryImageUrl
      supplierId
      supplierSku
      minStockLevel
      maxStockLevel
      reorderPoint
      reorderQuantity
      requiresBatchTracking
      requiresExpiryDate
      shelfLife
      isFeatured
      allowBackorders
      isActive
      launchedAt
      discontinuedAt
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) {
      id
      tenantId
      sku
      name
      description
      shortDescription
      type
      status
      categoryId
      brandId
      tags
      basePrice
      costPrice
      msrp
      trackInventory
      unitOfMeasure
      weight
      dimensions {
        length
        width
        height
        unit
      }
      taxable
      taxCategoryId
      slug
      metaTitle
      metaDescription
      images {
        url
        alt
        sortOrder
        isPrimary
      }
      primaryImageUrl
      supplierId
      supplierSku
      minStockLevel
      maxStockLevel
      reorderPoint
      reorderQuantity
      requiresBatchTracking
      requiresExpiryDate
      shelfLife
      isFeatured
      allowBackorders
      isActive
      launchedAt
      discontinuedAt
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id)
  }
`;

export const BULK_UPDATE_PRODUCTS = gql`
  mutation BulkUpdateProducts($input: BulkUpdateProductsInput!) {
    bulkUpdateProducts(input: $input) {
      id
      sku
      name
      status
      basePrice
      costPrice
      updatedAt
    }
  }
`;

// ===== INVENTORY MUTATIONS =====

export const CREATE_INVENTORY_LEVEL = gql`
  mutation CreateInventoryLevel($input: CreateInventoryLevelInput!) {
    createInventoryLevel(input: $input) {
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
    }
  }
`;

export const UPDATE_INVENTORY_LEVEL = gql`
  mutation UpdateInventoryLevel($id: ID!, $input: UpdateInventoryLevelInput!) {
    updateInventoryLevel(id: $id, input: $input) {
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
    }
  }
`;

export const ADJUST_INVENTORY = gql`
  mutation AdjustInventory($input: AdjustInventoryInput!) {
    adjustInventory(input: $input) {
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
    }
  }
`;

export const TRANSFER_INVENTORY = gql`
  mutation TransferInventory($input: TransferInventoryInput!) {
    transferInventory(input: $input)
  }
`;

export const RESERVE_INVENTORY = gql`
  mutation ReserveInventory($input: ReserveInventoryInput!) {
    reserveInventory(input: $input)
  }
`;

export const RELEASE_RESERVATION = gql`
  mutation ReleaseReservation($reservationId: ID!) {
    releaseReservation(reservationId: $reservationId)
  }
`;

// ===== CATEGORY MUTATIONS =====

export const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      tenantId
      name
      description
      slug
      parentId
      sortOrder
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      tenantId
      name
      description
      slug
      parentId
      sortOrder
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const MOVE_CATEGORY = gql`
  mutation MoveCategory($id: ID!, $newParentId: ID) {
    moveCategory(id: $id, newParentId: $newParentId) {
      id
      tenantId
      name
      description
      slug
      parentId
      sortOrder
      isActive
      createdAt
      updatedAt
    }
  }
`;

// ===== BRAND MUTATIONS =====

export const CREATE_BRAND = gql`
  mutation CreateBrand($input: CreateBrandInput!) {
    createBrand(input: $input) {
      id
      tenantId
      name
      description
      slug
      logoUrl
      websiteUrl
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BRAND = gql`
  mutation UpdateBrand($id: ID!, $input: UpdateBrandInput!) {
    updateBrand(id: $id, input: $input) {
      id
      tenantId
      name
      description
      slug
      logoUrl
      websiteUrl
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_BRAND = gql`
  mutation DeleteBrand($id: ID!) {
    deleteBrand(id: $id)
  }
`;

// ===== BATCH TRACKING MUTATIONS =====

export const CREATE_BATCH_TRACKING = gql`
  mutation CreateBatchTracking($input: CreateBatchInput!) {
    createBatchTracking(input: $input) {
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

export const UPDATE_BATCH_TRACKING = gql`
  mutation UpdateBatchTracking($id: ID!, $input: UpdateBatchInput!) {
    updateBatchTracking(id: $id, input: $input) {
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

export const DELETE_BATCH_TRACKING = gql`
  mutation DeleteBatchTracking($id: ID!) {
    deleteBatchTracking(id: $id)
  }
`;

// ===== CYCLE COUNTING MUTATIONS =====

export const CREATE_CYCLE_COUNT = gql`
  mutation CreateCycleCount($input: CreateCycleCountInput!) {
    createCycleCount(input: $input) {
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

export const UPDATE_CYCLE_COUNT = gql`
  mutation UpdateCycleCount($id: ID!, $input: UpdateCycleCountInput!) {
    updateCycleCount(id: $id, input: $input) {
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

export const COMPLETE_CYCLE_COUNT = gql`
  mutation CompleteCycleCount($id: ID!) {
    completeCycleCount(id: $id) {
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

// ===== REORDER MUTATIONS =====

export const CREATE_REORDER_SUGGESTION = gql`
  mutation CreateReorderSuggestion($input: CreateReorderInput!) {
    createReorderSuggestion(input: $input) {
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
    }
  }
`;

export const PROCESS_REORDER_SUGGESTION = gql`
  mutation ProcessReorderSuggestion($id: ID!, $action: String!, $notes: String) {
    processReorderSuggestion(id: $id, action: $action, notes: $notes) {
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
    }
  }
`;

// ===== VALUATION MUTATIONS =====

export const RECALCULATE_INVENTORY_VALUATION = gql`
  mutation RecalculateInventoryValuation($input: RecalculateValuationInput!) {
    recalculateInventoryValuation(input: $input) {
      success
      message
      affectedItems
      totalValue
      processedAt
    }
  }
`;