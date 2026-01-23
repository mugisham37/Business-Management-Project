import { gql } from '@apollo/client';

// Campaign Subscriptions
export const CAMPAIGN_CREATED = gql`
  subscription CampaignCreated {
    campaignCreated {
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

export const CAMPAIGN_UPDATED = gql`
  subscription CampaignUpdated {
    campaignUpdated {
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

export const CAMPAIGN_ACTIVATED = gql`
  subscription CampaignActivated {
    campaignActivated {
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

// Communication Subscriptions
export const COMMUNICATION_SCHEDULED = gql`
  subscription CommunicationScheduled {
    communicationScheduled {
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