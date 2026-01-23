/**
 * Warehouse Module Types
 * Complete type definitions for warehouse management
 */

// ===== ENUMS =====

export enum WarehouseStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  CLOSED = 'closed',
}

export enum LayoutType {
  GRID = 'grid',
  FLOW = 'flow',
  HYBRID = 'hybrid',
}

export enum SecurityLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  HIGH = 'high',
  MAXIMUM = 'maximum',
}

export enum WarehouseZoneType {
  RECEIVING = 'receiving',
  STORAGE = 'storage',
  PICKING = 'picking',
  PACKING = 'packing',
  SHIPPING = 'shipping',
  STAGING = 'staging',
  QUARANTINE = 'quarantine',
  RETURNS = 'returns',
  COLD_STORAGE = 'cold_storage',
  HAZMAT = 'hazmat',
}

export enum BinLocationStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  BLOCKED = 'blocked',
  MAINTENANCE = 'maintenance',
  DAMAGED = 'damaged',
}

export enum PickingWaveStatus {
  PLANNING = 'planning',
  PLANNED = 'planned',
  RELEASED = 'released',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PickListStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ShipmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  EXCEPTION = 'exception',
  CANCELLED = 'cancelled',
}

export enum LotStatus {
  ACTIVE = 'active',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
  RECALLED = 'recalled',
  QUARANTINE = 'quarantine',
}

export enum AssemblyWorkOrderStatus {
  PENDING = 'pending',
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

// ===== CORE INTERFACES =====

export interface Warehouse {
  id: string;
  tenantId: string;
  locationId: string;
  warehouseCode: string;
  name: string;
  description?: string;
  totalSquareFootage?: number;
  storageSquareFootage?: number;
  ceilingHeight?: number;
  totalBinLocations?: number;
  occupiedBinLocations?: number;
  maxCapacityUnits?: number;
  currentCapacityUnits?: number;
  layoutType?: LayoutType;
  timezone?: string;
  temperatureControlled?: boolean;
  humidityControlled?: boolean;
  securityLevel?: SecurityLevel;
  accessControlRequired?: boolean;
  wmsIntegration?: boolean;
  barcodeSystem?: boolean;
  rfidEnabled?: boolean;
  automatedSorting?: boolean;
  pickingAccuracy?: number;
  averagePickTime?: number;
  throughputPerHour?: number;
  warehouseManagerId?: string;
  status: WarehouseStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  version: number;
  
  // Resolved fields
  zones?: WarehouseZone[];
  binLocations?: BinLocation[];
  manager?: Employee;
  capacity?: WarehouseCapacity;
}

export interface WarehouseCapacity {
  warehouseId: string;
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  utilizationPercentage: number;
  totalBinLocations: number;
  occupiedBinLocations: number;
  availableBinLocations: number;
}

export interface WarehouseZone {
  id: string;
  tenantId: string;
  warehouseId: string;
  zoneCode: string;
  name: string;
  description?: string;
  zoneType: WarehouseZoneType;
  capacity?: number;
  priority?: number;
  coordinates?: Record<string, any>;
  squareFootage?: number;
  maxBinLocations?: number;
  currentBinLocations?: number;
  temperatureControlled?: boolean;
  temperatureRange?: Record<string, any>;
  humidityControlled?: boolean;
  allowMixedProducts?: boolean;
  allowMixedBatches?: boolean;
  fifoEnforced?: boolean;
  requiresAuthorization?: boolean;
  accessLevel?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  warehouse?: Warehouse;
  bins?: BinLocation[];
}

export interface BinLocation {
  id: string;
  tenantId: string;
  warehouseId: string;
  zoneId?: string;
  binCode: string;
  displayName?: string;
  name?: string;
  description?: string;
  aisle?: string;
  bay?: string;
  level?: string;
  rack?: string;
  shelf?: string;
  position?: string;
  xCoordinate?: number;
  yCoordinate?: number;
  zCoordinate?: number;
  length?: number;
  width?: number;
  height?: number;
  volume?: number;
  maxCapacity?: number;
  capacityUnit?: string;
  maxWeight?: number;
  weightUnit?: string;
  accessEquipment?: string[];
  allowedProductTypes?: string[];
  restrictedProductTypes?: string[];
  temperatureControlled?: boolean;
  temperatureRange?: Record<string, any>;
  hazmatApproved?: boolean;
  pickingSequence?: number;
  assignedProductId?: string;
  assignedVariantId?: string;
  dedicatedProduct?: boolean;
  occupancyPercentage?: number;
  currentWeight?: number;
  status: BinLocationStatus;
  lastActivityAt?: Date;
  lastPickAt?: Date;
  lastReplenishAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  zone?: WarehouseZone;
  warehouse?: Warehouse;
}

export interface PickingWave {
  id: string;
  tenantId: string;
  warehouseId: string;
  waveNumber: string;
  name?: string;
  description?: string;
  status: PickingWaveStatus;
  priority: number;
  plannedDate?: Date;
  scheduledDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  assignedPickers?: string[];
  totalOrders?: number;
  totalItems?: number;
  totalQuantity?: number;
  pickingAccuracy?: number;
  averagePickTime?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  warehouse?: Warehouse;
  pickLists?: PickList[];
  assignedPickersData?: Employee[];
  statistics?: WaveStatistics;
  recommendations?: WaveRecommendation[];
}

export interface PickList {
  id: string;
  tenantId: string;
  warehouseId: string;
  waveId?: string;
  pickListNumber: string;
  orderId?: string;
  customerId?: string;
  assignedPickerId?: string;
  status: PickListStatus;
  priority: number;
  totalItems: number;
  totalQuantity: number;
  pickedItems?: number;
  pickedQuantity?: number;
  estimatedPickTime?: number;
  actualPickTime?: number;
  pickingAccuracy?: number;
  scheduledDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  wave?: PickingWave;
  warehouse?: Warehouse;
  assignedPicker?: Employee;
  items?: PickListItem[];
}

export interface PickListItem {
  id: string;
  pickListId: string;
  productId: string;
  variantId?: string;
  binLocationId?: string;
  lotNumber?: string;
  quantityToPick: number;
  pickedQuantity?: number;
  status: 'pending' | 'picked' | 'shortage' | 'damaged';
  pickingSequence: number;
  notes?: string;
  
  // Resolved fields
  product?: Product;
  variant?: ProductVariant;
  binLocation?: BinLocation;
}

export interface Shipment {
  id: string;
  tenantId: string;
  warehouseId: string;
  pickListId?: string;
  shipmentNumber: string;
  trackingNumber?: string;
  carrierId?: string;
  serviceType?: string;
  status: ShipmentStatus;
  fromAddress: Address;
  toAddress: Address;
  weight?: number;
  weightUnit?: string;
  dimensions?: ShipmentDimensions;
  declaredValue?: number;
  currency?: string;
  shippingCost?: number;
  insuranceCost?: number;
  totalCost?: number;
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  shippedDate?: Date;
  deliveryConfirmation?: boolean;
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  warehouse?: Warehouse;
  pickList?: PickList;
  trackingEvents?: TrackingEvent[];
  latestTrackingEvent?: TrackingEvent;
  shippingLabel?: ShippingLabel;
  isDelivered?: boolean;
  isInTransit?: boolean;
  hasException?: boolean;
  transitDays?: number;
  isOnTime?: boolean;
}

export interface TrackingEvent {
  id: string;
  trackingNumber: string;
  eventType: string;
  eventDescription: string;
  eventDate: Date;
  location?: string;
  carrier?: string;
  status?: string;
}

export interface ShippingLabel {
  id: string;
  shipmentId: string;
  labelUrl: string;
  labelFormat: string;
  trackingNumber: string;
  createdAt: Date;
}

export interface LotInfo {
  id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  binLocationId?: string;
  lotNumber: string;
  batchNumber?: string;
  serialNumber?: string;
  quantity: number;
  unitOfMeasure: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  receivedDate: Date;
  supplierId?: string;
  qualityStatus: string;
  status: LotStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  warehouse?: Warehouse;
  binLocation?: BinLocation;
  movementHistory?: LotMovement[];
  isExpired?: boolean;
  isNearExpiry?: boolean;
  daysUntilExpiry?: number;
}

export interface LotMovement {
  id: string;
  tenantId: string;
  productId: string;
  lotNumber: string;
  movementType: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  unitOfMeasure: string;
  reason?: string;
  referenceId?: string;
  referenceType?: string;
  performedBy: string;
  performedAt: Date;
}

export interface KitDefinition {
  id: string;
  tenantId: string;
  kitSku: string;
  name: string;
  description?: string;
  version: string;
  isActive: boolean;
  components: KitComponent[];
  assemblyInstructions?: string;
  qualityChecks?: QualityCheck[];
  estimatedAssemblyTime?: number;
  skillLevel?: string;
  costCalculation: 'sum_of_parts' | 'fixed_price' | 'markup_percentage';
  fixedPrice?: number;
  markup?: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  metrics?: AssemblyMetrics;
  workOrders?: AssemblyWorkOrder[];
  totalCost?: number;
}

export interface KitComponent {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitOfMeasure: string;
  isOptional?: boolean;
  substitutes?: string[];
  
  // Resolved fields
  product?: Product;
  variant?: ProductVariant;
}

export interface AssemblyWorkOrder {
  id: string;
  tenantId: string;
  kitId: string;
  warehouseId: string;
  workOrderNumber: string;
  quantityToAssemble: number;
  quantityAssembled?: number;
  status: AssemblyWorkOrderStatus;
  priority: number;
  assignedTo?: string;
  scheduledDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  qualityChecksPassed?: number;
  qualityChecksTotal?: number;
  components?: AssemblyComponent[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Resolved fields
  kit?: KitDefinition;
  warehouse?: Warehouse;
  assembler?: Employee;
  completionPercentage?: number;
  hasComponentShortage?: boolean;
  isOverdue?: boolean;
  estimatedCost?: number;
}

export interface AssemblyComponent {
  id: string;
  workOrderId: string;
  productId: string;
  variantId?: string;
  quantityRequired: number;
  quantityAllocated?: number;
  quantityConsumed?: number;
  status: 'pending' | 'allocated' | 'consumed' | 'shortage';
  binLocationId?: string;
  lotNumber?: string;
  
  // Resolved fields
  product?: Product;
  variant?: ProductVariant;
  binLocation?: BinLocation;
}

// ===== SUPPORTING INTERFACES =====

export interface Address {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShipmentDimensions {
  length: number;
  width: number;
  height: number;
  unit: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  // Add other employee fields as needed
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  // Add other product fields as needed
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  // Add other variant fields as needed
}

export interface QualityCheck {
  id: string;
  name: string;
  description?: string;
  checkType: string;
  required: boolean;
  parameters?: Record<string, any>;
}

export interface WaveStatistics {
  waveId: string;
  totalOrders: number;
  totalItems: number;
  totalQuantity: number;
  completedOrders: number;
  completedItems: number;
  completedQuantity: number;
  pickingAccuracy: number;
  averagePickTime: number;
  estimatedCompletion?: Date;
  progressPercentage: number;
}

export interface WaveRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  actionRequired?: boolean;
  estimatedImpact?: string;
}

export interface AssemblyMetrics {
  kitId: string;
  totalWorkOrders: number;
  completedWorkOrders: number;
  averageAssemblyTime: number;
  qualityPassRate: number;
  componentShortageRate: number;
  onTimeCompletionRate: number;
  totalCost: number;
  averageCostPerUnit: number;
}

export interface ShippingMetrics {
  warehouseId: string;
  totalShipments: number;
  deliveredShipments: number;
  inTransitShipments: number;
  exceptionShipments: number;
  averageTransitTime: number;
  onTimeDeliveryRate: number;
  totalShippingCost: number;
  averageCostPerShipment: number;
}

// ===== INPUT TYPES =====

export interface CreateWarehouseInput {
  locationId: string;
  warehouseCode: string;
  name: string;
  description?: string;
  totalSquareFootage?: number;
  storageSquareFootage?: number;
  ceilingHeight?: number;
  layoutType?: LayoutType;
  timezone?: string;
  temperatureControlled?: boolean;
  humidityControlled?: boolean;
  securityLevel?: SecurityLevel;
  accessControlRequired?: boolean;
  warehouseManagerId?: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  description?: string;
  totalSquareFootage?: number;
  storageSquareFootage?: number;
  ceilingHeight?: number;
  layoutType?: LayoutType;
  timezone?: string;
  temperatureControlled?: boolean;
  humidityControlled?: boolean;
  securityLevel?: SecurityLevel;
  accessControlRequired?: boolean;
  warehouseManagerId?: string;
  status?: WarehouseStatus;
}

export interface WarehouseFilterInput {
  search?: string;
  status?: WarehouseStatus;
  locationId?: string;
  managerId?: string;
}

export interface InitializeWarehouseInput {
  warehouseId: string;
  createDefaultZones?: boolean;
  createSampleBinLocations?: boolean;
  sampleBinCount?: number;
}

export interface UpdateWarehouseCapacityInput {
  warehouseId: string;
  maxCapacityUnits?: number;
  currentCapacityUnits?: number;
  totalBinLocations?: number;
  occupiedBinLocations?: number;
  changeReason?: string;
}

export interface WarehouseConfigurationInput {
  wmsIntegration?: boolean;
  barcodeSystem?: boolean;
  rfidEnabled?: boolean;
  automatedSorting?: boolean;
  temperatureControlled?: boolean;
  humidityControlled?: boolean;
  accessControlRequired?: boolean;
  securityLevel?: SecurityLevel;
}

export interface CreateWarehouseZoneInput {
  warehouseId: string;
  zoneCode: string;
  name: string;
  description?: string;
  zoneType: WarehouseZoneType;
  capacity?: number;
  priority?: number;
  squareFootage?: number;
  maxBinLocations?: number;
  temperatureControlled?: boolean;
  humidityControlled?: boolean;
  allowMixedProducts?: boolean;
  allowMixedBatches?: boolean;
  fifoEnforced?: boolean;
  requiresAuthorization?: boolean;
  accessLevel?: string;
}

export interface CreateBinLocationInput {
  warehouseId: string;
  zoneId?: string;
  binCode: string;
  displayName?: string;
  aisle?: string;
  bay?: string;
  level?: string;
  position?: string;
  xCoordinate?: number;
  yCoordinate?: number;
  zCoordinate?: number;
  length?: number;
  width?: number;
  height?: number;
  maxCapacity?: number;
  maxWeight?: number;
  accessEquipment?: string[];
  temperatureControlled?: boolean;
  hazmatApproved?: boolean;
  pickingSequence?: number;
}

export interface CreatePickingWaveInput {
  warehouseId: string;
  name?: string;
  description?: string;
  priority: number;
  plannedDate?: Date;
  scheduledDate?: Date;
  orderIds?: string[];
}

export interface CreatePickListInput {
  warehouseId: string;
  waveId?: string;
  orderId?: string;
  customerId?: string;
  priority: number;
  items: CreatePickListItemInput[];
}

export interface CreatePickListItemInput {
  productId: string;
  variantId?: string;
  binLocationId?: string;
  quantityToPick: number;
  pickingSequence: number;
}

export interface CreateShipmentInput {
  warehouseId: string;
  pickListId?: string;
  carrierId?: string;
  serviceType?: string;
  fromAddress: Address;
  toAddress: Address;
  weight?: number;
  dimensions?: ShipmentDimensions;
  declaredValue?: number;
  requiresSignature?: boolean;
}

export interface CreateLotInput {
  productId: string;
  warehouseId: string;
  binLocationId?: string;
  lotNumber: string;
  batchNumber?: string;
  quantity: number;
  unitOfMeasure: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  supplierId?: string;
  qualityStatus?: string;
}

export interface CreateKitDefinitionInput {
  kitSku: string;
  name: string;
  description?: string;
  components: CreateKitComponentInput[];
  assemblyInstructions?: string;
  estimatedAssemblyTime?: number;
  skillLevel?: string;
  costCalculation: 'sum_of_parts' | 'fixed_price' | 'markup_percentage';
  fixedPrice?: number;
  markup?: number;
}

export interface CreateKitComponentInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitOfMeasure: string;
  isOptional?: boolean;
}

export interface CreateAssemblyWorkOrderInput {
  kitId: string;
  warehouseId: string;
  quantityToAssemble: number;
  priority: number;
  assignedTo?: string;
  scheduledDate?: Date;
}

// ===== PAGINATION & CONNECTIONS =====

export interface OffsetPaginationArgs {
  page?: number;
  limit?: number;
}

export interface CursorPaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount?: number;
}

export type WarehouseConnection = Connection<Warehouse>;
export type WarehouseZoneConnection = Connection<WarehouseZone>;
export type BinLocationConnection = Connection<BinLocation>;
export type PickingWaveConnection = Connection<PickingWave>;
export type PickListConnection = Connection<PickList>;
export type ShipmentConnection = Connection<Shipment>;
export type LotInfoConnection = Connection<LotInfo>;
export type KitDefinitionConnection = Connection<KitDefinition>;
export type AssemblyWorkOrderConnection = Connection<AssemblyWorkOrder>;

// ===== SORT & FILTER TYPES =====

export interface WarehouseSortInput {
  name?: 'ASC' | 'DESC';
  warehouseCode?: 'ASC' | 'DESC';
  status?: 'ASC' | 'DESC';
  createdAt?: 'ASC' | 'DESC';
  totalCapacity?: 'ASC' | 'DESC';
  utilizationPercentage?: 'ASC' | 'DESC';
}

export interface PickingWaveFilterInput {
  search?: string;
  status?: PickingWaveStatus;
  warehouseId?: string;
  assignedPickerId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ShipmentFilterInput {
  search?: string;
  status?: ShipmentStatus;
  warehouseId?: string;
  carrierId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface LotFilterInput {
  search?: string;
  productId?: string;
  warehouseId?: string;
  status?: LotStatus;
  expiryDateFrom?: Date;
  expiryDateTo?: Date;
}

// ===== ERROR TYPES =====

export interface WarehouseError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

export interface WarehouseValidationError extends WarehouseError {
  field: string;
  value?: any;
  constraints?: string[];
}

// ===== SUBSCRIPTION PAYLOADS =====

export interface WarehouseUpdatedPayload {
  warehouse: Warehouse;
  changeType: 'created' | 'updated' | 'deleted';
  changedFields?: string[];
}

export interface PickingWaveStatusChangedPayload {
  wave: PickingWave;
  previousStatus: PickingWaveStatus;
  newStatus: PickingWaveStatus;
  timestamp: Date;
}

export interface ShipmentStatusChangedPayload {
  shipment: Shipment;
  previousStatus: ShipmentStatus;
  newStatus: ShipmentStatus;
  timestamp: Date;
}

export interface LotExpiryAlertPayload {
  lot: LotInfo;
  alertType: 'expired' | 'near_expiry';
  daysUntilExpiry?: number;
  timestamp: Date;
}