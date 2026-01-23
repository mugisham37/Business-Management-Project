/**
 * Bin Location Management Hooks
 * Complete set of hooks for bin location operations
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useTenantStore } from '@/lib/stores/tenant-store';
import {
  BinLocation,
  BinLocationStatus,
  CreateBinLocationInput,
  UpdateBinLocationInput,
  BinLocationConnection,
} from '@/types/warehouse';

// GraphQL Operations
import {
  GET_BIN_LOCATION,
  GET_BIN_INVENTORY,
} from '@/graphql/queries/warehouse-queries';

import {
  CREATE_BIN_LOCATION,
  UPDATE_BIN_LOCATION,
  DELETE_BIN_LOCATION,
  ASSIGN_PRODUCT_TO_BIN,
  UNASSIGN_PRODUCT_FROM_BIN,
  UPDATE_BIN_OCCUPANCY,
  BULK_CREATE_BIN_LOCATIONS,
} from '@/graphql/mutations/warehouse-mutations';

// ===== SINGLE BIN LOCATION HOOK =====

/**
 * Hook for managing a single bin location
 */
export function useBinLocation(binLocationId: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_BIN_LOCATION, {
    variables: { id: binLocationId },
    skip: !currentTenant?.id || !binLocationId,
    errorPolicy: 'all',
  });

  const [updateBinLocation] = useMutation(UPDATE_BIN_LOCATION);
  const [deleteBinLocation] = useMutation(DELETE_BIN_LOCATION);
  const [assignProduct] = useMutation(ASSIGN_PRODUCT_TO_BIN);
  const [unassignProduct] = useMutation(UNASSIGN_PRODUCT_FROM_BIN);
  const [updateOccupancy] = useMutation(UPDATE_BIN_OCCUPANCY);

  const binLocation = data?.binLocation;

  const update = useCallback(async (input: UpdateBinLocationInput) => {
    if (!binLocation?.id) return null;
    
    try {
      const result = await updateBinLocation({
        variables: { id: binLocation.id, input },
        optimisticResponse: {
          updateBinLocation: {
            ...binLocation,
            ...input,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateBinLocation;
    } catch (error) {
      console.error('Failed to update bin location:', error);
      throw error;
    }
  }, [updateBinLocation, binLocation]);

  const remove = useCallback(async () => {
    if (!binLocation?.id) return false;
    
    try {
      await deleteBinLocation({
        variables: { id: binLocation.id },
        update: (cache) => {
          cache.evict({ id: cache.identify(binLocation) });
          cache.gc();
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to delete bin location:', error);
      throw error;
    }
  }, [deleteBinLocation, binLocation]);

  const assignProductToBin = useCallback(async (
    productId: string,
    variantId?: string,
    dedicated: boolean = false
  ) => {
    if (!binLocation?.id) return null;
    
    try {
      const result = await assignProduct({
        variables: {
          binLocationId: binLocation.id,
          productId,
          variantId,
          dedicated,
        },
        optimisticResponse: {
          assignProductToBin: {
            ...binLocation,
            assignedProductId: productId,
            assignedVariantId: variantId,
            dedicatedProduct: dedicated,
            status: BinLocationStatus.OCCUPIED,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.assignProductToBin;
    } catch (error) {
      console.error('Failed to assign product to bin:', error);
      throw error;
    }
  }, [assignProduct, binLocation]);

  const unassignProductFromBin = useCallback(async () => {
    if (!binLocation?.id) return null;
    
    try {
      const result = await unassignProduct({
        variables: { binLocationId: binLocation.id },
        optimisticResponse: {
          unassignProductFromBin: {
            ...binLocation,
            assignedProductId: null,
            assignedVariantId: null,
            dedicatedProduct: false,
            occupancyPercentage: 0,
            currentWeight: 0,
            status: BinLocationStatus.AVAILABLE,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.unassignProductFromBin;
    } catch (error) {
      console.error('Failed to unassign product from bin:', error);
      throw error;
    }
  }, [unassignProduct, binLocation]);

  const updateBinOccupancy = useCallback(async (
    occupancyPercentage: number,
    currentWeight?: number
  ) => {
    if (!binLocation?.id) return null;
    
    try {
      const result = await updateOccupancy({
        variables: {
          binLocationId: binLocation.id,
          occupancyPercentage,
          currentWeight,
        },
        optimisticResponse: {
          updateBinOccupancy: {
            ...binLocation,
            occupancyPercentage,
            currentWeight: currentWeight || binLocation.currentWeight,
            status: occupancyPercentage > 0 ? BinLocationStatus.OCCUPIED : BinLocationStatus.AVAILABLE,
            updatedAt: new Date(),
          },
        },
      });
      return result.data?.updateBinOccupancy;
    } catch (error) {
      console.error('Failed to update bin occupancy:', error);
      throw error;
    }
  }, [updateOccupancy, binLocation]);

  // Computed properties
  const isAvailable = useMemo(() => {
    return binLocation?.status === BinLocationStatus.AVAILABLE;
  }, [binLocation?.status]);

  const isOccupied = useMemo(() => {
    return binLocation?.status === BinLocationStatus.OCCUPIED;
  }, [binLocation?.status]);

  const isBlocked = useMemo(() => {
    return binLocation?.status === BinLocationStatus.BLOCKED || 
           binLocation?.status === BinLocationStatus.MAINTENANCE ||
           binLocation?.status === BinLocationStatus.DAMAGED;
  }, [binLocation?.status]);

  const capacityUtilization = useMemo(() => {
    return binLocation?.occupancyPercentage || 0;
  }, [binLocation?.occupancyPercentage]);

  const remainingCapacity = useMemo(() => {
    return 100 - (binLocation?.occupancyPercentage || 0);
  }, [binLocation?.occupancyPercentage]);

  return {
    binLocation,
    loading,
    error,
    refetch,
    update,
    remove,
    assignProductToBin,
    unassignProductFromBin,
    updateBinOccupancy,
    isAvailable,
    isOccupied,
    isBlocked,
    capacityUtilization,
    remainingCapacity,
  };
}

// ===== BIN INVENTORY HOOK =====

/**
 * Hook for managing bin inventory within a warehouse or zone
 */
export function useBinInventory(warehouseId: string, zoneId?: string) {
  const currentTenant = useTenantStore(state => state.currentTenant);
  
  const { data, loading, error, refetch } = useQuery(GET_BIN_INVENTORY, {
    variables: { warehouseId, zoneId },
    skip: !currentTenant?.id || !warehouseId,
    errorPolicy: 'all',
  });

  const [createBinLocation] = useMutation(CREATE_BIN_LOCATION);
  const [bulkCreateBinLocations] = useMutation(BULK_CREATE_BIN_LOCATIONS);

  const binLocations = data?.binInventory || [];

  const create = useCallback(async (input: CreateBinLocationInput) => {
    try {
      const result = await createBinLocation({
        variables: { input },
        update: (cache, { data: mutationData }) => {
          if (mutationData?.createBinLocation) {
            const existingBins = cache.readQuery({
              query: GET_BIN_INVENTORY,
              variables: { warehouseId, zoneId },
            });

            if (existingBins) {
              cache.writeQuery({
                query: GET_BIN_INVENTORY,
                variables: { warehouseId, zoneId },
                data: {
                  binInventory: [
                    ...existingBins.binInventory,
                    mutationData.createBinLocation,
                  ],
                },
              });
            }
          }
        },
      });
      return result.data?.createBinLocation;
    } catch (error) {
      console.error('Failed to create bin location:', error);
      throw error;
    }
  }, [createBinLocation, warehouseId, zoneId]);

  const bulkCreate = useCallback(async (input: any) => {
    try {
      const result = await bulkCreateBinLocations({
        variables: { input },
        refetchQueries: [
          { query: GET_BIN_INVENTORY, variables: { warehouseId, zoneId } },
        ],
      });
      return result.data?.bulkCreateBinLocations;
    } catch (error) {
      console.error('Failed to bulk create bin locations:', error);
      throw error;
    }
  }, [bulkCreateBinLocations, warehouseId, zoneId]);

  // Filter bins by status
  const availableBins = useMemo(() => 
    binLocations.filter(bin => bin.status === BinLocationStatus.AVAILABLE), 
    [binLocations]
  );

  const occupiedBins = useMemo(() => 
    binLocations.filter(bin => bin.status === BinLocationStatus.OCCUPIED), 
    [binLocations]
  );

  const reservedBins = useMemo(() => 
    binLocations.filter(bin => bin.status === BinLocationStatus.RESERVED), 
    [binLocations]
  );

  const blockedBins = useMemo(() => 
    binLocations.filter(bin => 
      bin.status === BinLocationStatus.BLOCKED ||
      bin.status === BinLocationStatus.MAINTENANCE ||
      bin.status === BinLocationStatus.DAMAGED
    ), 
    [binLocations]
  );

  // Group bins by aisle for easier navigation
  const binsByAisle = useMemo(() => {
    const grouped: Record<string, BinLocation[]> = {};
    
    binLocations.forEach(bin => {
      const aisle = bin.aisle || 'Unassigned';
      if (!grouped[aisle]) {
        grouped[aisle] = [];
      }
      grouped[aisle].push(bin);
    });

    // Sort bins within each aisle by bay and level
    Object.keys(grouped).forEach(aisle => {
      grouped[aisle].sort((a, b) => {
        const bayA = a.bay || '';
        const bayB = b.bay || '';
        const levelA = a.level || '';
        const levelB = b.level || '';
        
        if (bayA !== bayB) return bayA.localeCompare(bayB);
        return levelA.localeCompare(levelB);
      });
    });

    return grouped;
  }, [binLocations]);

  // Bin statistics
  const binStats = useMemo(() => {
    const totalBins = binLocations.length;
    const availableCount = availableBins.length;
    const occupiedCount = occupiedBins.length;
    const reservedCount = reservedBins.length;
    const blockedCount = blockedBins.length;
    
    const utilizationPercentage = totalBins > 0 ? (occupiedCount / totalBins) * 100 : 0;
    const availabilityPercentage = totalBins > 0 ? (availableCount / totalBins) * 100 : 0;
    
    const totalCapacity = binLocations.reduce((sum, bin) => sum + (bin.maxCapacity || 0), 0);
    const usedCapacity = binLocations.reduce((sum, bin) => {
      const occupancy = (bin.occupancyPercentage || 0) / 100;
      return sum + ((bin.maxCapacity || 0) * occupancy);
    }, 0);
    
    const capacityUtilization = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    return {
      totalBins,
      availableCount,
      occupiedCount,
      reservedCount,
      blockedCount,
      utilizationPercentage,
      availabilityPercentage,
      totalCapacity,
      usedCapacity,
      capacityUtilization,
    };
  }, [binLocations, availableBins, occupiedBins, reservedBins, blockedBins]);

  return {
    binLocations,
    loading,
    error,
    refetch,
    create,
    bulkCreate,
    availableBins,
    occupiedBins,
    reservedBins,
    blockedBins,
    binsByAisle,
    binStats,
  };
}

// ===== BIN LOCATION MANAGEMENT HOOK =====

/**
 * Combined hook for comprehensive bin location management
 */
export function useBinLocationManagement(warehouseId: string, zoneId?: string) {
  const apolloClient = useApolloClient();
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);

  // Get all bin locations
  const {
    binLocations,
    loading: binLocationsLoading,
    error: binLocationsError,
    create: createBinLocation,
    bulkCreate: bulkCreateBinLocations,
    refetch: refetchBinLocations,
    availableBins,
    occupiedBins,
    reservedBins,
    blockedBins,
    binsByAisle,
    binStats,
  } = useBinInventory(warehouseId, zoneId);

  // Get selected bin details
  const {
    binLocation: selectedBin,
    loading: selectedBinLoading,
    error: selectedBinError,
    update: updateBinLocation,
    remove: deleteBinLocation,
    assignProductToBin,
    unassignProductFromBin,
    updateBinOccupancy,
    isAvailable,
    isOccupied,
    isBlocked,
    capacityUtilization,
    remainingCapacity,
  } = useBinLocation(selectedBinId || '');

  const selectBin = useCallback((binId: string) => {
    setSelectedBinId(binId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBinId(null);
  }, []);

  // Find optimal bin for product placement
  const findOptimalBin = useCallback((
    productId: string,
    requiredCapacity?: number,
    preferredAisle?: string
  ) => {
    let candidates = availableBins;

    // Filter by capacity if specified
    if (requiredCapacity) {
      candidates = candidates.filter(bin => (bin.maxCapacity || 0) >= requiredCapacity);
    }

    // Filter by aisle preference
    if (preferredAisle) {
      const aisleMatches = candidates.filter(bin => bin.aisle === preferredAisle);
      if (aisleMatches.length > 0) {
        candidates = aisleMatches;
      }
    }

    // Sort by picking sequence and capacity
    candidates.sort((a, b) => {
      const sequenceA = a.pickingSequence || 999999;
      const sequenceB = b.pickingSequence || 999999;
      
      if (sequenceA !== sequenceB) {
        return sequenceA - sequenceB;
      }
      
      // Prefer smaller bins to optimize space usage
      const capacityA = a.maxCapacity || 0;
      const capacityB = b.maxCapacity || 0;
      return capacityA - capacityB;
    });

    return candidates[0] || null;
  }, [availableBins]);

  // Get bins by product
  const getBinsByProduct = useCallback((productId: string, variantId?: string) => {
    return binLocations.filter(bin => {
      if (bin.assignedProductId !== productId) return false;
      if (variantId && bin.assignedVariantId !== variantId) return false;
      return true;
    });
  }, [binLocations]);

  // Get bins in picking sequence
  const getBinsInPickingSequence = useCallback(() => {
    return [...binLocations].sort((a, b) => {
      const sequenceA = a.pickingSequence || 999999;
      const sequenceB = b.pickingSequence || 999999;
      return sequenceA - sequenceB;
    });
  }, [binLocations]);

  // Bin validation
  const validateBinCode = useCallback((code: string): string | null => {
    if (!code) return 'Bin code is required';
    if (code.length < 1) return 'Bin code is required';
    if (code.length > 50) return 'Bin code must be less than 50 characters';
    
    const existingBin = binLocations.find(bin => bin.binCode === code);
    if (existingBin && existingBin.id !== selectedBinId) {
      return 'Bin code already exists in this warehouse';
    }
    
    return null;
  }, [binLocations, selectedBinId]);

  const validateCapacity = useCallback((capacity: number): string | null => {
    if (capacity < 0) return 'Capacity cannot be negative';
    if (capacity > 1000000) return 'Capacity seems unreasonably large';
    return null;
  }, []);

  const validateCoordinates = useCallback((x?: number, y?: number, z?: number): string | null => {
    if (x !== undefined && x < 0) return 'X coordinate cannot be negative';
    if (y !== undefined && y < 0) return 'Y coordinate cannot be negative';
    if (z !== undefined && z < 0) return 'Z coordinate cannot be negative';
    return null;
  }, []);

  // Generate bin codes for bulk creation
  const generateBinCodes = useCallback((
    aislePrefix: string,
    aisleCount: number,
    bayCount: number,
    levelCount: number
  ) => {
    const binCodes: string[] = [];
    
    for (let aisle = 1; aisle <= aisleCount; aisle++) {
      for (let bay = 1; bay <= bayCount; bay++) {
        for (let level = 1; level <= levelCount; level++) {
          const aisleCode = `${aislePrefix}${aisle.toString().padStart(2, '0')}`;
          const bayCode = bay.toString().padStart(2, '0');
          const levelCode = level.toString().padStart(2, '0');
          const binCode = `${aisleCode}-${bayCode}-${levelCode}`;
          binCodes.push(binCode);
        }
      }
    }
    
    return binCodes;
  }, []);

  // Clear cache for bin location data
  const clearCache = useCallback(() => {
    apolloClient.cache.evict({ fieldName: 'binInventory' });
    apolloClient.cache.evict({ fieldName: 'binLocation' });
    apolloClient.cache.gc();
  }, [apolloClient]);

  return {
    // Bin locations list
    binLocations,
    binLocationsLoading,
    binLocationsError,
    createBinLocation,
    bulkCreateBinLocations,
    refetchBinLocations,

    // Bin organization
    availableBins,
    occupiedBins,
    reservedBins,
    blockedBins,
    binsByAisle,
    binStats,

    // Selected bin
    selectedBin,
    selectedBinId,
    selectedBinLoading,
    selectedBinError,
    selectBin,
    clearSelection,
    updateBinLocation,
    deleteBinLocation,
    assignProductToBin,
    unassignProductFromBin,
    updateBinOccupancy,
    isAvailable,
    isOccupied,
    isBlocked,
    capacityUtilization,
    remainingCapacity,

    // Bin queries and utilities
    findOptimalBin,
    getBinsByProduct,
    getBinsInPickingSequence,

    // Validation
    validateBinCode,
    validateCapacity,
    validateCoordinates,

    // Bulk operations
    generateBinCodes,

    // Utilities
    clearCache,
  };
}

// ===== BIN LOCATION SEARCH HOOK =====

/**
 * Hook for searching and filtering bin locations
 */
export function useBinLocationSearch(warehouseId: string, zoneId?: string) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BinLocationStatus | 'all'>('all');
  const [aisleFilter, setAisleFilter] = useState<string>('all');

  const { binLocations, loading, error } = useBinInventory(warehouseId, zoneId);

  const filteredBinLocations = useMemo(() => {
    let filtered = binLocations;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bin =>
        bin.binCode.toLowerCase().includes(term) ||
        bin.displayName?.toLowerCase().includes(term) ||
        bin.aisle?.toLowerCase().includes(term) ||
        bin.bay?.toLowerCase().includes(term) ||
        bin.level?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(bin => bin.status === statusFilter);
    }

    // Filter by aisle
    if (aisleFilter !== 'all') {
      filtered = filtered.filter(bin => bin.aisle === aisleFilter);
    }

    return filtered;
  }, [binLocations, searchTerm, statusFilter, aisleFilter]);

  const availableAisles = useMemo(() => {
    const aisles = new Set(binLocations.map(bin => bin.aisle).filter(Boolean));
    return Array.from(aisles).sort();
  }, [binLocations]);

  const updateSearchTerm = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const updateStatusFilter = useCallback((status: BinLocationStatus | 'all') => {
    setStatusFilter(status);
  }, []);

  const updateAisleFilter = useCallback((aisle: string) => {
    setAisleFilter(aisle);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setAisleFilter('all');
  }, []);

  return {
    searchTerm,
    statusFilter,
    aisleFilter,
    filteredBinLocations,
    availableAisles,
    loading,
    error,
    updateSearchTerm,
    updateStatusFilter,
    updateAisleFilter,
    clearFilters,
  };
}