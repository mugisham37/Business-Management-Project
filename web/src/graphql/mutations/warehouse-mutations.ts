/**
 * Warehouse GraphQL Mutations
 * Complete set of mutations for warehouse management
 */

import { gql } from '@apollo/client';
import {
  WAREHOUSE_FRAGMENT,
  WAREHOUSE_CAPACITY_FRAGMENT,
  WAREHOUSE_ZONE_FRAGMENT,
  BIN_LOCATION_FRAGMENT,
  PICKING_WAVE_FRAGMENT,
  PICK_LIST_FRAGMENT,
  SHIPMENT_FRAGMENT,
  LOT_INFO_FRAGMENT,
  KIT_DEFINITION_FRAGMENT,
  ASSEMBLY_WORK_ORDER_FRAGMENT,
} from './warehouse-queries';

// ===== WAREHOUSE MUTATIONS =====

export const CREATE_WAREHOUSE = gql`
  ${WAREHOUSE_FRAGMENT}
  mutation CreateWarehouse($input: CreateWarehouseInput!) {
    createWarehouse(input: $input) {
      ...WarehouseFragment
    }
  }
`;

export const UPDATE_WAREHOUSE = gql`
  ${WAREHOUSE_FRAGMENT}
  mutation UpdateWarehouse($id: ID!, $input: UpdateWarehouseInput!) {
    updateWarehouse(id: $id, input: $input) {
      ...WarehouseFragment
    }
  }
`;

export const DELETE_WAREHOUSE = gql`
  mutation DeleteWarehouse($id: ID!) {
    deleteWarehouse(id: $id)
  }
`;

export const INITIALIZE_WAREHOUSE = gql`
  ${WAREHOUSE_FRAGMENT}
  mutation InitializeWarehouse($input: InitializeWarehouseInput!) {
    initializeWarehouse(input: $input) {
      ...WarehouseFragment
    }
  }
`;

export const UPDATE_WAREHOUSE_CAPACITY = gql`
  ${WAREHOUSE_CAPACITY_FRAGMENT}
  mutation UpdateWarehouseCapacity($input: UpdateWarehouseCapacityInput!) {
    updateWarehouseCapacity(input: $input) {
      ...WarehouseCapacityFragment
    }
  }
`;

export const UPDATE_WAREHOUSE_CONFIGURATION = gql`
  ${WAREHOUSE_FRAGMENT}
  mutation UpdateWarehouseConfiguration(
    $warehouseId: ID!
    $input: WarehouseConfigurationInput!
  ) {
    updateWarehouseConfiguration(warehouseId: $warehouseId, input: $input) {
      ...WarehouseFragment
    }
  }
`;

export const UPDATE_WAREHOUSE_OPERATING_HOURS = gql`
  ${WAREHOUSE_FRAGMENT}
  mutation UpdateWarehouseOperatingHours($input: UpdateWarehouseOperatingHoursInput!) {
    updateWarehouseOperatingHours(input: $input) {
      ...WarehouseFragment
    }
  }
`;

export const OPTIMIZE_WAREHOUSE_LAYOUT = gql`
  ${WAREHOUSE_FRAGMENT}
  mutation OptimizeWarehouseLayout($input: WarehouseLayoutOptimizationInput!) {
    optimizeWarehouseLayout(input: $input) {
      ...WarehouseFragment
    }
  }
`;

export const UPDATE_WAREHOUSE_PERFORMANCE_METRICS = gql`
  mutation UpdateWarehousePerformanceMetrics($input: WarehousePerformanceMetricsInput!) {
    updateWarehousePerformanceMetrics(input: $input)
  }
`;

// ===== WAREHOUSE ZONE MUTATIONS =====

export const CREATE_WAREHOUSE_ZONE = gql`
  ${WAREHOUSE_ZONE_FRAGMENT}
  mutation CreateWarehouseZone(
    $warehouseId: ID!
    $name: String!
    $zoneType: WarehouseZoneType!
  ) {
    createWarehouseZone(
      warehouseId: $warehouseId
      name: $name
      zoneType: $zoneType
    ) {
      ...WarehouseZoneFragment
    }
  }
`;

export const UPDATE_WAREHOUSE_ZONE = gql`
  ${WAREHOUSE_ZONE_FRAGMENT}
  mutation UpdateWarehouseZone(
    $id: ID!
    $name: String
    $zoneType: WarehouseZoneType
  ) {
    updateWarehouseZone(id: $id, name: $name, zoneType: $zoneType) {
      ...WarehouseZoneFragment
    }
  }
`;

export const DELETE_WAREHOUSE_ZONE = gql`
  mutation DeleteWarehouseZone($id: ID!) {
    deleteWarehouseZone(id: $id)
  }
`;

// ===== BIN LOCATION MUTATIONS =====

export const CREATE_BIN_LOCATION = gql`
  ${BIN_LOCATION_FRAGMENT}
  mutation CreateBinLocation($input: CreateBinLocationInput!) {
    createBinLocation(input: $input) {
      ...BinLocationFragment
    }
  }
`;

export const UPDATE_BIN_LOCATION = gql`
  ${BIN_LOCATION_FRAGMENT}
  mutation UpdateBinLocation($id: ID!, $input: UpdateBinLocationInput!) {
    updateBinLocation(id: $id, input: $input) {
      ...BinLocationFragment
    }
  }
`;

export const DELETE_BIN_LOCATION = gql`
  mutation DeleteBinLocation($id: ID!) {
    deleteBinLocation(id: $id)
  }
`;

export const ASSIGN_PRODUCT_TO_BIN = gql`
  ${BIN_LOCATION_FRAGMENT}
  mutation AssignProductToBin(
    $binLocationId: ID!
    $productId: ID!
    $variantId: ID
    $dedicated: Boolean = false
  ) {
    assignProductToBin(
      binLocationId: $binLocationId
      productId: $productId
      variantId: $variantId
      dedicated: $dedicated
    ) {
      ...BinLocationFragment
    }
  }
`;

export const UNASSIGN_PRODUCT_FROM_BIN = gql`
  ${BIN_LOCATION_FRAGMENT}
  mutation UnassignProductFromBin($binLocationId: ID!) {
    unassignProductFromBin(binLocationId: $binLocationId) {
      ...BinLocationFragment
    }
  }
`;

export const UPDATE_BIN_OCCUPANCY = gql`
  ${BIN_LOCATION_FRAGMENT}
  mutation UpdateBinOccupancy(
    $binLocationId: ID!
    $occupancyPercentage: Float!
    $currentWeight: Float
  ) {
    updateBinOccupancy(
      binLocationId: $binLocationId
      occupancyPercentage: $occupancyPercentage
      currentWeight: $currentWeight
    ) {
      ...BinLocationFragment
    }
  }
`;

export const BULK_CREATE_BIN_LOCATIONS = gql`
  mutation BulkCreateBinLocations($input: BulkCreateBinLocationsInput!) {
    bulkCreateBinLocations(input: $input) {
      success
      createdCount
      errors {
        binCode
        error
      }
    }
  }
`;

// ===== PICKING WAVE MUTATIONS =====

export const CREATE_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation CreatePickingWave($input: CreatePickingWaveInput!) {
    createPickingWave(input: $input) {
      ...PickingWaveFragment
    }
  }
`;

export const UPDATE_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation UpdatePickingWave($id: ID!, $input: UpdatePickingWaveInput!) {
    updatePickingWave(id: $id, input: $input) {
      ...PickingWaveFragment
    }
  }
`;

export const DELETE_PICKING_WAVE = gql`
  mutation DeletePickingWave($id: ID!) {
    deletePickingWave(id: $id)
  }
`;

export const RELEASE_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation ReleasePickingWave($id: ID!) {
    releasePickingWave(id: $id) {
      ...PickingWaveFragment
    }
  }
`;

export const START_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation StartPickingWave($id: ID!) {
    startPickingWave(id: $id) {
      ...PickingWaveFragment
    }
  }
`;

export const COMPLETE_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation CompletePickingWave($id: ID!) {
    completePickingWave(id: $id) {
      ...PickingWaveFragment
    }
  }
`;

export const CANCEL_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation CancelPickingWave($id: ID!, $reason: String) {
    cancelPickingWave(id: $id, reason: $reason) {
      ...PickingWaveFragment
    }
  }
`;

export const ASSIGN_PICKERS_TO_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation AssignPickersToWave($waveId: ID!, $input: AssignPickersInput!) {
    assignPickersToWave(waveId: $waveId, input: $input) {
      ...PickingWaveFragment
    }
  }
`;

export const PLAN_PICKING_WAVES = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation PlanPickingWaves($input: WavePlanningInput!) {
    planPickingWaves(input: $input) {
      ...PickingWaveFragment
    }
  }
`;

export const OPTIMIZE_PICKING_WAVE = gql`
  ${PICKING_WAVE_FRAGMENT}
  mutation OptimizePickingWave($waveId: ID!) {
    optimizePickingWave(waveId: $waveId) {
      ...PickingWaveFragment
    }
  }
`;

// ===== PICK LIST MUTATIONS =====

export const CREATE_PICK_LIST = gql`
  ${PICK_LIST_FRAGMENT}
  mutation CreatePickList($input: CreatePickListInput!) {
    createPickList(input: $input) {
      ...PickListFragment
    }
  }
`;

export const ASSIGN_PICK_LIST = gql`
  ${PICK_LIST_FRAGMENT}
  mutation AssignPickList($id: ID!, $pickerId: ID!) {
    assignPickList(id: $id, pickerId: $pickerId) {
      ...PickListFragment
    }
  }
`;

export const RECORD_PICK = gql`
  ${PICK_LIST_FRAGMENT}
  mutation RecordPick($pickListId: ID!, $input: RecordPickInput!) {
    recordPick(pickListId: $pickListId, input: $input) {
      ...PickListFragment
    }
  }
`;

export const COMPLETE_PICK_LIST = gql`
  ${PICK_LIST_FRAGMENT}
  mutation CompletePickList($id: ID!) {
    completePickList(id: $id) {
      ...PickListFragment
    }
  }
`;

// ===== SHIPMENT MUTATIONS =====

export const CREATE_SHIPMENT = gql`
  ${SHIPMENT_FRAGMENT}
  mutation CreateShipment($input: CreateShipmentInput!) {
    createShipment(input: $input) {
      ...ShipmentFragment
    }
  }
`;

export const CREATE_SHIPPING_LABEL = gql`
  mutation CreateShippingLabel($input: CreateShippingLabelInput!) {
    createShippingLabel(input: $input) {
      id
      shipmentId
      labelUrl
      labelFormat
      trackingNumber
      createdAt
    }
  }
`;

export const CANCEL_SHIPMENT = gql`
  mutation CancelShipment($shipmentId: ID!, $reason: String) {
    cancelShipment(shipmentId: $shipmentId, reason: $reason)
  }
`;

export const UPDATE_SHIPMENT_STATUS = gql`
  ${SHIPMENT_FRAGMENT}
  mutation UpdateShipmentStatus($shipmentId: ID!, $status: String!) {
    updateShipmentStatus(shipmentId: $shipmentId, status: $status) {
      ...ShipmentFragment
    }
  }
`;

export const TRACK_SHIPMENT = gql`
  mutation TrackShipment($trackingNumber: String!) {
    trackShipment(trackingNumber: $trackingNumber)
  }
`;

export const UPDATE_ALL_TRACKING_INFO = gql`
  mutation UpdateAllTrackingInfo($warehouseId: ID) {
    updateAllTrackingInfo(warehouseId: $warehouseId)
  }
`;

export const CONFIRM_DELIVERY = gql`
  ${SHIPMENT_FRAGMENT}
  mutation ConfirmDelivery(
    $shipmentId: ID!
    $deliveryDate: DateTime
    $signature: String
  ) {
    confirmDelivery(
      shipmentId: $shipmentId
      deliveryDate: $deliveryDate
      signature: $signature
    ) {
      ...ShipmentFragment
    }
  }
`;

export const GENERATE_RETURN_LABEL = gql`
  mutation GenerateReturnLabel($shipmentId: ID!, $reason: String) {
    generateReturnLabel(shipmentId: $shipmentId, reason: $reason) {
      id
      shipmentId
      labelUrl
      labelFormat
      trackingNumber
      createdAt
    }
  }
`;

export const VALIDATE_ADDRESS = gql`
  mutation ValidateAddress($address: AddressInput!) {
    validateAddress(address: $address)
  }
`;

export const SCHEDULE_PICKUP = gql`
  mutation SchedulePickup(
    $warehouseId: ID!
    $pickupDate: DateTime!
    $shipmentIds: [ID!]!
  ) {
    schedulePickup(
      warehouseId: $warehouseId
      pickupDate: $pickupDate
      shipmentIds: $shipmentIds
    )
  }
`;

// ===== LOT TRACKING MUTATIONS =====

export const CREATE_LOT = gql`
  ${LOT_INFO_FRAGMENT}
  mutation CreateLot($input: CreateLotInput!) {
    createLot(input: $input) {
      ...LotInfoFragment
    }
  }
`;

export const UPDATE_LOT = gql`
  ${LOT_INFO_FRAGMENT}
  mutation UpdateLot(
    $lotNumber: String!
    $productId: ID!
    $input: UpdateLotInput!
  ) {
    updateLot(lotNumber: $lotNumber, productId: $productId, input: $input) {
      ...LotInfoFragment
    }
  }
`;

export const DELETE_LOT = gql`
  mutation DeleteLot($lotNumber: String!, $productId: ID!) {
    deleteLot(lotNumber: $lotNumber, productId: $productId)
  }
`;

export const RECORD_LOT_MOVEMENT = gql`
  mutation RecordLotMovement($input: RecordLotMovementInput!) {
    recordLotMovement(input: $input) {
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

export const CREATE_FIFO_RULE = gql`
  mutation CreateFIFORule($input: CreateFIFORuleInput!) {
    createFIFORule(input: $input) {
      id
      tenantId
      productId
      warehouseId
      enabled
      strictMode
      exceptionRules
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_FIFO_RULE = gql`
  mutation UpdateFIFORule($id: ID!, $input: CreateFIFORuleInput!) {
    updateFIFORule(id: $id, input: $input) {
      id
      tenantId
      productId
      warehouseId
      enabled
      strictMode
      exceptionRules
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_FIFO_RULE = gql`
  mutation DeleteFIFORule($id: ID!) {
    deleteFIFORule(id: $id)
  }
`;

export const CREATE_RECALL = gql`
  mutation CreateRecall($input: CreateRecallInput!) {
    createRecall(input: $input) {
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

export const UPDATE_RECALL_STATUS = gql`
  mutation UpdateRecallStatus($recallId: ID!, $status: String!) {
    updateRecallStatus(recallId: $recallId, status: $status) {
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

export const QUARANTINE_LOT = gql`
  mutation QuarantineLot(
    $lotNumber: String!
    $productId: ID!
    $reason: String!
  ) {
    quarantineLot(lotNumber: $lotNumber, productId: $productId, reason: $reason)
  }
`;

export const RELEASE_LOT_FROM_QUARANTINE = gql`
  mutation ReleaseLotFromQuarantine($lotNumber: String!, $productId: ID!) {
    releaseLotFromQuarantine(lotNumber: $lotNumber, productId: $productId)
  }
`;

export const CHECK_LOT_EXPIRY = gql`
  mutation CheckLotExpiry($warehouseId: ID) {
    checkLotExpiry(warehouseId: $warehouseId)
  }
`;

// ===== KIT DEFINITION MUTATIONS =====

export const CREATE_KIT_DEFINITION = gql`
  ${KIT_DEFINITION_FRAGMENT}
  mutation CreateKitDefinition($input: CreateKitDefinitionInput!) {
    createKitDefinition(input: $input) {
      ...KitDefinitionFragment
    }
  }
`;

export const UPDATE_KIT_DEFINITION = gql`
  ${KIT_DEFINITION_FRAGMENT}
  mutation UpdateKitDefinition($id: ID!, $input: CreateKitDefinitionInput!) {
    updateKitDefinition(id: $id, input: $input) {
      ...KitDefinitionFragment
    }
  }
`;

export const DELETE_KIT_DEFINITION = gql`
  mutation DeleteKitDefinition($id: ID!) {
    deleteKitDefinition(id: $id)
  }
`;

export const ACTIVATE_KIT_DEFINITION = gql`
  ${KIT_DEFINITION_FRAGMENT}
  mutation ActivateKitDefinition($id: ID!) {
    activateKitDefinition(id: $id) {
      ...KitDefinitionFragment
    }
  }
`;

export const DEACTIVATE_KIT_DEFINITION = gql`
  ${KIT_DEFINITION_FRAGMENT}
  mutation DeactivateKitDefinition($id: ID!) {
    deactivateKitDefinition(id: $id) {
      ...KitDefinitionFragment
    }
  }
`;

// ===== ASSEMBLY WORK ORDER MUTATIONS =====

export const CREATE_ASSEMBLY_WORK_ORDER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation CreateAssemblyWorkOrder($input: CreateAssemblyWorkOrderInput!) {
    createAssemblyWorkOrder(input: $input) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const UPDATE_ASSEMBLY_WORK_ORDER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation UpdateAssemblyWorkOrder($id: ID!, $input: UpdateAssemblyWorkOrderInput!) {
    updateAssemblyWorkOrder(id: $id, input: $input) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const DELETE_ASSEMBLY_WORK_ORDER = gql`
  mutation DeleteAssemblyWorkOrder($id: ID!) {
    deleteAssemblyWorkOrder(id: $id)
  }
`;

export const START_ASSEMBLY_WORK_ORDER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation StartAssemblyWorkOrder($id: ID!) {
    startAssemblyWorkOrder(id: $id) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const COMPLETE_ASSEMBLY_WORK_ORDER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation CompleteAssemblyWorkOrder($id: ID!) {
    completeAssemblyWorkOrder(id: $id) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const CANCEL_ASSEMBLY_WORK_ORDER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation CancelAssemblyWorkOrder($id: ID!, $reason: String) {
    cancelAssemblyWorkOrder(id: $id, reason: $reason) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const ALLOCATE_COMPONENTS = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation AllocateComponents(
    $workOrderId: ID!
    $components: [AllocateComponentInput!]!
  ) {
    allocateComponents(workOrderId: $workOrderId, components: $components) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const CONSUME_COMPONENTS = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation ConsumeComponents(
    $workOrderId: ID!
    $components: [AllocateComponentInput!]!
  ) {
    consumeComponents(workOrderId: $workOrderId, components: $components) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const RECORD_QUALITY_CHECK = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation RecordQualityCheck(
    $workOrderId: ID!
    $qualityCheck: RecordQualityCheckInput!
  ) {
    recordQualityCheck(workOrderId: $workOrderId, qualityCheck: $qualityCheck) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const ASSIGN_ASSEMBLER = gql`
  ${ASSEMBLY_WORK_ORDER_FRAGMENT}
  mutation AssignAssembler($workOrderId: ID!, $assemblerId: ID!) {
    assignAssembler(workOrderId: $workOrderId, assemblerId: $assemblerId) {
      ...AssemblyWorkOrderFragment
    }
  }
`;

export const DISASSEMBLE_KIT = gql`
  mutation DisassembleKit(
    $kitId: ID!
    $quantity: Int!
    $reason: String!
  ) {
    disassembleKit(kitId: $kitId, quantity: $quantity, reason: $reason)
  }
`;