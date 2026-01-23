/**
 * Warehouse GraphQL Queries
 * Complete set of queries for warehouse management
 */

import { gql } from '@apollo/client';

// ===== FRAGMENTS =====

export const WAREHOUSE_FRAGMENT = gql`
  fragment WarehouseFragment on Warehouse {
    id
    tenantId
    locationId
    warehouseCode
    name
    description
    totalSquareFootage
    storageSquareFootage
    ceilingHeight
    totalBinLocations
    occupiedBinLocations
    maxCapacityUnits
    currentCapacityUnits
    layoutType
    timezone
    temperatureControlled
    humidityControlled
    securityLevel
    accessControlRequired
    wmsIntegration
    barcodeSystem
    rfidEnabled
    automatedSorting
    pickingAccuracy
    averagePickTime
    throughputPerHour
    warehouseManagerId
    status
    createdAt
    updatedAt
    deletedAt
    version
  }
`;

export const WAREHOUSE_CAPACITY_FRAGMENT = gql`
  fragment WarehouseCapacityFragment on WarehouseCapacity {
    warehouseId
    totalCapacity
    usedCapacity
    availableCapacity
    utilizationPercentage
    totalBinLocations
    occupiedBinLocations
    availableBinLocations
  }
`;

export const WAREHOUSE_ZONE_FRAGMENT = gql`
  fragment WarehouseZoneFragment on WarehouseZone {
    id
    tenantId
    warehouseId
    zoneCode
    name
    description
    zoneType
    capacity
    priority
    coordinates
    squareFootage
    maxBinLocations
    currentBinLocations
    temperatureControlled
    temperatureRange
    humidityControlled
    allowMixedProducts
    allowMixedBatches
    fifoEnforced
    requiresAuthorization
    accessLevel
    status
    createdAt
    updatedAt
  }
`;

export const BIN_LOCATION_FRAGMENT = gql`
  fragment BinLocationFragment on BinLocation {
    id
    tenantId
    warehouseId
    zoneId
    binCode
    displayName
    name
    description
    aisle
    bay
    level
    rack
    shelf
    position
    xCoordinate
    yCoordinate
    zCoordinate
    length
    width
    height
    volume
    maxCapacity
    capacityUnit
    maxWeight
    weightUnit
    accessEquipment
    allowedProductTypes
    restrictedProductTypes
    temperatureControlled
    temperatureRange
    hazmatApproved
    pickingSequence
    assignedProductId
    assignedVariantId
    dedicatedProduct
    occupancyPercentage
    currentWeight
    status
    lastActivityAt
    lastPickAt
    lastReplenishAt
    createdAt
    updatedAt
  }
`;

export const PICKING_WAVE_FRAGMENT = gql`
  fragment PickingWaveFragment on PickingWave {
    id
    tenantId
    warehouseId
    waveNumber
    name
    description
    status
    priority
    plannedDate
    scheduledDate
    startedAt
    completedAt
    assignedPickers
    totalOrders
    totalItems
    totalQuantity
    pickingAccuracy
    averagePickTime
    estimatedDuration
    actualDuration
    createdAt
    updatedAt
  }
`;

export const PICK_LIST_FRAGMENT = gql`
  fragment PickListFragment on PickList {
    id
    tenantId
    warehouseId
    waveId
    pickListNumber
    orderId
    customerId
    assignedPickerId
    status
    priority
    totalItems
    totalQuantity
    pickedItems
    pickedQuantity
    estimatedPickTime
    actualPickTime
    pickingAccuracy
    scheduledDate
    startedAt
    completedAt
    createdAt
    updatedAt
  }
`;

export const SHIPMENT_FRAGMENT = gql`
  fragment ShipmentFragment on Shipment {
    id
    tenantId
    warehouseId
    pickListId
    shipmentNumber
    trackingNumber
    carrierId
    serviceType
    status
    fromAddress {
      name
      company
      street1
      street2
      city
      state
      postalCode
      country
      phone
      email
    }
    toAddress {
      name
      company
      street1
      street2
      city
      state
      postalCode
      country
      phone
      email
    }
    weight
    weightUnit
    dimensions {
      length
      width
      height
      unit
    }
    declaredValue
    currency
    shippingCost
    insuranceCost
    totalCost
    estimatedDeliveryDate
    actualDeliveryDate
    shippedDate
    deliveryConfirmation
    signature
    createdAt
    updatedAt
  }
`;

export const LOT_INFO_FRAGMENT = gql`
  fragment LotInfoFragment on LotInfo {
    id
    tenantId
    productId
    warehouseId
    binLocationId
    lotNumber
    batchNumber
    serialNumber
    quantity
    unitOfMeasure
    manufacturingDate
    expiryDate
    receivedDate
    supplierId
    qualityStatus
    status
    notes
    createdAt
    updatedAt
  }
`;

export const KIT_DEFINITION_FRAGMENT = gql`
  fragment KitDefinitionFragment on KitDefinition {
    id
    tenantId
    kitSku
    name
    description
    version
    isActive
    components {
      id
      productId
      variantId
      quantity
      unitOfMeasure
      isOptional
      substitutes
    }
    assemblyInstructions
    qualityChecks {
      id
      name
      description
      checkType
      required
      parameters
    }
    estimatedAssemblyTime
    skillLevel
    costCalculation
    fixedPrice
    markup
    createdAt
    updatedAt
  }
`;

export const ASSEMBLY_WORK_ORDER_FRAGMENT = gql`
  fragment AssemblyWorkOrderFragment on AssemblyWorkOrder {
    id
    tenantId
    kitId
    warehouseId
    workOrderNumber
    quantityToAssemble
    quantityAssembled
    status
    priority
    assignedTo
    scheduledDate
    startedAt
    completedAt
    estimatedDuration
    actualDuration
    qualityChecksPassed
    qualityChecksTotal
    components {
      id
      workOrderId
      productId
      variantId
      quantityRequired
      quantityAllocated
      quantityConsumed
      status
      binLocationId
      lotNumber
    }
    notes
    createdAt
    updatedAt
  }
`;

// ===== WAREHOUSE QUERIES =====

export const GET_WAREHOUSE = gql`
  ${WAREHOUSE_FRAGMENT}
  ${WAREHOUSE_CAPACITY_FRAGMENT}
  query GetWarehouse($id: ID!) {
    warehouse(id: $id) {
      ...WarehouseFragment
      capacity {
        ...WarehouseCapacityFragment
      }
      manager {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

export const GET_WAREHOUSES = gql`
  ${WAREHOUSE_FRAGMENT}
  query GetWarehouses(
    $first: Int
    $after: String
    $filter: WarehouseFilterInput
  ) {
    warehouses(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...WarehouseFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_WAREHOUSE_CAPACITY = gql`
  ${WAREHOUSE_CAPACITY_FRAGMENT}
  query GetWarehouseCapacity($warehouseId: ID!) {
    warehouseCapacity(warehouseId: $warehouseId) {
      ...WarehouseCapacityFragment
    }
  }
`;

export const GET_WAREHOUSES_BY_LOCATION = gql`
  ${WAREHOUSE_FRAGMENT}
  query GetWarehousesByLocation($locationId: ID!) {
    warehousesByLocation(locationId: $locationId) {
      ...WarehouseFragment
    }
  }
`;

// ===== WAREHOUSE ZONE QUERIES =====

export const GET_WAREHOUSE_ZONE = gql`
  ${WAREHOUSE_ZONE_FRAGMENT}
  query GetWarehouseZone($id: ID!) {
    warehouseZone(id: $id) {
      ...WarehouseZoneFragment
      warehouse {
        id
        name
        warehouseCode
      }
    }
  }
`;

export const GET_WAREHOUSE_ZONES = gql`
  ${WAREHOUSE_ZONE_FRAGMENT}
  query GetWarehouseZones($warehouseId: ID!) {
    warehouseZones(warehouseId: $warehouseId) {
      ...WarehouseZoneFragment
    }
  }
`;

// ===== BIN LOCATION QUERIES =====

export const GET_BIN_LOCATION = gql`
  ${BIN_LOCATION_FRAGMENT}
  query GetBinLocation($id: ID!) {
    binLocation(id: $id) {
      ...BinLocationFragment
      zone {
        id
        name
        zoneCode
        zoneType
      }
      warehouse {
        id
        name
        warehouseCode
      }
    }
  }
`;

export const GET_BIN_INVENTORY = gql`
  ${BIN_LOCATION_FRAGMENT}
  query GetBinInventory($warehouseId: ID!, $zoneId: ID) {
    binInventory(warehouseId: $warehouseId, zoneId: $zoneId) {
      ...BinLocationFragment
    }
  }
`;

// ===== PICKING WAVE QUERIES =====

export const GET_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  query GetPickingWave($id: ID!) {
    pickingWave(id: $id) {
      ...PickingWaveFragment
      warehouse {
        id
        name
        warehouseCode
      }
      assignedPickersData {
        id
        firstName
        lastName
        email
      }
      statistics {
        waveId
        totalOrders
        totalItems
        totalQuantity
        completedOrders
        completedItems
        completedQuantity
        pickingAccuracy
        averagePickTime
        estimatedCompletion
        progressPercentage
      }
    }
  }
`;

export const GET_PICKING_WAVES = gql`
  ${PICKING_WAVE_FRAGMENT}
  query GetPickingWaves(
    $first: Int
    $after: String
    $filter: PickingWaveFilterInput
  ) {
    pickingWaves(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...PickingWaveFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_PICKING_WAVES_BY_WAREHOUSE = gql`
  ${PICKING_WAVE_FRAGMENT}
  query GetPickingWavesByWarehouse($warehouseId: ID!) {
    pickingWavesByWarehouse(warehouseId: $warehouseId) {
      ...PickingWaveFragment
    }
  }
`;

export const GET_PICKING_WAVES_BY_PICKER = gql`
  ${PICKING_WAVE_FRAGMENT}
  query GetPickingWavesByPicker($pickerId: ID!) {
    pickingWavesByPicker(pickerId: $pickerId) {
      ...PickingWaveFragment
    }
  }
`;

export const GET_OVERDUE_PICKING_WAVES = gql`
  ${PICKING_WAVE_FRAGMENT}
  query GetOverduePickingWaves($warehouseId: ID) {
    overduePickingWaves(warehouseId: $warehouseId) {
      ...PickingWaveFragment
    }
  }
`;

export const GET_WAVE_STATISTICS = gql`
  query GetWaveStatistics($waveId: ID!) {
    pickingWaveStatistics(waveId: $waveId) {
      waveId
      totalOrders
      totalItems
      totalQuantity
      completedOrders
      completedItems
      completedQuantity
      pickingAccuracy
      averagePickTime
      estimatedCompletion
      progressPercentage
    }
  }
`;

export const GET_WAVE_RECOMMENDATIONS = gql`
  query GetWaveRecommendations($warehouseId: ID!) {
    pickingWaveRecommendations(warehouseId: $warehouseId) {
      type
      priority
      title
      description
      actionRequired
      estimatedImpact
    }
  }
`;

// ===== PICK LIST QUERIES =====

export const GET_PICK_LIST = gql`
  ${PICK_LIST_FRAGMENT}
  query GetPickList($id: ID!) {
    pickList(id: $id) {
      ...PickListFragment
      wave {
        id
        waveNumber
        name
      }
      warehouse {
        id
        name
        warehouseCode
      }
      assignedPicker {
        id
        firstName
        lastName
        email
      }
      items {
        id
        pickListId
        productId
        variantId
        binLocationId
        lotNumber
        quantityToPick
        pickedQuantity
        status
        pickingSequence
        notes
        binLocation {
          id
          binCode
          displayName
          aisle
          bay
          level
        }
      }
    }
  }
`;

export const GET_PICK_LISTS = gql`
  ${PICK_LIST_FRAGMENT}
  query GetPickLists(
    $first: Int
    $after: String
    $warehouseId: ID
    $status: String
    $assignedTo: ID
  ) {
    pickLists(
      first: $first
      after: $after
      warehouseId: $warehouseId
      status: $status
      assignedTo: $assignedTo
    ) {
      edges {
        node {
          ...PickListFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

// ===== SHIPMENT QUERIES =====

export const GET_SHIPMENT = gql`
  ${SHIPMENT_FRAGMENT}
  query GetShipment($id: ID!) {
    shipment(id: $id) {
      ...ShipmentFragment
      warehouse {
        id
        name
        warehouseCode
      }
      pickList {
        id
        pickListNumber
        orderId
      }
      trackingEvents {
        id
        trackingNumber
        eventType
        eventDescription
        eventDate
        location
        carrier
        status
      }
      latestTrackingEvent {
        id
        eventType
        eventDescription
        eventDate
        location
      }
      shippingLabel {
        id
        labelUrl
        labelFormat
        trackingNumber
      }
      isDelivered
      isInTransit
      hasException
      transitDays
      isOnTime
    }
  }
`;

export const GET_SHIPMENTS = gql`
  ${SHIPMENT_FRAGMENT}
  query GetShipments(
    $first: Int
    $after: String
    $filter: ShipmentFilterInput
  ) {
    shipments(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...ShipmentFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_SHIPMENT_BY_TRACKING_NUMBER = gql`
  ${SHIPMENT_FRAGMENT}
  query GetShipmentByTrackingNumber($trackingNumber: String!) {
    shipmentByTrackingNumber(trackingNumber: $trackingNumber) {
      ...ShipmentFragment
    }
  }
`;

export const GET_SHIPMENTS_BY_WAREHOUSE = gql`
  ${SHIPMENT_FRAGMENT}
  query GetShipmentsByWarehouse($warehouseId: ID!) {
    shipmentsByWarehouse(warehouseId: $warehouseId) {
      ...ShipmentFragment
    }
  }
`;

export const GET_PENDING_SHIPMENTS = gql`
  ${SHIPMENT_FRAGMENT}
  query GetPendingShipments($warehouseId: ID) {
    pendingShipments(warehouseId: $warehouseId) {
      ...ShipmentFragment
    }
  }
`;

export const GET_IN_TRANSIT_SHIPMENTS = gql`
  ${SHIPMENT_FRAGMENT}
  query GetInTransitShipments($warehouseId: ID) {
    inTransitShipments(warehouseId: $warehouseId) {
      ...ShipmentFragment
    }
  }
`;

export const GET_DELIVERED_SHIPMENTS = gql`
  ${SHIPMENT_FRAGMENT}
  query GetDeliveredShipments($warehouseId: ID, $days: Int = 7) {
    deliveredShipments(warehouseId: $warehouseId, days: $days) {
      ...ShipmentFragment
    }
  }
`;

export const GET_EXCEPTION_SHIPMENTS = gql`
  ${SHIPMENT_FRAGMENT}
  query GetExceptionShipments($warehouseId: ID) {
    exceptionShipments(warehouseId: $warehouseId) {
      ...ShipmentFragment
    }
  }
`;

export const GET_SHIPPING_RATES = gql`
  query GetShippingRates($input: GetShippingRatesInput!) {
    shippingRates(input: $input) {
      carrierId
      serviceName
      serviceType
      rate
      currency
      estimatedDeliveryDate
      transitDays
    }
  }
`;

export const GET_SHIPPING_LABEL = gql`
  query GetShippingLabel($shipmentId: ID!) {
    shippingLabel(shipmentId: $shipmentId) {
      id
      shipmentId
      labelUrl
      labelFormat
      trackingNumber
      createdAt
    }
  }
`;

export const GET_TRACKING_EVENTS = gql`
  query GetTrackingEvents($trackingNumber: String!) {
    trackingEvents(trackingNumber: $trackingNumber) {
      id
      trackingNumber
      eventType
      eventDescription
      eventDate
      location
      carrier
      status
    }
  }
`;

export const GET_SHIPPING_METRICS = gql`
  query GetShippingMetrics(
    $warehouseId: ID!
    $startDate: DateTime
    $endDate: DateTime
  ) {
    shippingMetrics(
      warehouseId: $warehouseId
      startDate: $startDate
      endDate: $endDate
    ) {
      warehouseId
      totalShipments
      deliveredShipments
      inTransitShipments
      exceptionShipments
      averageTransitTime
      onTimeDeliveryRate
      totalShippingCost
      averageCostPerShipment
    }
  }
`;

// ===== LOT TRACKING QUERIES =====

export const GET_LOT_INFO = gql`
  ${LOT_INFO_FRAGMENT}
  query GetLotInfo($lotNumber: String!, $productId: ID!) {
    lotInfo(lotNumber: $lotNumber, productId: $productId) {
      ...LotInfoFragment
      warehouse {
        id
        name
        warehouseCode
      }
      binLocation {
        id
        binCode
        displayName
        aisle
        bay
        level
      }
      movementHistory {
        id
        tenantId
        productId
        lotNumber
        movementType
        fromLocationId
        toLocationId
        quantity
        unitOfMeasure
        reason
        referenceId
        referenceType
        performedBy
        performedAt
      }
      isExpired
      isNearExpiry
      daysUntilExpiry
    }
  }
`;

export const GET_LOTS = gql`
  ${LOT_INFO_FRAGMENT}
  query GetLots(
    $first: Int
    $after: String
    $filter: LotFilterInput
  ) {
    lots(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...LotInfoFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_LOTS_BY_PRODUCT = gql`
  ${LOT_INFO_FRAGMENT}
  query GetLotsByProduct($productId: ID!) {
    lotsByProduct(productId: $productId) {
      ...LotInfoFragment
    }
  }
`;

export const GET_LOTS_BY_WAREHOUSE = gql`
  ${LOT_INFO_FRAGMENT}
  query GetLotsByWarehouse($warehouseId: ID!) {
    lotsByWarehouse(warehouseId: $warehouseId) {
      ...LotInfoFragment
    }
  }
`;

export const GET_EXPIRED_LOTS = gql`
  ${LOT_INFO_FRAGMENT}
  query GetExpiredLots($warehouseId: ID) {
    expiredLots(warehouseId: $warehouseId) {
      ...LotInfoFragment
    }
  }
`;

export const GET_NEAR_EXPIRY_LOTS = gql`
  ${LOT_INFO_FRAGMENT}
  query GetNearExpiryLots($days: Int = 30, $warehouseId: ID) {
    nearExpiryLots(days: $days, warehouseId: $warehouseId) {
      ...LotInfoFragment
    }
  }
`;

export const GET_LOT_TRACEABILITY = gql`
  query GetLotTraceability($lotNumber: String!, $productId: ID!) {
    lotTraceability(lotNumber: $lotNumber, productId: $productId) {
      lotNumber
      productId
      warehouseId
      currentLocation
      movementHistory {
        id
        movementType
        fromLocationId
        toLocationId
        quantity
        reason
        performedAt
        performedBy
      }
      qualityHistory {
        id
        checkType
        result
        performedAt
        performedBy
      }
      relatedLots
      upstreamLots
      downstreamLots
    }
  }
`;

export const GET_LOT_MOVEMENT_HISTORY = gql`
  query GetLotMovementHistory($lotNumber: String!, $productId: ID!) {
    lotMovementHistory(lotNumber: $lotNumber, productId: $productId) {
      id
      tenantId
      productId
      lotNumber
      movementType
      fromLocationId
      toLocationId
      quantity
      unitOfMeasure
      reason
      referenceId
      referenceType
      performedBy
      performedAt
    }
  }
`;

// ===== KIT DEFINITION QUERIES =====

export const GET_KIT_DEFINITION = gql`
  ${KIT_DEFINITION_FRAGMENT}
  query GetKitDefinition($id: ID!) {
    kitDefinition(id: $id) {
      ...KitDefinitionFragment
      metrics {
        kitId
        totalWorkOrders
        completedWorkOrders
        averageAssemblyTime
        qualityPassRate
        componentShortageRate
        onTimeCompletionRate
        totalCost
        averageCostPerUnit
      }
      totalCost
    }
  }
`;

export const GET_KIT_DEFINITIONS = gql`
  ${KIT_DEFINITION_FRAGMENT}
  query GetKitDefinitions(
    $first: Int
    $after: String
    $filter: KitDefinitionFilterInput
  ) {
    kitDefinitions(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...KitDefinitionFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_KIT_DEFINITION_BY_SKU = gql`
  ${KIT_DEFINITION_FRAGMENT}
  query GetKitDefinitionBySku($kitSku: String!) {
    kitDefinitionBySku(kitSku: $kitSku) {
      ...KitDefinitionFragment
    }
  }
`;

export const GET_ACTIVE_KIT_DEFINITIONS = gql`
  ${KIT_DEFINITION_FRAGMENT}
  query GetActiveKitDefinitions {
    activeKitDefinitions {
      ...KitDefinitionFragment
    }
  }
`;

// ===== ASSEMBLY WORK ORDER QUERIES =====

export const GET_ASSEMBLY_WORK_ORDER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetAssemblyWorkOrder($id: ID!) {
    assemblyWorkOrder(id: $id) {
      ...AssemblyWorkOrderFragment
      kit {
        id
        kitSku
        name
        version
      }
      warehouse {
        id
        name
        warehouseCode
      }
      assembler {
        id
        firstName
        lastName
        email
      }
      completionPercentage
      hasComponentShortage
      isOverdue
      estimatedCost
    }
  }
`;

export const GET_ASSEMBLY_WORK_ORDERS = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetAssemblyWorkOrders(
    $first: Int
    $after: String
    $filter: AssemblyWorkOrderFilterInput
  ) {
    assemblyWorkOrders(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...AssemblyWorkOrderFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_ASSEMBLY_WORK_ORDER_BY_NUMBER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetAssemblyWorkOrderByNumber($workOrderNumber: String!) {
    assemblyWorkOrderByNumber(workOrderNumber: $workOrderNumber) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const GET_ASSEMBLY_WORK_ORDERS_BY_KIT = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetAssemblyWorkOrdersByKit($kitId: ID!) {
    assemblyWorkOrdersByKit(kitId: $kitId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const GET_ASSEMBLY_WORK_ORDERS_BY_WAREHOUSE = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetAssemblyWorkOrdersByWarehouse($warehouseId: ID!) {
    assemblyWorkOrdersByWarehouse(warehouseId: $warehouseId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const GET_ASSEMBLY_WORK_ORDERS_BY_ASSEMBLER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetAssemblyWorkOrdersByAssembler($assemblerId: ID!) {
    assemblyWorkOrdersByAssembler(assemblerId: $assemblerId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const GET_PENDING_ASSEMBLY_WORK_ORDERS = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetPendingAssemblyWorkOrders($warehouseId: ID) {
    pendingAssemblyWorkOrders(warehouseId: $warehouseId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const GET_OVERDUE_ASSEMBLY_WORK_ORDERS = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  query GetOverdueAssemblyWorkOrders($warehouseId: ID) {
    overdueAssemblyWorkOrders(warehouseId: $warehouseId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const GET_ASSEMBLY_METRICS = gql`
  query GetAssemblyMetrics(
    $kitId: ID!
    $startDate: DateTime
    $endDate: DateTime
  ) {
    assemblyMetrics(
      kitId: $kitId
      startDate: $startDate
      endDate: $endDate
    ) {
      kitId
      totalWorkOrders
      completedWorkOrders
      averageAssemblyTime
      qualityPassRate
      componentShortageRate
      onTimeCompletionRate
      totalCost
      averageCostPerUnit
    }
  }
`;