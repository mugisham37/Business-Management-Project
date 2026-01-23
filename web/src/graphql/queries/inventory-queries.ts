/**
 * Inventory GraphQL Queries
 * Complete set of queries for inventory management
 */

import { gql } from '@apollo/client';

// ===== PRODUCT QUERIES =====

export const GET_PRODUCT = gql`
  query GetProduct($id: ID!) {
    product(id: $id) {
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
      variants {
        id
        sku
        name
        attributes {
          name
          value
        }
        price
        costPrice
        weight
        dimensions {
          length
          width
          height
          unit
        }
        images {
          url
          alt
          sortOrder
          isPrimary
        }
        status
        minStockLevel
        maxStockLevel
        reorderPoint
        reorderQuantity
        isActive
      }
      category {
        id
        name
        slug
      }
      brand {
        id
        name
        slug
      }
      supplier {
        id
        name
        code
      }
    }
  }
`;

export const GET_PRODUCTS = gql`
  query GetProducts($filter: ProductFilterInput, $pagination: OffsetPaginationArgs) {
    products(filter: $filter, pagination: $pagination) {
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
      taxable
      primaryImageUrl
      supplierId
      supplierSku
      minStockLevel
      maxStockLevel
      reorderPoint
      reorderQuantity
      requiresBatchTracking
      requiresExpiryDate
      isFeatured
      allowBackorders
      isActive
      launchedAt
      discontinuedAt
      createdAt
      updatedAt
      category {
        id
        name
        slug
      }
      brand {
        id
        name
        slug
      }
    }
  }
`;

// ===== INVENTORY QUERIES =====

export const GET_INVENTORY_LEVEL = gql`
  query GetInventoryLevel($productId: ID!, $locationId: ID!, $variantId: ID) {
    getInventory(productId: $productId, locationId: $locationId, variantId: $variantId) {
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
      }
      location {
        id
        name
        code
      }
    }
  }
`;

export const GET_INVENTORY_LEVELS = gql`
  query GetInventoryLevels($filter: InventoryFilterInput, $pagination: OffsetPaginationArgs) {
    getInventoryLevels(filter: $filter, pagination: $pagination) {
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

export const GET_INVENTORY_HISTORY = gql`
  query GetInventoryHistory($productId: ID!, $locationId: ID) {
    getInventoryHistory(productId: $productId, locationId: $locationId) {
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
      }
      location {
        id
        name
        code
      }
    }
  }
`;

// ===== CATEGORY QUERIES =====

export const GET_CATEGORY = gql`
  query GetCategory($id: ID!) {
    category(id: $id) {
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
      parent {
        id
        name
        slug
      }
      children {
        id
        name
        slug
        sortOrder
      }
    }
  }
`;

export const GET_CATEGORY_BY_SLUG = gql`
  query GetCategoryBySlug($slug: String!) {
    categoryBySlug(slug: $slug) {
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
      parent {
        id
        name
        slug
      }
      children {
        id
        name
        slug
        sortOrder
      }
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategories($filter: CategoryFilterInput, $pagination: OffsetPaginationArgs) {
    categories(filter: $filter, pagination: $pagination) {
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
      parent {
        id
        name
        slug
      }
    }
  }
`;

export const GET_CATEGORY_TREE = gql`
  query GetCategoryTree {
    categoryTree {
      id
      tenantId
      name
      description
      slug
      parentId
      sortOrder
      isActive
      children {
        id
        name
        slug
        sortOrder
        children {
          id
          name
          slug
          sortOrder
        }
      }
    }
  }
`;

// ===== BRAND QUERIES =====

export const GET_BRAND = gql`
  query GetBrand($id: ID!) {
    brand(id: $id) {
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

export const GET_BRAND_BY_SLUG = gql`
  query GetBrandBySlug($slug: String!) {
    brandBySlug(slug: $slug) {
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

export const GET_BRANDS = gql`
  query GetBrands($filter: BrandFilterInput, $pagination: OffsetPaginationArgs) {
    brands(filter: $filter, pagination: $pagination) {
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

// ===== BATCH TRACKING QUERIES =====

export const GET_BATCH_TRACKING = gql`
  query GetBatchTracking($productId: ID!, $locationId: ID!) {
    batchTracking(productId: $productId, locationId: $locationId) {
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
      product {
        id
        sku
        name
      }
      location {
        id
        name
        code
      }
    }
  }
`;

export const GET_BATCH_TRACKINGS = gql`
  query GetBatchTrackings($filter: BatchFilterInput, $pagination: OffsetPaginationArgs) {
    batchTrackings(filter: $filter, pagination: $pagination) {
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
      product {
        id
        sku
        name
      }
      location {
        id
        name
        code
      }
    }
  }
`;

export const GET_EXPIRING_BATCHES = gql`
  query GetExpiringBatches($daysAhead: Int = 30, $locationId: ID) {
    expiringBatches(daysAhead: $daysAhead, locationId: $locationId) {
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

export const GET_FIFO_BATCHES = gql`
  query GetFIFOBatches($productId: ID!, $variantId: ID, $locationId: ID!) {
    fifoBatches(productId: $productId, variantId: $variantId, locationId: $locationId) {
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

// ===== REPORTING QUERIES =====

export const GET_INVENTORY_SUMMARY = gql`
  query GetInventorySummary($locationId: ID) {
    inventorySummary(locationId: $locationId) {
      totalProducts
      totalValue
      lowStockItems
      outOfStockItems
      expiringItems
      totalMovements
      lastUpdated
    }
  }
`;

export const GET_LOW_STOCK_ITEMS = gql`
  query GetLowStockItems($locationId: ID) {
    lowStockItems(locationId: $locationId) {
      id
      productId
      variantId
      locationId
      currentLevel
      reorderPoint
      reorderQuantity
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

export const GET_OUT_OF_STOCK_ITEMS = gql`
  query GetOutOfStockItems($locationId: ID) {
    outOfStockItems(locationId: $locationId) {
      id
      productId
      variantId
      locationId
      currentLevel
      reorderPoint
      reorderQuantity
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