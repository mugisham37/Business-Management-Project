/**
 * Location Reporting Management Hooks
 * Complete hook implementation for location reporting and analytics
 */

import { useCallback } from 'react';
import { 
  useQuery,
  QueryHookOptions
} from '@apollo/client';
import { 
  GET_LOCATION_SALES_REPORT,
  GET_LOCATION_INVENTORY_REPORT,
  GET_LOCATION_PERFORMANCE_REPORT,
  COMPARE_LOCATIONS
} from '@/graphql/queries/location-queries';
import { useTenant } from '@/hooks/useTenant';

// Types
export interface LocationSalesReport {
  locationId: string;
  locationName: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    date: string;
    sales: number;
    transactions: number;
  }>;
  salesByHour: Array<{
    hour: number;
    sales: number;
    transactions: number;
  }>;
  paymentMethods: Array<{
    method: string;
    amount: number;
    percentage: number;
  }>;
}

export interface LocationInventoryReport {
  locationId: string;
  locationName: string;
  totalProducts: number;
  totalValue: number;
  lowStockItems: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
  }>;
  outOfStockItems: Array<{
    productId: string;
    productName: string;
    lastStockDate: string;
  }>;
  overstockItems: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    maxStockLevel: number;
    excessQuantity: number;
  }>;
  inventoryTurnover: Array<{
    productId: string;
    productName: string;
    turnoverRate: number;
    daysOfSupply: number;
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    itemCount: number;
    totalValue: number;
  }>;
}

export interface LocationPerformanceReport {
  locationId: string;
  locationName: string;
  period: string;
  metrics: {
    revenue: number;
    grossProfit: number;
    netProfit: number;
    expenses: number;
    profitMargin: number;
    transactionCount: number;
    averageTransactionValue: number;
    itemsSold: number;
    refundAmount: number;
    refundRate: number;
    inventoryValue: number;
    inventoryTurnover: number;
    stockoutEvents: number;
    excessInventoryValue: number;
    uniqueCustomers: number;
    repeatCustomerRate: number;
    customerLifetimeValue: number;
    customerSatisfactionScore?: number;
    employeeCount: number;
    salesPerEmployee: number;
    operatingHours: number;
    salesPerHour: number;
    previousPeriodGrowth?: number;
    benchmarkComparison?: number;
    rankAmongLocations?: number;
  };
  trends: Array<{
    date: string;
    revenue: number;
    transactions: number;
    customers: number;
  }>;
  comparisons: {
    previousPeriod: {
      revenue: number;
      growth: number;
    };
    benchmark: {
      revenue: number;
      comparison: number;
    };
  };
}

export interface LocationComparison {
  locations: Array<{
    locationId: string;
    locationName: string;
    metrics: Record<string, number>;
    rank: number;
  }>;
  summary: {
    totalLocations: number;
    averageMetrics: Record<string, number>;
    topPerformer: {
      locationId: string;
      locationName: string;
    };
    bottomPerformer: {
      locationId: string;
      locationName: string;
    };
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

// Hook for location sales report
export function useLocationSalesReport(
  locationId: string,
  startDate?: Date,
  endDate?: Date,
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();
  
  const { data, loading, error, refetch } = useQuery(GET_LOCATION_SALES_REPORT, {
    variables: { 
      locationId, 
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const report = data?.getLocationSalesReport;

  return {
    report,
    loading,
    error,
    refetch,
  };
}

// Hook for location inventory report
export function useLocationInventoryReport(locationId: string, options?: QueryHookOptions) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_LOCATION_INVENTORY_REPORT, {
    variables: { locationId },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const report = data?.getLocationInventoryReport;

  return {
    report,
    loading,
    error,
    refetch,
  };
}

// Hook for location performance report
export function useLocationPerformanceReport(
  locationId: string,
  period: string = 'monthly',
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(GET_LOCATION_PERFORMANCE_REPORT, {
    variables: { locationId, period },
    skip: !currentTenant?.id || !locationId,
    errorPolicy: 'all',
    ...options,
  });

  const report = data?.getLocationPerformanceReport;

  return {
    report,
    loading,
    error,
    refetch,
  };
}

// Hook for location comparison
export function useLocationComparison(
  locationIds: string[],
  metrics: string[],
  period: string = 'monthly',
  options?: QueryHookOptions
) {
  const { tenant: currentTenant } = useTenant();

  const { data, loading, error, refetch } = useQuery(COMPARE_LOCATIONS, {
    variables: { locationIds, metrics, period },
    skip: !currentTenant?.id || !locationIds.length || !metrics.length,
    errorPolicy: 'all',
    ...options,
  });

  const comparison = data?.compareLocations;

  return {
    comparison,
    loading,
    error,
    refetch,
  };
}

// Hook for report calculations and analysis
export function useReportAnalysis() {
  const calculateGrowthRate = useCallback((current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }, []);

  const calculateMargin = useCallback((profit: number, revenue: number): number => {
    if (revenue === 0) return 0;
    return (profit / revenue) * 100;
  }, []);

  const calculateAverageTransactionValue = useCallback((
    totalRevenue: number,
    transactionCount: number
  ): number => {
    if (transactionCount === 0) return 0;
    return totalRevenue / transactionCount;
  }, []);

  const calculateInventoryTurnover = useCallback((
    costOfGoodsSold: number,
    averageInventoryValue: number
  ): number => {
    if (averageInventoryValue === 0) return 0;
    return costOfGoodsSold / averageInventoryValue;
  }, []);

  const calculateCustomerMetrics = useCallback((
    totalCustomers: number,
    repeatCustomers: number,
    totalRevenue: number
  ): {
    repeatCustomerRate: number;
    averageCustomerValue: number;
  } => {
    const repeatCustomerRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    const averageCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    return {
      repeatCustomerRate,
      averageCustomerValue,
    };
  }, []);

  const calculateEfficiencyMetrics = useCallback((
    totalRevenue: number,
    employeeCount: number,
    operatingHours: number
  ): {
    salesPerEmployee: number;
    salesPerHour: number;
  } => {
    const salesPerEmployee = employeeCount > 0 ? totalRevenue / employeeCount : 0;
    const salesPerHour = operatingHours > 0 ? totalRevenue / operatingHours : 0;

    return {
      salesPerEmployee,
      salesPerHour,
    };
  }, []);

  const identifyTrends = useCallback((
    data: Array<{ date: string; value: number }>
  ): {
    trend: 'increasing' | 'decreasing' | 'stable';
    changeRate: number;
    volatility: number;
  } => {
    if (data.length < 2) {
      return { trend: 'stable', changeRate: 0, volatility: 0 };
    }

    const values = data.map(d => d.value);
    const firstValue = values[0] ?? 0;
    const lastValue = values[values.length - 1] ?? 0;
    const changeRate = calculateGrowthRate(lastValue, firstValue);

    // Calculate volatility (standard deviation)
    const mean = values.reduce((sum, val) => sum + (val ?? 0), 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow((val ?? 0) - mean, 2), 0) / values.length;
    const volatility = Math.sqrt(variance);

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changeRate) > 5) { // 5% threshold
      trend = changeRate > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      changeRate,
      volatility,
    };
  }, [calculateGrowthRate]);

  return {
    calculateGrowthRate,
    calculateMargin,
    calculateAverageTransactionValue,
    calculateInventoryTurnover,
    calculateCustomerMetrics,
    calculateEfficiencyMetrics,
    identifyTrends,
  };
}

// Hook for report formatting and export
export function useReportFormatting() {
  const formatCurrency = useCallback((amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }, []);

  const formatPercentage = useCallback((value: number, decimals: number = 1): string => {
    return `${value.toFixed(decimals)}%`;
  }, []);

  const formatNumber = useCallback((value: number, decimals: number = 0): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }, []);

  const formatDate = useCallback((date: string | Date, format: 'short' | 'long' = 'short'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (format === 'long') {
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    return dateObj.toLocaleDateString('en-US');
  }, []);

  const exportToCSV = useCallback((data: Array<Record<string, unknown>>, filename: string): void => {
    if (!data.length) return;

    const headers = (data && Array.isArray(data) && data.length > 0) ? Object.keys(data[0] || {}) : [];
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  return {
    formatCurrency,
    formatPercentage,
    formatNumber,
    formatDate,
    exportToCSV,
  };
}

// Hook for report filters and date ranges
export function useReportFilters() {
  const getDateRange = useCallback((period: string): { startDate: Date; endDate: Date } => {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'thisMonth':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'lastMonth':
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'lastYear':
        startDate.setFullYear(startDate.getFullYear() - 1, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setFullYear(endDate.getFullYear() - 1, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }, []);

  const getAvailableMetrics = useCallback((): Array<{ key: string; label: string; category: string }> => {
    return [
      // Financial Metrics
      { key: 'revenue', label: 'Revenue', category: 'Financial' },
      { key: 'grossProfit', label: 'Gross Profit', category: 'Financial' },
      { key: 'netProfit', label: 'Net Profit', category: 'Financial' },
      { key: 'profitMargin', label: 'Profit Margin', category: 'Financial' },
      { key: 'expenses', label: 'Expenses', category: 'Financial' },
      
      // Sales Metrics
      { key: 'transactionCount', label: 'Transaction Count', category: 'Sales' },
      { key: 'averageTransactionValue', label: 'Average Transaction Value', category: 'Sales' },
      { key: 'itemsSold', label: 'Items Sold', category: 'Sales' },
      { key: 'refundRate', label: 'Refund Rate', category: 'Sales' },
      
      // Inventory Metrics
      { key: 'inventoryValue', label: 'Inventory Value', category: 'Inventory' },
      { key: 'inventoryTurnover', label: 'Inventory Turnover', category: 'Inventory' },
      { key: 'stockoutEvents', label: 'Stockout Events', category: 'Inventory' },
      
      // Customer Metrics
      { key: 'uniqueCustomers', label: 'Unique Customers', category: 'Customer' },
      { key: 'repeatCustomerRate', label: 'Repeat Customer Rate', category: 'Customer' },
      { key: 'customerLifetimeValue', label: 'Customer Lifetime Value', category: 'Customer' },
      
      // Operational Metrics
      { key: 'salesPerEmployee', label: 'Sales per Employee', category: 'Operational' },
      { key: 'salesPerHour', label: 'Sales per Hour', category: 'Operational' },
    ];
  }, []);

  return {
    getDateRange,
    getAvailableMetrics,
  };
}

// Main location reporting management hook
export function useLocationReportingManagement() {
  const reportAnalysis = useReportAnalysis();
  const reportFormatting = useReportFormatting();
  const reportFilters = useReportFilters();

  return {
    ...reportAnalysis,
    ...reportFormatting,
    ...reportFilters,
  };
}