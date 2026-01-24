import { gql } from '@apollo/client';

// ===== B2B ORDER QUERIES =====

export const B2B_ORDER_FRAGMENT = gql`
  fragment B2BOrderFragment on B2BOrderType {
    id
    orderNumber
    customerId
    salesRepId
    accountManagerId
    quoteId
    status
    orderDate
    requestedDeliveryDate
    actualDeliveryDate
    paymentTerms
    paymentDueDate
    subtotal
    taxAmount
    shippingAmount
    discountAmount
    totalAmount
    currency
    requiresApproval
    approvedBy
    approvedAt
    approvalNotes
    rejectedBy
    rejectedAt
    rejectionReason
    shippedBy
    shippedAt
    trackingNumber
    estimatedDeliveryDate
    cancelledBy
    cancelledAt
    cancellationReason
    notes
    canBeApproved
    canBeRejected
    canBeCancelled
    canBeShipped
    isOverdue
    daysUntilDue
    totalSavings
    fulfillmentPercentage
    availableActions
    items {
      id
      productId
      productName
      productSku
      quantity
      unitPrice
      listPrice
      discountPercentage
      discountAmount
      lineTotal
      quantityShipped
      quantityBackordered
      notes
      isBackordered
      totalSavings
    }
    shippingAddress {
      line1
      line2
      city
      state
      postalCode
      country
    }
    billingAddress {
      line1
      line2
      city
      state
      postalCode
      country
    }
    createdAt
    updatedAt
  }
`;

export const GET_B2B_ORDERS = gql`
  ${B2B_ORDER_FRAGMENT}
  query GetB2BOrders($query: B2BOrderQueryInput!) {
    getB2BOrders(query: $query) {
      orders {
        ...B2BOrderFragment
      }
      total
      page
      limit
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const GET_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  query GetB2BOrder($id: ID!) {
    getB2BOrder(id: $id) {
      ...B2BOrderFragment
    }
  }
`;

export const GET_B2B_ORDER_BY_NUMBER = gql`
  ${B2B_ORDER_FRAGMENT}
  query GetB2BOrderByNumber($orderNumber: String!) {
    getB2BOrderByNumber(orderNumber: $orderNumber) {
      ...B2BOrderFragment
    }
  }
`;

export const GET_ORDERS_REQUIRING_APPROVAL = gql`
  ${B2B_ORDER_FRAGMENT}
  query GetOrdersRequiringApproval($page: Int = 1, $limit: Int = 20) {
    getOrdersRequiringApproval(page: $page, limit: $limit) {
      orders {
        ...B2BOrderFragment
      }
      total
      page
      limit
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const GET_ORDER_ANALYTICS = gql`
  query GetOrderAnalytics(
    $startDate: DateTime
    $endDate: DateTime
    $customerId: ID
    $salesRepId: ID
  ) {
    getOrderAnalytics(
      startDate: $startDate
      endDate: $endDate
      customerId: $customerId
      salesRepId: $salesRepId
    ) {
      totalOrders
      totalRevenue
      averageOrderValue
      ordersByStatus {
        status
        count
        revenue
      }
      monthlyTrends {
        month
        orders
        revenue
      }
      topCustomers {
        customerId
        companyName
        orders
        revenue
      }
      topProducts {
        productId
        productName
        quantity
        revenue
      }
      approvalMetrics {
        pendingApprovals
        averageApprovalTime
        approvalRate
      }
    }
  }
`;

// ===== QUOTE QUERIES =====

export const QUOTE_FRAGMENT = gql`
  fragment QuoteFragment on QuoteType {
    id
    quoteNumber
    customerId
    salesRepId
    accountManagerId
    status
    quoteDate
    expirationDate
    validUntil
    subtotal
    taxAmount
    discountAmount
    totalAmount
    currency
    requiresApproval
    approvedBy
    approvedAt
    approvalNotes
    rejectedBy
    rejectedAt
    rejectionReason
    sentAt
    sentTo
    acceptedAt
    convertedToOrderId
    convertedAt
    terms
    notes
    items {
      id
      productId
      productName
      productSku
      quantity
      unitPrice
      listPrice
      discountPercentage
      discountAmount
      lineTotal
      notes
    }
    createdAt
    updatedAt
  }
`;

export const GET_QUOTES = gql`
  ${QUOTE_FRAGMENT}
  query GetQuotes($query: QuoteQueryInput!) {
    getQuotes(query: $query) {
      quotes {
        ...QuoteFragment
      }
      total
    }
  }
`;

export const GET_QUOTE = gql`
  ${QUOTE_FRAGMENT}
  query GetQuote($id: ID!) {
    getQuote(id: $id) {
      ...QuoteFragment
    }
  }
`;

// ===== CONTRACT QUERIES =====

export const CONTRACT_FRAGMENT = gql`
  fragment ContractFragment on ContractGraphQLType {
    id
    contractNumber
    customerId
    salesRepId
    accountManagerId
    status
    contractType
    startDate
    endDate
    contractValue
    currency
    paymentTerms
    autoRenewal
    renewalNoticeDays
    customerSignedAt
    companySignedAt
    approvedBy
    approvedAt
    approvalNotes
    pricingTerms
    terms
    notes
    isExpired
    daysUntilExpiration
    requiresRenewalNotice
    createdAt
    updatedAt
  }
`;

export const GET_CONTRACTS = gql`
  ${CONTRACT_FRAGMENT}
  query GetContracts($query: ContractQueryInput!) {
    getContracts(query: $query) {
      contracts {
        ...ContractFragment
      }
      total
    }
  }
`;

export const GET_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  query GetContract($id: ID!) {
    getContract(id: $id) {
      ...ContractFragment
    }
  }
`;

export const GET_EXPIRING_CONTRACTS = gql`
  ${CONTRACT_FRAGMENT}
  query GetExpiringContracts($days: Int!) {
    getExpiringContracts(days: $days) {
      ...ContractFragment
    }
  }
`;

// ===== PRICING QUERIES =====

export const PRICING_RULE_FRAGMENT = gql`
  fragment PricingRuleFragment on PricingRuleType {
    id
    name
    description
    ruleType
    targetType
    targetId
    discountType
    discountValue
    minimumQuantity
    maximumQuantity
    minimumAmount
    effectiveDate
    expirationDate
    priority
    isActive
    isCurrentlyActive
    createdAt
    updatedAt
  }
`;

export const GET_CUSTOMER_PRICING = gql`
  query GetCustomerPricing($query: CustomerPricingQueryInput!) {
    getCustomerPricing(query: $query) {
      customerId
      productId
      quantity
      listPrice
      customerPrice
      discountPercentage
      discountAmount
      appliedRules {
        ...PricingRuleFragment
      }
      pricingTier
      contractPricing
      totalSavings
      savingsPercentage
    }
  }
  ${PRICING_RULE_FRAGMENT}
`;

export const GET_BULK_PRICING = gql`
  query GetBulkPricing($query: BulkPricingQueryInput!) {
    getBulkPricing(query: $query) {
      customerId
      items {
        productId
        quantity
        listPrice
        customerPrice
        discountPercentage
        discountAmount
        appliedRules {
          ...PricingRuleFragment
        }
      }
      totalListPrice
      totalCustomerPrice
      totalSavings
      totalSavingsPercentage
      customerTier
      hasVolumeDiscounts
      hasContractPricing
    }
  }
  ${PRICING_RULE_FRAGMENT}
`;

export const GET_PRICING_RULES = gql`
  ${PRICING_RULE_FRAGMENT}
  query GetPricingRules($query: PricingRuleQueryInput!) {
    getPricingRules(query: $query) {
      rules {
        ...PricingRuleFragment
      }
      total
    }
  }
`;

export const GET_APPLICABLE_PRICING_RULES = gql`
  ${PRICING_RULE_FRAGMENT}
  query GetApplicablePricingRules(
    $customerId: ID!
    $productId: ID!
    $quantity: Float!
    $amount: Float!
  ) {
    getApplicablePricingRules(
      customerId: $customerId
      productId: $productId
      quantity: $quantity
      amount: $amount
    ) {
      ...PricingRuleFragment
    }
  }
`;

// ===== TERRITORY QUERIES =====

export const TERRITORY_FRAGMENT = gql`
  fragment TerritoryFragment on TerritoryGraphQLType {
    id
    territoryCode
    name
    description
    territoryType
    primarySalesRepId
    secondarySalesRepIds
    managerId
    isActive
    revenueTarget
    customerTarget
    regions
    postalCodes
    states
    countries
    customerCount
    currentRevenue
    targetAchievement
    createdAt
    updatedAt
  }
`;

export const GET_TERRITORIES = gql`
  ${TERRITORY_FRAGMENT}
  query GetTerritories($query: TerritoryQueryInput!) {
    getTerritories(query: $query) {
      territories {
        ...TerritoryFragment
      }
      total
    }
  }
`;

export const GET_TERRITORY = gql`
  ${TERRITORY_FRAGMENT}
  query GetTerritory($id: ID!) {
    getTerritory(id: $id) {
      ...TerritoryFragment
    }
  }
`;

export const GET_TERRITORY_PERFORMANCE = gql`
  query GetTerritoryPerformance($id: ID!, $query: TerritoryPerformanceQueryInput!) {
    getTerritoryPerformance(id: $id, query: $query) {
      territoryId
      period {
        startDate
        endDate
      }
      metrics {
        totalRevenue
        customerCount
        orderCount
        averageOrderValue
        revenueTarget
        targetAchievement
        revenueGrowth
        customerGrowth
      }
      topCustomers {
        customerId
        companyName
        revenue
      }
      monthlyBreakdown {
        month
        revenue
        orders
        customers
      }
    }
  }
`;

export const GET_TERRITORY_CUSTOMERS = gql`
  query GetTerritoryCustomers($id: ID!) {
    getTerritoryCustomers(id: $id) {
      customers {
        id
        companyName
        industry
        annualRevenue
        creditLimit
        outstandingBalance
      }
      total
    }
  }
`;

// ===== WORKFLOW QUERIES =====

export const WORKFLOW_FRAGMENT = gql`
  fragment WorkflowFragment on WorkflowType {
    id
    workflowType
    entityType
    entityId
    status
    priority
    initiatedBy
    initiatedAt
    completedAt
    expiresAt
    currentStepId
    totalSteps
    completedSteps
    notes
    isExpired
    daysUntilExpiration
    canBeApproved
    canBeRejected
    createdAt
    updatedAt
  }
`;

export const APPROVAL_STEP_FRAGMENT = gql`
  fragment ApprovalStepFragment on ApprovalStepType {
    id
    workflowId
    stepNumber
    stepType
    approverId
    status
    requiredBy
    approvedAt
    rejectedAt
    approvalNotes
    rejectionReason
    reassignedFrom
    reassignedTo
    reassignedAt
    reassignmentReason
    createdAt
    updatedAt
  }
`;

export const GET_WORKFLOWS = gql`
  ${WORKFLOW_FRAGMENT}
  query GetWorkflows($query: WorkflowQueryInput!) {
    getWorkflows(query: $query) {
      workflows {
        ...WorkflowFragment
      }
      total
    }
  }
`;

export const GET_WORKFLOW = gql`
  ${WORKFLOW_FRAGMENT}
  ${APPROVAL_STEP_FRAGMENT}
  query GetWorkflow($id: ID!) {
    getWorkflow(id: $id) {
      ...WorkflowFragment
      steps {
        ...ApprovalStepFragment
      }
    }
  }
`;

export const GET_PENDING_APPROVALS = gql`
  ${APPROVAL_STEP_FRAGMENT}
  query GetPendingApprovals($entityType: EntityType) {
    getPendingApprovals(entityType: $entityType) {
      approvals {
        ...ApprovalStepFragment
        workflow {
          ...WorkflowFragment
        }
      }
      total
      byEntityType {
        entityType
        count
        urgentCount
        expiringCount
      }
    }
  }
  ${WORKFLOW_FRAGMENT}
`;

export const GET_WORKFLOW_HISTORY = gql`
  ${WORKFLOW_FRAGMENT}
  ${APPROVAL_STEP_FRAGMENT}
  query GetWorkflowHistory($entityId: ID!, $entityType: EntityType!) {
    getWorkflowHistory(entityId: $entityId, entityType: $entityType) {
      workflows {
        ...WorkflowFragment
        steps {
          ...ApprovalStepFragment
        }
      }
      total
    }
  }
`;

export const GET_WORKFLOW_ANALYTICS = gql`
  query GetWorkflowAnalytics(
    $startDate: DateTime
    $endDate: DateTime
    $entityType: EntityType
  ) {
    getWorkflowAnalytics(
      startDate: $startDate
      endDate: $endDate
      entityType: $entityType
    ) {
      totalWorkflows
      completedWorkflows
      pendingWorkflows
      averageApprovalTime
      approvalRate
      rejectionRate
      expiredWorkflows
      workflowsByType {
        workflowType
        count
        averageTime
      }
      workflowsByStatus {
        status
        count
      }
      approverPerformance {
        approverId
        approverName
        totalApprovals
        averageTime
        onTimeRate
      }
    }
  }
`;