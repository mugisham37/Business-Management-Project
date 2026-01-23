/**
 * Warehouse Zone Management Hooks
 * Complete set of hooks for warehouse zone operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  WarehouseZone,
  WarehouseZoneType,
  CreateWarehouseZoneInput,
  UpdateWarehouseZoneInput,
  WarehouseZoneConnection,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_WAREHOUSE_ZONE,
  GET_WAREHOUSE_ZONES,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_WAREHOUSE_ZONE,
  UPDATE_WAREHOUSE_ZONE,
  DELETE_WAREHOUSE_ZONE,
} from '@/graphql/mutations/warehouse-mutations';

// ===== SINGLE WAREHOUSE ZONE HOOK =====

/**
 * Hook for managing a single warehouse zone
 */
export function useWarehouseZone(zoneId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAREHOUSE_ZONE, {
    variables: { id: zoneId },
    skip: !currentTenant?.id || !zoneId,
    errorPolicy: 'all',
  });

  const [updateZone] = useMutation(UPDATE_WAREHOUSE_ZONE);
  const [deleteZone] = useMutation(DELETE_WAREHOUSE_ZONE);

  const zone = data?.warehouseZone;

  const update = useCallback(async (input: Partial<UpdateWarehouseZoneInput>) => {
    if (!zone?.id) return null;
    
    try {
      const result = await updateZone({
        variables: { 
          id: zone.id, 
          name: input.name,
          zoneType: input.zoneType,
        },
        optimisticResponse: {
          updateWarehouseZone: {
            ...zone,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateWarehouseZone;
    } catch (error) {
      console.error('Failed to update warehouse zone:', error);
      throw error;
    }
  }, [updateZone, zone]);

  const remove = useCallback(async () => {
    if (!zone?.id) return false;
    
    try {
      await deleteZone({
        variables: { id: zone.id },
        update: (cache) => {
          cache.evict({ id: cache.identify(zone) });
          cache.gc();
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete warehouse zone:', error);
      throw error;
    }
  }, [deleteZone, zone]);

  return {
    zone,
    loading,
    error,
    refetch,
    update,
    remove,
  };
}

// ===== WAREHOUSE ZONES BY WAREHOUSE HOOK =====

/**
 * Hook for managing zones within a specific warehouse
 */
export function useWarehouseZones(warehouseId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_WAREHOUSE_ZONES, {
    variables: { warehouseId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const [createZone] = useMutation(CREATE_WAREHOUSE_ZONE);

  const zones = data?.warehouseZones || [];

  const create = useCallback(async (name: string, zoneType: WarehouseZoneType) => {
    try {
      const result = await createZone({
        variables: { warehouseId, name, zoneType },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createWarehouseZone) {
            const existingZones = cache.readQuery({
              query: GET_WAREHOUSE_ZONES,
              variables: { warehouseId },
            });

            if (existingZones) {
              cache.writeQuery({
                query: GET_WAREHOUSE_ZONES,
                variables: { warehouseId },
                data: {
                  warehouseZones: [
                    ...existingZones.warehouseZones,
                    mutationData.createWarehouseZone,
                  ],
                },
              });
            }
          }
        },
      });
      return result.data?.createWarehouseZone;
    } catch (error) {
      console.error('Failed to create warehouse zone:', error);
      throw error;
    }
  }, [createZone, warehouseId]);

  // Group zones by type for easier management
  const zonesByType = useMemo(() => {
    const grouped: Record<WarehouseZoneType, WarehouseZone[]> = {
      [WarehouseZoneType.RECEIVING]: [],
      [WarehouseZoneType.STORAGE]: [],
      [WarehouseZoneType.PICKING]: [],
      [WarehouseZoneType.PACKING]: [],
      [WarehouseZoneType.SHIPPING]: [],
      [WarehouseZoneType.STAGING]: [],
      [WarehouseZoneType.QUARANTINE]: [],
      [WarehouseZoneType.RETURNS]: [],
      [WarehouseZoneType.COLD_STORAGE]: [],
      [WarehouseZoneType.HAZMAT]: [],
    };

    zones.forEach(zone => {
      if (zone.zoneType && grouped[zone.zoneType]) {
        grouped[zone.zoneType].push(zone);
      }
    });

    return grouped;
  }, [zones]);

  // Get zones by status
  const activeZones = useMemo(() => zones.filter(zone => zone.status === 'active'), [zones]);
  const inactiveZones = useMemo(() => zones.filter(zone => zone.status === 'inactive'), [zones]);

  // Zone statistics
  const zoneStats = useMemo(() => {
    const totalZones = zones.length;
    const activeCount = activeZones.length;
    const inactiveCount = inactiveZones.length;
    
    const totalCapacity = zones.reduce((sum, zone) => sum + (zone.capacity || 0), 0);
    const totalBinLocations = zones.reduce((sum, zone) => sum + (zone.currentBinLocations || 0), 0);
    const maxBinLocations = zones.reduce((sum, zone) => sum + (zone.maxBinLocations || 0), 0);
    
    const utilizationPercentage = maxBinLocations > 0 ? (totalBinLocations / maxBinLocations) * 100 : 0;

    return {
      totalZones,
      activeCount,
      inactiveCount,
      totalCapacity,
      totalBinLocations,
      maxBinLocations,
      utilizationPercentage,
    };
  }, [zones, activeZones, inactiveZones]);

  return {
    zones,
    loading,
    error,
    refetch,
    create,
    zonesByType,
    activeZones,
    inactiveZones,
    zoneStats,
  };
}

// ===== ZONE MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive zone management
 */
export function useZoneManagement(warehouseId: string) {
  const apolloClient = useApolloClient();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Get all zones for the warehouse
  const {
    zones,
    loading: zonesLoading,
    error: zonesError,
    create: createZone,
    refetch: refetchZones,
    zonesByType,
    activeZones,
    inactiveZones,
    zoneStats,
  } = useWarehouseZones(warehouseId);

  // Get selected zone details
  const {
    zone: selectedZone,
    loading: selectedZoneLoading,
    error: selectedZoneError,
    update: updateZone,
    remove: deleteZone,
  } = useWarehouseZone(selectedZoneId || '');

  const selectZone = useCallback((zoneId: string) => {
    setSelectedZoneId(zoneId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedZoneId(null);
  }, []);

  // Get zones by specific criteria
  const getZonesByType = useCallback((zoneType: WarehouseZoneType) => {
    return zones.filter(zone => zone.zoneType === zoneType);
  }, [zones]);

  const getZonesByStatus = useCallback((status: 'active' | 'inactive') => {
    return zones.filter(zone => zone.status === status);
  }, [zones]);

  const getZoneByCode = useCallback((zoneCode: string) => {
    return zones.find(zone => zone.zoneCode === zoneCode);
  }, [zones]);

  // Zone validation
  const validateZoneCode = useCallback((code: string): string | null => {
    if (!code) return 'Zone code is required';
    if (code.length < 1) return 'Zone code is required';
    if (code.length > 50) return 'Zone code must be less than 50 characters';
    
    const existingZone = getZoneByCode(code);
    if (existingZone && existingZone.id !== selectedZoneId) {
      return 'Zone code already exists in this warehouse';
    }
    
    return null;
  }, [getZoneByCode, selectedZoneId]);

  const validateZoneName = useCallback((name: string): string | null => {
    if (!name) return 'Zone name is required';
    if (name.length < 1) return 'Zone name is required';
    if (name.length > 255) return 'Zone name must be less than 255 characters';
    return null;
  }, []);

  // Check if zone type is already used
  const isZoneTypeUsed = useCallback((zoneType: WarehouseZoneType) => {
    return zones.some(zone => zone.zoneType === zoneType && zone.id !== selectedZoneId);
  }, [zones, selectedZoneId]);

  // Get recommended zone types that are missing
  const getMissingZoneTypes = useCallback((): WarehouseZoneType[] => {
    const essentialZoneTypes: WarehouseZoneType[] = [
      WarehouseZoneType.RECEIVING,
      WarehouseZoneType.STORAGE,
      WarehouseZoneType.PICKING,
      WarehouseZoneType.PACKING,
      WarehouseZoneType.SHIPPING,
    ];

    return essentialZoneTypes.filter(zoneType => !isZoneTypeUsed(zoneType));
  }, [isZoneTypeUsed]);

  // Clear cache for zone data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'warehouseZones' });
    apolloClient.cache.evict({ fieldName: 'warehouseZone' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Zones list
    zones,
    zonesLoading,
    zonesError,
    createZone,
    refetchZones,

    // Zone organization
    zonesByType,
    activeZones,
    inactiveZones,
    zoneStats,

    // Selected zone
    selectedZone,
    selectedZoneId,
    selectedZoneLoading,
    selectedZoneError,
    selectZone,
    clearSelection,
    updateZone,
    deleteZone,

    // Zone queries
    getZonesByType,
    getZonesByStatus,
    getZoneByCode,

    // Validation
    validateZoneCode,
    validateZoneName,
    isZoneTypeUsed,
    getMissingZoneTypes,

    // Utilities
    clearCache,
  };
}

// ===== ZONE TEMPLATES HOOK =====

/**
 * Hook for managing zone templates and default configurations
 */
export function useZoneTemplates() {
  const getDefaultZoneConfiguration = useCallback((zoneType: WarehouseZoneType) => {
    const baseConfig = {
      temperatureControlled: false,
      humidityControlled: false,
      allowMixedProducts: true,
      allowMixedBatches: true,
      fifoEnforced: false,
      requiresAuthorization: false,
      accessLevel: 'standard',
    };

    switch (zoneType) {
      case WarehouseZoneType.RECEIVING:
        return {
          ...baseConfig,
          priority: 1,
          allowMixedProducts: true,
          allowMixedBatches: true,
        };

      case WarehouseZoneType.STORAGE:
        return {
          ...baseConfig,
          priority: 3,
          fifoEnforced: true,
        };

      case WarehouseZoneType.PICKING:
        return {
          ...baseConfig,
          priority: 2,
          fifoEnforced: true,
          allowMixedProducts: false,
        };

      case WarehouseZoneType.PACKING:
        return {
          ...baseConfig,
          priority: 2,
          allowMixedProducts: true,
        };

      case WarehouseZoneType.SHIPPING:
        return {
          ...baseConfig,
          priority: 1,
          allowMixedProducts: true,
          allowMixedBatches: true,
        };

      case WarehouseZoneType.QUARANTINE:
        return {
          ...baseConfig,
          priority: 5,
          requiresAuthorization: true,
          accessLevel: 'high',
          allowMixedProducts: false,
          allowMixedBatches: false,
        };

      case WarehouseZoneType.COLD_STORAGE:
        return {
          ...baseConfig,
          priority: 4,
          temperatureControlled: true,
          humidityControlled: true,
          requiresAuthorization: true,
          accessLevel: 'high',
        };

      case WarehouseZoneType.HAZMAT:
        return {
          ...baseConfig,
          priority: 5,
          requiresAuthorization: true,
          accessLevel: 'maximum',
          allowMixedProducts: false,
          allowMixedBatches: false,
        };

      default:
        return baseConfig;
    }
  }, []);

  const getZoneTypeDescription = useCallback((zoneType: WarehouseZoneType): string => {
    switch (zoneType) {
      case WarehouseZoneType.RECEIVING:
        return 'Area for receiving incoming shipments and initial processing';
      case WarehouseZoneType.STORAGE:
        return 'Primary storage area for inventory';
      case WarehouseZoneType.PICKING:
        return 'Optimized area for order picking operations';
      case WarehouseZoneType.PACKING:
        return 'Area for packing orders for shipment';
      case WarehouseZoneType.SHIPPING:
        return 'Staging area for outbound shipments';
      case WarehouseZoneType.STAGING:
        return 'Temporary holding area for work-in-progress';
      case WarehouseZoneType.QUARANTINE:
        return 'Restricted area for quarantined or problematic inventory';
      case WarehouseZoneType.RETURNS:
        return 'Area for processing returned merchandise';
      case WarehouseZoneType.COLD_STORAGE:
        return 'Temperature-controlled storage for perishable items';
      case WarehouseZoneType.HAZMAT:
        return 'Specialized area for hazardous materials';
      default:
        return 'General purpose zone';
    }
  }, []);

  const getZoneTypeIcon = useCallback((zoneType: WarehouseZoneType): string => {
    switch (zoneType) {
      case WarehouseZoneType.RECEIVING:
        return '📦';
      case WarehouseZoneType.STORAGE:
        return '🏪';
      case WarehouseZoneType.PICKING:
        return '🛒';
      case WarehouseZoneType.PACKING:
        return '📋';
      case WarehouseZoneType.SHIPPING:
        return '🚚';
      case WarehouseZoneType.STAGING:
        return '⏳';
      case WarehouseZoneType.QUARANTINE:
        return '🚫';
      case WarehouseZoneType.RETURNS:
        return '↩️';
      case WarehouseZoneType.COLD_STORAGE:
        return '❄️';
      case WarehouseZoneType.HAZMAT:
        return '⚠️';
      default:
        return '📍';
    }
  }, []);

  const createDefaultZones = useCallback((warehouseId: string) => {
    const defaultZones: Array<{ name: string; zoneType: WarehouseZoneType; zoneCode: string }> = [
      { name: 'Receiving Area', zoneType: WarehouseZoneType.RECEIVING, zoneCode: 'RCV-01' },
      { name: 'Main Storage', zoneType: WarehouseZoneType.STORAGE, zoneCode: 'STG-01' },
      { name: 'Picking Zone', zoneType: WarehouseZoneType.PICKING, zoneCode: 'PCK-01' },
      { name: 'Packing Area', zoneType: WarehouseZoneType.PACKING, zoneCode: 'PAK-01' },
      { name: 'Shipping Dock', zoneType: WarehouseZoneType.SHIPPING, zoneCode: 'SHP-01' },
    ];

    return defaultZones.map(zone => ({
      ...zone,
      warehouseId,
      ...getDefaultZoneConfiguration(zone.zoneType),
    }));
  }, [getDefaultZoneConfiguration]);

  return {
    getDefaultZoneConfiguration,
    getZoneTypeDescription,
    getZoneTypeIcon,
    createDefaultZones,
  };
}