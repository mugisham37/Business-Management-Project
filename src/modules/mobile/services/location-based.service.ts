import { Injectable, Logger } from '@nestjs/common';
import { IntelligentCacheService } from '../../cache/intelligent-cache.service';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface GeofenceArea {
  id: string;
  name: string;
  tenantId: string;
  center: LocationCoordinates;
  radius: number; // in meters
  type: 'store' | 'warehouse' | 'delivery_zone' | 'restricted' | 'custom';
  isActive: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface LocationEvent {
  id: string;
  userId: string;
  tenantId: string;
  deviceId: string;
  eventType: 'enter' | 'exit' | 'dwell' | 'movement';
  location: LocationCoordinates;
  geofenceId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface NearbyLocation {
  id: string;
  name: string;
  type: 'store' | 'warehouse' | 'customer' | 'supplier';
  location: LocationCoordinates;
  distance: number; // in meters
  metadata?: Record<string, any>;
}

export interface LocationBasedRecommendation {
  type: 'nearby_customer' | 'optimal_route' | 'inventory_alert' | 'promotion';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LocationBasedService {
  private readonly logger = new Logger(LocationBasedService.name);

  constructor(private readonly cacheService: IntelligentCacheService) {}

  /**
   * Track user location and trigger location-based events
   */
  async trackLocation(
    userId: string,
    tenantId: string,
    deviceId: string,
    location: LocationCoordinates,
  ): Promise<{
    events: LocationEvent[];
    recommendations: LocationBasedRecommendation[];
    nearbyLocations: NearbyLocation[];
  }> {
    try {
      this.logger.debug(`Tracking location for user ${userId}: ${location.latitude}, ${location.longitude}`);

      // Store current location
      await this.storeUserLocation(userId, tenantId, deviceId, location);

      // Check geofences
      const geofenceEvents = await this.checkGeofences(userId, tenantId, deviceId, location);

      // Get nearby locations
      const nearbyLocations = await this.getNearbyLocations(tenantId, location, 5000); // 5km radius

      // Generate location-based recommendations
      const recommendations = await this.generateLocationRecommendations(
        userId,
        tenantId,
        location,
        nearbyLocations,
      );

      // Create movement event
      const movementEvent: LocationEvent = {
        id: `location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        tenantId,
        deviceId,
        eventType: 'movement',
        location,
        timestamp: new Date(),
      };

      const allEvents = [movementEvent, ...geofenceEvents];

      // Store events
      await this.storeLocationEvents(allEvents);

      return {
        events: allEvents,
        recommendations,
        nearbyLocations,
      };
    } catch (error) {
      this.logger.error(`Location tracking failed: ${error.message}`, error.stack);
      return {
        events: [],
        recommendations: [],
        nearbyLocations: [],
      };
    }
  }

  /**
   * Create geofence area
   */
  async createGeofence(
    tenantId: string,
    name: string,
    center: LocationCoordinates,
    radius: number,
    type: 'store' | 'warehouse' | 'delivery_zone' | 'restricted' | 'custom',
    metadata?: Record<string, any>,
  ): Promise<GeofenceArea> {
    const geofence: GeofenceArea = {
      id: `geofence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      tenantId,
      center,
      radius,
      type,
      isActive: true,
      createdAt: new Date(),
      metadata,
    };

    await this.saveGeofence(geofence);
    
    this.logger.log(`Created geofence ${name} for tenant ${tenantId}`);
    return geofence;
  }

  /**
   * Get geofences for tenant
   */
  async getGeofences(tenantId: string): Promise<GeofenceArea[]> {
    const cacheKey = `geofences:${tenantId}`;
    const cached = await this.cacheService.get<GeofenceArea[]>(cacheKey);
    
    if (cached) {
      return cached.filter(g => g.isActive);
    }

    // In production, this would query the database
    return [];
  }

  /**
   * Update geofence
   */
  async updateGeofence(
    tenantId: string,
    geofenceId: string,
    updates: Partial<GeofenceArea>,
  ): Promise<GeofenceArea | null> {
    const geofences = await this.getGeofences(tenantId);
    const geofence = geofences.find(g => g.id === geofenceId);

    if (!geofence) {
      return null;
    }

    Object.assign(geofence, updates);
    await this.saveGeofence(geofence);

    return geofence;
  }

  /**
   * Delete geofence
   */
  async deleteGeofence(tenantId: string, geofenceId: string): Promise<boolean> {
    const geofence = await this.updateGeofence(tenantId, geofenceId, { isActive: false });
    return geofence !== null;
  }

  /**
   * Get location history for user
   */
  async getLocationHistory(
    userId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
  ): Promise<LocationEvent[]> {
    const cacheKey = `location_history:${tenantId}:${userId}`;
    const allEvents = await this.cacheService.get<LocationEvent[]>(cacheKey) || [];

    return allEvents
      .filter(event => 
        event.timestamp >= startDate && 
        event.timestamp <= endDate
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get location analytics
   */
  async getLocationAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    geofenceEvents: Record<string, number>;
    heatmapData: Array<{ lat: number; lng: number; intensity: number }>;
    popularAreas: Array<{ name: string; visits: number; avgDwellTime: number }>;
  }> {
    try {
      // Get all location events for the period
      const events = await this.getLocationEventsForPeriod(tenantId, startDate, endDate);

      const totalEvents = events.length;
      const uniqueUsers = new Set(events.map(e => e.userId)).size;

      // Count geofence events
      const geofenceEvents: Record<string, number> = {};
      events.forEach(event => {
        if (event.geofenceId) {
          geofenceEvents[event.geofenceId] = (geofenceEvents[event.geofenceId] || 0) + 1;
        }
      });

      // Generate heatmap data (simplified)
      const heatmapData = this.generateHeatmapData(events);

      // Calculate popular areas
      const popularAreas = await this.calculatePopularAreas(tenantId, events);

      return {
        totalEvents,
        uniqueUsers,
        geofenceEvents,
        heatmapData,
        popularAreas,
      };
    } catch (error) {
      this.logger.error(`Location analytics failed: ${error.message}`, error.stack);
      return {
        totalEvents: 0,
        uniqueUsers: 0,
        geofenceEvents: {},
        heatmapData: [],
        popularAreas: [],
      };
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(coord1: LocationCoordinates, coord2: LocationCoordinates): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (coord1.latitude * Math.PI) / 180;
    const lat2Rad = (coord2.latitude * Math.PI) / 180;
    const deltaLatRad = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const deltaLngRad = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if location is within geofence
   */
  private isWithinGeofence(location: LocationCoordinates, geofence: GeofenceArea): boolean {
    const distance = this.calculateDistance(location, geofence.center);
    return distance <= geofence.radius;
  }

  /**
   * Check geofences for location
   */
  private async checkGeofences(
    userId: string,
    tenantId: string,
    deviceId: string,
    location: LocationCoordinates,
  ): Promise<LocationEvent[]> {
    const geofences = await this.getGeofences(tenantId);
    const events: LocationEvent[] = [];

    // Get previous location to determine enter/exit events
    const previousLocation = await this.getPreviousLocation(userId, tenantId, deviceId);

    for (const geofence of geofences) {
      const isCurrentlyInside = this.isWithinGeofence(location, geofence);
      const wasPreviouslyInside = previousLocation ? 
        this.isWithinGeofence(previousLocation, geofence) : false;

      if (isCurrentlyInside && !wasPreviouslyInside) {
        // Enter event
        events.push({
          id: `geofence_enter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          tenantId,
          deviceId,
          eventType: 'enter',
          location,
          geofenceId: geofence.id,
          timestamp: new Date(),
          metadata: { geofenceName: geofence.name, geofenceType: geofence.type },
        });
      } else if (!isCurrentlyInside && wasPreviouslyInside) {
        // Exit event
        events.push({
          id: `geofence_exit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          tenantId,
          deviceId,
          eventType: 'exit',
          location,
          geofenceId: geofence.id,
          timestamp: new Date(),
          metadata: { geofenceName: geofence.name, geofenceType: geofence.type },
        });
      }
    }

    return events;
  }

  /**
   * Get nearby locations
   */
  private async getNearbyLocations(
    tenantId: string,
    location: LocationCoordinates,
    radius: number,
  ): Promise<NearbyLocation[]> {
    // Mock implementation - in production, query database for nearby locations
    const mockLocations: NearbyLocation[] = [
      {
        id: 'store-1',
        name: 'Main Store',
        type: 'store',
        location: {
          latitude: location.latitude + 0.001,
          longitude: location.longitude + 0.001,
          timestamp: Date.now(),
        },
        distance: 0,
        metadata: { address: '123 Main St', phone: '+1234567890' },
      },
      {
        id: 'warehouse-1',
        name: 'Central Warehouse',
        type: 'warehouse',
        location: {
          latitude: location.latitude - 0.002,
          longitude: location.longitude + 0.003,
          timestamp: Date.now(),
        },
        distance: 0,
        metadata: { capacity: '10000 sqft', manager: 'John Doe' },
      },
    ];

    // Calculate actual distances and filter by radius
    return mockLocations
      .map(loc => ({
        ...loc,
        distance: this.calculateDistance(location, loc.location),
      }))
      .filter(loc => loc.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Generate location-based recommendations
   */
  private async generateLocationRecommendations(
    userId: string,
    tenantId: string,
    location: LocationCoordinates,
    nearbyLocations: NearbyLocation[],
  ): Promise<LocationBasedRecommendation[]> {
    const recommendations: LocationBasedRecommendation[] = [];

    // Nearby customer recommendations
    const nearbyStores = nearbyLocations.filter(loc => loc.type === 'store');
    if (nearbyStores.length > 0) {
      recommendations.push({
        type: 'nearby_customer',
        title: 'Nearby Store Detected',
        description: `You are near ${nearbyStores[0].name}. Check inventory levels or visit customers.`,
        priority: 'medium',
        actionUrl: `/stores/${nearbyStores[0].id}`,
        metadata: { storeId: nearbyStores[0].id, distance: nearbyStores[0].distance },
      });
    }

    // Warehouse proximity recommendations
    const nearbyWarehouses = nearbyLocations.filter(loc => loc.type === 'warehouse');
    if (nearbyWarehouses.length > 0) {
      recommendations.push({
        type: 'inventory_alert',
        title: 'Warehouse Nearby',
        description: `${nearbyWarehouses[0].name} is nearby. Perfect time to check inventory or pick up supplies.`,
        priority: 'low',
        actionUrl: `/warehouses/${nearbyWarehouses[0].id}`,
        metadata: { warehouseId: nearbyWarehouses[0].id },
      });
    }

    // Route optimization recommendations
    if (nearbyLocations.length > 1) {
      recommendations.push({
        type: 'optimal_route',
        title: 'Route Optimization Available',
        description: `Plan an optimal route to visit ${nearbyLocations.length} nearby locations.`,
        priority: 'medium',
        actionUrl: '/routes/optimize',
        metadata: { locationCount: nearbyLocations.length },
      });
    }

    return recommendations;
  }

  /**
   * Store user location
   */
  private async storeUserLocation(
    userId: string,
    tenantId: string,
    deviceId: string,
    location: LocationCoordinates,
  ): Promise<void> {
    const cacheKey = `user_location:${tenantId}:${userId}:${deviceId}`;
    await this.cacheService.set(cacheKey, location, 3600); // 1 hour
  }

  /**
   * Get previous location
   */
  private async getPreviousLocation(
    userId: string,
    tenantId: string,
    deviceId: string,
  ): Promise<LocationCoordinates | null> {
    const cacheKey = `user_location:${tenantId}:${userId}:${deviceId}`;
    return this.cacheService.get<LocationCoordinates>(cacheKey);
  }

  /**
   * Save geofence
   */
  private async saveGeofence(geofence: GeofenceArea): Promise<void> {
    const cacheKey = `geofences:${geofence.tenantId}`;
    const geofences = await this.cacheService.get<GeofenceArea[]>(cacheKey) || [];
    
    const existingIndex = geofences.findIndex(g => g.id === geofence.id);
    if (existingIndex >= 0) {
      geofences[existingIndex] = geofence;
    } else {
      geofences.push(geofence);
    }

    await this.cacheService.set(cacheKey, geofences, 86400); // 24 hours
  }

  /**
   * Store location events
   */
  private async storeLocationEvents(events: LocationEvent[]): Promise<void> {
    for (const event of events) {
      const cacheKey = `location_history:${event.tenantId}:${event.userId}`;
      const existingEvents = await this.cacheService.get<LocationEvent[]>(cacheKey) || [];
      
      existingEvents.push(event);
      
      // Keep only last 1000 events per user
      if (existingEvents.length > 1000) {
        existingEvents.splice(0, existingEvents.length - 1000);
      }

      await this.cacheService.set(cacheKey, existingEvents, 86400 * 7); // 7 days
    }
  }

  /**
   * Get location events for period
   */
  private async getLocationEventsForPeriod(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LocationEvent[]> {
    // In production, this would query the database
    // For now, we'll return mock data
    return [];
  }

  /**
   * Generate heatmap data
   */
  private generateHeatmapData(
    events: LocationEvent[],
  ): Array<{ lat: number; lng: number; intensity: number }> {
    const locationCounts = new Map<string, number>();

    events.forEach(event => {
      // Round coordinates to create grid
      const lat = Math.round(event.location.latitude * 1000) / 1000;
      const lng = Math.round(event.location.longitude * 1000) / 1000;
      const key = `${lat},${lng}`;
      
      locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
    });

    const maxCount = Math.max(...locationCounts.values());

    return Array.from(locationCounts.entries()).map(([key, count]) => {
      const [lat, lng] = key.split(',').map(Number);
      return {
        lat,
        lng,
        intensity: count / maxCount,
      };
    });
  }

  /**
   * Calculate popular areas
   */
  private async calculatePopularAreas(
    tenantId: string,
    events: LocationEvent[],
  ): Promise<Array<{ name: string; visits: number; avgDwellTime: number }>> {
    const geofences = await this.getGeofences(tenantId);
    const areaStats = new Map<string, { visits: number; totalDwellTime: number }>();

    events.forEach(event => {
      if (event.geofenceId) {
        const geofence = geofences.find(g => g.id === event.geofenceId);
        if (geofence) {
          const stats = areaStats.get(geofence.name) || { visits: 0, totalDwellTime: 0 };
          stats.visits++;
          // Mock dwell time calculation
          stats.totalDwellTime += Math.random() * 3600000; // Random 0-1 hour
          areaStats.set(geofence.name, stats);
        }
      }
    });

    return Array.from(areaStats.entries())
      .map(([name, stats]) => ({
        name,
        visits: stats.visits,
        avgDwellTime: stats.totalDwellTime / stats.visits,
      }))
      .sort((a, b) => b.visits - a.visits);
  }
}