/**
 * Warehouse GraphQL Subscriptions
 * Complete set of subscriptions for real-time warehouse updates
 */

import { gql } from '@apollo/client';
import {
  WAREHOUSE_FRAGMENT,
  WAREHOUSE_CAPACITY_FRAGMENT,
  PICKING_WAVE_FRAGMENT,
  PICK_LIST_FRAGMENT,
  SHIPMENT_FRAGMENT,
  LOT_INFO_FRAGMENT,
  KIT_DEFINITION_FRAGMENT,
  ASSEMBLY_WORK_ORDER_FRAGMENT,
} from '../queries/warehouse-queries';

// ===== WAREHOUSE SUBSCRIPTIONS =====

export const WAREHOUSE_UPDATED = gql`
  ${WAREHOUSE_FRAGMENT}
  subscription WarehouseUpdated($warehouseId: ID!) {
    warehouseUpdated(warehouseId: $warehouseId) {
      ...WarehouseFragment
    }
  }
`;

export const WAREHOUSE_CAPACITY_UPDATED = gql`
  ${WAREHOUSE_CAPACITY_FRAGMENT}
  subscription WarehouseCapacityUpdated($warehouseId: ID!) {
    warehouseCapacityUpdated(warehouseId: $warehouseId) {
      ...WarehouseCapacityFragment
    }
  }
`;

// ===== PICKING WAVE SUBSCRIPTIONS =====

export const PICKING_WAVE_UPDATED = gql`
  ${PICKING_WAVE_FRAGMENT}
  subscription PickingWaveUpdated($waveId: ID!) {
    pickingWaveUpdated(waveId: $waveId) {
      ...PickingWaveFragment
    }
  }
`;

export const PICKING_WAVE_STATISTICS_UPDATED = gql`
  subscription PickingWaveStatisticsUpdated($waveId: ID!) {
    pickingWaveStatisticsUpdated(waveId: $waveId) {
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

export const PICKING_WAVE_STATUS_CHANGED = gql`
  ${PICKING_WAVE_FRAGMENT}
  subscription PickingWaveStatusChanged($warehouseId: ID) {
    pickingWaveStatusChanged(warehouseId: $warehouseId) {
      ...PickingWaveFragment
    }
  }
`;

// ===== PICK LIST SUBSCRIPTIONS =====

export const PICK_LIST_ASSIGNED = gql`
  ${PICK_LIST_FRAGMENT}
  subscription PickListAssigned {
    pickListAssigned {
      ...PickListFragment
    }
  }
`;

export const PICK_LIST_COMPLETED = gql`
  ${PICK_LIST_FRAGMENT}
  subscription PickListCompleted {
    pickListCompleted {
      ...PickListFragment
    }
  }
`;

// ===== SHIPMENT SUBSCRIPTIONS =====

export const SHIPMENT_UPDATED = gql`
  ${SHIPMENT_FRAGMENT}
  subscription ShipmentUpdated($shipmentId: ID!) {
    shipmentUpdated(shipmentId: $shipmentId) {
      ...ShipmentFragment
    }
  }
`;

export const TRACKING_EVENT_ADDED = gql`
  subscription TrackingEventAdded($trackingNumber: String!) {
    trackingEventAdded(trackingNumber: $trackingNumber) {
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

export const SHIPMENT_DELIVERED = gql`
  ${SHIPMENT_FRAGMENT}
  subscription ShipmentDelivered($warehouseId: ID) {
    shipmentDelivered(warehouseId: $warehouseId) {
      ...ShipmentFragment
    }
  }
`;

export const SHIPMENT_EXCEPTION = gql`
  ${SHIPMENT_FRAGMENT}
  subscription ShipmentException($warehouseId: ID) {
    shipmentException(warehouseId: $warehouseId) {
      ...ShipmentFragment
    }
  }
`;

export const SHIPPING_LABEL_CREATED = gql`
  subscription ShippingLabelCreated($warehouseId: ID) {
    shippingLabelCreated(warehouseId: $warehouseId) {
      id
      shipmentId
      labelUrl
      labelFormat
      trackingNumber
      createdAt
    }
  }
`;

// ===== LOT TRACKING SUBSCRIPTIONS =====

export const LOT_UPDATED = gql`
  ${LOT_INFO_FRAGMENT}
  subscription LotUpdated($lotNumber: String!, $productId: ID!) {
    lotUpdated(lotNumber: $lotNumber, productId: $productId) {
      ...LotInfoFragment
    }
  }
`;

export const LOT_MOVEMENT_RECORDED = gql`
  subscription LotMovementRecorded($lotNumber: String!, $productId: ID!) {
    lotMovementRecorded(lotNumber: $lotNumber, productId: $productId) {
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

export const RECALL_CREATED = gql`
  subscription RecallCreated {
    recallCreated {
      id
      tenantId
      recallNumber
      productId
      lotNumbers
      reason
      severity
      status
      initiatedBy
      initiatedAt
      completedAt
      affectedQuantity
      recoveredQuantity
      createdAt
      updatedAt
    }
  }
`;

export const LOT_EXPIRED = gql`
  ${LOT_INFO_FRAGMENT}
  subscription LotExpired($warehouseId: ID) {
    lotExpired(warehouseId: $warehouseId) {
      ...LotInfoFragment
    }
  }
`;

export const LOT_NEAR_EXPIRY = gql`
  ${LOT_INFO_FRAGMENT}
  subscription LotNearExpiry($warehouseId: ID) {
    lotNearExpiry(warehouseId: $warehouseId) {
      ...LotInfoFragment
    }
  }
`;

// ===== KIT DEFINITION SUBSCRIPTIONS =====

export const KIT_DEFINITION_UPDATED = gql`
  ${KIT_DEFINITION_FRAGMENT}
  subscription KitDefinitionUpdated($kitId: ID!) {
    kitDefinitionUpdated(kitId: $kitId) {
      ...KitDefinitionFragment
    }
  }
`;

// ===== ASSEMBLY WORK ORDER SUBSCRIPTIONS =====

export const ASSEMBLY_WORK_ORDER_UPDATED = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  subscription AssemblyWorkOrderUpdated($workOrderId: ID!) {
    assemblyWorkOrderUpdated(workOrderId: $workOrderId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const ASSEMBLY_WORK_ORDER_STATUS_CHANGED = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  subscription AssemblyWorkOrderStatusChanged($warehouseId: ID) {
    assemblyWorkOrderStatusChanged(warehouseId: $warehouseId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const ASSEMBLY_WORK_ORDER_COMPLETED = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  subscription AssemblyWorkOrderCompleted($warehouseId: ID) {
    assemblyWorkOrderCompleted(warehouseId: $warehouseId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const COMPONENT_SHORTAGE_DETECTED = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  subscription ComponentShortageDetected($warehouseId: ID) {
    componentShortageDetected(warehouseId: $warehouseId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

// ===== COMBINED SUBSCRIPTIONS FOR DASHBOARD =====

export const WAREHOUSE_DASHBOARD_UPDATES = gql`
  subscription WarehouseDashboardUpdates($warehouseId: ID!) {
    warehouseUpdated(warehouseId: $warehouseId) {
      id
      name
      status
      updatedAt
    }
    warehouseCapacityUpdated(warehouseId: $warehouseId) {
      warehouseId
      utilizationPercentage
      availableCapacity
    }
    pickingWaveStatusChanged(warehouseId: $warehouseId) {
      id
      waveNumber
      status
      updatedAt
    }
    shipmentException(warehouseId: $warehouseId) {
      id
      shipmentNumber
      status
      trackingNumber
    }
    lotExpired(warehouseId: $warehouseId) {
      id
      lotNumber
      productId
      expiryDate
    }
    componentShortageDetected(warehouseId: $warehouseId) {
      id
      workOrderNumber
      kitId
    }
  }
`;

// ===== REAL-TIME ALERTS =====

export const WAREHOUSE_ALERTS = gql`
  subscription WarehouseAlerts($warehouseId: ID!) {
    # Critical alerts that need immediate attention
    shipmentException(warehouseId: $warehouseId) {
      id
      shipmentNumber
      status
      trackingNumber
      updatedAt
    }
    
    lotExpired(warehouseId: $warehouseId) {
      id
      lotNumber
      productId
      expiryDate
      quantity
    }
    
    lotNearExpiry(warehouseId: $warehouseId) {
      id
      lotNumber
      productId
      expiryDate
      daysUntilExpiry
      quantity
    }
    
    componentShortageDetected(warehouseId: $warehouseId) {
      id
      workOrderNumber
      kitId
      components {
        productId
        quantityRequired
        quantityAllocated
        status
      }
    }
  }
`;

// ===== PERFORMANCE MONITORING =====

export const WAREHOUSE_PERFORMANCE_UPDATES = gql`
  subscription WarehousePerformanceUpdates($warehouseId: ID!) {
    pickingWaveStatisticsUpdated(waveId: $waveId) {
      waveId
      pickingAccuracy
      averagePickTime
      progressPercentage
    }
    
    warehouseCapacityUpdated(warehouseId: $warehouseId) {
      warehouseId
      utilizationPercentage
      totalBinLocations
      occupiedBinLocations
    }
  }
`;