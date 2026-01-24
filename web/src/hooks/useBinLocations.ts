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
      const id = binLocation.id;
      await deleteBinLocation({
        variables: { id },
        update: (cache) => {
          const cacheId = cache.identify({ __typename: 'BinLocation', id });
          if (cacheId) {
            cache.evict({ id: cacheId });
            cache.gc();
          }
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
          dedicated 
        },
        optimisticResponse: {
          assignProductToBin: {
            ...binLocation,
            assignedProductId: productId,
            assignedVariantId: variantId,
            dedicatedProduct: dedicated,
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
          currentWeight 
        },
        optimisticResponse: {
          updateBinOccupancy: {
            ...binLocation,
            occupancyPercentage,
            currentWeight,
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

  const isReserved = useMemo(() => {
    return binLocation?.status === BinLocationStatus.RESERVED;
  }, [binLocation?.status]);

  const isBlocked = useMemo(() => {
    return [BinLocationStatus.BLOCKED, BinLocationStatus.MAINTENANCE, BinLocationStatus.DAMAGED]
      .includes(binLocation?.status as BinLocationStatus);
  }, [binLocation?.status]);

  const hasProduct = useMemo(() => {
    return !!binLocation?.assignedProductId;
  }, [binLocation?.assignedProductId]);

  const occupancyLevel = useMemo(() => {
    const occupancy = binLocation?.occupancyPercentage || 0;
    if (occupancy >= 90) return 'full';
    if (occupancy >= 75) return 'high';
    if (occupancy >= 50) return 'medium';
    if (occupancy > 0) return 'low';
    return 'empty';
  }, [binLocation?.occupancyPercentage]);

  const capacityRemaining = useMemo(() => {
    const maxCapacity = binLocation?.maxCapacity || 0;
    const occupancy = binLocation?.occupancyPercentage || 0;
    return maxCapacity * (1 - occupancy / 100);
  }, [binLocation?.maxCapacity, binLocation?.occupancyPercentage]);

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
    isReserved,
    isBlocked,
    hasProduct,
    occupancyLevel,
    capacityRemaining,
  };
}

// ===== BIN INVENTORY HOOK =====

/**
 * Hook for managing bin inventory within a warehouse/zone
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

  const binLocations: BinLocation[] = useMemo(
    () => data?.binInventory || [],
    [data?.binInventory]
  );

  const create = useCallback(async (input: CreateBinLocationInput) => {
    try {
      const result = await createBinLocation({
        variables: { input: { ...input, warehouseId, zoneId } },
        refetchQueries: [
          { query: GET_BIN_INVENTORY, variables: { warehouseId, zoneId } },
        ],
      });
      return result.data?.createBinLocation;
    } catch (error) {
      console.error('Failed to create bin location:', error);
      throw error;
    }
  }, [createBinLocation, warehouseId, zoneId]);

  const bulkCreate = useCallback(async (binLocations: CreateBinLocationInput[]) => {
    try {
      const result = await bulkCreateBinLocations({
        variables: { 
          input: { 
            warehouseId, 
            zoneId, 
            binLocations 
          } 
        },
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

  // Statistics and groupings
  const binStats = useMemo(() => {
    const totalBins = binLocations.length;
    const availableBins = binLocations.filter(bin => bin.status === BinLocationStatus.AVAILABLE).length;
    const occupiedBins = binLocations.filter(bin => bin.status === BinLocationStatus.OCCUPIED).length;
    const reservedBins = binLocations.filter(bin => bin.status === BinLocationStatus.RESERVED).length;
    const blockedBins = binLocations.filter(bin => 
      [BinLocationStatus.BLOCKED, BinLocationStatus.MAINTENANCE, BinLocationStatus.DAMAGED]
        .includes(bin.status)
    ).length;

    const totalCapacity = binLocations.reduce((sum, bin) => sum + (bin.maxCapacity || 0), 0);
    const usedCapacity = binLocations.reduce((sum, bin) => 
      sum + ((bin.maxCapacity || 0) * (bin.occupancyPercentage || 0) / 100), 0
    );
    const utilizationPercentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

    return {
      totalBins,
      availableBins,
      occupiedBins,
      reservedBins,
      blockedBins,
      totalCapacity,
      usedCapacity,
      utilizationPercentage,
    };
  }, [binLocations]);

  const binsByStatus = useMemo(() => {
    const grouped: Record<BinLocationStatus, BinLocation[]> = {
      [BinLocationStatus.AVAILABLE]: [],
      [BinLocationStatus.OCCUPIED]: [],
      [BinLocationStatus.RESERVED]: [],
      [BinLocationStatus.BLOCKED]: [],
      [BinLocationStatus.MAINTENANCE]: [],
      [BinLocationStatus.DAMAGED]: [],
    };

    binLocations.forEach((bin: BinLocation) => {
      if (bin.status && grouped[bin.status]) {
        grouped[bin.status].push(bin);
      }
    });

    return grouped;
  }, [binLocations]);

  const binsByAisle = useMemo(() => {
    const grouped: Record<string, BinLocation[]> = {};
    
    binLocations.forEach((bin: BinLocation) => {
      const aisle = bin.aisle || 'Unassigned';
      if (!grouped[aisle]) {
        grouped[aisle] = [];
      }
      grouped[aisle].push(bin);
    });

    return grouped;
  }, [binLocations]);

  const binsByOccupancyLevel = useMemo(() => {
    const grouped = {
      empty: [] as BinLocation[],
      low: [] as BinLocation[],
      medium: [] as BinLocation[],
      high: [] as BinLocation[],
      full: [] as BinLocation[],
    };

    binLocations.forEach((bin: BinLocation) => {
      const occupancy = bin.occupancyPercentage || 0;
      if (occupancy === 0) grouped.empty.push(bin);
      else if (occupancy < 50) grouped.low.push(bin);
      else if (occupancy < 75) grouped.medium.push(bin);
      else if (occupancy < 90) grouped.high.push(bin);
      else grouped.full.push(bin);
    });

    return grouped;
  }, [binLocations]);

  return {
    binLocations,
    loading,
    error,
    refetch,
    create,
    bulkCreate,
    binStats,
    binsByStatus,
    binsByAisle,
    binsByOccupancyLevel,
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
    binStats,
    binsByStatus,
    binsByAisle,
    binsByOccupancyLevel,
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
    isReserved,
    isBlocked,
    hasProduct,
    occupancyLevel,
    capacityRemaining,
  } = useBinLocation(selectedBinId || '');

  const selectBin = useCallback((binId: string) => {
    setSelectedBinId(binId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBinId(null);
  }, []);

  // Bin search and filtering
  const searchBins = useCallback((searchTerm: string) => {
    return binLocations.filter(bin => 
      bin.binCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bin.aisle?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [binLocations]);

  const filterBinsByStatus = useCallback((status: BinLocationStatus) => {
    return binLocations.filter(bin => bin.status === status);
  }, [binLocations]);

  const filterBinsByAisle = useCallback((aisle: string) => {
    return binLocations.filter(bin => bin.aisle === aisle);
  }, [binLocations]);

  const getAvailableBins = useCallback(() => {
    return binLocations.filter(bin => 
      bin.status === BinLocationStatus.AVAILABLE && 
      (bin.occupancyPercentage || 0) < 100
    );
  }, [binLocations]);

  const getNearFullBins = useCallback((threshold: number = 85) => {
    return binLocations.filter(bin => 
      (bin.occupancyPercentage || 0) >= threshold
    );
  }, [binLocations]);

  // Bin validation
  const validateBinCode = useCallback((binCode: string): string | null => {
    if (!binCode) return 'Bin code is required';
    if (binCode.length < 1) return 'Bin code is required';
    if (binCode.length > 50) return 'Bin code must be less than 50 characters';
    
    const existingBin = binLocations.find(bin => bin.binCode === binCode && bin.id !== selectedBinId);
    if (existingBin) {
      return 'Bin code already exists in this warehouse/zone';
    }
    
    return null;
  }, [binLocations, selectedBinId]);

  // Generate bin codes
  const generateBinCodes = useCallback((
    aislePrefix: string, 
    bayCount: number, 
    levelCount: number
  ): string[] => {
    const codes: string[] = [];
    for (let bay = 1; bay <= bayCount; bay++) {
      for (let level = 1; level <= levelCount; level++) {
        codes.push(`${aislePrefix}-${bay.toString().padStart(2, '0')}-${level.toString().padStart(2, '0')}`);
      }
    }
    return codes;
  }, []);

  // Clear cache for bin data
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

    // Statistics and groupings
    binStats,
    binsByStatus,
    binsByAisle,
    binsByOccupancyLevel,

    // Selected bin
    selectedBin,
    selectedBinId,
    selectedBinLoading,
    selectedBinError,
    selectBin,
    clearSelection,
    updateBinLocation,
    deleteBinLocation,

    // Bin operations
    assignProductToBin,
    unassignProductFromBin,
    updateBinOccupancy,

    // Bin state
    isAvailable,
    isOccupied,
    isReserved,
    isBlocked,
    hasProduct,
    occupancyLevel,
    capacityRemaining,

    // Search and filtering
    searchBins,
    filterBinsByStatus,
    filterBinsByAisle,
    getAvailableBins,
    getNearFullBins,

    // Validation and utilities
    validateBinCode,
    generateBinCodes,

    // Utilities
    clearCache,
  };
}

// ===== BIN LOCATION VALIDATION HOOK =====

/**
 * Hook for bin location validation
 */
export function useBinLocationValidation() {
  const validateBinCode = useCallback((binCode: string): string | null => {
    if (!binCode) return 'Bin code is required';
    if (binCode.length < 1) return 'Bin code is required';
    if (binCode.length > 50) return 'Bin code must be less than 50 characters';
    if (!/^[A-Z0-9_-]+$/i.test(binCode)) return 'Bin code can only contain letters, numbers, hyphens, and underscores';
    return null;
  }, []);

  const validateDimensions = useCallback((
    length?: number, 
    width?: number, 
    height?: number
  ): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (length !== undefined && length <= 0) {
      errors.length = 'Length must be greater than 0';
    }
    if (width !== undefined && width <= 0) {
      errors.width = 'Width must be greater than 0';
    }
    if (height !== undefined && height <= 0) {
      errors.height = 'Height must be greater than 0';
    }

    return errors;
  }, []);

  const validateCapacity = useCallback((
    maxCapacity?: number, 
    maxWeight?: number
  ): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (maxCapacity !== undefined && maxCapacity <= 0) {
      errors.maxCapacity = 'Max capacity must be greater than 0';
    }
    if (maxWeight !== undefined && maxWeight <= 0) {
      errors.maxWeight = 'Max weight must be greater than 0';
    }

    return errors;
  }, []);

  const validateCoordinates = useCallback((
    x?: number, 
    y?: number, 
    z?: number
  ): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (x !== undefined && x < 0) {
      errors.xCoordinate = 'X coordinate cannot be negative';
    }
    if (y !== undefined && y < 0) {
      errors.yCoordinate = 'Y coordinate cannot be negative';
    }
    if (z !== undefined && z < 0) {
      errors.zCoordinate = 'Z coordinate cannot be negative';
    }

    return errors;
  }, []);

  const validateCreateBinLocationInput = useCallback((input: CreateBinLocationInput): Record<string, string> => {
    const errors: Record<string, string> = {};

    const codeError = validateBinCode(input.binCode);
    if (codeError) errors.binCode = codeError;

    if (!input.warehouseId) errors.warehouseId = 'Warehouse is required';

    const dimensionErrors = validateDimensions(input.length, input.width, input.height);
    Object.assign(errors, dimensionErrors);

    const capacityErrors = validateCapacity(input.maxCapacity, input.maxWeight);
    Object.assign(errors, capacityErrors);

    const coordinateErrors = validateCoordinates(input.xCoordinate, input.yCoordinate, input.zCoordinate);
    Object.assign(errors, coordinateErrors);

    return errors;
  }, [validateBinCode, validateDimensions, validateCapacity, validateCoordinates]);

  return {
    validateBinCode,
    validateDimensions,
    validateCapacity,
    validateCoordinates,
    validateCreateBinLocationInput,
  };
}