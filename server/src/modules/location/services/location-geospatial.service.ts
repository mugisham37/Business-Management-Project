import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LocationRepository } from '../repositories/location.repository';
import { Location } from '../entities/location.entity';
import { LocationStatus } from '../dto/location.dto';

export interface GeospatialQuery {
  latitude: number;
  longitude: number;
  radiusKm: number;
  maxResults?: number;
  locationTypes?: string[];
  statuses?: LocationStatus[];
}

export interface LocationDistance {
  location: Location;
  distanceKm: number;
  bearing: number; // Compass bearing in degrees
}

export interface GeospatialBounds {
  northEast: { latitude: number; longitude: number };
  southWest: { latitude: number; longitude: number };
}

export interface LocationCluster {
  centroid: { latitude: number; longitude: number };
  locations: Location[];
  averageDistance: number;
  boundingBox: GeospatialBounds;
}

@Injectable()
export class LocationGeospatialService {
  private readonly logger = new Logger(LocationGeospatialService.name);
  private readonly EARTH_RADIUS_KM = 6371;

  constructor(
    private readonly locationRepository: LocationRepository,
  ) {}

  /**
   * Find locations within a radius of a point
   */
  async findNearbyLocations(
    tenantId: string,
    query: GeospatialQuery,
  ): Promise<LocationDistance[]> {
    try {
      this.validateGeospatialQuery(query);

      // Get all locations for the tenant
      const allLocations = await this.locationRepository.findAll(tenantId, { limit: 10000 });
      
      // Filter locations with coordinates
      const locationsWithCoords = allLocations.locations.filter((loc: any) => 
        loc.latitude !== null && 
        loc.longitude !== null &&
        (!query.locationTypes || query.locationTypes.includes(loc.type)) &&
        (!query.statuses || query.statuses.includes(loc.status))
      );

      // Calculate distances and filter by radius
      const nearbyLocations: LocationDistance[] = [];

      for (const location of locationsWithCoords) {
        const distance = this.calculateDistance(
          query.latitude,
          query.longitude,
          location.latitude!,
          location.longitude!
        );

        if (distance <= query.radiusKm) {
          const bearing = this.calculateBearing(
            query.latitude,
            query.longitude,
            location.latitude!,
            location.longitude!
          );

          nearbyLocations.push({
            location,
            distanceKm: distance,
            bearing,
          });
        }
      }

      // Sort by distance and limit results
      nearbyLocations.sort((a, b) => a.distanceKm - b.distanceKm);
      
      if (query.maxResults) {
        return nearbyLocations.slice(0, query.maxResults);
      }

      return nearbyLocations;
    } catch (error: any) {
      this.logger.error(`Failed to find nearby locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find the closest location to a point
   */
  async findClosestLocation(
    tenantId: string,
    latitude: number,
    longitude: number,
    locationTypes?: string[],
    statuses?: LocationStatus[],
  ): Promise<LocationDistance | null> {
    try {
      const nearbyLocations = await this.findNearbyLocations(tenantId, {
        latitude,
        longitude,
        radiusKm: 1000, // Search within 1000km
        maxResults: 1,
        ...(locationTypes && { locationTypes }),
        ...(statuses && { statuses }),
      });

      return nearbyLocations.length > 0 ? nearbyLocations[0]! : null;
    } catch (error: any) {
      this.logger.error(`Failed to find closest location: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find locations within a bounding box
   */
  async findLocationsInBounds(
    tenantId: string,
    bounds: GeospatialBounds,
    locationTypes?: string[],
    statuses?: LocationStatus[],
  ): Promise<Location[]> {
    try {
      // Get all locations for the tenant
      const allLocations = await this.locationRepository.findAll(tenantId, { limit: 10000 });
      
      // Filter locations within bounds
      const locationsInBounds = allLocations.locations.filter((location: any) => {
        if (!location.latitude || !location.longitude) return false;
        
        const withinBounds = 
          location.latitude >= bounds.southWest.latitude &&
          location.latitude <= bounds.northEast.latitude &&
          location.longitude >= bounds.southWest.longitude &&
          location.longitude <= bounds.northEast.longitude;

        const typeMatch = !locationTypes || locationTypes.includes(location.type);
        const statusMatch = !statuses || statuses.includes(location.status);

        return withinBounds && typeMatch && statusMatch;
      });

      return locationsInBounds;
    } catch (error: any) {
      this.logger.error(`Failed to find locations in bounds: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate coverage area for a set of locations
   */
  async calculateCoverageArea(
    tenantId: string,
    locationIds: string[],
    radiusKm: number,
  ): Promise<{
    totalCoverageKm2: number;
    overlapKm2: number;
    coveragePolygons: Array<{
      locationId: string;
      center: { latitude: number; longitude: number };
      radiusKm: number;
      areaKm2: number;
    }>;
  }> {
    try {
      const locations = await Promise.all(
        locationIds.map(id => this.locationRepository.findById(tenantId, id))
      );

      const validLocations = locations.filter(loc => 
        loc && loc.latitude != null && loc.longitude != null
      ) as Location[];

      if (validLocations.length === 0) {
        throw new BadRequestException('No valid locations with coordinates found');
      }

      const coveragePolygons = validLocations.map(location => ({
        locationId: location.id,
        center: { latitude: location.latitude!, longitude: location.longitude! },
        radiusKm,
        areaKm2: Math.PI * radiusKm * radiusKm,
      }));

      // Calculate total coverage (simplified - doesn't account for actual overlap)
      const totalCoverageKm2 = coveragePolygons.reduce((sum, polygon) => sum + polygon.areaKm2, 0);
      
      // Estimate overlap (simplified calculation)
      let overlapKm2 = 0;
      for (let i = 0; i < validLocations.length; i++) {
        for (let j = i + 1; j < validLocations.length; j++) {
          const distance = this.calculateDistance(
            validLocations[i]!.latitude!,
            validLocations[i]!.longitude!,
            validLocations[j]!.latitude!,
            validLocations[j]!.longitude!
          );
          
          if (distance < radiusKm * 2) {
            // Simplified overlap calculation
            const overlapRatio = Math.max(0, (radiusKm * 2 - distance) / (radiusKm * 2));
            overlapKm2 += (Math.PI * radiusKm * radiusKm) * overlapRatio * 0.5;
          }
        }
      }

      return {
        totalCoverageKm2,
        overlapKm2,
        coveragePolygons,
      };
    } catch (error: any) {
      this.logger.error(`Failed to calculate coverage area: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cluster locations by proximity
   */
  async clusterLocationsByProximity(
    tenantId: string,
    maxDistanceKm: number,
    minClusterSize: number = 2,
  ): Promise<LocationCluster[]> {
    try {
      const allLocations = await this.locationRepository.findAll(tenantId, { limit: 10000 });
      const locationsWithCoords = allLocations.locations.filter((loc: any) => 
        loc.latitude !== null && loc.longitude !== null
      );

      if (locationsWithCoords.length < minClusterSize) {
        return [];
      }

      const clusters: LocationCluster[] = [];
      const processed = new Set<string>();

      for (const location of locationsWithCoords) {
        if (processed.has(location.id)) continue;

        const cluster: Location[] = [location];
        processed.add(location.id);

        // Find nearby locations for this cluster
        for (const otherLocation of locationsWithCoords) {
          if (processed.has(otherLocation.id)) continue;

          const distance = this.calculateDistance(
            location.latitude!,
            location.longitude!,
            otherLocation.latitude!,
            otherLocation.longitude!
          );

          if (distance <= maxDistanceKm) {
            cluster.push(otherLocation);
            processed.add(otherLocation.id);
          }
        }

        if (cluster.length >= minClusterSize) {
          const centroid = this.calculateCentroid(cluster);
          const averageDistance = this.calculateAverageDistanceFromCentroid(cluster, centroid);
          const boundingBox = this.calculateBoundingBox(cluster);

          clusters.push({
            centroid,
            locations: cluster,
            averageDistance,
            boundingBox,
          });
        }
      }

      return clusters;
    } catch (error: any) {
      this.logger.error(`Failed to cluster locations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get optimal location for a new store based on existing locations and coverage gaps
   */
  async suggestOptimalLocation(
    tenantId: string,
    targetArea: GeospatialBounds,
    minDistanceFromExisting: number,
    populationDensityData?: Array<{ latitude: number; longitude: number; density: number }>,
  ): Promise<Array<{
    latitude: number;
    longitude: number;
    score: number;
    distanceToNearestLocation: number;
    populationDensity?: number;
    reasoning: string[];
  }>> {
    try {
      const existingLocations = await this.findLocationsInBounds(tenantId, targetArea);
      const suggestions: Array<{
        latitude: number;
        longitude: number;
        score: number;
        distanceToNearestLocation: number;
        populationDensity?: number;
        reasoning: string[];
      }> = [];

      // Generate grid of potential locations
      const gridSize = 0.01; // ~1km grid
      const latRange = targetArea.northEast.latitude - targetArea.southWest.latitude;
      const lngRange = targetArea.northEast.longitude - targetArea.southWest.longitude;

      for (let latOffset = 0; latOffset <= latRange; latOffset += gridSize) {
        for (let lngOffset = 0; lngOffset <= lngRange; lngOffset += gridSize) {
          const candidateLat = targetArea.southWest.latitude + latOffset;
          const candidateLng = targetArea.southWest.longitude + lngOffset;

          // Find distance to nearest existing location
          let minDistance = Infinity;
          for (const location of existingLocations) {
            if (location.latitude && location.longitude) {
              const distance = this.calculateDistance(
                candidateLat,
                candidateLng,
                location.latitude,
                location.longitude
              );
              minDistance = Math.min(minDistance, distance);
            }
          }

          // Only consider locations that meet minimum distance requirement
          if (minDistance >= minDistanceFromExisting) {
            const reasoning: string[] = [];
            let score = 0;

            // Distance score (farther from existing locations is better)
            const distanceScore = Math.min(minDistance / (minDistanceFromExisting * 2), 1) * 40;
            score += distanceScore;
            reasoning.push(`Distance score: ${distanceScore.toFixed(1)} (${minDistance.toFixed(1)}km from nearest location)`);

            // Population density score (if available)
            if (populationDensityData) {
              let nearestDensityPoint = { latitude: 0, longitude: 0, density: 0, distance: Infinity };
              
              for (const point of populationDensityData) {
                const distance = this.calculateDistance(candidateLat, candidateLng, point.latitude, point.longitude);
                if (distance < nearestDensityPoint.distance) {
                  nearestDensityPoint = { ...point, distance };
                }
              }

              if (nearestDensityPoint.distance < 5) { // Within 5km
                const densityScore = Math.min(nearestDensityPoint.density / 1000, 1) * 40;
                score += densityScore;
                reasoning.push(`Population density score: ${densityScore.toFixed(1)} (density: ${nearestDensityPoint.density})`);
              }
            }

            // Coverage gap score (areas with less coverage get higher scores)
            const coverageScore = Math.min(minDistance / 10, 1) * 20;
            score += coverageScore;
            reasoning.push(`Coverage gap score: ${coverageScore.toFixed(1)}`);

            const populationDensity = populationDensityData?.find(p => 
              this.calculateDistance(candidateLat, candidateLng, p.latitude, p.longitude) < 5
            )?.density;

            suggestions.push({
              latitude: candidateLat,
              longitude: candidateLng,
              score,
              distanceToNearestLocation: minDistance,
              ...(populationDensity !== undefined && { populationDensity }),
              reasoning,
            });
          }
        }
      }

      // Sort by score and return top suggestions
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch (error: any) {
      this.logger.error(`Failed to suggest optimal location: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Calculate bearing between two points
   */
  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  /**
   * Calculate centroid of a group of locations
   */
  private calculateCentroid(locations: Location[]): { latitude: number; longitude: number } {
    const validLocations = locations.filter(loc => loc.latitude && loc.longitude);
    
    if (validLocations.length === 0) {
      throw new BadRequestException('No valid locations with coordinates');
    }

    const sumLat = validLocations.reduce((sum, loc) => sum + loc.latitude!, 0);
    const sumLng = validLocations.reduce((sum, loc) => sum + loc.longitude!, 0);

    return {
      latitude: sumLat / validLocations.length,
      longitude: sumLng / validLocations.length,
    };
  }

  /**
   * Calculate average distance from centroid
   */
  private calculateAverageDistanceFromCentroid(
    locations: Location[],
    centroid: { latitude: number; longitude: number }
  ): number {
    const validLocations = locations.filter(loc => loc.latitude && loc.longitude);
    
    if (validLocations.length === 0) return 0;

    const totalDistance = validLocations.reduce((sum, location) => {
      return sum + this.calculateDistance(
        centroid.latitude,
        centroid.longitude,
        location.latitude!,
        location.longitude!
      );
    }, 0);

    return totalDistance / validLocations.length;
  }

  /**
   * Calculate bounding box for a group of locations
   */
  private calculateBoundingBox(locations: Location[]): GeospatialBounds {
    const validLocations = locations.filter(loc => loc.latitude && loc.longitude);
    
    if (validLocations.length === 0) {
      throw new BadRequestException('No valid locations with coordinates');
    }

    const latitudes = validLocations.map(loc => loc.latitude!);
    const longitudes = validLocations.map(loc => loc.longitude!);

    return {
      northEast: {
        latitude: Math.max(...latitudes),
        longitude: Math.max(...longitudes),
      },
      southWest: {
        latitude: Math.min(...latitudes),
        longitude: Math.min(...longitudes),
      },
    };
  }

  /**
   * Validate geospatial query parameters
   */
  private validateGeospatialQuery(query: GeospatialQuery): void {
    if (query.latitude < -90 || query.latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (query.longitude < -180 || query.longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    if (query.radiusKm <= 0 || query.radiusKm > 20000) {
      throw new BadRequestException('Radius must be between 0 and 20000 km');
    }

    if (query.maxResults && (query.maxResults <= 0 || query.maxResults > 1000)) {
      throw new BadRequestException('Max results must be between 1 and 1000');
    }
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}