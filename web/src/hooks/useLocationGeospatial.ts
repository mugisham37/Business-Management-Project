/**
 * Location Geospatial Management Hooks
 * Complete hook implementation for geospatial operations and mapping
 */

import { useCallback } from 'react';
import { 
  useQuery,
  QueryHookOptions
} from '@apollo/client';
import { 
  FIND_NEARBY_LOCATIONS,
  FIND_CLOSEST_LOCATION,
  FIND_LOCATIONS_IN_BOUNDS,
  CALCULATE_COVERAGE_AREA,
  CLUSTER_LOCATIONS_BY_PROXIMITY,
  SUGGEST_OPTIMAL_LOCATION
} from '@/graphql/queries/location-queries';
import { useTenant } from '@/hooks/useTenant';

// Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationDistance {
  id: string;
  name: string;
  code: string;
  locationType: string;
  status: string;
  coordinates: Coordinates;
  distance: number; // in kilometers
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}

export interface GeospatialBounds {
  northEast: Coordinates;
  southWest: Coordinates;
}

export interface LocationCluster {
  id: string;
  centerPoint: Coordinates;
  locations: LocationDistance[];
  averageDistance: number;
  totalLocations: number;
}

export interface CoverageArea {
  totalCoverageKm2: number;
  overlapKm2: number;
  coveragePolygons: Array<{
    locationId: string;
    center: Coordinates;
    radiusKm: number;
    areaKm2: number;
  }>;
}

export interface OptimalLocationSuggestion {
  latitude: number;
  longitude: number;
  score: number;
  distanceToNearestLocation: number;
  populationDensity?: number;
  reasoning: string[];
}

// Hook for finding nearby locations
export function useNearbyLocations(
  latitude: number,
  longitude: number,
  radiusKm: number,
  options?: {
    maxResults?: number;
    locationTypes?: string[];
    statuses?: string[];
    queryOptions?: QueryHookOptions;
  }
) {
  const { tenant: currentTenant } = useTenant();
  const { maxResults, locationTypes, statuses, queryOptions } = options || {};
  
  const { data, loading, error, refetch } = useQuery(FIND_NEARBY_LOCATIONS, {
    variables: { 
      latitude, 
      longitude, 
      radiusKm,
      maxResults,
      locationTypes,
      statuses
    },
    skip: !currentTenant?.id || !latitude || !longitude || !radiusKm,
    errorPolicy: 'all',
    ...queryOptions,
  });

  const nearbyLocations = data?.findNearbyLocations || [];

  return {
    nearbyLocations,
    loading,
    error,
    refetch,
  };
}

// Hook for finding closest location
export function useClosestLocation(
  latitude: number,
  longitude: number,
  options?: {
    locationTypes?: string[];
    statuses?: string[];
    queryOptions?: QueryHookOptions;
  }
) {
  const { tenant: currentTenant } = useTenant();
  const { locationTypes, statuses, queryOptions } = options || {};
  
  const { data, loading, error, refetch } = useQuery(FIND_CLOSEST_LOCATION, {
    variables: { 
      latitude, 
      longitude,
      locationTypes,
      statuses
    },
    skip: !currentTenant?.id || !latitude || !longitude,
    errorPolicy: 'all',
    ...queryOptions,
  });

  const closestLocation = data?.findClosestLocation;

  return {
    closestLocation,
    loading,
    error,
    refetch,
  };
}

// Hook for finding locations in bounds
export function useLocationsInBounds(
  bounds: GeospatialBounds,
  options?: {
    locationTypes?: string[];
    statuses?: string[];
    queryOptions?: QueryHookOptions;
  }
) {
  const { tenant: currentTenant } = useTenant();
  const { locationTypes, statuses, queryOptions } = options || {};
  
  const { data, loading, error, refetch } = useQuery(FIND_LOCATIONS_IN_BOUNDS, {
    variables: { 
      northEastLat: bounds.northEast.latitude,
      northEastLng: bounds.northEast.longitude,
      southWestLat: bounds.southWest.latitude,
      southWestLng: bounds.southWest.longitude,
      locationTypes,
      statuses
    },
    skip: !currentTenant?.id || !bounds,
    errorPolicy: 'all',
    ...queryOptions,
  });

  const locationsInBounds = data?.findLocationsInBounds || [];

  return {
    locationsInBounds,
    loading,
    error,
    refetch,
  };
}

// Hook for coverage area calculation
export function useCoverageArea(
  locationIds: string[],
  radiusKm: number,
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(CALCULATE_COVERAGE_AREA, {
    variables: { locationIds, radiusKm },
    skip: !currentTenant?.id || !locationIds.length || !radiusKm,
    errorPolicy: 'all',
    ...options,
  });

  const coverageArea = data?.calculateCoverageArea;

  return {
    coverageArea,
    loading,
    error,
    refetch,
  };
}

// Hook for location clustering
export function useLocationClustering(
  maxDistanceKm: number,
  minClusterSize: number = 2,
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(CLUSTER_LOCATIONS_BY_PROXIMITY, {
    variables: { maxDistanceKm, minClusterSize },
    skip: !currentTenant?.id || !maxDistanceKm,
    errorPolicy: 'all',
    ...options,
  });

  const clusters = data?.clusterLocationsByProximity || [];

  return {
    clusters,
    loading,
    error,
    refetch,
  };
}

// Hook for optimal location suggestions
export function useOptimalLocationSuggestions(
  targetArea: GeospatialBounds,
  minDistanceFromExisting: number,
  populationDensityData?: Array<{ latitude: number; longitude: number; density: number }>,
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(SUGGEST_OPTIMAL_LOCATION, {
    variables: { 
      northEastLat: targetArea.northEast.latitude,
      northEastLng: targetArea.northEast.longitude,
      southWestLat: targetArea.southWest.latitude,
      southWestLng: targetArea.southWest.longitude,
      minDistanceFromExisting,
      populationDensityData
    },
    skip: !currentTenant?.id || !targetArea || !minDistanceFromExisting,
    errorPolicy: 'all',
    ...options,
  });

  const suggestions = data?.suggestOptimalLocation || [];

  return {
    suggestions,
    loading,
    error,
    refetch,
  };
}

// Hook for geospatial calculations
export function useGeospatialCalculations() {
  const calculateDistance = useCallback((
    point1: Coordinates,
    point2: Coordinates
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const calculateBearing = useCallback((
    point1: Coordinates,
    point2: Coordinates
  ): number => {
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const lat1 = point1.latitude * Math.PI / 180;
    const lat2 = point2.latitude * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }, []);

  const calculateMidpoint = useCallback((
    point1: Coordinates,
    point2: Coordinates
  ): Coordinates => {
    const lat1 = point1.latitude * Math.PI / 180;
    const lat2 = point2.latitude * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const Bx = Math.cos(lat2) * Math.cos(dLon);
    const By = Math.cos(lat2) * Math.sin(dLon);
    
    const lat3 = Math.atan2(
      Math.sin(lat1) + Math.sin(lat2),
      Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By)
    );
    const lon3 = point1.longitude * Math.PI / 180 + Math.atan2(By, Math.cos(lat1) + Bx);
    
    return {
      latitude: lat3 * 180 / Math.PI,
      longitude: lon3 * 180 / Math.PI,
    };
  }, []);

  const calculateBoundingBox = useCallback((
    center: Coordinates,
    radiusKm: number
  ): GeospatialBounds => {
    const latDelta = radiusKm / 111.32; // Approximate km per degree latitude
    const lonDelta = radiusKm / (111.32 * Math.cos(center.latitude * Math.PI / 180));
    
    return {
      northEast: {
        latitude: center.latitude + latDelta,
        longitude: center.longitude + lonDelta,
      },
      southWest: {
        latitude: center.latitude - latDelta,
        longitude: center.longitude - lonDelta,
      },
    };
  }, []);

  const isPointInBounds = useCallback((
    point: Coordinates,
    bounds: GeospatialBounds
  ): boolean => {
    return (
      point.latitude >= bounds.southWest.latitude &&
      point.latitude <= bounds.northEast.latitude &&
      point.longitude >= bounds.southWest.longitude &&
      point.longitude <= bounds.northEast.longitude
    );
  }, []);

  const calculatePolygonArea = useCallback((
    coordinates: Coordinates[]
  ): number => {
    if (coordinates.length < 3) return 0;
    
    let area = 0;
    const R = 6371000; // Earth's radius in meters
    
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      const lat1 = coordinates[i]?.latitude ?? 0 * Math.PI / 180;
      const lat2 = coordinates[j]?.latitude ?? 0 * Math.PI / 180;
      const dLon = ((coordinates[j]?.longitude ?? 0) - (coordinates[i]?.longitude ?? 0)) * Math.PI / 180;
      
      area += dLon * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    
    area = Math.abs(area * R * R / 2);
    return area / 1000000; // Convert to km²
  }, []);

  return {
    calculateDistance,
    calculateBearing,
    calculateMidpoint,
    calculateBoundingBox,
    isPointInBounds,
    calculatePolygonArea,
  };
}

// Hook for map utilities
export function useMapUtilities() {
  const formatCoordinates = useCallback((
    coordinates: Coordinates,
    format: 'decimal' | 'dms' = 'decimal'
  ): string => {
    if (format === 'decimal') {
      return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
    }
    
    // Convert to degrees, minutes, seconds
    const formatDMS = (decimal: number, isLatitude: boolean): string => {
      const absolute = Math.abs(decimal);
      const degrees = Math.floor(absolute);
      const minutes = Math.floor((absolute - degrees) * 60);
      const seconds = ((absolute - degrees) * 60 - minutes) * 60;
      const direction = isLatitude 
        ? (decimal >= 0 ? 'N' : 'S')
        : (decimal >= 0 ? 'E' : 'W');
      
      return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
    };
    
    return `${formatDMS(coordinates.latitude, true)}, ${formatDMS(coordinates.longitude, false)}`;
  }, []);

  const generateMapUrl = useCallback((
    coordinates: Coordinates,
    zoom: number = 15,
    provider: 'google' | 'openstreetmap' | 'mapbox' = 'google'
  ): string => {
    switch (provider) {
      case 'google':
        return `https://www.google.com/maps/@${coordinates.latitude},${coordinates.longitude},${zoom}z`;
      case 'openstreetmap':
        return `https://www.openstreetmap.org/#map=${zoom}/${coordinates.latitude}/${coordinates.longitude}`;
      case 'mapbox':
        return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${coordinates.longitude},${coordinates.latitude},${zoom}/400x400`;
      default:
        return '';
    }
  }, []);

  const generateDirectionsUrl = useCallback((
    from: Coordinates,
    to: Coordinates,
    provider: 'google' | 'apple' = 'google'
  ): string => {
    if (provider === 'google') {
      return `https://www.google.com/maps/dir/${from.latitude},${from.longitude}/${to.latitude},${to.longitude}`;
    } else {
      return `http://maps.apple.com/?saddr=${from.latitude},${from.longitude}&daddr=${to.latitude},${to.longitude}`;
    }
  }, []);

  const getLocationIcon = useCallback((locationType: string): string => {
    const iconMap: Record<string, string> = {
      'STORE': '🏪',
      'WAREHOUSE': '🏭',
      'OFFICE': '🏢',
      'DISTRIBUTION_CENTER': '📦',
      'FRANCHISE': '🏬',
      'KIOSK': '🛒',
      'MOBILE': '🚚',
      'POPUP': '⛺',
      'HEADQUARTERS': '🏛️',
      'BRANCH': '🏪',
    };
    
    return iconMap[locationType] || '📍';
  }, []);

  return {
    formatCoordinates,
    generateMapUrl,
    generateDirectionsUrl,
    getLocationIcon,
  };
}

// Hook for geospatial validation
export function useGeospatialValidation() {
  const validateCoordinates = useCallback((coordinates: Coordinates): string | null => {
    if (coordinates.latitude < -90 || coordinates.latitude > 90) {
      return 'Latitude must be between -90 and 90 degrees';
    }
    
    if (coordinates.longitude < -180 || coordinates.longitude > 180) {
      return 'Longitude must be between -180 and 180 degrees';
    }
    
    return null;
  }, []);

  const validateRadius = useCallback((radius: number): string | null => {
    if (radius <= 0) {
      return 'Radius must be greater than 0';
    }
    
    if (radius > 20000) { // Half of Earth's circumference
      return 'Radius cannot exceed 20,000 km';
    }
    
    return null;
  }, []);

  const validateBounds = useCallback((bounds: GeospatialBounds): string | null => {
    const coordError1 = validateCoordinates(bounds.northEast);
    if (coordError1) return coordError1;
    
    const coordError2 = validateCoordinates(bounds.southWest);
    if (coordError2) return coordError2;
    
    if (bounds.northEast.latitude <= bounds.southWest.latitude) {
      return 'North-east latitude must be greater than south-west latitude';
    }
    
    if (bounds.northEast.longitude <= bounds.southWest.longitude) {
      return 'North-east longitude must be greater than south-west longitude';
    }
    
    return null;
  }, [validateCoordinates]);

  return {
    validateCoordinates,
    validateRadius,
    validateBounds,
  };
}

// Main geospatial management hook
export function useLocationGeospatialManagement() {
  const geospatialCalculations = useGeospatialCalculations();
  const mapUtilities = useMapUtilities();
  const geospatialValidation = useGeospatialValidation();

  return {
    ...geospatialCalculations,
    ...mapUtilities,
    ...geospatialValidation,
  };
}