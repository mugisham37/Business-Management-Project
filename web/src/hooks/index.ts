/**
 * Hooks Index
 * Central exports for all custom React hooks
 */

export { useCacheStrategy } from './useCacheStrategy';
export { useGraphQLMutations } from './useGraphQLMutations';
export { 
  useAuth, 
  useMFA, 
  usePermission, 
  useRequireAllPermissions, 
  useRequireAuth, 
  useAuthLoading, 
  useCurrentUser, 
  useTokens 
} from './useAuth';

// Financial hooks
export {
  useBalanceSheet,
  useIncomeStatement,
  useCashFlowStatement,
  useTrialBalance,
  useFinancialRatios,
  useFinancialSummary,
  useAccountingIntegrity,
  useFinancialReportSubscriptions,
  useFinancialReporting,
} from './useFinancialReporting';

export {
  useBudget,
  useBudgets,
  useBudgetVariance,
  useBudgetMutations,
  useBudgetSubscriptions,
  useBudgetManagement,
} from './useBudgetManagement';

export {
  useAccount,
  useAccounts,
  useAccountHierarchy,
  useAccountSearch,
  useAccountMutations,
  useAccountBalanceSubscriptions,
  useAccountValidation,
  useChartOfAccounts,
} from './useChartOfAccounts';

export {
  useJournalEntry,
  useJournalEntries,
  useGeneralLedger,
  useJournalEntryMutations,
  useJournalEntrySubscriptions,
  useJournalEntryValidation,
} from './useJournalEntries';

export {
  useCurrencyConversion,
  useExchangeRates,
  useCurrencies,
  useCurrencyMutations,
  useCurrencySubscriptions,
  useCurrencyFormatting,
  useMultiCurrency,
} from './useMultiCurrency';

export {
  useAccountsReceivable,
  useAccountsPayable,
  useAgingReport,
  useARAPMutations,
  useARAPSubscriptions,
  useAccountsReceivablePayable,
} from './useAccountsReceivablePayable';

export {
  useFinancialDashboard,
} from './useFinancialDashboard';

// Communication hooks
export { 
  useCommunication, 
  useNotifications, 
  useEmail, 
  useSMS,
  useSlack,
  useTeams
} from '@/modules/communication';

// Supplier hooks
export {
  useSuppliers,
  useSupplier,
  useSupplierByCode,
  usePreferredSuppliers,
  useSuppliersByStatus,
  useSearchSuppliers,
  useSupplierStats,
  useSupplierPerformanceScore,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useSupplierSubscriptions,
  useSupplierManagement,
  useSupplierFilters,
} from './useSuppliers';

export {
  useSupplierContacts,
  useSupplierContact,
  usePrimarySupplierContact,
  useCreateSupplierContact,
  useUpdateSupplierContact,
  useDeleteSupplierContact,
  useSetPrimaryContact,
  useSupplierContactManagement,
} from './useSupplierContacts';

export {
  useSupplierCommunications,
  useSupplierCommunicationsList,
  useSupplierCommunication,
  usePendingFollowUps,
  useCommunicationStats,
  useCommunicationByTypeStats,
  useCreateSupplierCommunication,
  useUpdateSupplierCommunication,
  useDeleteSupplierCommunication,
  useMarkFollowUpComplete,
  useSupplierCommunicationManagement,
  useCommunicationFilters,
} from './useSupplierCommunications';

export {
  useSupplierEvaluations,
  useSupplierEvaluationsList,
  useSupplierEvaluation,
  useLatestSupplierEvaluation,
  usePendingEvaluations,
  useEvaluationStats,
  useSupplierTrends,
  useCreateSupplierEvaluation,
  useUpdateSupplierEvaluation,
  useDeleteSupplierEvaluation,
  useApproveSupplierEvaluation,
  useRejectSupplierEvaluation,
  useSupplierEvaluationSubscriptions,
  useSupplierEvaluationManagement,
  useEvaluationScoring,
} from './useSupplierEvaluations';

export {
  usePurchaseOrders,
  usePurchaseOrder,
  usePurchaseOrderByNumber,
  usePurchaseOrderStats,
  useSupplierPurchaseStats,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useSubmitPurchaseOrderForApproval,
  useRespondToApproval,
  useCreatePurchaseOrderReceipt,
  useCreatePurchaseOrderInvoice,
  useProcurementAnalytics,
  useEDIOperations,
  usePurchaseOrderSubscriptions,
  useProcurementManagement,
  usePurchaseOrderFilters,
} from './useProcurement';

// CRM Hooks
export { useCRM } from './useCRM';
export { useCustomers, useCustomer, useCustomerByEmail, useCustomerByPhone, useCustomerSearch, useCustomerStats } from './useCustomers';
export { useLoyalty, useCustomerLoyalty, useCampaignLoyalty, useLoyaltyStats, useLoyaltyTiers } from './useLoyalty';
export { useCampaigns, useCampaign, useActiveCampaignsForCustomer, useCampaignPerformance, useCampaignStats, useCampaignValidation } from './useCampaigns';
export { useCustomerAnalytics, useCustomerLifetimeValue, useCustomersLifetimeValue, useCustomerPurchasePatterns, useCustomerChurnRisk, useSegmentAnalytics, useAllSegmentsAnalytics, useHighChurnRiskCustomers, useCustomerMetrics, useAnalyticsInsights, usePredictiveAnalytics } from './useCustomerAnalytics';
export { useB2BCustomers, useB2BCustomer, useB2BCustomerMetrics, useB2BCustomersByIndustry, useB2BCustomersBySalesRep, useB2BCustomersWithExpiringContracts, useB2BCreditManagement } from './useB2BCustomers';
export { useB2BOrders, useB2BOrder, useB2BOrderByNumber, useOrdersRequiringApproval, useB2BOrderAnalytics } from './useB2BOrders';
export { useQuotes, useQuote, useQuoteSubscriptions } from './useQuotes';
export { useContracts, useContract, useExpiringContracts, useContractExpirationNotifications } from './useContracts';
export { useB2BPricing, useCustomerPricing, useBulkPricing, usePricingChangeNotifications } from './useB2BPricing';
export { useTerritories, useTerritory, useTerritoryPerformance, useTerritoryCustomers } from './useTerritories';
export { useB2BWorkflows, useB2BWorkflow, usePendingApprovals, useWorkflowAnalytics, useWorkflowHistory } from './useB2BWorkflows';
export { useCommunications, useCustomerCommunications, useCommunicationStats, useCommunicationTemplates, useCommunicationAutomation } from './useCommunications';
export { useSegmentation, useSegment, useSegmentMembers, useSegmentCriteriaBuilder, useSegmentTemplates } from './useSegmentation';

// Inventory Hooks
export {
  useInventoryLevel,
  useInventoryLevels,
  useInventoryHistory,
  useInventoryTransfer,
  useInventoryReservation,
  useInventorySummary,
  useLowStockItems,
  useOutOfStockItems,
  useInventorySubscriptions,
  useInventoryManagement,
} from './useInventory';

export {
  useProduct,
  useProducts,
  useProductSearch,
  useFeaturedProducts,
  useProductSubscriptions,
  useProductManagement,
} from './useProducts';

export {
  useCategory,
  useCategoryBySlug,
  useCategories,
  useCategoryTree,
  useCategorySearch,
  useCategoryManagement,
} from './useCategories';

export {
  useBrand,
  useBrandBySlug,
  useBrands,
  useBrandSearch,
  usePopularBrands,
  useBrandManagement,
} from './useBrands';

export {
  useBatchTracking,
  useBatchTrackings,
  useExpiringBatches,
  useFIFOBatches,
  useBatchSubscriptions,
  useBatchTrackingManagement,
} from './useBatchTracking';

// POS Hooks
export {
  usePOS,
  usePOSSession,
  usePOSConfiguration,
  useDailySalesSummary,
} from './usePOS';

export {
  useTransactions,
  useTransaction,
} from './useTransactions';

export {
  usePayments,
} from './usePayments';

export {
  useReceipts,
} from './useReceipts';

export {
  useOfflineSync,
} from './useOfflineSync';

export {
  useReconciliation,
  useReconciliationReport,
} from './useReconciliation';