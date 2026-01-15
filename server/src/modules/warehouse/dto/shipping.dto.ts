import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsNumber, 
  IsBoolean, 
  IsEnum, 
  IsUUID, 
  IsArray, 
  Min, 
  Max,
  ValidateNested,
  IsNotEmpty,
  Length,
  IsPositive,
  IsDateString,
  IsEmail
} from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum CarrierType {
  UPS = 'ups',
  FEDEX = 'fedex',
  USPS = 'usps',
  DHL = 'dhl',
  CUSTOM = 'custom',
}

export enum ServiceType {
  GROUND = 'ground',
  NEXT_DAY = 'next_day',
  TWO_DAY = 'two_day',
  PRIORITY = 'priority',
  EXPRESS = 'express',
  OVERNIGHT = 'overnight',
  STANDARD = 'standard',
}

export enum ShipmentStatus {
  CREATED = 'created',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  EXCEPTION = 'exception',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

export enum LabelFormat {
  PDF = 'PDF',
  PNG = 'PNG',
  ZPL = 'ZPL',
  EPL = 'EPL',
}

export enum PackageType {
  BOX = 'box',
  ENVELOPE = 'envelope',
  TUBE = 'tube',
  PAK = 'pak',
  CUSTOM = 'custom',
}

// Address DTOs
export class ShippingAddressDto {
  @ApiProperty({ description: 'Recipient or sender name' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  company?: string;

  @ApiProperty({ description: 'Address line 1' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  addressLine1!: string;

  @ApiPropertyOptional({ description: 'Address line 2' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  addressLine2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  city!: string;

  @ApiProperty({ description: 'State or province' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  state!: string;

  @ApiProperty({ description: 'Postal or ZIP code' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  postalCode!: string;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Address type' })
  @IsOptional()
  @IsString()
  addressType?: 'residential' | 'commercial';
}

// Package dimensions DTO
export class PackageDimensionsDto {
  @ApiProperty({ description: 'Length in inches' })
  @IsNumber()
  @IsPositive()
  @Min(0.1)
  @Max(108)
  length!: number;

  @ApiProperty({ description: 'Width in inches' })
  @IsNumber()
  @IsPositive()
  @Min(0.1)
  @Max(108)
  width!: number;

  @ApiProperty({ description: 'Height in inches' })
  @IsNumber()
  @IsPositive()
  @Min(0.1)
  @Max(108)
  height!: number;
}

// Shipment item DTO
export class ShipmentItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Product SKU' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  sku!: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  description!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Weight per item in pounds' })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  weight!: number;

  @ApiProperty({ description: 'Item dimensions' })
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  dimensions!: PackageDimensionsDto;

  @ApiProperty({ description: 'Declared value per item' })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  value!: number;

  @ApiPropertyOptional({ description: 'Harmonized tariff code' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  harmonizedCode?: string;

  @ApiPropertyOptional({ description: 'Country of origin' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryOfOrigin?: string;

  @ApiPropertyOptional({ description: 'Lot number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

// Customs information DTO
export class CustomsInfoDto {
  @ApiProperty({ description: 'Contents type' })
  @IsString()
  @IsNotEmpty()
  contentsType!: 'merchandise' | 'documents' | 'gift' | 'returned_goods' | 'sample';

  @ApiPropertyOptional({ description: 'Contents explanation' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  contentsExplanation?: string;

  @ApiPropertyOptional({ description: 'Restriction type' })
  @IsOptional()
  @IsString()
  restrictionType?: 'none' | 'quarantine' | 'sanitary_phytosanitary' | 'other';

  @ApiPropertyOptional({ description: 'Restriction comments' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  restrictionComments?: string;

  @ApiPropertyOptional({ description: 'Non-delivery option' })
  @IsOptional()
  @IsString()
  nonDeliveryOption?: 'return' | 'abandon';

  @ApiPropertyOptional({ description: 'Certificate number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  certificateNumber?: string;

  @ApiPropertyOptional({ description: 'License number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Invoice number' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  invoiceNumber?: string;
}

// Create shipment DTO
export class CreateShipmentDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({ description: 'Order ID reference' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Pick list ID reference' })
  @IsOptional()
  @IsUUID()
  pickListId?: string;

  @ApiProperty({ description: 'Carrier ID', enum: CarrierType })
  @IsEnum(CarrierType)
  carrierId!: CarrierType;

  @ApiProperty({ description: 'Service type', enum: ServiceType })
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @ApiProperty({ description: 'Sender address' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  fromAddress!: ShippingAddressDto;

  @ApiProperty({ description: 'Recipient address' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  toAddress!: ShippingAddressDto;

  @ApiProperty({ description: 'Shipment items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemDto)
  items!: ShipmentItemDto[];

  @ApiProperty({ description: 'Package type', enum: PackageType })
  @IsEnum(PackageType)
  packageType!: PackageType;

  @ApiProperty({ description: 'Total weight in pounds' })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  weight!: number;

  @ApiProperty({ description: 'Package dimensions' })
  @ValidateNested()
  @Type(() => PackageDimensionsDto)
  dimensions!: PackageDimensionsDto;

  @ApiPropertyOptional({ description: 'Declared value for insurance' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  declaredValue?: number;

  @ApiPropertyOptional({ description: 'Signature required' })
  @IsOptional()
  @IsBoolean()
  signatureRequired?: boolean;

  @ApiPropertyOptional({ description: 'Saturday delivery' })
  @IsOptional()
  @IsBoolean()
  saturdayDelivery?: boolean;

  @ApiPropertyOptional({ description: 'Insurance value' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  insuranceValue?: number;

  @ApiPropertyOptional({ description: 'Customs information for international shipments' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomsInfoDto)
  customsInfo?: CustomsInfoDto;

  @ApiPropertyOptional({ description: 'Label format', enum: LabelFormat })
  @IsOptional()
  @IsEnum(LabelFormat)
  labelFormat?: LabelFormat;

  @ApiPropertyOptional({ description: 'Include return label' })
  @IsOptional()
  @IsBoolean()
  returnLabel?: boolean;

  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'Reference number 1' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  reference1?: string;

  @ApiPropertyOptional({ description: 'Reference number 2' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  reference2?: string;

  @ApiPropertyOptional({ description: 'Delivery confirmation type' })
  @IsOptional()
  @IsString()
  deliveryConfirmation?: 'none' | 'delivery_confirmation' | 'signature_confirmation' | 'adult_signature';

  @ApiPropertyOptional({ description: 'Hold for pickup' })
  @IsOptional()
  @IsBoolean()
  holdForPickup?: boolean;

  @ApiPropertyOptional({ description: 'Pickup location' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  pickupLocation?: string;
}

// Update shipment DTO
export class UpdateShipmentDto {
  @ApiPropertyOptional({ description: 'Shipment status', enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Special instructions' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  specialInstructions?: string;

  @ApiPropertyOptional({ description: 'Reference number 1' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  reference1?: string;

  @ApiPropertyOptional({ description: 'Reference number 2' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  reference2?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

// Shipping rate response DTO
export class ShippingRateDto {
  @ApiProperty({ description: 'Carrier ID' })
  carrierId!: string;

  @ApiProperty({ description: 'Carrier name' })
  carrierName!: string;

  @ApiProperty({ description: 'Service type' })
  serviceType!: string;

  @ApiProperty({ description: 'Service name' })
  serviceName!: string;

  @ApiProperty({ description: 'Estimated delivery date' })
  estimatedDeliveryDate!: Date;

  @ApiProperty({ description: 'Transit days' })
  transitDays!: number;

  @ApiProperty({ description: 'Shipping cost' })
  cost!: number;

  @ApiProperty({ description: 'Currency' })
  currency!: string;

  @ApiProperty({ description: 'Guaranteed delivery' })
  guaranteedDelivery!: boolean;

  @ApiProperty({ description: 'Tracking included' })
  trackingIncluded!: boolean;

  @ApiPropertyOptional({ description: 'Signature required' })
  signatureRequired?: boolean;

  @ApiPropertyOptional({ description: 'Insurance included' })
  insuranceIncluded?: boolean;

  @ApiPropertyOptional({ description: 'Maximum insurance value' })
  maxInsuranceValue?: number;
}

// Shipping label DTO
export class ShippingLabelDto {
  @ApiProperty({ description: 'Label ID' })
  labelId!: string;

  @ApiProperty({ description: 'Tracking number' })
  trackingNumber!: string;

  @ApiProperty({ description: 'Carrier ID' })
  carrierId!: string;

  @ApiProperty({ description: 'Service type' })
  serviceType!: string;

  @ApiProperty({ description: 'Label format' })
  labelFormat!: LabelFormat;

  @ApiProperty({ description: 'Base64 encoded label data' })
  labelData!: string;

  @ApiPropertyOptional({ description: 'Label download URL' })
  labelUrl?: string;

  @ApiProperty({ description: 'Shipping cost' })
  cost!: number;

  @ApiProperty({ description: 'Currency' })
  currency!: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Label expiration timestamp' })
  expiresAt?: Date;
}

// Tracking event DTO
export class TrackingEventDto {
  @ApiProperty({ description: 'Event ID' })
  eventId!: string;

  @ApiProperty({ description: 'Tracking number' })
  trackingNumber!: string;

  @ApiProperty({ description: 'Event type' })
  eventType!: string;

  @ApiProperty({ description: 'Event description' })
  eventDescription!: string;

  @ApiProperty({ description: 'Event date' })
  eventDate!: Date;

  @ApiPropertyOptional({ description: 'Event location' })
  location?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  @ApiPropertyOptional({ description: 'Carrier event code' })
  carrierEventCode?: string;

  @ApiProperty({ description: 'Is delivered' })
  isDelivered!: boolean;

  @ApiProperty({ description: 'Is exception' })
  isException!: boolean;

  @ApiPropertyOptional({ description: 'Exception reason' })
  exceptionReason?: string;
}

// Shipment query DTO
export class ShipmentQueryDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Filter by carrier', enum: CarrierType })
  @IsOptional()
  @IsEnum(CarrierType)
  carrierId?: CarrierType;

  @ApiPropertyOptional({ description: 'Filter by service type', enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({ description: 'Filter by order ID' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Filter from date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter to date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Bulk shipment creation DTO
export class BulkCreateShipmentsDto {
  @ApiProperty({ description: 'Array of shipments to create' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentDto)
  shipments!: CreateShipmentDto[];

  @ApiPropertyOptional({ description: 'Default carrier for all shipments', enum: CarrierType })
  @IsOptional()
  @IsEnum(CarrierType)
  defaultCarrierId?: CarrierType;

  @ApiPropertyOptional({ description: 'Default service type for all shipments', enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  defaultServiceType?: ServiceType;

  @ApiPropertyOptional({ description: 'Default label format for all shipments', enum: LabelFormat })
  @IsOptional()
  @IsEnum(LabelFormat)
  defaultLabelFormat?: LabelFormat;

  @ApiPropertyOptional({ description: 'Batch processing options' })
  @IsOptional()
  batchOptions?: {
    continueOnError?: boolean;
    maxConcurrent?: number;
    delayBetweenRequests?: number;
  };
}

// Address validation DTO
export class ValidateAddressDto {
  @ApiProperty({ description: 'Address to validate' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  address!: ShippingAddressDto;

  @ApiPropertyOptional({ description: 'Carrier to use for validation', enum: CarrierType })
  @IsOptional()
  @IsEnum(CarrierType)
  carrierId?: CarrierType;

  @ApiPropertyOptional({ description: 'Return suggestions for invalid addresses' })
  @IsOptional()
  @IsBoolean()
  returnSuggestions?: boolean;
}

// Shipping metrics DTO
export class ShippingMetricsDto {
  @ApiProperty({ description: 'Total shipments' })
  totalShipments!: number;

  @ApiProperty({ description: 'Total shipping cost' })
  totalCost!: number;

  @ApiProperty({ description: 'Average shipping cost' })
  averageCost!: number;

  @ApiProperty({ description: 'On-time delivery rate percentage' })
  onTimeDeliveryRate!: number;

  @ApiProperty({ description: 'Carrier breakdown' })
  carrierBreakdown!: Record<string, number>;

  @ApiProperty({ description: 'Service type breakdown' })
  serviceTypeBreakdown!: Record<string, number>;

  @ApiProperty({ description: 'Delivery performance metrics' })
  deliveryPerformance!: {
    delivered: number;
    inTransit: number;
    exceptions: number;
    cancelled: number;
  };

  @ApiProperty({ description: 'Average transit time in days' })
  averageTransitTime!: number;

  @ApiProperty({ description: 'Exception rate percentage' })
  exceptionRate!: number;

  @ApiProperty({ description: 'Cost per shipment by carrier' })
  costPerShipmentByCarrier!: Record<string, number>;

  @ApiProperty({ description: 'Delivery time by service type' })
  deliveryTimeByService!: Record<string, number>;
}

// Carrier configuration DTO
export class CarrierConfigDto {
  @ApiProperty({ description: 'Carrier ID', enum: CarrierType })
  @IsEnum(CarrierType)
  carrierId!: CarrierType;

  @ApiProperty({ description: 'Carrier name' })
  @IsString()
  @IsNotEmpty()
  carrierName!: string;

  @ApiProperty({ description: 'Available services' })
  @IsArray()
  services!: Array<{
    serviceType: string;
    serviceName: string;
    description?: string;
    features?: string[];
  }>;

  @ApiProperty({ description: 'Supported features' })
  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @ApiProperty({ description: 'Supported countries' })
  @IsArray()
  @IsString({ each: true })
  supportedCountries!: string[];

  @ApiProperty({ description: 'Is enabled' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ description: 'API configuration' })
  @IsOptional()
  apiConfig?: {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
  };

  @ApiPropertyOptional({ description: 'Default settings' })
  @IsOptional()
  defaultSettings?: {
    labelFormat?: LabelFormat;
    signatureRequired?: boolean;
    insuranceIncluded?: boolean;
  };
}