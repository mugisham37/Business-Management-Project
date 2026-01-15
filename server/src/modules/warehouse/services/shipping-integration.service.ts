import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';
import { QueueService } from '../../queue/queue.service';

// Shipping DTOs and interfaces
export interface ShippingAddress {
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShipmentItem {
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  value: number;
  harmonizedCode?: string;
  countryOfOrigin?: string;
}

export interface ShippingRate {
  carrierId: string;
  carrierName: string;
  serviceType: string;
  serviceName: string;
  estimatedDeliveryDate: Date;
  transitDays: number;
  cost: number;
  currency: string;
  guaranteedDelivery: boolean;
  trackingIncluded: boolean;
  signatureRequired?: boolean;
  insuranceIncluded?: boolean;
  maxInsuranceValue?: number;
}

export interface ShippingLabel {
  labelId: string;
  trackingNumber: string;
  carrierId: string;
  serviceType: string;
  labelFormat: 'PDF' | 'PNG' | 'ZPL';
  labelData: string; // Base64 encoded
  labelUrl?: string;
  cost: number;
  currency: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface TrackingEvent {
  eventId: string;
  trackingNumber: string;
  eventType: string;
  eventDescription: string;
  eventDate: Date;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  carrierEventCode?: string;
  isDelivered: boolean;
  isException: boolean;
  exceptionReason?: string;
}

export interface CreateShipmentDto {
  tenantId: string;
  warehouseId: string;
  orderId?: string;
  pickListId?: string;
  carrierId: string;
  serviceType: string;
  fromAddress: ShippingAddress;
  toAddress: ShippingAddress;
  items: ShipmentItem[];
  packageType: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  declaredValue?: number;
  signatureRequired?: boolean;
  saturdayDelivery?: boolean;
  insuranceValue?: number;
  customsInfo?: {
    contentsType: string;
    contentsExplanation?: string;
    restrictionType?: string;
    restrictionComments?: string;
  };
  labelFormat?: 'PDF' | 'PNG' | 'ZPL';
  returnLabel?: boolean;
  userId: string;
}

// Domain Events
export class ShipmentCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly shipmentId: string,
    public readonly trackingNumber: string,
    public readonly carrierId: string,
    public readonly orderId?: string,
    public readonly userId?: string,
  ) {}
}

export class ShipmentDeliveredEvent {
  constructor(
    public readonly tenantId: string,
    public readonly shipmentId: string,
    public readonly trackingNumber: string,
    public readonly deliveryDate: Date,
    public readonly signedBy?: string,
  ) {}
}

export class ShipmentExceptionEvent {
  constructor(
    public readonly tenantId: string,
    public readonly shipmentId: string,
    public readonly trackingNumber: string,
    public readonly exceptionType: string,
    public readonly exceptionReason: string,
    public readonly eventDate: Date,
  ) {}
}

// Carrier interface for different shipping providers
export interface ICarrierService {
  carrierId: string;
  carrierName: string;
  
  getRates(shipment: CreateShipmentDto): Promise<ShippingRate[]>;
  createShipment(shipment: CreateShipmentDto): Promise<ShippingLabel>;
  trackShipment(trackingNumber: string): Promise<TrackingEvent[]>;
  cancelShipment(trackingNumber: string): Promise<boolean>;
  validateAddress(address: ShippingAddress): Promise<ShippingAddress>;
}

@Injectable()
export class ShippingIntegrationService {
  private readonly logger = new Logger(ShippingIntegrationService.name);
  private carriers = new Map<string, ICarrierService>();

  constructor(
    private readonly cacheService: IntelligentCacheService,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeCarriers();
  }

  private initializeCarriers(): void {
    // Initialize carrier services based on configuration
    // This would be loaded from environment/configuration
    const enabledCarriers = process.env.ENABLED_CARRIERS?.split(',') || ['ups', 'fedex', 'usps'];
    
    enabledCarriers.forEach(carrierId => {
      try {
        const carrierService = this.createCarrierService(carrierId);
        if (carrierService) {
          this.carriers.set(carrierId, carrierService);
          this.logger.log(`Initialized carrier service: ${carrierId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize carrier ${carrierId}:`, error);
      }
    });
  }

  private createCarrierService(carrierId: string): ICarrierService | null {
    // Factory method to create carrier services
    // In a real implementation, these would be separate service classes
    switch (carrierId.toLowerCase()) {
      case 'ups':
        return new UPSCarrierService();
      case 'fedex':
        return new FedExCarrierService();
      case 'usps':
        return new USPSCarrierService();
      default:
        this.logger.warn(`Unknown carrier: ${carrierId}`);
        return null;
    }
  }

  async getShippingRates(tenantId: string, shipmentData: CreateShipmentDto): Promise<ShippingRate[]> {
    const cacheKey = `shipping:rates:${tenantId}:${this.generateShipmentHash(shipmentData)}`;
    
    // Check cache first
    let rates = await this.cacheService.get<ShippingRate[]>(cacheKey);
    if (rates) {
      return rates;
    }

    // Get rates from all available carriers
    const ratePromises = Array.from(this.carriers.values()).map(async (carrier) => {
      try {
        return await carrier.getRates(shipmentData);
      } catch (error) {
        this.logger.error(`Failed to get rates from ${carrier.carrierId}:`, error);
        return [];
      }
    });

    const carrierRates = await Promise.all(ratePromises);
    rates = carrierRates.flat().sort((a, b) => a.cost - b.cost); // Sort by cost

    // Cache rates for 15 minutes
    await this.cacheService.set(cacheKey, rates, { ttl: 900 });

    return rates;
  }

  async createShipment(tenantId: string, shipmentData: CreateShipmentDto): Promise<{
    shipmentId: string;
    label: ShippingLabel;
    estimatedDelivery: Date;
  }> {
    const carrier = this.carriers.get(shipmentData.carrierId);
    if (!carrier) {
      throw new BadRequestException(`Carrier ${shipmentData.carrierId} not supported`);
    }

    try {
      // Validate addresses
      const validatedFromAddress = await carrier.validateAddress(shipmentData.fromAddress);
      const validatedToAddress = await carrier.validateAddress(shipmentData.toAddress);

      // Create shipment with validated addresses
      const validatedShipmentData = {
        ...shipmentData,
        fromAddress: validatedFromAddress,
        toAddress: validatedToAddress,
      };

      const label = await carrier.createShipment(validatedShipmentData);
      
      // Generate shipment ID
      const shipmentId = this.generateShipmentId(tenantId);

      // Store shipment data
      await this.storeShipmentData(tenantId, shipmentId, {
        ...validatedShipmentData,
        label,
        status: 'created',
        createdAt: new Date(),
      });

      // Emit domain event
      this.eventEmitter.emit('shipment.created', new ShipmentCreatedEvent(
        tenantId,
        shipmentId,
        label.trackingNumber,
        shipmentData.carrierId,
        shipmentData.orderId,
        shipmentData.userId,
      ));

      // Queue tracking updates
      await this.queueService.add('track-shipment', {
        tenantId,
        shipmentId,
        trackingNumber: label.trackingNumber,
        carrierId: shipmentData.carrierId,
      }, {
        delay: 3600000, // Start tracking after 1 hour
        repeat: { every: 3600000 }, // Check every hour
      });

      // Calculate estimated delivery (this would be more sophisticated in real implementation)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 3); // Default 3 days

      return {
        shipmentId,
        label,
        estimatedDelivery,
      };

    } catch (error: unknown) {
      this.logger.error(`Failed to create shipment with ${shipmentData.carrierId}:`, error);
      throw new BadRequestException(`Failed to create shipment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async trackShipment(tenantId: string, trackingNumber: string): Promise<{
    shipment: any;
    trackingEvents: TrackingEvent[];
    currentStatus: string;
    isDelivered: boolean;
  }> {
    const cacheKey = `shipping:tracking:${tenantId}:${trackingNumber}`;
    
    // Check cache first
    let trackingData = await this.cacheService.get<any>(cacheKey);
    if (trackingData) {
      return trackingData;
    }

    // Get shipment data
    const shipment = await this.getShipmentByTrackingNumber(tenantId, trackingNumber);
    if (!shipment) {
      throw new NotFoundException(`Shipment not found for tracking number: ${trackingNumber}`);
    }

    const carrier = this.carriers.get(shipment.carrierId);
    if (!carrier) {
      throw new BadRequestException(`Carrier ${shipment.carrierId} not supported`);
    }

    try {
      const trackingEvents = await carrier.trackShipment(trackingNumber);
      
      // Determine current status
      const latestEvent = trackingEvents[trackingEvents.length - 1];
      const currentStatus = latestEvent?.eventType || 'unknown';
      const isDelivered = trackingEvents.some(event => event.isDelivered);

      // Check for delivery
      if (isDelivered && !shipment.deliveredAt) {
        const deliveryEvent = trackingEvents.find(event => event.isDelivered);
        if (deliveryEvent) {
          await this.markShipmentDelivered(tenantId, shipment.id, deliveryEvent);
        }
      }

      // Check for exceptions
      const exceptionEvents = trackingEvents.filter(event => event.isException);
      for (const exceptionEvent of exceptionEvents) {
        if (!shipment.exceptions?.includes(exceptionEvent.eventId)) {
          await this.handleShipmentException(tenantId, shipment.id, exceptionEvent);
        }
      }

      trackingData = {
        shipment,
        trackingEvents,
        currentStatus,
        isDelivered,
      };

      // Cache tracking data for 30 minutes
      await this.cacheService.set(cacheKey, trackingData, { ttl: 1800 });

      return trackingData;

    } catch (error: unknown) {
      this.logger.error(`Failed to track shipment ${trackingNumber}:`, error);
      throw new BadRequestException(`Failed to track shipment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelShipment(tenantId: string, shipmentId: string, userId: string): Promise<boolean> {
    const shipment = await this.getShipment(tenantId, shipmentId);
    if (!shipment) {
      throw new NotFoundException(`Shipment not found: ${shipmentId}`);
    }

    if (shipment.status === 'delivered' || shipment.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel shipment with status: ${shipment.status}`);
    }

    const carrier = this.carriers.get(shipment.carrierId);
    if (!carrier) {
      throw new BadRequestException(`Carrier ${shipment.carrierId} not supported`);
    }

    try {
      const cancelled = await carrier.cancelShipment(shipment.trackingNumber);
      
      if (cancelled) {
        await this.updateShipmentStatus(tenantId, shipmentId, 'cancelled', userId);
        
        // Invalidate cache
        await this.invalidateShipmentCache(tenantId, shipmentId);
      }

      return cancelled;

    } catch (error: unknown) {
      this.logger.error(`Failed to cancel shipment ${shipmentId}:`, error);
      throw new BadRequestException(`Failed to cancel shipment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getShipmentsByWarehouse(tenantId: string, warehouseId: string, options: {
    status?: string;
    carrierId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    shipments: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = `shipping:warehouse:${tenantId}:${warehouseId}:${JSON.stringify(options)}`;
    
    let result = await this.cacheService.get<{ shipments: any[]; total: number; page: number; limit: number; totalPages: number; }>(cacheKey);
    if (result) {
      return result;
    }

    // This would query the database for shipments
    // For now, returning mock data structure
    result = {
      shipments: [],
      total: 0,
      page: options.page || 1,
      limit: options.limit || 20,
      totalPages: 0,
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, result, { ttl: 300 });

    return result;
  }

  async getShippingMetrics(tenantId: string, warehouseId: string, dateRange: {
    from: Date;
    to: Date;
  }): Promise<{
    totalShipments: number;
    totalCost: number;
    averageCost: number;
    onTimeDeliveryRate: number;
    carrierBreakdown: Record<string, number>;
    serviceTypeBreakdown: Record<string, number>;
    deliveryPerformance: {
      delivered: number;
      inTransit: number;
      exceptions: number;
      cancelled: number;
    };
  }> {
    const cacheKey = `shipping:metrics:${tenantId}:${warehouseId}:${dateRange.from.getTime()}-${dateRange.to.getTime()}`;
    
    let metrics = await this.cacheService.get<any>(cacheKey);
    if (metrics) {
      return metrics;
    }

    // This would calculate metrics from database
    // For now, returning mock data structure
    metrics = {
      totalShipments: 0,
      totalCost: 0,
      averageCost: 0,
      onTimeDeliveryRate: 0,
      carrierBreakdown: {},
      serviceTypeBreakdown: {},
      deliveryPerformance: {
        delivered: 0,
        inTransit: 0,
        exceptions: 0,
        cancelled: 0,
      },
    };

    // Cache for 1 hour
    await this.cacheService.set(cacheKey, metrics, { ttl: 3600 });

    return metrics;
  }

  // Private helper methods
  private generateShipmentHash(shipmentData: CreateShipmentDto): string {
    const hashData = {
      from: shipmentData.fromAddress,
      to: shipmentData.toAddress,
      weight: shipmentData.weight,
      dimensions: shipmentData.dimensions,
      serviceType: shipmentData.serviceType,
    };
    
    // Simple hash generation (in production, use a proper hashing library)
    return Buffer.from(JSON.stringify(hashData)).toString('base64').slice(0, 16);
  }

  private generateShipmentId(tenantId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `SHP-${timestamp}-${random}`.toUpperCase();
  }

  private async storeShipmentData(tenantId: string, shipmentId: string, data: any): Promise<void> {
    // This would store shipment data in database
    // For now, just cache it
    const cacheKey = `shipment:${tenantId}:${shipmentId}`;
    await this.cacheService.set(cacheKey, data, { ttl: 86400 }); // 24 hours
  }

  private async getShipment(tenantId: string, shipmentId: string): Promise<any> {
    const cacheKey = `shipment:${tenantId}:${shipmentId}`;
    return await this.cacheService.get(cacheKey);
  }

  private async getShipmentByTrackingNumber(tenantId: string, trackingNumber: string): Promise<any> {
    const cacheKey = `shipment:tracking:${tenantId}:${trackingNumber}`;
    return await this.cacheService.get(cacheKey);
  }

  private async updateShipmentStatus(tenantId: string, shipmentId: string, status: string, userId: string): Promise<void> {
    const shipment = await this.getShipment(tenantId, shipmentId);
    if (shipment) {
      shipment.status = status;
      shipment.updatedAt = new Date();
      shipment.updatedBy = userId;
      
      const cacheKey = `shipment:${tenantId}:${shipmentId}`;
      await this.cacheService.set(cacheKey, shipment, { ttl: 86400 });
    }
  }

  private async markShipmentDelivered(tenantId: string, shipmentId: string, deliveryEvent: TrackingEvent): Promise<void> {
    const shipment = await this.getShipment(tenantId, shipmentId);
    if (shipment) {
      shipment.status = 'delivered';
      shipment.deliveredAt = deliveryEvent.eventDate;
      shipment.signedBy = deliveryEvent.location?.city; // Simplified
      
      await this.storeShipmentData(tenantId, shipmentId, shipment);
      
      // Emit delivery event
      this.eventEmitter.emit('shipment.delivered', new ShipmentDeliveredEvent(
        tenantId,
        shipmentId,
        shipment.trackingNumber,
        deliveryEvent.eventDate,
        shipment.signedBy,
      ));
    }
  }

  private async handleShipmentException(tenantId: string, shipmentId: string, exceptionEvent: TrackingEvent): Promise<void> {
    const shipment = await this.getShipment(tenantId, shipmentId);
    if (shipment) {
      if (!shipment.exceptions) {
        shipment.exceptions = [];
      }
      shipment.exceptions.push(exceptionEvent.eventId);
      
      await this.storeShipmentData(tenantId, shipmentId, shipment);
      
      // Emit exception event
      this.eventEmitter.emit('shipment.exception', new ShipmentExceptionEvent(
        tenantId,
        shipmentId,
        shipment.trackingNumber,
        exceptionEvent.eventType,
        exceptionEvent.exceptionReason || 'Unknown exception',
        exceptionEvent.eventDate,
      ));
    }
  }

  private async invalidateShipmentCache(tenantId: string, shipmentId: string): Promise<void> {
    await this.cacheService.invalidatePattern(`shipment:${tenantId}:${shipmentId}*`);
    await this.cacheService.invalidatePattern(`shipping:warehouse:${tenantId}:*`);
    await this.cacheService.invalidatePattern(`shipping:metrics:${tenantId}:*`);
  }
}

// Mock carrier service implementations
// In a real implementation, these would be separate files with actual API integrations

class UPSCarrierService implements ICarrierService {
  carrierId = 'ups';
  carrierName = 'United Parcel Service';

  async getRates(shipment: CreateShipmentDto): Promise<ShippingRate[]> {
    // Mock UPS API integration
    return [
      {
        carrierId: this.carrierId,
        carrierName: this.carrierName,
        serviceType: 'ground',
        serviceName: 'UPS Ground',
        estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        transitDays: 3,
        cost: 12.50,
        currency: 'USD',
        guaranteedDelivery: false,
        trackingIncluded: true,
      },
      {
        carrierId: this.carrierId,
        carrierName: this.carrierName,
        serviceType: 'next_day',
        serviceName: 'UPS Next Day Air',
        estimatedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        transitDays: 1,
        cost: 45.00,
        currency: 'USD',
        guaranteedDelivery: true,
        trackingIncluded: true,
      },
    ];
  }

  async createShipment(shipment: CreateShipmentDto): Promise<ShippingLabel> {
    // Mock UPS shipment creation
    return {
      labelId: `UPS-${Date.now()}`,
      trackingNumber: `1Z999AA1${Math.random().toString().substring(2, 12)}`,
      carrierId: this.carrierId,
      serviceType: shipment.serviceType,
      labelFormat: shipment.labelFormat || 'PDF',
      labelData: 'base64-encoded-label-data',
      cost: 12.50,
      currency: 'USD',
      createdAt: new Date(),
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingEvent[]> {
    // Mock UPS tracking
    return [
      {
        eventId: `evt-${Date.now()}`,
        trackingNumber,
        eventType: 'shipped',
        eventDescription: 'Package shipped from origin',
        eventDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        location: { city: 'Atlanta', state: 'GA', country: 'US' },
        isDelivered: false,
        isException: false,
      },
      {
        eventId: `evt-${Date.now() + 1}`,
        trackingNumber,
        eventType: 'in_transit',
        eventDescription: 'Package in transit',
        eventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        location: { city: 'Memphis', state: 'TN', country: 'US' },
        isDelivered: false,
        isException: false,
      },
    ];
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    // Mock UPS cancellation
    return true;
  }

  async validateAddress(address: ShippingAddress): Promise<ShippingAddress> {
    // Mock UPS address validation
    return address;
  }
}

class FedExCarrierService implements ICarrierService {
  carrierId = 'fedex';
  carrierName = 'Federal Express';

  async getRates(shipment: CreateShipmentDto): Promise<ShippingRate[]> {
    // Mock FedEx API integration
    return [
      {
        carrierId: this.carrierId,
        carrierName: this.carrierName,
        serviceType: 'ground',
        serviceName: 'FedEx Ground',
        estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        transitDays: 2,
        cost: 11.75,
        currency: 'USD',
        guaranteedDelivery: false,
        trackingIncluded: true,
      },
      {
        carrierId: this.carrierId,
        carrierName: this.carrierName,
        serviceType: 'overnight',
        serviceName: 'FedEx Standard Overnight',
        estimatedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        transitDays: 1,
        cost: 42.00,
        currency: 'USD',
        guaranteedDelivery: true,
        trackingIncluded: true,
      },
    ];
  }

  async createShipment(shipment: CreateShipmentDto): Promise<ShippingLabel> {
    // Mock FedEx shipment creation
    return {
      labelId: `FDX-${Date.now()}`,
      trackingNumber: `${Math.random().toString().substring(2, 14)}`,
      carrierId: this.carrierId,
      serviceType: shipment.serviceType,
      labelFormat: shipment.labelFormat || 'PDF',
      labelData: 'base64-encoded-label-data',
      cost: 11.75,
      currency: 'USD',
      createdAt: new Date(),
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingEvent[]> {
    // Mock FedEx tracking
    return [
      {
        eventId: `evt-${Date.now()}`,
        trackingNumber,
        eventType: 'picked_up',
        eventDescription: 'Package picked up',
        eventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        location: { city: 'Memphis', state: 'TN', country: 'US' },
        isDelivered: false,
        isException: false,
      },
    ];
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    // Mock FedEx cancellation
    return true;
  }

  async validateAddress(address: ShippingAddress): Promise<ShippingAddress> {
    // Mock FedEx address validation
    return address;
  }
}

class USPSCarrierService implements ICarrierService {
  carrierId = 'usps';
  carrierName = 'United States Postal Service';

  async getRates(shipment: CreateShipmentDto): Promise<ShippingRate[]> {
    // Mock USPS API integration
    return [
      {
        carrierId: this.carrierId,
        carrierName: this.carrierName,
        serviceType: 'ground',
        serviceName: 'USPS Ground Advantage',
        estimatedDeliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        transitDays: 4,
        cost: 8.95,
        currency: 'USD',
        guaranteedDelivery: false,
        trackingIncluded: true,
      },
      {
        carrierId: this.carrierId,
        carrierName: this.carrierName,
        serviceType: 'priority',
        serviceName: 'USPS Priority Mail',
        estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        transitDays: 2,
        cost: 15.50,
        currency: 'USD',
        guaranteedDelivery: false,
        trackingIncluded: true,
      },
    ];
  }

  async createShipment(shipment: CreateShipmentDto): Promise<ShippingLabel> {
    // Mock USPS shipment creation
    return {
      labelId: `USPS-${Date.now()}`,
      trackingNumber: `9400${Math.random().toString().substring(2, 20)}`,
      carrierId: this.carrierId,
      serviceType: shipment.serviceType,
      labelFormat: shipment.labelFormat || 'PDF',
      labelData: 'base64-encoded-label-data',
      cost: 8.95,
      currency: 'USD',
      createdAt: new Date(),
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingEvent[]> {
    // Mock USPS tracking
    return [
      {
        eventId: `evt-${Date.now()}`,
        trackingNumber,
        eventType: 'accepted',
        eventDescription: 'Package accepted at USPS facility',
        eventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        location: { city: 'Chicago', state: 'IL', country: 'US' },
        isDelivered: false,
        isException: false,
      },
    ];
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    // Mock USPS cancellation
    return true;
  }

  async validateAddress(address: ShippingAddress): Promise<ShippingAddress> {
    // Mock USPS address validation
    return address;
  }
}