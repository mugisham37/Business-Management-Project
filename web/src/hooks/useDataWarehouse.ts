/**
 * Data Warehouse Hook
 * Comprehensive hook for data warehouse operations
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_DATA_CUBES,
  GET_DATA_CUBE,
  QUERY_WAREHOUSE,
  GET_WAREHOUSE_STATISTICS,
  TEST_WAREHOUSE_CONNECTION,
} from '@/graphql/queries/analytics-queries';
import {
  CREATE_TENANT_SCHEMA,
  OPTIMIZE_WAREHOUSE,
  CREATE_PARTITIONS,
} from '@/graphql/mutations/analytics-mutations';
import type {
  DataCube,
  WarehouseStatistics,
  UseDataWarehouseResult,
} from '@/types/analytics';

export function useDataWarehouse(): UseDataWarehouseResult {
  const [dataCubes, setDataCubes] = useState<DataCube[]>([]);
  const [warehouseStats, setWarehouseStats] = useState<WarehouseStatistics | undefined>();
  const [queryResults, setQueryResults] = useState<Record<string, Record<string, unknown>>>({});

  // Queries
  const {
    data: cubesData,
    loading: cubesLoading,
    error: cubesError,
    refetch: refetchCubes,
  } = useQuery(GET_DATA_CUBES, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  // Lazy queries for on-demand execution
  const {
    refetch: getDataCubeQuery,
    loading: cubeLoading,
  } = useQuery(GET_DATA_CUBE, { skip: true });

  const {
    refetch: queryWarehouseQuery,
    loading: queryLoading,
    error: queryError,
  } = useQuery(QUERY_WAREHOUSE, { skip: true });

  const {
    refetch: getWarehouseStatsQuery,
    loading: statsLoading,
    error: statsError,
  } = useQuery(GET_WAREHOUSE_STATISTICS, { skip: true });

  const {
    refetch: testConnectionQuery,
  } = useQuery(TEST_WAREHOUSE_CONNECTION, { skip: true });

  // Mutations
  const [createTenantSchemaMutation] = useMutation(CREATE_TENANT_SCHEMA);
  const [optimizeWarehouseMutation] = useMutation(OPTIMIZE_WAREHOUSE);
  const [createPartitionsMutation] = useMutation(CREATE_PARTITIONS);

  // Update state when query data changes
  useEffect(() => {
    if (cubesData?.getDataCubes) {
      setDataCubes(cubesData.getDataCubes);
    }
  }, [cubesData]);

  // Actions
  const getDataCubes = useCallback(async (): Promise<DataCube[]> => {
    try {
      const { data } = await refetchCubes();
      return data?.getDataCubes || [];
    } catch (error) {
      console.error('Failed to get data cubes:', error);
      throw error;
    }
  }, [refetchCubes]);

  const getDataCube = useCallback(async (cubeName: string): Promise<DataCube> => {
    try {
      const { data } = await getDataCubeQuery({
        variables: { cubeName },
      });
      
      if (data?.getDataCube) {
        return data.getDataCube;
      }
      throw new Error(`Data cube not found: ${cubeName}`);
    } catch (error) {
      console.error('Failed to get data cube:', error);
      throw error;
    }
  }, [getDataCubeQuery]);

  const queryWarehouse = useCallback(async (query: string): Promise<Record<string, unknown>> => {
    try {
      const { data } = await queryWarehouseQuery({
        variables: { query },
      });
      
      if (data?.queryWarehouse) {
        const result = typeof data.queryWarehouse === 'string' 
          ? JSON.parse(data.queryWarehouse) 
          : data.queryWarehouse;
        setQueryResults(prev => ({ ...prev, [query]: result }));
        return result;
      }
      return {};
    } catch (error) {
      console.error('Failed to query warehouse:', error);
      throw error;
    }
  }, [queryWarehouseQuery]);

  const getWarehouseStatistics = useCallback(async (): Promise<WarehouseStatistics> => {
    try {
      const { data } = await getWarehouseStatsQuery();
      
      if (data?.getWarehouseStatistics) {
        const stats = typeof data.getWarehouseStatistics === 'string'
          ? JSON.parse(data.getWarehouseStatistics)
          : data.getWarehouseStatistics;
        setWarehouseStats(stats);
        return stats;
      }
      throw new Error('Failed to retrieve warehouse statistics');
    } catch (error) {
      console.error('Failed to get warehouse statistics:', error);
      throw error;
    }
  }, [getWarehouseStatsQuery]);

  const testWarehouseConnection = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await testConnectionQuery();
      return data?.testWarehouseConnection || false;
    } catch (error) {
      console.error('Failed to test warehouse connection:', error);
      throw error;
    }
  }, [testConnectionQuery]);

  const createTenantSchema = useCallback(async (schemaConfig: string): Promise<string> => {
    try {
      const { data } = await createTenantSchemaMutation({
        variables: { schemaConfig },
      });
      
      return data?.createTenantSchema || '';
    } catch (error) {
      console.error('Failed to create tenant schema:', error);
      throw error;
    }
  }, [createTenantSchemaMutation]);

  const optimizeWarehouse = useCallback(async (optimizationConfig?: string): Promise<string> => {
    try {
      const { data } = await optimizeWarehouseMutation({
        variables: { optimizationConfig },
      });
      
      return data?.optimizeWarehouse || '';
    } catch (error) {
      console.error('Failed to optimize warehouse:', error);
      throw error;
    }
  }, [optimizeWarehouseMutation]);

  const createPartitions = useCallback(async (partitionConfig: string): Promise<string> => {
    try {
      const { data } = await createPartitionsMutation({
        variables: { partitionConfig },
      });
      
      return data?.createPartitions || '';
    } catch (error) {
      console.error('Failed to create partitions:', error);
      throw error;
    }
  }, [createPartitionsMutation]);

  return {
    // Data
    dataCubes,
    ...(warehouseStats && { warehouseStats }),
    queryResults,
    
    // Loading states
    cubesLoading: cubesLoading || cubeLoading,
    statsLoading,
    queryLoading,
    
    // Error states
    ...(cubesError && { cubesError: cubesError as Error }),
    ...(statsError && { statsError: statsError as Error }),
    ...(queryError && { queryError: queryError as Error }),
    
    // Actions
    getDataCubes,
    getDataCube,
    queryWarehouse,
    getWarehouseStatistics,
    testWarehouseConnection,
    createTenantSchema,
    optimizeWarehouse,
    createPartitions,
  };
}