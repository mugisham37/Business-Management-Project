import { gql } from '@apollo/client';
import { 
  B2B_ORDER_FRAGMENT, 
  QUOTE_FRAGMENT, 
  CONTRACT_FRAGMENT, 
  PRICING_RULE_FRAGMENT,
  TERRITORY_FRAGMENT,
  WORKFLOW_FRAGMENT,
  APPROVAL_STEP_FRAGMENT
} from '../queries/b2b-queries';

// ===== B2B ORDER MUTATIONS =====

export const CREATE_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  mutation CreateB2BOrder($input: CreateB2BOrderInput!) {
    createB2BOrder(input: $input) {
      ...B2BOrderFragment
    }
  }
`;

export const UPDATE_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  mutation UpdateB2BOrder($id: ID!, $input: UpdateB2BOrderInput!) {
    updateB2BOrder(id: $id, input: $input) {
      ...B2BOrderFragment
    }
  }
`;

export const APPROVE_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  mutation ApproveB2BOrder($id: ID!, $input: ApproveOrderInput!) {
    approveB2BOrder(id: $id, input: $input) {
      order {
        ...B2BOrderFragment
      }
      message
    }
  }
`;

export const REJECT_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  mutation RejectB2BOrder($id: ID!, $input: RejectOrderInput!) {
    rejectB2BOrder(id: $id, input: $input) {
      order {
        ...B2BOrderFragment
      }
      message
    }
  }
`;

export const SHIP_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  mutation ShipB2BOrder($id: ID!, $input: ShipOrderInput!) {
    shipB2BOrder(id: $id, input: $input) {
      order {
        ...B2BOrderFragment
      }
      message
      trackingNumber
      estimatedDeliveryDate
    }
  }
`;

export const CANCEL_B2B_ORDER = gql`
  ${B2B_ORDER_FRAGMENT}
  mutation CancelB2BOrder($id: ID!, $cancellationReason: String!) {
    cancelB2BOrder(id: $id, cancellationReason: $cancellationReason) {
      ...B2BOrderFragment
    }
  }
`;

// ===== QUOTE MUTATIONS =====

export const CREATE_QUOTE = gql`
  ${QUOTE_FRAGMENT}
  mutation CreateQuote($input: CreateQuoteInput!) {
    createQuote(input: $input) {
      ...QuoteFragment
    }
  }
`;

export const UPDATE_QUOTE = gql`
  ${QUOTE_FRAGMENT}
  mutation UpdateQuote($id: ID!, $input: UpdateQuoteInput!) {
    updateQuote(id: $id, input: $input) {
      ...QuoteFragment
    }
  }
`;

export const APPROVE_QUOTE = gql`
  ${QUOTE_FRAGMENT}
  mutation ApproveQuote($id: ID!, $input: ApproveQuoteInput!) {
    approveQuote(id: $id, input: $input) {
      quote {
        ...QuoteFragment
      }
      message
    }
  }
`;

export const REJECT_QUOTE = gql`
  ${QUOTE_FRAGMENT}
  mutation RejectQuote($id: ID!, $input: RejectQuoteInput!) {
    rejectQuote(id: $id, input: $input) {
      quote {
        ...QuoteFragment
      }
      message
    }
  }
`;

export const SEND_QUOTE = gql`
  ${QUOTE_FRAGMENT}
  mutation SendQuote($id: ID!, $input: SendQuoteInput!) {
    sendQuote(id: $id, input: $input) {
      quote {
        ...QuoteFragment
      }
      message
      sentTo
    }
  }
`;

export const CONVERT_QUOTE_TO_ORDER = gql`
  ${QUOTE_FRAGMENT}
  ${B2B_ORDER_FRAGMENT}
  mutation ConvertQuoteToOrder($id: ID!) {
    convertQuoteToOrder(id: $id) {
      quote {
        ...QuoteFragment
      }
      order {
        ...B2BOrderFragment
      }
      message
    }
  }
`;

// ===== CONTRACT MUTATIONS =====

export const CREATE_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  mutation CreateContract($input: CreateContractInput!) {
    createContract(input: $input) {
      ...ContractFragment
    }
  }
`;

export const UPDATE_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  mutation UpdateContract($id: ID!, $input: UpdateContractInput!) {
    updateContract(id: $id, input: $input) {
      ...ContractFragment
    }
  }
`;

export const APPROVE_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  mutation ApproveContract($id: ID!, $input: ApproveContractInput!) {
    approveContract(id: $id, input: $input) {
      contract {
        ...ContractFragment
      }
      message
    }
  }
`;

export const SIGN_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  mutation SignContract($id: ID!, $input: SignContractInput!) {
    signContract(id: $id, input: $input) {
      ...ContractFragment
    }
  }
`;

export const RENEW_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  mutation RenewContract($id: ID!, $input: RenewContractInput!) {
    renewContract(id: $id, input: $input) {
      contract {
        ...ContractFragment
      }
      message
    }
  }
`;

export const TERMINATE_CONTRACT = gql`
  ${CONTRACT_FRAGMENT}
  mutation TerminateContract(
    $id: ID!
    $terminationReason: String!
    $terminationDate: DateTime
  ) {
    terminateContract(
      id: $id
      terminationReason: $terminationReason
      terminationDate: $terminationDate
    ) {
      ...ContractFragment
    }
  }
`;

// ===== PRICING MUTATIONS =====

export const CREATE_PRICING_RULE = gql`
  ${PRICING_RULE_FRAGMENT}
  mutation CreatePricingRule($input: CreatePricingRuleInput!) {
    createPricingRule(input: $input) {
      rule {
        ...PricingRuleFragment
      }
      message
    }
  }
`;

export const UPDATE_PRICING_RULE = gql`
  ${PRICING_RULE_FRAGMENT}
  mutation UpdatePricingRule($id: ID!, $input: UpdatePricingRuleInput!) {
    updatePricingRule(id: $id, input: $input) {
      rule {
        ...PricingRuleFragment
      }
      message
    }
  }
`;

export const DELETE_PRICING_RULE = gql`
  mutation DeletePricingRule($id: ID!) {
    deletePricingRule(id: $id)
  }
`;

export const SET_PRICING_RULE_ACTIVE = gql`
  ${PRICING_RULE_FRAGMENT}
  mutation SetPricingRuleActive($id: ID!, $isActive: Boolean!) {
    setPricingRuleActive(id: $id, isActive: $isActive) {
      rule {
        ...PricingRuleFragment
      }
      message
    }
  }
`;

// ===== TERRITORY MUTATIONS =====

export const CREATE_TERRITORY = gql`
  ${TERRITORY_FRAGMENT}
  mutation CreateTerritory($input: CreateTerritoryInput!) {
    createTerritory(input: $input) {
      ...TerritoryFragment
    }
  }
`;

export const UPDATE_TERRITORY = gql`
  ${TERRITORY_FRAGMENT}
  mutation UpdateTerritory($id: ID!, $input: UpdateTerritoryInput!) {
    updateTerritory(id: $id, input: $input) {
      ...TerritoryFragment
    }
  }
`;

export const ASSIGN_CUSTOMER_TO_TERRITORY = gql`
  mutation AssignCustomerToTerritory(
    $territoryId: ID!
    $input: AssignCustomerToTerritoryInput!
  ) {
    assignCustomerToTerritory(territoryId: $territoryId, input: $input) {
      assignment {
        id
        territoryId
        customerId
        assignedBy
        assignedAt
        isActive
        notes
      }
      message
    }
  }
`;

export const BULK_ASSIGN_CUSTOMERS_TO_TERRITORY = gql`
  mutation BulkAssignCustomersToTerritory(
    $territoryId: ID!
    $input: BulkAssignCustomersInput!
  ) {
    bulkAssignCustomersToTerritory(territoryId: $territoryId, input: $input) {
      assignments {
        id
        territoryId
        customerId
        assignedBy
        assignedAt
        isActive
        notes
      }
      count
    }
  }
`;

export const SET_TERRITORY_ACTIVE = gql`
  ${TERRITORY_FRAGMENT}
  mutation SetTerritoryActive($id: ID!, $isActive: Boolean!) {
    setTerritoryActive(id: $id, isActive: $isActive) {
      ...TerritoryFragment
    }
  }
`;

// ===== WORKFLOW MUTATIONS =====

export const APPROVE_STEP = gql`
  ${APPROVAL_STEP_FRAGMENT}
  ${WORKFLOW_FRAGMENT}
  mutation ApproveStep(
    $workflowId: ID!
    $stepId: ID!
    $input: ApprovalStepInput!
  ) {
    approveStep(workflowId: $workflowId, stepId: $stepId, input: $input) {
      step {
        ...ApprovalStepFragment
      }
      workflow {
        ...WorkflowFragment
      }
      message
    }
  }
`;

export const REJECT_STEP = gql`
  ${APPROVAL_STEP_FRAGMENT}
  ${WORKFLOW_FRAGMENT}
  mutation RejectStep(
    $workflowId: ID!
    $stepId: ID!
    $rejectionReason: String!
    $input: ApprovalStepInput
  ) {
    rejectStep(
      workflowId: $workflowId
      stepId: $stepId
      rejectionReason: $rejectionReason
      input: $input
    ) {
      step {
        ...ApprovalStepFragment
      }
      workflow {
        ...WorkflowFragment
      }
      message
    }
  }
`;

export const REASSIGN_APPROVAL = gql`
  ${APPROVAL_STEP_FRAGMENT}
  ${WORKFLOW_FRAGMENT}
  mutation ReassignApproval(
    $workflowId: ID!
    $stepId: ID!
    $input: ReassignApprovalInput!
  ) {
    reassignApproval(workflowId: $workflowId, stepId: $stepId, input: $input) {
      step {
        ...ApprovalStepFragment
      }
      workflow {
        ...WorkflowFragment
      }
      message
    }
  }
`;