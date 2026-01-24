import { gql } from '@apollo/client';
import { 
  B2B_ORDER_FRAGMENT, 
  QUOTE_FRAGMENT, 
  CONTRACT_FRAGMENT, 
  PRICING_RULE_FRAGMENT,
  WORKFLOW_FRAGMENT,
  APPROVAL_STEP_FRAGMENT
} from '../queries/b2b-queries';

// ===== B2B ORDER SUBSCRIPTIONS =====

export const B2B_ORDER_CREATED_SUBSCRIPTION = gql`
  ${B2B_ORDER_FRAGMENT}
  subscription B2BOrderCreated {
    b2bOrderCreated {
      tenantId
      order {
        ...B2BOrderFragment
      }
      createdBy
    }
  }
`;

export const B2B_ORDER_STATUS_CHANGED_SUBSCRIPTION = gql`
  ${B2B_ORDER_FRAGMENT}
  subscription B2BOrderStatusChanged($orderId: ID) {
    b2bOrderStatusChanged(orderId: $orderId) {
      tenantId
      order {
        ...B2BOrderFragment
      }
      updatedBy
      previousStatus
      newStatus
    }
  }
`;

export const B2B_ORDER_APPROVED_SUBSCRIPTION = gql`
  ${B2B_ORDER_FRAGMENT}
  subscription B2BOrderApproved {
    b2bOrderApproved {
      tenantId
      order {
        ...B2BOrderFragment
      }
      approvedBy
      approvedAt
    }
  }
`;

export const B2B_ORDER_SHIPPED_SUBSCRIPTION = gql`
  ${B2B_ORDER_FRAGMENT}
  subscription B2BOrderShipped {
    b2bOrderShipped {
      tenantId
      order {
        ...B2BOrderFragment
      }
      shippedBy
      shippedAt
      trackingNumber
    }
  }
`;

// ===== QUOTE SUBSCRIPTIONS =====

export const QUOTE_CREATED_SUBSCRIPTION = gql`
  ${QUOTE_FRAGMENT}
  subscription QuoteCreated {
    quoteCreated {
      tenantId
      quote {
        ...QuoteFragment
      }
      createdBy
    }
  }
`;

export const QUOTE_STATUS_CHANGED_SUBSCRIPTION = gql`
  ${QUOTE_FRAGMENT}
  subscription QuoteStatusChanged($quoteId: ID) {
    quoteStatusChanged(quoteId: $quoteId) {
      tenantId
      quote {
        ...QuoteFragment
      }
      updatedBy
      previousStatus
      newStatus
    }
  }
`;

export const QUOTE_SENT_SUBSCRIPTION = gql`
  ${QUOTE_FRAGMENT}
  subscription QuoteSent {
    quoteSent {
      tenantId
      quote {
        ...QuoteFragment
      }
      sentBy
      sentAt
      recipients
    }
  }
`;

export const QUOTE_CONVERTED_SUBSCRIPTION = gql`
  ${QUOTE_FRAGMENT}
  ${B2B_ORDER_FRAGMENT}
  subscription QuoteConverted {
    quoteConverted {
      tenantId
      quote {
        ...QuoteFragment
      }
      order {
        ...B2BOrderFragment
      }
      convertedBy
      convertedAt
    }
  }
`;

// ===== CONTRACT SUBSCRIPTIONS =====

export const CONTRACT_EXPIRING_SUBSCRIPTION = gql`
  ${CONTRACT_FRAGMENT}
  subscription ContractExpiring {
    contractExpiring {
      tenantId
      contract {
        ...ContractFragment
      }
      daysUntilExpiration
      notificationSent
    }
  }
`;

export const CONTRACT_STATUS_CHANGED_SUBSCRIPTION = gql`
  ${CONTRACT_FRAGMENT}
  subscription ContractStatusChanged($contractId: ID) {
    contractStatusChanged(contractId: $contractId) {
      tenantId
      contract {
        ...ContractFragment
      }
      updatedBy
      previousStatus
      newStatus
    }
  }
`;

export const CONTRACT_RENEWED_SUBSCRIPTION = gql`
  ${CONTRACT_FRAGMENT}
  subscription ContractRenewed {
    contractRenewed {
      tenantId
      contract {
        ...ContractFragment
      }
      renewedBy
      renewedAt
      previousEndDate
      newEndDate
    }
  }
`;

// ===== PRICING SUBSCRIPTIONS =====

export const PRICING_RULE_CREATED_SUBSCRIPTION = gql`
  ${PRICING_RULE_FRAGMENT}
  subscription PricingRuleCreated {
    pricingRuleCreated {
      tenantId
      rule {
        ...PricingRuleFragment
      }
      createdBy
    }
  }
`;

export const PRICING_RULE_UPDATED_SUBSCRIPTION = gql`
  ${PRICING_RULE_FRAGMENT}
  subscription PricingRuleUpdated($ruleId: ID) {
    pricingRuleUpdated(ruleId: $ruleId) {
      tenantId
      rule {
        ...PricingRuleFragment
      }
      updatedBy
    }
  }
`;

export const PRICING_CHANGED_SUBSCRIPTION = gql`
  subscription PricingChanged($customerId: ID, $productId: ID) {
    pricingChanged(customerId: $customerId, productId: $productId) {
      tenantId
      customerId
      productId
      oldPrice
      newPrice
      discountPercentage
      effectiveDate
      reason
    }
  }
`;

// ===== TERRITORY SUBSCRIPTIONS =====

export const TERRITORY_ASSIGNMENT_CHANGED_SUBSCRIPTION = gql`
  subscription TerritoryAssignmentChanged($territoryId: ID, $customerId: ID) {
    territoryAssignmentChanged(territoryId: $territoryId, customerId: $customerId) {
      tenantId
      territoryId
      customerId
      assignmentType
      assignedBy
      assignedAt
      previousTerritoryId
    }
  }
`;

export const TERRITORY_PERFORMANCE_UPDATED_SUBSCRIPTION = gql`
  subscription TerritoryPerformanceUpdated($territoryId: ID) {
    territoryPerformanceUpdated(territoryId: $territoryId) {
      tenantId
      territoryId
      metrics {
        totalRevenue
        customerCount
        orderCount
        targetAchievement
      }
      period {
        startDate
        endDate
      }
    }
  }
`;

// ===== WORKFLOW SUBSCRIPTIONS =====

export const WORKFLOW_STEP_APPROVED_SUBSCRIPTION = gql`
  ${WORKFLOW_FRAGMENT}
  ${APPROVAL_STEP_FRAGMENT}
  subscription WorkflowStepApproved {
    workflowStepApproved {
      tenantId
      workflowId
      stepId
      approvedBy
      approvedAt
      workflow {
        ...WorkflowFragment
      }
      step {
        ...ApprovalStepFragment
      }
    }
  }
`;

export const WORKFLOW_STEP_REJECTED_SUBSCRIPTION = gql`
  ${WORKFLOW_FRAGMENT}
  ${APPROVAL_STEP_FRAGMENT}
  subscription WorkflowStepRejected {
    workflowStepRejected {
      tenantId
      workflowId
      stepId
      rejectedBy
      rejectedAt
      rejectionReason
      workflow {
        ...WorkflowFragment
      }
      step {
        ...ApprovalStepFragment
      }
    }
  }
`;

export const WORKFLOW_STEP_REASSIGNED_SUBSCRIPTION = gql`
  ${WORKFLOW_FRAGMENT}
  ${APPROVAL_STEP_FRAGMENT}
  subscription WorkflowStepReassigned {
    workflowStepReassigned {
      tenantId
      workflowId
      stepId
      reassignedFrom
      reassignedTo
      reassignedAt
      reason
      workflow {
        ...WorkflowFragment
      }
      step {
        ...ApprovalStepFragment
      }
    }
  }
`;

export const NEW_PENDING_APPROVAL_SUBSCRIPTION = gql`
  ${APPROVAL_STEP_FRAGMENT}
  ${WORKFLOW_FRAGMENT}
  subscription NewPendingApproval($userId: ID) {
    newPendingApproval(userId: $userId) {
      tenantId
      approverId
      entityType
      entityId
      priority
      expiresAt
      step {
        ...ApprovalStepFragment
      }
      workflow {
        ...WorkflowFragment
      }
    }
  }
`;

// ===== CUSTOMER PORTAL SUBSCRIPTIONS =====

export const CUSTOMER_ORDER_STATUS_SUBSCRIPTION = gql`
  ${B2B_ORDER_FRAGMENT}
  subscription CustomerOrderStatus($customerId: ID!) {
    customerOrderStatus(customerId: $customerId) {
      tenantId
      customerId
      order {
        ...B2BOrderFragment
      }
      statusChange {
        previousStatus
        newStatus
        changedAt
        reason
      }
    }
  }
`;

export const CUSTOMER_QUOTE_UPDATE_SUBSCRIPTION = gql`
  ${QUOTE_FRAGMENT}
  subscription CustomerQuoteUpdate($customerId: ID!) {
    customerQuoteUpdate(customerId: $customerId) {
      tenantId
      customerId
      quote {
        ...QuoteFragment
      }
      updateType
      updatedAt
    }
  }
`;

export const CUSTOMER_CONTRACT_NOTIFICATION_SUBSCRIPTION = gql`
  ${CONTRACT_FRAGMENT}
  subscription CustomerContractNotification($customerId: ID!) {
    customerContractNotification(customerId: $customerId) {
      tenantId
      customerId
      contract {
        ...ContractFragment
      }
      notificationType
      message
      actionRequired
    }
  }
`;