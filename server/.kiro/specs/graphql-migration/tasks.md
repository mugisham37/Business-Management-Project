# Implementation Plan: GraphQL Migration

## Overview

This implementation plan breaks down the GraphQL migration into 7 phases with 77 new resolvers across 24 business modules. The plan follows an incremental approach, starting with foundational infrastructure, then progressing through core modules, business modules, operations modules, advanced modules, and supporting modules, before completing with testing and optimization.

Each task builds on previous tasks and includes clear acceptance criteria. The migration maintains complete backward compatibility with all existing REST endpoints while achieving 100% GraphQL API coverage.

## Tasks

- [x] 1. Phase 1: Foundation Infrastructure
  - Set up enhanced GraphQL infrastructure, base templates, DataLoader patterns, and PubSub for subscriptions
  - _Requirements: 1.1, 4.1, 5.1, 10.1-10.6_

- [x] 1.1 Enhance GraphQL configuration and error handling
  - Update GraphQL config with query complexity limits and depth limits
  - Implement comprehensive error code enum and error handler utility
  - Add query performance monitoring and logging
  - _Requirements: 7.1-7.6, 29.1-29.2_

- [x] 1.2 Create base resolver templates and utilities
  - Create enhanced BaseResolver with DataLoader integration
  - Create resolver template generator script
  - Document resolver patterns and best practices
  - _Requirements: 1.1, 4.1_

- [x] 1.3 Set up PubSub infrastructure for subscriptions
  - Configure Redis-based PubSub provider
  - Create PubSub module with tenant filtering
  - Implement subscription authentication middleware
  - _Requirements: 5.1-5.5_

- [x] 1.4 Create common GraphQL types and patterns
  - Create filter input types (EntityFilterInput pattern)
  - Create sort input types (EntitySortInput pattern)
  - Create mutation response types (MutationResponse pattern)
  - Create connection types for pagination
  - _Requirements: 6.1-6.6, 7.1-7.2_


- [ ]* 1.5 Write property tests for foundation infrastructure
  - **Property 5: Authentication Error Codes** - For any GraphQL operation that fails authentication or authorization, verify error codes
  - **Property 13: Pagination Argument Validation** - For any paginated query with invalid arguments, verify validation errors
  - **Property 24: Query Depth Limiting** - For any query exceeding depth limit, verify rejection
  - **Validates: Requirements 3.6, 6.5, 29.2**

- [ ] 2. Checkpoint - Foundation Complete
  - Ensure all foundation tests pass, ask the user if questions arise.

- [-] 3. Phase 2: Core Modules (Auth, Tenant, Employee)
  - Implement resolvers for authentication, tenant management, and employee modules
  - _Requirements: 14.1-14.6, 15.1-15.6_

- [x] 3.1 Implement Auth module resolvers (3 resolvers)
  - [x] 3.1.1 Create auth.resolver.ts with login, logout, register, password reset mutations
    - Implement login mutation with JWT token generation
    - Implement logout mutation with token invalidation
    - Implement register mutation with validation
    - Implement password reset flow (request and confirm)
    - Apply rate limiting to login attempts
    - _Requirements: 14.1-14.6_
  
  - [x] 3.1.2 Create mfa.resolver.ts for multi-factor authentication
    - Implement MFA setup with QR code generation
    - Implement MFA verification
    - Implement MFA enable/disable mutations
    - Implement backup code generation
    - Use speakeasy for TOTP
    - _Requirements: 14.1-14.6_
  
  - [x] 3.1.3 Create permissions.resolver.ts for permission management
    - Implement getPermissions query
    - Implement getRoles query
    - Implement assignRole and revokeRole mutations
    - Implement createRole and updateRolePermissions mutations
    - Add caching for user permissions (15-minute TTL)
    - _Requirements: 14.1-14.6_
  
  - [ ]* 3.1.4 Write property tests for Auth module
    - **Property 5: Authentication Error Codes** - Test auth failures return correct error codes
    - **Property 9: Subscription Authentication** - Test subscription auth requirements
    - **Validates: Requirements 3.6, 5.4**

- [ ] 3.2 Implement Employee module resolvers (4 resolvers)
  - [x] 3.2.1 Create employee.resolver.ts for employee management
    - Implement CRUD operations (get, list, create, update, terminate)
    - Implement field resolvers (manager, directReports, department)
    - Add DataLoader for manager and department loading
    - Implement employeeStatusChanged subscription
    - _Requirements: 15.1-15.6_
  
  - [x] 3.2.2 Create compliance.resolver.ts for compliance tracking
    - Implement getComplianceStatus query
    - Implement getRequiredTraining query
    - Implement recordTrainingCompletion mutation
    - Implement getCertifications and recordCertification
    - Implement complianceExpiring subscription
    - _Requirements: 15.1-15.6_
  
  - [x] 3.2.3 Create payroll.resolver.ts for payroll processing
    - Implement getPayroll and getPaystub queries
    - Implement processPayroll mutation (enqueue to Bull queue)
    - Implement updatePayrollSettings mutation
    - Apply strict permission controls
    - Add audit logging for all payroll access
    - _Requirements: 15.1-15.6, 12.1-12.2_
  
  - [x] 3.2.4 Create performance.resolver.ts for performance management
    - Implement performance review CRUD operations
    - Implement goal management operations
    - Implement feedback operations
    - Add field resolvers (reviewer, goals)
    - Add DataLoader for reviewer loading
    - _Requirements: 15.1-15.6_
  
  - [ ]* 3.2.5 Write property tests for Employee module
    - **Property 2: Tenant Data Isolation** - Test employee queries respect tenant boundaries
    - **Property 21: Async Operation Job Enqueueing** - Test payroll processing enqueues jobs
    - **Validates: Requirements 2.3, 12.1**

- [x] 3.3 Enhance Tenant module with additional resolvers (2 new resolvers)
  - [x] 3.3.1 Create feature-flag.resolver.ts for feature flag management
    - Implement getFeatureFlags query
    - Implement updateFeatureFlag mutation
    - Implement enableFeature and disableFeature mutations
    - Add caching for feature flags
    - _Requirements: 1.1-1.6_
  
  - [x] 3.3.2 Create tenant-metrics.resolver.ts for tenant metrics
    - Implement getTenantMetrics query
    - Implement getTenantUsage query
    - Implement getTenantLimits query
    - Add caching with 5-minute TTL
    - _Requirements: 1.1-1.6_
  
  - [ ]* 3.3.3 Write property tests for Tenant module enhancements
    - **Property 2: Tenant Data Isolation** - Test tenant queries respect isolation
    - **Property 3: Cross-Tenant Access Rejection** - Test cross-tenant access is rejected
    - **Validates: Requirements 2.3, 2.4**

- [ ] 4. Checkpoint - Core Modules Complete
  - Ensure all core module tests pass, ask the user if questions arise.


- [-] 5. Phase 3: Business Modules (CRM, Financial, Inventory, POS)
  - Implement resolvers for core business operations
  - _Requirements: 16.1-16.6, 17.1-17.6, 19.1-19.6, 24.1-24.6_

- [x] 5.1 Implement CRM module resolvers (4 additional resolvers)
  - [x] 5.1.1 Create b2b-customer.resolver.ts for B2B customer management
    - Implement CRUD operations for B2B customers
    - Implement getB2BCustomerHierarchy query
    - Add field resolvers (parentCustomer, childCustomers, contracts, orders)
    - Add DataLoader for relationship loading
    - _Requirements: 19.1-19.6_
  
  - [x] 5.1.2 Create communication.resolver.ts for communication history
    - Implement getCommunications query
    - Implement recordCommunication mutation
    - Implement getCommunicationTimeline query
    - Implement scheduleCommunication mutation
    - Add field resolvers (customer, employee)
    - Implement communicationScheduled subscription
    - _Requirements: 19.1-19.6_
  
  - [x] 5.1.3 Create customer-analytics.resolver.ts for customer insights
    - Implement getCustomerLifetimeValue query
    - Implement getCustomerSegment query
    - Implement getPurchasePatterns query
    - Implement getChurnRisk query
    - Implement getCustomerJourney query
    - Add caching with 1-hour TTL
    - _Requirements: 19.1-19.6_
  
  - [x] 5.1.4 Create segmentation.resolver.ts for dynamic segmentation
    - Implement segment CRUD operations
    - Implement getSegmentMembers query
    - Implement evaluateSegmentMembership query
    - Enqueue segment recalculation to Bull queue
    - _Requirements: 19.1-19.6, 12.1-12.2_
  
  - [ ]* 5.1.5 Write property tests for CRM module
    - **Property 2: Tenant Data Isolation** - Test customer queries respect tenant boundaries
    - **Property 6: DataLoader Request Deduplication** - Test customer relationship loading
    - **Validates: Requirements 2.3, 4.4**

- [x] 5.2 Implement Financial module resolvers (6 additional resolvers)
  - [x] 5.2.1 Create accounts-receivable-payable.resolver.ts for AR/AP
    - Implement getReceivables and getPayables queries
    - Implement recordPayment mutation
    - Implement getAgingReport query
    - Implement sendPaymentReminder mutation
    - Add field resolvers (customer, supplier, invoiceLineItems)
    - _Requirements: 16.1-16.6_
  
  - [x] 5.2.2 Create budget.resolver.ts for budget management
    - Implement budget CRUD operations
    - Implement getBudgetVariance query
    - Implement approveBudget mutation
    - Add field resolvers (actualSpending, variance)
    - _Requirements: 16.1-16.6_
  
  - [x] 5.2.3 Create journal-entry.resolver.ts for journal entries
    - Implement journal entry CRUD operations
    - Implement postJournalEntry mutation
    - Implement reverseJournalEntry mutation
    - Implement getGeneralLedger query
    - Validate debits equal credits
    - _Requirements: 16.1-16.6_
  
  - [x] 5.2.4 Create multi-currency.resolver.ts for currency operations
    - Implement convertCurrency query
    - Implement getExchangeRates query
    - Implement updateExchangeRate mutation
    - Implement getMultiCurrencyReport query
    - Add caching for exchange rates (1-hour TTL)
    - _Requirements: 16.1-16.6_
  
  - [x] 5.2.5 Create reconciliation.resolver.ts for reconciliation
    - Implement reconciliation workflow operations
    - Implement startReconciliation mutation
    - Implement matchTransaction mutation
    - Implement completeReconciliation mutation
    - Enqueue auto-matching to Bull queue
    - _Requirements: 16.1-16.6, 12.1-12.2_
  
  - [x] 5.2.6 Create tax.resolver.ts for tax calculations
    - Implement calculateTax query
    - Implement getTaxReport query
    - Implement getTaxRates query
    - Implement updateTaxRate mutation
    - Add caching for tax rates (24-hour TTL)
    - _Requirements: 16.1-16.6_
  
  - [ ]* 5.2.7 Write property tests for Financial module
    - **Property 2: Tenant Data Isolation** - Test financial queries respect tenant boundaries
    - **Property 20: Mutation Cache Invalidation** - Test financial mutations invalidate cache
    - **Validates: Requirements 2.3, 11.2**


- [x] 5.3 Implement Inventory module resolvers (10 additional resolvers)
  - [x] 5.3.1 Create inventory.resolver.ts for core inventory operations
    - Implement getInventory query
    - Implement adjustInventory mutation
    - Implement transferInventory mutation
    - Implement getInventoryHistory query
    - Add field resolvers (product, location)
    - Implement inventoryChanged subscription
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.2 Create batch-tracking.resolver.ts for batch tracking
    - Implement batch CRUD operations
    - Implement getBatchInventory query
    - Implement traceBatch query
    - Add field resolvers (movements)
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.3 Create brand.resolver.ts for brand management
    - Implement brand CRUD operations
    - Add field resolvers (products)
    - Add DataLoader for product loading
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.4 Create category.resolver.ts for category hierarchy
    - Implement category CRUD operations
    - Implement getCategoryTree query
    - Implement moveCategory mutation
    - Add field resolvers (parent, children, products)
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.5 Create cycle-counting.resolver.ts for cycle counts
    - Implement cycle count workflow operations
    - Implement createCycleCount mutation
    - Implement recordCount mutation
    - Implement completeCycleCount mutation
    - Enqueue variance analysis to Bull queue
    - _Requirements: 17.1-17.6, 12.1-12.2_
  
  - [x] 5.3.6 Create inventory-accuracy-reporting.resolver.ts
    - Implement getAccuracyReport query
    - Implement getVarianceAnalysis query
    - Implement getCountAccuracy query
    - Add caching with 1-hour TTL
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.7 Create inventory-movement-tracking.resolver.ts
    - Implement getMovements query
    - Implement getMovementHistory query
    - Implement getLocationMovements query
    - Add field resolvers (product, fromLocation, toLocation)
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.8 Create inventory-reporting.resolver.ts
    - Implement getStockReport query
    - Implement getValuationReport query
    - Implement getTurnoverReport query
    - Add caching with 30-minute TTL
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.9 Create perpetual-inventory.resolver.ts
    - Implement getCurrentInventory query
    - Implement getInventoryValue query
    - Implement reconcileInventory mutation
    - Support real-time updates via subscriptions
    - _Requirements: 17.1-17.6_
  
  - [x] 5.3.10 Create reorder.resolver.ts for reorder management
    - Implement getReorderPoints query
    - Implement updateReorderPoint mutation
    - Implement getReorderSuggestions query
    - Implement createPurchaseOrder mutation
    - Add field resolvers (product, supplier)
    - _Requirements: 17.1-17.6_
  
  - [ ]* 5.3.11 Write property tests for Inventory module
    - **Property 2: Tenant Data Isolation** - Test inventory queries respect tenant boundaries
    - **Property 8: Domain Event to Subscription Propagation** - Test inventory changes emit events
    - **Property 10: Subscription Tenant Filtering** - Test inventory subscriptions filter by tenant
    - **Validates: Requirements 2.3, 5.2, 5.5**

- [x] 5.4 Implement POS module resolvers (3 resolvers)
  - [x] 5.4.1 Create pos.resolver.ts for POS operations
    - Implement POS session operations (open, close, get)
    - Implement getPOSConfiguration query
    - Add field resolvers (employee, transactions)
    - _Requirements: 24.1-24.6_
  
  - [x] 5.4.2 Create transaction.resolver.ts for transaction management
    - Implement transaction CRUD operations
    - Implement voidTransaction mutation
    - Implement refundTransaction mutation
    - Add field resolvers (lineItems, payments, customer)
    - Implement transactionCreated subscription
    - _Requirements: 24.1-24.6_
  
  - [x] 5.4.3 Create offline.resolver.ts for offline sync
    - Implement getOfflineQueue query
    - Implement syncOfflineTransactions mutation
    - Implement resolveConflict mutation
    - Implement getOfflineStatus query
    - Implement offlineStatusChanged subscription
    - _Requirements: 24.1-24.6_
  
  - [ ]* 5.4.4 Write property tests for POS module
    - **Property 2: Tenant Data Isolation** - Test transaction queries respect tenant boundaries
    - **Property 10: Subscription Tenant Filtering** - Test transaction subscriptions filter by tenant
    - **Validates: Requirements 2.3, 5.5**

- [ ] 6. Checkpoint - Business Modules Complete
  - Ensure all business module tests pass, ask the user if questions arise.


- [-] 7. Phase 4: Operations Modules (Warehouse, Location, Supplier, B2B)
  - Implement resolvers for operational features
  - _Requirements: 18.1-18.6, 20.1-20.6, 21.1-21.6, 27.1-27.6_

- [x] 7.1 Implement Warehouse module resolvers (8 resolvers)
  - [x] 7.1.1 Create warehouse.resolver.ts for core warehouse operations
    - Implement warehouse CRUD operations
    - Add field resolvers (zones, inventory, employees)
    - Add DataLoader for relationship loading
    - _Requirements: 20.1-20.6_
  
  - [x] 7.1.2 Create bin-location.resolver.ts for bin management
    - Implement bin location CRUD operations
    - Implement getBinInventory query
    - Add field resolvers (zone, inventory)
    - _Requirements: 20.1-20.6_
  
  - [x] 7.1.3 Create kitting-assembly.resolver.ts for kitting
    - Implement kit definition CRUD operations
    - Implement assembleKit mutation
    - Implement disassembleKit mutation
    - Enqueue assembly operations to Bull queue
    - _Requirements: 20.1-20.6, 12.1-12.2_
  
  - [x] 7.1.4 Create lot-tracking.resolver.ts for lot tracking
    - Implement lot CRUD operations
    - Implement getLotInventory query
    - Implement traceLot query
    - Implement getLotExpiration query (implemented as getExpiringLots)
    - Add field resolvers (product, movements)
    - _Requirements: 20.1-20.6_
  
  - [x] 7.1.5 Create pick-list.resolver.ts for pick list management
    - Implement pick list workflow operations
    - Implement assignPickList mutation
    - Implement recordPick mutation
    - Implement completePickList mutation
    - Implement pickListAssigned and pickListCompleted subscriptions
    - _Requirements: 20.1-20.6_
  
  - [x] 7.1.6 Create picking-wave.resolver.ts for wave picking
    - Implement picking wave operations
    - Implement releasePickingWave mutation
    - Implement getWaveProgress query
    - Enqueue wave optimization to Bull queue
    - _Requirements: 20.1-20.6, 12.1-12.2_
  
  - [x] 7.1.7 Create shipping-integration.resolver.ts for shipping
    - Implement getShippingRates query
    - Implement createShipment mutation
    - Implement printShippingLabel mutation
    - Implement trackShipment query
    - Implement schedulePickup mutation
    - Handle carrier API errors gracefully
    - _Requirements: 20.1-20.6_
  
  - [x] 7.1.8 Create warehouse-zone.resolver.ts for zone management
    - Implement zone CRUD operations
    - Add field resolvers (warehouse, bins)
    - Add DataLoader for relationship loading
    - _Requirements: 20.1-20.6_
  
  - [ ]* 7.1.9 Write property tests for Warehouse module
    - **Property 2: Tenant Data Isolation** - Test warehouse queries respect tenant boundaries
    - **Property 21: Async Operation Job Enqueueing** - Test assembly operations enqueue jobs
    - **Validates: Requirements 2.3, 12.1**

- [x] 7.2 Implement Location module resolvers (9 resolvers)
  - [x] 7.2.1 Create location.resolver.ts for core location operations
    - Implement location CRUD operations
    - Implement closeLocation mutation
    - Add field resolvers (parentLocation, childLocations, employees, inventory)
    - Implement locationStatusChanged subscription
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.2 Create dealer-portal.resolver.ts for dealer portal
    - Implement getDealerDashboard query
    - Implement getDealerOrders query
    - Implement getDealerInventory query
    - Implement submitDealerOrder mutation
    - Apply dealer-specific permissions
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.3 Create franchise.resolver.ts for franchise management
    - Implement franchise CRUD operations
    - Implement getFranchisePerformance query
    - Add field resolvers (locations, franchisee)
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.4 Create location-inventory-policy.resolver.ts
    - Implement getInventoryPolicy query
    - Implement updateInventoryPolicy mutation
    - Implement getReorderRules query
    - Implement updateReorderRules mutation
    - Validate policy constraints
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.5 Create location-pricing.resolver.ts for location pricing
    - Implement getLocationPricing query
    - Implement updateLocationPricing mutation
    - Implement getPricingRules query
    - Implement applyPricingRule mutation
    - Add field resolvers (product, basePrice)
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.6 Create location-promotion.resolver.ts for promotions
    - Implement location promotion CRUD operations
    - Implement activatePromotion mutation
    - Implement deactivatePromotion mutation
    - Implement promotionActivated subscription
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.7 Create location-reporting.resolver.ts for location reports
    - Implement getLocationSalesReport query
    - Implement getLocationInventoryReport query
    - Implement getLocationPerformanceReport query
    - Implement compareLocations query
    - Add caching with 30-minute TTL
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.8 Create location-sync.resolver.ts for location sync
    - Implement getSyncStatus query
    - Implement triggerSync mutation
    - Implement getSyncHistory query
    - Implement resolveSyncConflict mutation
    - Implement syncStatusChanged subscription
    - _Requirements: 18.1-18.6_
  
  - [x] 7.2.9 Create territory.resolver.ts for territory management
    - Implement territory CRUD operations
    - Implement assignLocationToTerritory mutation
    - Add field resolvers (locations, manager)
    - _Requirements: 18.1-18.6_
  
  - [ ]* 7.2.10 Write property tests for Location module
    - **Property 2: Tenant Data Isolation** - Test location queries respect tenant boundaries
    - **Property 18: Field Resolver Lazy Execution** - Test field resolvers only execute when requested
    - **Validates: Requirements 2.3, 8.4**


- [ ] 7.3 Implement Supplier module resolvers (4 resolvers)
  - [ ] 7.3.1 Create supplier.resolver.ts for supplier management
    - Implement supplier CRUD operations
    - Implement rateSupplier mutation
    - Add field resolvers (products, purchaseOrders, contacts)
    - Add DataLoader for relationship loading
    - _Requirements: 21.1-21.6_
  
  - [ ] 7.3.2 Create edi-integration.resolver.ts for EDI
    - Implement sendEDIDocument mutation
    - Implement receiveEDIDocument query
    - Implement getEDIStatus query
    - Implement retryEDIDocument mutation
    - Enqueue EDI processing to Bull queue
    - _Requirements: 21.1-21.6, 12.1-12.2_
  
  - [ ] 7.3.3 Create procurement-analytics.resolver.ts
    - Implement getSupplierPerformance query
    - Implement getSpendAnalysis query
    - Implement getLeadTimeAnalysis query
    - Implement getCostTrends query
    - Add caching with 1-hour TTL
    - _Requirements: 21.1-21.6_
  
  - [ ] 7.3.4 Create purchase-order.resolver.ts for PO management
    - Implement purchase order CRUD operations
    - Implement approvePurchaseOrder mutation
    - Implement receivePurchaseOrder mutation
    - Add field resolvers (supplier, lineItems, receipts)
    - Implement purchaseOrderApproved and purchaseOrderReceived subscriptions
    - _Requirements: 21.1-21.6_
  
  - [ ]* 7.3.5 Write property tests for Supplier module
    - **Property 2: Tenant Data Isolation** - Test supplier queries respect tenant boundaries
    - **Property 8: Domain Event to Subscription Propagation** - Test PO events emit subscriptions
    - **Validates: Requirements 2.3, 5.2**

- [ ] 7.4 Implement B2B module resolvers (3 additional resolvers)
  - [ ] 7.4.1 Create contract.resolver.ts for contract lifecycle
    - Implement contract CRUD operations
    - Implement approveContract mutation
    - Implement renewContract mutation
    - Implement terminateContract mutation
    - Add field resolvers (customer, pricingAgreements)
    - Implement contractExpiring subscription
    - _Requirements: 27.1-27.6_
  
  - [ ] 7.4.2 Create customer-portal.resolver.ts for customer portal
    - Implement getPortalDashboard query
    - Implement getPortalOrders query
    - Implement getPortalInvoices query
    - Implement submitPortalOrder mutation
    - Apply customer-specific permissions
    - _Requirements: 27.1-27.6_
  
  - [ ] 7.4.3 Create territory.resolver.ts (B2B-specific)
    - Implement B2B territory CRUD operations
    - Implement assignCustomerToTerritory mutation
    - Implement getTerritoryPerformance query
    - Add field resolvers (customers, salesRep)
    - _Requirements: 27.1-27.6_
  
  - [ ]* 7.4.4 Write property tests for B2B module
    - **Property 2: Tenant Data Isolation** - Test B2B queries respect tenant boundaries
    - **Property 10: Subscription Tenant Filtering** - Test contract subscriptions filter by tenant
    - **Validates: Requirements 2.3, 5.5**

- [ ] 8. Checkpoint - Operations Modules Complete
  - Ensure all operations module tests pass, ask the user if questions arise.

- [ ] 9. Phase 5: Advanced Modules (Analytics, Integration, Security, Realtime)
  - Implement resolvers for advanced features
  - _Requirements: 13.1-13.6, 22.1-22.6, 23.1-23.6, 26.1-26.6_

- [ ] 9.1 Implement Analytics module resolvers (8 resolvers)
  - [ ] 9.1.1 Create analytics.resolver.ts for core analytics
    - Implement getMetrics query
    - Implement getKPIs query
    - Implement getTrends query
    - Add DataLoader for metric batch loading
    - Implement metricsUpdated subscription
    - _Requirements: 13.1-13.6_
  
  - [ ] 9.1.2 Create comparative-analysis.resolver.ts
    - Implement compareTimePeriods query
    - Implement compareLocations query
    - Implement compareSegments query
    - Add field resolvers (variance, percentageChange)
    - _Requirements: 13.1-13.6_
  
  - [ ] 9.1.3 Create custom-reporting.resolver.ts
    - Implement createReport mutation
    - Implement executeReport query
    - Implement scheduleReport mutation
    - Enqueue long-running reports to Bull queue
    - Return job ID for status tracking
    - _Requirements: 13.1-13.6, 12.1-12.2_
  
  - [ ] 9.1.4 Create dashboard.resolver.ts for dashboards
    - Implement getDashboard query
    - Implement getWidgetData query
    - Implement updateDashboard mutation
    - Add caching for widget data (5-minute TTL)
    - _Requirements: 13.1-13.6_
  
  - [ ] 9.1.5 Create data-warehouse.resolver.ts
    - Implement queryWarehouse query
    - Implement getDataCube query
    - Implement getDrillDown query
    - Implement query complexity limits
    - Add caching for frequently accessed cubes
    - _Requirements: 13.1-13.6_
  
  - [ ] 9.1.6 Create mobile-analytics.resolver.ts
    - Implement getMobileMetrics query
    - Implement getUserBehavior query
    - Implement getSessionAnalytics query
    - Optimize for minimal payloads
    - Support offline data sync
    - _Requirements: 13.1-13.6_
  
  - [ ] 9.1.7 Create predictive-analytics.resolver.ts
    - Implement getForecast query
    - Implement getAnomalies query
    - Implement getRecommendations query
    - Enqueue ML model execution to Bull queue
    - Return prediction job ID
    - _Requirements: 13.1-13.6, 12.1-12.2_
  
  - [ ] 9.1.8 Create reporting.resolver.ts for standard reports
    - Implement getReport query
    - Implement exportReport mutation
    - Implement getReportHistory query
    - Add caching for report results (1-hour TTL)
    - _Requirements: 13.1-13.6_
  
  - [ ]* 9.1.9 Write property tests for Analytics module
    - **Property 2: Tenant Data Isolation** - Test analytics queries respect tenant boundaries
    - **Property 21: Async Operation Job Enqueueing** - Test report generation enqueues jobs
    - **Property 22: Async Operation Job ID Response** - Test job ID is returned
    - **Validates: Requirements 2.3, 12.1, 12.2**


- [ ] 9.2 Implement Integration module resolvers (4 resolvers)
  - [ ] 9.2.1 Create integration.resolver.ts for integration CRUD
    - Implement integration CRUD operations
    - Implement testIntegration mutation
    - Implement enableIntegration mutation
    - Implement disableIntegration mutation
    - Add field resolvers (connector, webhooks)
    - _Requirements: 22.1-22.6_
  
  - [ ] 9.2.2 Create connector.resolver.ts for connector management
    - Implement connector CRUD operations
    - Implement installConnector mutation
    - Implement configureConnector mutation
    - Implement uninstallConnector mutation
    - Add field resolvers (integrations)
    - _Requirements: 22.1-22.6_
  
  - [ ] 9.2.3 Create developer-portal.resolver.ts
    - Implement getAPIKeys query
    - Implement createAPIKey mutation
    - Implement revokeAPIKey mutation
    - Implement getAPIUsage query
    - Implement getWebhookLogs query
    - Apply strict permission controls
    - Audit all API key operations
    - _Requirements: 22.1-22.6_
  
  - [ ] 9.2.4 Create webhook.resolver.ts for webhook management
    - Implement webhook CRUD operations
    - Implement testWebhook mutation
    - Implement getWebhookDeliveries query
    - Implement webhookDelivered subscription
    - _Requirements: 22.1-22.6_
  
  - [ ]* 9.2.5 Write property tests for Integration module
    - **Property 2: Tenant Data Isolation** - Test integration queries respect tenant boundaries
    - **Property 10: Subscription Tenant Filtering** - Test webhook subscriptions filter by tenant
    - **Validates: Requirements 2.3, 5.5**

- [ ] 9.3 Implement Security module resolvers (4 resolvers)
  - [ ] 9.3.1 Create security.resolver.ts for core security
    - Implement getSecuritySettings query
    - Implement updateSecuritySettings mutation
    - Implement getSecurityEvents query
    - Implement investigateEvent mutation
    - Add field resolvers (user, resource)
    - _Requirements: 23.1-23.6_
  
  - [ ] 9.3.2 Create audit.resolver.ts for audit logs
    - Implement getAuditLogs query (read-only)
    - Implement getAuditLog query
    - Implement exportAuditLogs mutation
    - Apply strict permission controls
    - Prevent log tampering
    - _Requirements: 23.1-23.6_
  
  - [ ] 9.3.3 Create compliance.resolver.ts for compliance tracking
    - Implement getComplianceStatus query
    - Implement getComplianceReports query
    - Implement runComplianceCheck mutation
    - Implement acknowledgeViolation mutation
    - Enqueue compliance checks to Bull queue
    - _Requirements: 23.1-23.6, 12.1-12.2_
  
  - [ ] 9.3.4 Create security-dashboard.resolver.ts
    - Implement getSecurityDashboard query
    - Implement getSecurityMetrics query
    - Implement getThreatAnalysis query
    - Implement getAccessPatterns query
    - Add caching with 5-minute TTL
    - _Requirements: 23.1-23.6_
  
  - [ ]* 9.3.5 Write property tests for Security module
    - **Property 2: Tenant Data Isolation** - Test security queries respect tenant boundaries
    - **Property 17: Error Response Completeness** - Test all errors include code, message, timestamp
    - **Validates: Requirements 2.3, 7.4**

- [ ] 9.4 Implement Realtime module resolvers (3 additional resolvers)
  - [ ] 9.4.1 Create realtime.resolver.ts for real-time operations
    - Implement getOnlineUsers query
    - Implement sendRealtimeMessage mutation
    - Implement broadcastMessage mutation
    - Implement userOnline, userOffline, messageReceived subscriptions
    - _Requirements: 26.1-26.6_
  
  - [ ] 9.4.2 Create notification.resolver.ts for notifications
    - Implement getNotifications query
    - Implement markNotificationRead mutation
    - Implement markAllNotificationsRead mutation
    - Implement deleteNotification mutation
    - Implement notificationReceived subscription
    - _Requirements: 26.1-26.6_
  
  - [ ] 9.4.3 Create communication-integration.resolver.ts
    - Implement sendEmail mutation
    - Implement sendSMS mutation
    - Implement sendPushNotification mutation
    - Implement getCommunicationHistory query
    - Enqueue email/SMS sending to Bull queue
    - _Requirements: 26.1-26.6, 12.1-12.2_
  
  - [ ]* 9.4.4 Write property tests for Realtime module
    - **Property 8: Domain Event to Subscription Propagation** - Test events emit subscriptions
    - **Property 10: Subscription Tenant Filtering** - Test subscriptions filter by tenant
    - **Property 23: Job Completion Event Emission** - Test completed jobs emit events
    - **Validates: Requirements 5.2, 5.5, 12.5**

- [ ] 10. Checkpoint - Advanced Modules Complete
  - Ensure all advanced module tests pass, ask the user if questions arise.

- [ ] 11. Phase 6: Supporting Modules (Mobile)
  - Implement resolver for mobile-optimized operations
  - _Requirements: 25.1-25.6_

- [ ] 11.1 Implement Mobile module resolver (1 resolver)
  - [ ] 11.1.1 Create mobile-api.resolver.ts for mobile operations
    - Implement getMobileConfig query
    - Implement getMobileDashboard query
    - Implement syncMobileData mutation
    - Implement reportMobileError mutation
    - Optimize for minimal payloads
    - Support offline-first patterns
    - _Requirements: 25.1-25.6_
  
  - [ ]* 11.1.2 Write property tests for Mobile module
    - **Property 2: Tenant Data Isolation** - Test mobile queries respect tenant boundaries
    - **Property 11: Pagination Response Structure** - Test mobile pagination follows Relay spec
    - **Validates: Requirements 2.3, 6.3**

- [ ] 12. Checkpoint - All Resolvers Complete
  - Ensure all 77 resolvers are implemented and tested, ask the user if questions arise.


- [ ] 13. Phase 7: Testing & Optimization
  - Complete comprehensive testing and performance optimization
  - _Requirements: 28.1-28.8, 29.1-29.8_

- [ ] 13.1 Implement integration tests for critical workflows
  - [ ] 13.1.1 Write integration tests for authentication workflows
    - Test login → query → logout flow
    - Test MFA setup and verification flow
    - Test password reset flow
    - Test token refresh flow
    - _Requirements: 28.2_
  
  - [ ] 13.1.2 Write integration tests for multi-tenant isolation
    - Test tenant A cannot access tenant B data
    - Test cross-tenant queries are rejected
    - Test DataLoader respects tenant boundaries
    - Test subscriptions filter by tenant
    - _Requirements: 28.4_
  
  - [ ] 13.1.3 Write integration tests for business workflows
    - Test order creation → inventory adjustment → notification flow
    - Test purchase order → receiving → inventory update flow
    - Test employee creation → permission assignment → access flow
    - _Requirements: 28.2_
  
  - [ ] 13.1.4 Write integration tests for subscription delivery
    - Test subscription authentication
    - Test subscription filtering
    - Test subscription event delivery
    - Test subscription cleanup on disconnect
    - _Requirements: 28.7_

- [ ] 13.2 Implement remaining property-based tests
  - [ ]* 13.2.1 Write property tests for REST-GraphQL equivalence
    - **Property 1: REST-GraphQL Functional Equivalence** - Test REST and GraphQL return same results
    - **Validates: Requirements 1.2**
  
  - [ ]* 13.2.2 Write property tests for DataLoader functionality
    - **Property 4: DataLoader Tenant Scoping** - Test DataLoader respects tenant boundaries
    - **Property 6: DataLoader Request Deduplication** - Test single query per entity ID
    - **Property 7: Batch Load Error Handling** - Test missing entities handled correctly
    - **Validates: Requirements 2.5, 4.4, 4.6**
  
  - [ ]* 13.2.3 Write property tests for pagination
    - **Property 11: Pagination Response Structure** - Test Relay spec compliance
    - **Property 12: Pagination Size Limit** - Test 100-item limit enforced
    - **Property 14: Cursor Opacity** - Test cursors cannot be manipulated
    - **Validates: Requirements 6.3, 6.4, 6.6**
  
  - [ ]* 13.2.4 Write property tests for error handling
    - **Property 15: Validation Error Format** - Test validation errors include details
    - **Property 16: Service Error Conversion** - Test service errors converted to GraphQL errors
    - **Validates: Requirements 7.2, 7.3**
  
  - [ ]* 13.2.5 Write property tests for caching and jobs
    - **Property 19: Service Event Emission Preservation** - Test events still emitted from GraphQL
    - **Property 20: Mutation Cache Invalidation** - Test mutations invalidate cache
    - **Validates: Requirements 9.5, 11.2**

- [ ] 13.3 Performance optimization and load testing
  - [ ] 13.3.1 Verify DataLoader prevents N+1 queries
    - Test queries with relationships execute minimal database queries
    - Measure query count for complex nested queries
    - Verify DataLoader batching is working
    - _Requirements: 29.4_
  
  - [ ] 13.3.2 Optimize database queries and indexes
    - Review slow query logs
    - Add missing indexes for common queries
    - Optimize complex aggregation queries
    - _Requirements: 29.7_
  
  - [ ] 13.3.3 Verify caching effectiveness
    - Measure cache hit rates
    - Verify cache invalidation on mutations
    - Optimize cache TTL values
    - _Requirements: 29.5_
  
  - [ ] 13.3.4 Conduct load testing
    - Test concurrent user load
    - Test query complexity limits
    - Test subscription scalability
    - Identify and fix bottlenecks
    - _Requirements: 29.1-29.8_

- [ ] 13.4 Documentation and developer experience
  - [ ] 13.4.1 Generate GraphQL schema documentation
    - Verify schema.gql is generated correctly
    - Add descriptions to all types and fields
    - Document deprecated fields
    - _Requirements: 30.1_
  
  - [ ] 13.4.2 Write resolver documentation
    - Add JSDoc comments to all resolver methods
    - Document authentication requirements
    - Document permission requirements
    - Include usage examples
    - _Requirements: 30.2, 30.3, 30.4_
  
  - [ ] 13.4.3 Create API usage guides
    - Document pagination patterns
    - Document subscription setup
    - Document error handling
    - Document best practices
    - _Requirements: 30.6, 30.7_
  
  - [ ] 13.4.4 Set up GraphQL playground
    - Configure playground for development
    - Add example queries
    - Add authentication instructions
    - _Requirements: 30.5_
  
  - [ ] 13.4.5 Create API changelog
    - Document all new GraphQL operations
    - Document breaking changes (if any)
    - Document migration guide from REST
    - _Requirements: 30.8_

- [ ] 13.5 Final validation and deployment preparation
  - [ ] 13.5.1 Verify all 89 REST controllers still functional
    - Run REST API test suite
    - Verify no breaking changes
    - Verify backward compatibility
    - _Requirements: 1.3_
  
  - [ ] 13.5.2 Verify 100% GraphQL coverage achieved
    - Count all resolvers (should be 89 existing + 77 new = 166 total operations)
    - Verify all REST endpoints have GraphQL equivalents
    - Verify all business operations accessible via GraphQL
    - _Requirements: 1.1, 1.2_
  
  - [ ] 13.5.3 Run complete test suite
    - Run all unit tests
    - Run all integration tests
    - Run all property-based tests
    - Verify 80%+ code coverage
    - _Requirements: 28.8_
  
  - [ ] 13.5.4 Security audit
    - Verify all resolvers have authentication
    - Verify all resolvers have authorization
    - Verify tenant isolation is enforced
    - Verify no data leakage
    - _Requirements: 2.1-2.6, 3.1-3.6_
  
  - [ ] 13.5.5 Performance validation
    - Verify query execution times acceptable
    - Verify no N+1 queries
    - Verify cache hit rates acceptable
    - Verify subscription latency acceptable
    - _Requirements: 29.1-29.8_

- [ ] 14. Final Checkpoint - Migration Complete
  - Ensure all tests pass, documentation is complete, and system is ready for deployment.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the migration
- All 77 new resolvers are covered across the 7 phases
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate complete workflows
- The migration maintains 100% backward compatibility with REST APIs
