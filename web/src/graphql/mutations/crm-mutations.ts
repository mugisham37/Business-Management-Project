import { gql } from '@apollo/client';

// Customer Mutations
export const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($input: CreateCustomerInput!) {
    createCustomer(input: $input) {
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

export const UPDATE_CUSTOMER = gql`
  mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
    updateCustomer(id: $id, input: $input) {
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

export const DELETE_CUSTOMER = gql`
  mutation DeleteCustomer($id: ID!) {
    deleteCustomer(id: $id)
  }
`;

export const UPDATE_CUSTOMER_PURCHASE_STATS = gql`
  mutation UpdateCustomerPurchaseStats(
    $id: ID!
    $orderValue: Int!
    $orderDate: DateTime
  ) {
    updateCustomerPurchaseStats(
      id: $id
      orderValue: $orderValue
      orderDate: $orderDate
    )
  }
`;

export const UPDATE_CUSTOMER_LOYALTY_POINTS = gql`
  mutation UpdateCustomerLoyaltyPoints(
    $id: ID!
    $pointsChange: Int!
    $reason: String!
  ) {
    updateCustomerLoyaltyPoints(
      id: $id
      pointsChange: $pointsChange
      reason: $reason
    )
  }
`;

// Loyalty Mutations
export const AWARD_LOYALTY_POINTS = gql`
  mutation AwardLoyaltyPoints(
    $customerId: ID!
    $points: Int!
    $reason: String!
    $relatedTransactionId: ID
    $campaignId: ID
  ) {
    awardLoyaltyPoints(
      customerId: $customerId
      points: $points
      reason: $reason
      relatedTransactionId: $relatedTransactionId
      campaignId: $campaignId
    ) {
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

export const REDEEM_LOYALTY_POINTS = gql`
  mutation RedeemLoyaltyPoints(
    $customerId: ID!
    $points: Int!
    $reason: String!
    $relatedTransactionId: ID
  ) {
    redeemLoyaltyPoints(
      customerId: $customerId
      points: $points
      reason: $reason
      relatedTransactionId: $relatedTransactionId
    ) {
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

export const ADJUST_LOYALTY_POINTS = gql`
  mutation AdjustLoyaltyPoints(
    $customerId: ID!
    $pointsChange: Int!
    $reason: String!
  ) {
    adjustLoyaltyPoints(
      customerId: $customerId
      pointsChange: $pointsChange
      reason: $reason
    ) {
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

export const CREATE_LOYALTY_REWARD = gql`
  mutation CreateLoyaltyReward($input: CreateRewardInput!) {
    createLoyaltyReward(input: $input)
  }
`;

export const CREATE_LOYALTY_CAMPAIGN = gql`
  mutation CreateLoyaltyCampaign($input: CreateCampaignInput!) {
    createLoyaltyCampaign(input: $input)
  }
`;

// Campaign Mutations
export const CREATE_CAMPAIGN = gql`
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
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

export const UPDATE_CAMPAIGN = gql`
  mutation UpdateCampaign($id: ID!, $input: UpdateCampaignInput!) {
    updateCampaign(id: $id, input: $input) {
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

export const DELETE_CAMPAIGN = gql`
  mutation DeleteCampaign($id: ID!) {
    deleteCampaign(id: $id)
  }
`;

export const ACTIVATE_CAMPAIGN = gql`
  mutation ActivateCampaign($id: ID!) {
    activateCampaign(id: $id) {
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

export const PAUSE_CAMPAIGN = gql`
  mutation PauseCampaign($id: ID!) {
    pauseCampaign(id: $id) {
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

// B2B Customer Mutations
export const CREATE_B2B_CUSTOMER = gql`
  mutation CreateB2BCustomer($input: CreateB2BCustomerInput!) {
    createB2BCustomer(input: $input) {
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

export const UPDATE_B2B_CUSTOMER = gql`
  mutation UpdateB2BCustomer($id: ID!, $input: UpdateB2BCustomerInput!) {
    updateB2BCustomer(id: $id, input: $input) {
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

export const UPDATE_B2B_CUSTOMER_CREDIT_LIMIT = gql`
  mutation UpdateB2BCustomerCreditLimit(
    $id: ID!
    $creditLimit: Float!
    $reason: String!
  ) {
    updateB2BCustomerCreditLimit(
      id: $id
      creditLimit: $creditLimit
      reason: $reason
    )
  }
`;

export const UPDATE_B2B_CUSTOMER_CREDIT_STATUS = gql`
  mutation UpdateB2BCustomerCreditStatus(
    $id: ID!
    $status: String!
    $reason: String!
  ) {
    updateB2BCustomerCreditStatus(
      id: $id
      status: $status
      reason: $reason
    )
  }
`;

// Communication Mutations
export const RECORD_COMMUNICATION = gql`
  mutation RecordCommunication($input: CreateCommunicationInput!) {
    recordCommunication(input: $input) {
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

export const SCHEDULE_COMMUNICATION = gql`
  mutation ScheduleCommunication($input: ScheduleCommunicationInput!) {
    scheduleCommunication(input: $input) {
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

// Segmentation Mutations
export const CREATE_SEGMENT = gql`
  mutation CreateSegment($input: CreateSegmentInput!) {
    createSegment(input: $input) {
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

export const UPDATE_SEGMENT = gql`
  mutation UpdateSegment($id: ID!, $input: UpdateSegmentInput!) {
    updateSegment(id: $id, input: $input) {
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

export const DELETE_SEGMENT = gql`
  mutation DeleteSegment($id: ID!) {
    deleteSegment(id: $id)
  }
`;

export const RECALCULATE_SEGMENT = gql`
  mutation RecalculateSegment($id: ID!) {
    recalculateSegment(id: $id) {
      jobId
      status
      createdAt
    }
  }
`;