import { gql } from '@apollo/client';

// Customer Queries
export const GET_CUSTOMERS = gql`
  query GetCustomers($query: CustomerFilterInput) {
    customers(query: $query) {
      id
      type
      status
      firstName
      lastName
      displayName
      companyName
      email
      phone
      alternatePhone
      website
      addressLine1
      addressLine2
      city
      state
      postalCode
      country
      taxId
      creditLimit
      paymentTerms
      discountPercentage
      loyaltyTier
      loyaltyPoints
      totalSpent
      totalOrders
      averageOrderValue
      lastPurchaseDate
      churnRisk
      marketingOptIn
      emailOptIn
      smsOptIn
      tags
      notes
      referralCode
      dateOfBirth
      anniversary
      customFields
      preferences
      socialProfiles
      createdAt
      updatedAt
    }
  }
`;

export const GET_CUSTOMER = gql`
  query GetCustomer($id: ID!) {
    customer(id: $id) {
      id
      type
      status
      firstName
      lastName
      displayName
      companyName
      email
      phone
      alternatePhone
      website
      addressLine1
      addressLine2
      city
      state
      postalCode
      country
      taxId
      creditLimit
      paymentTerms
      discountPercentage
      loyaltyTier
      loyaltyPoints
      totalSpent
      totalOrders
      averageOrderValue
      lastPurchaseDate
      churnRisk
      marketingOptIn
      emailOptIn
      smsOptIn
      tags
      notes
      referralCode
      dateOfBirth
      anniversary
      customFields
      preferences
      socialProfiles
      createdAt
      updatedAt
    }
  }
`;

export const GET_CUSTOMER_BY_EMAIL = gql`
  query GetCustomerByEmail($email: String!) {
    customerByEmail(email: $email) {
      id
      type
      status
      firstName
      lastName
      displayName
      companyName
      email
      phone
      alternatePhone
      website
      addressLine1
      addressLine2
      city
      state
      postalCode
      country
      taxId
      creditLimit
      paymentTerms
      discountPercentage
      loyaltyTier
      loyaltyPoints
      totalSpent
      totalOrders
      averageOrderValue
      lastPurchaseDate
      churnRisk
      marketingOptIn
      emailOptIn
      smsOptIn
      tags
      notes
      referralCode
      dateOfBirth
      anniversary
      customFields
      preferences
      socialProfiles
      createdAt
      updatedAt
    }
  }
`;

export const GET_CUSTOMER_BY_PHONE = gql`
  query GetCustomerByPhone($phone: String!) {
    customerByPhone(phone: $phone) {
      id
      type
      status
      firstName
      lastName
      displayName
      companyName
      email
      phone
      alternatePhone
      website
      addressLine1
      addressLine2
      city
      state
      postalCode
      country
      taxId
      creditLimit
      paymentTerms
      discountPercentage
      loyaltyTier
      loyaltyPoints
      totalSpent
      totalOrders
      averageOrderValue
      lastPurchaseDate
      churnRisk
      marketingOptIn
      emailOptIn
      smsOptIn
      tags
      notes
      referralCode
      dateOfBirth
      anniversary
      customFields
      preferences
      socialProfiles
      createdAt
      updatedAt
    }
  }
`;

// Loyalty Queries
export const GET_LOYALTY_TRANSACTIONS = gql`
  query GetLoyaltyTransactions($query: LoyaltyTransactionFilterInput) {
    loyaltyTransactions(query: $query) {
      id
      customerId
      type
      points
      description
      relatedTransactionId
      expiresAt
      campaignId
      promotionId
      metadata
      createdAt
      updatedAt
    }
  }
`;

// Campaign Queries
export const GET_CAMPAIGNS = gql`
  query GetCampaigns($filter: CampaignFilterInput) {
    campaigns(filter: $filter) {
      id
      name
      description
      type
      status
      startDate
      endDate
      pointsMultiplier
      minimumPurchaseAmount
      targetSegments
      targetTiers
      applicableCategories
      applicableProducts
      maxPointsPerCustomer
      totalPointsBudget
      termsAndConditions
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const GET_CAMPAIGN = gql`
  query GetCampaign($id: ID!) {
    campaign(id: $id) {
      id
      name
      description
      type
      status
      startDate
      endDate
      pointsMultiplier
      minimumPurchaseAmount
      targetSegments
      targetTiers
      applicableCategories
      applicableProducts
      maxPointsPerCustomer
      totalPointsBudget
      termsAndConditions
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const GET_ACTIVE_CAMPAIGNS_FOR_CUSTOMER = gql`
  query GetActiveCampaignsForCustomer(
    $customerId: ID!
    $customerTier: String
    $customerSegments: [ID!]
  ) {
    activeCampaignsForCustomer(
      customerId: $customerId
      customerTier: $customerTier
      customerSegments: $customerSegments
    ) {
      id
      name
      description
      type
      status
      startDate
      endDate
      pointsMultiplier
      minimumPurchaseAmount
      targetSegments
      targetTiers
      applicableCategories
      applicableProducts
      maxPointsPerCustomer
      totalPointsBudget
      termsAndConditions
      metadata
      createdAt
      updatedAt
    }
  }
`;

export const GET_CAMPAIGN_PERFORMANCE = gql`
  query GetCampaignPerformance($id: ID!) {
    campaignPerformance(id: $id) {
      campaignId
      totalParticipants
      totalPointsAwarded
      totalRedemptions
      conversionRate
      averagePointsPerParticipant
      totalRevenue
      roi
      engagementMetrics
      performanceBySegment
      performanceByTier
      dailyMetrics
      createdAt
      updatedAt
    }
  }
`;

// B2B Customer Queries
export const GET_B2B_CUSTOMER = gql`
  query GetB2BCustomer($id: ID!) {
    b2bCustomer(id: $id) {
      id
      companyName
      industry
      companySize
      annualRevenue
      website
      taxId
      creditLimit
      availableCredit
      outstandingBalance
      paymentTerms
      creditStatus
      salesRepId
      accountManagerId
      contractStartDate
      contractEndDate
      contractExpiringSoon
      daysUntilContractExpiry
      billingAddressLine1
      billingAddressLine2
      billingCity
      billingState
      billingPostalCode
      billingCountry
      shippingAddressLine1
      shippingAddressLine2
      shippingCity
      shippingState
      shippingPostalCode
      shippingCountry
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      secondaryContactName
      secondaryContactEmail
      secondaryContactPhone
      customFields
      createdAt
      updatedAt
      pricingRules {
        id
        productId
        categoryId
        discountType
        discountValue
        minimumQuantity
        validFrom
        validTo
        isActive
      }
      creditHistory {
        id
        previousLimit
        newLimit
        reason
        changedBy
        changedAt
      }
    }
  }
`;

export const GET_B2B_CUSTOMERS = gql`
  query GetB2BCustomers($filter: B2BCustomerFilterInput) {
    b2bCustomers(filter: $filter) {
      id
      companyName
      industry
      companySize
      annualRevenue
      website
      taxId
      creditLimit
      availableCredit
      outstandingBalance
      paymentTerms
      creditStatus
      salesRepId
      accountManagerId
      contractStartDate
      contractEndDate
      contractExpiringSoon
      daysUntilContractExpiry
      billingAddressLine1
      billingAddressLine2
      billingCity
      billingState
      billingPostalCode
      billingCountry
      shippingAddressLine1
      shippingAddressLine2
      shippingCity
      shippingState
      shippingPostalCode
      shippingCountry
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      secondaryContactName
      secondaryContactEmail
      secondaryContactPhone
      customFields
      createdAt
      updatedAt
    }
  }
`;

export const GET_B2B_CUSTOMERS_BY_INDUSTRY = gql`
  query GetB2BCustomersByIndustry($industry: String!) {
    b2bCustomersByIndustry(industry: $industry) {
      id
      companyName
      industry
      companySize
      annualRevenue
      website
      taxId
      creditLimit
      availableCredit
      outstandingBalance
      paymentTerms
      creditStatus
      salesRepId
      accountManagerId
      contractStartDate
      contractEndDate
      contractExpiringSoon
      daysUntilContractExpiry
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      createdAt
      updatedAt
    }
  }
`;

export const GET_B2B_CUSTOMERS_BY_SALES_REP = gql`
  query GetB2BCustomersBySalesRep($salesRepId: ID!) {
    b2bCustomersBySalesRep(salesRepId: $salesRepId) {
      id
      companyName
      industry
      companySize
      annualRevenue
      website
      taxId
      creditLimit
      availableCredit
      outstandingBalance
      paymentTerms
      creditStatus
      salesRepId
      accountManagerId
      contractStartDate
      contractEndDate
      contractExpiringSoon
      daysUntilContractExpiry
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      createdAt
      updatedAt
    }
  }
`;

export const GET_B2B_CUSTOMERS_WITH_EXPIRING_CONTRACTS = gql`
  query GetB2BCustomersWithExpiringContracts($days: Int = 30) {
    b2bCustomersWithExpiringContracts(days: $days) {
      id
      companyName
      industry
      companySize
      annualRevenue
      website
      taxId
      creditLimit
      availableCredit
      outstandingBalance
      paymentTerms
      creditStatus
      salesRepId
      accountManagerId
      contractStartDate
      contractEndDate
      contractExpiringSoon
      daysUntilContractExpiry
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      createdAt
      updatedAt
    }
  }
`;

export const GET_B2B_CUSTOMER_METRICS = gql`
  query GetB2BCustomerMetrics {
    b2bCustomerMetrics {
      totalCustomers
      totalRevenue
      averageContractValue
      averageCreditLimit
      totalOutstandingBalance
      contractsExpiringThisMonth
      contractsExpiringNextMonth
      customersByIndustry
      customersByCreditStatus
      topCustomersByRevenue
      revenueGrowthRate
      customerRetentionRate
      averagePaymentTerms
    }
  }
`;

// Communication Queries
export const GET_COMMUNICATIONS = gql`
  query GetCommunications(
    $customerId: ID
    $employeeId: ID
    $type: String
    $startDate: DateTime
    $endDate: DateTime
  ) {
    getCommunications(
      customerId: $customerId
      employeeId: $employeeId
      type: $type
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      customerId
      employeeId
      type
      direction
      subject
      content
      status
      scheduledAt
      completedAt
      metadata
      createdAt
      updatedAt
      customer {
        id
        firstName
        lastName
        displayName
        email
        phone
      }
      employee {
        id
        name
      }
    }
  }
`;

export const GET_COMMUNICATION_TIMELINE = gql`
  query GetCommunicationTimeline($customerId: ID!, $limit: Int = 50) {
    getCommunicationTimeline(customerId: $customerId, limit: $limit) {
      id
      customerId
      employeeId
      type
      direction
      subject
      content
      status
      scheduledAt
      completedAt
      metadata
      createdAt
      updatedAt
      customer {
        id
        firstName
        lastName
        displayName
        email
        phone
      }
      employee {
        id
        name
      }
    }
  }
`;

// Customer Analytics Queries
export const GET_CUSTOMER_LIFETIME_VALUE = gql`
  query GetCustomerLifetimeValue($customerId: ID!) {
    customerLifetimeValue(customerId: $customerId) {
      customerId
      currentValue
      predictedValue
      totalRevenue
      totalOrders
      averageOrderValue
      customerLifespan
      churnProbability
      segmentValue
      calculatedAt
      purchasePattern {
        customerId
        averageOrderValue
        purchaseFrequency
        seasonalTrends
        preferredCategories
        preferredProducts
        peakPurchaseTimes
        averageDaysBetweenOrders
        lastPurchaseDate
        predictedNextPurchase
        calculatedAt
      }
      churnRisk {
        customerId
        riskScore
        riskLevel
        factors
        recommendations
        lastActivityDate
        daysSinceLastPurchase
        engagementScore
        calculatedAt
      }
    }
  }
`;

export const GET_CUSTOMERS_LIFETIME_VALUE = gql`
  query GetCustomersLifetimeValue($customerIds: [ID!]!) {
    customersLifetimeValue(customerIds: $customerIds) {
      customerId
      currentValue
      predictedValue
      totalRevenue
      totalOrders
      averageOrderValue
      customerLifespan
      churnProbability
      segmentValue
      calculatedAt
    }
  }
`;

export const GET_SEGMENT_ANALYTICS = gql`
  query GetSegmentAnalytics($segmentId: ID!) {
    segmentAnalytics(segmentId: $segmentId) {
      segmentId
      segmentName
      totalCustomers
      totalRevenue
      averageOrderValue
      averageLifetimeValue
      churnRate
      engagementRate
      conversionRate
      topProducts
      revenueGrowth
      customerGrowth
      seasonalTrends
      calculatedAt
    }
  }
`;

export const GET_ALL_SEGMENTS_ANALYTICS = gql`
  query GetAllSegmentsAnalytics {
    allSegmentsAnalytics {
      segmentId
      segmentName
      totalCustomers
      totalRevenue
      averageOrderValue
      averageLifetimeValue
      churnRate
      engagementRate
      conversionRate
      topProducts
      revenueGrowth
      customerGrowth
      seasonalTrends
      calculatedAt
    }
  }
`;

export const GET_CUSTOMER_PURCHASE_PATTERNS = gql`
  query GetCustomerPurchasePatterns($customerId: ID!) {
    customerPurchasePatterns(customerId: $customerId) {
      customerId
      averageOrderValue
      purchaseFrequency
      seasonalTrends
      preferredCategories
      preferredProducts
      peakPurchaseTimes
      averageDaysBetweenOrders
      lastPurchaseDate
      predictedNextPurchase
      calculatedAt
    }
  }
`;

export const GET_CUSTOMERS_PURCHASE_PATTERNS = gql`
  query GetCustomersPurchasePatterns($customerIds: [ID!]!) {
    customersPurchasePatterns(customerIds: $customerIds) {
      customerId
      averageOrderValue
      purchaseFrequency
      seasonalTrends
      preferredCategories
      preferredProducts
      peakPurchaseTimes
      averageDaysBetweenOrders
      lastPurchaseDate
      predictedNextPurchase
      calculatedAt
    }
  }
`;

export const GET_CUSTOMER_CHURN_RISK = gql`
  query GetCustomerChurnRisk($customerId: ID!) {
    customerChurnRisk(customerId: $customerId) {
      customerId
      riskScore
      riskLevel
      factors
      recommendations
      lastActivityDate
      daysSinceLastPurchase
      engagementScore
      calculatedAt
    }
  }
`;

export const GET_CUSTOMERS_CHURN_RISK = gql`
  query GetCustomersChurnRisk($customerIds: [ID!]!) {
    customersChurnRisk(customerIds: $customerIds) {
      customerId
      riskScore
      riskLevel
      factors
      recommendations
      lastActivityDate
      daysSinceLastPurchase
      engagementScore
      calculatedAt
    }
  }
`;

export const GET_HIGH_CHURN_RISK_CUSTOMERS = gql`
  query GetHighChurnRiskCustomers($threshold: Float = 0.7, $limit: Int = 50) {
    highChurnRiskCustomers(threshold: $threshold, limit: $limit) {
      customerId
      riskScore
      riskLevel
      factors
      recommendations
      lastActivityDate
      daysSinceLastPurchase
      engagementScore
      calculatedAt
    }
  }
`;

export const GET_CUSTOMER_METRICS = gql`
  query GetCustomerMetrics {
    customerMetrics {
      totalCustomers
      activeCustomers
      newCustomersThisMonth
      newCustomersLastMonth
      customerGrowthRate
      averageLifetimeValue
      averageOrderValue
      totalRevenue
      churnRate
      retentionRate
      engagementRate
      loyaltyProgramParticipation
      topCustomerSegments
      customersByTier
      customersByStatus
      revenueBySegment
      monthlyActiveCustomers
      customerAcquisitionCost
      customerSatisfactionScore
    }
  }
`;

// Segmentation Queries
export const GET_SEGMENT = gql`
  query GetSegment($id: ID!) {
    segment(id: $id) {
      id
      name
      description
      criteria
      isActive
      customerCount
      lastCalculated
      createdAt
      updatedAt
    }
  }
`;

export const GET_SEGMENTS = gql`
  query GetSegments($isActive: Boolean) {
    segments(isActive: $isActive) {
      id
      name
      description
      criteria
      isActive
      customerCount
      lastCalculated
      createdAt
      updatedAt
    }
  }
`;

export const GET_SEGMENT_MEMBERS = gql`
  query GetSegmentMembers($segmentId: ID!, $limit: Int = 100) {
    getSegmentMembers(segmentId: $segmentId, limit: $limit) {
      customerId
      segmentId
      addedAt
      customer {
        id
        firstName
        lastName
        displayName
        email
        phone
        totalSpent
        totalOrders
        loyaltyTier
        status
      }
    }
  }
`;

export const EVALUATE_SEGMENT_MEMBERSHIP = gql`
  query EvaluateSegmentMembership($segmentId: ID!, $customerId: ID!) {
    evaluateSegmentMembership(segmentId: $segmentId, customerId: $customerId)
  }
`;