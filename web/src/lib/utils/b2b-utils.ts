/**
 * B2B Utility Functions
 * Comprehensive utilities for B2B operations including orders, quotes, contracts, pricing, territories, and workflows
 */

import { 
  B2BOrder, 
  B2BOrderStatus, 
  Quote, 
  QuoteStatus, 
  Contract, 
  ContractStatus,
  PricingRule,
  Territory,
  Workflow,
  WorkflowStatus,
  WorkflowPriority,
  ApprovalStep,
  ApprovalStepStatus
} from '@/types/crm';

// ===== B2B ORDER UTILITIES =====

export const b2bOrderUtils = {
  /**
   * Get order status color for UI display
   */
  getOrderStatusColor: (status: B2BOrderStatus): string => {
    const colors = {
      [B2BOrderStatus.DRAFT]: 'gray',
      [B2BOrderStatus.PENDING_APPROVAL]: 'yellow',
      [B2BOrderStatus.APPROVED]: 'green',
      [B2BOrderStatus.REJECTED]: 'red',
      [B2BOrderStatus.PROCESSING]: 'blue',
      [B2BOrderStatus.SHIPPED]: 'purple',
      [B2BOrderStatus.DELIVERED]: 'green',
      [B2BOrderStatus.CANCELLED]: 'red',
      [B2BOrderStatus.COMPLETED]: 'green',
    };
    return colors[status] || 'gray';
  },

  /**
   * Get order status label for display
   */
  getOrderStatusLabel: (status: B2BOrderStatus): string => {
    const labels = {
      [B2BOrderStatus.DRAFT]: 'Draft',
      [B2BOrderStatus.PENDING_APPROVAL]: 'Pending Approval',
      [B2BOrderStatus.APPROVED]: 'Approved',
      [B2BOrderStatus.REJECTED]: 'Rejected',
      [B2BOrderStatus.PROCESSING]: 'Processing',
      [B2BOrderStatus.SHIPPED]: 'Shipped',
      [B2BOrderStatus.DELIVERED]: 'Delivered',
      [B2BOrderStatus.CANCELLED]: 'Cancelled',
      [B2BOrderStatus.COMPLETED]: 'Completed',
    };
    return labels[status] || status;
  },

  /**
   * Check if order can be edited
   */
  canEditOrder: (order: B2BOrder): boolean => {
    return [B2BOrderStatus.DRAFT, B2BOrderStatus.PENDING_APPROVAL].includes(order.status);
  },

  /**
   * Check if order can be approved
   */
  canApproveOrder: (order: B2BOrder): boolean => {
    return order.status === B2BOrderStatus.PENDING_APPROVAL && order.requiresApproval;
  },

  /**
   * Check if order can be shipped
   */
  canShipOrder: (order: B2BOrder): boolean => {
    return [B2BOrderStatus.APPROVED, B2BOrderStatus.PROCESSING].includes(order.status);
  },

  /**
   * Calculate order fulfillment percentage
   */
  calculateFulfillmentPercentage: (order: B2BOrder): number => {
    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const shippedQuantity = order.items.reduce((sum, item) => sum + item.quantityShipped, 0);
    
    if (totalQuantity === 0) return 0;
    return Math.round((shippedQuantity / totalQuantity) * 100);
  },

  /**
   * Calculate total savings on order
   */
  calculateTotalSavings: (order: B2BOrder): number => {
    return order.items.reduce((sum, item) => sum + (item.discountAmount * item.quantity), 0);
  },

  /**
   * Format order number for display
   */
  formatOrderNumber: (orderNumber: string): string => {
    return orderNumber.toUpperCase();
  },

  /**
   * Get order priority based on amount and customer
   */
  getOrderPriority: (order: B2BOrder): 'low' | 'medium' | 'high' | 'urgent' => {
    if (order.totalAmount >= 100000) return 'urgent';
    if (order.totalAmount >= 50000) return 'high';
    if (order.totalAmount >= 10000) return 'medium';
    return 'low';
  },
};

// ===== QUOTE UTILITIES =====

export const quoteUtils = {
  /**
   * Get quote status color for UI display
   */
  getQuoteStatusColor: (status: QuoteStatus): string => {
    const colors = {
      [QuoteStatus.DRAFT]: 'gray',
      [QuoteStatus.PENDING_APPROVAL]: 'yellow',
      [QuoteStatus.APPROVED]: 'green',
      [QuoteStatus.REJECTED]: 'red',
      [QuoteStatus.SENT]: 'blue',
      [QuoteStatus.ACCEPTED]: 'green',
      [QuoteStatus.EXPIRED]: 'orange',
      [QuoteStatus.CONVERTED]: 'purple',
      [QuoteStatus.CANCELLED]: 'red',
    };
    return colors[status] || 'gray';
  },

  /**
   * Get quote status label for display
   */
  getQuoteStatusLabel: (status: QuoteStatus): string => {
    const labels = {
      [QuoteStatus.DRAFT]: 'Draft',
      [QuoteStatus.PENDING_APPROVAL]: 'Pending Approval',
      [QuoteStatus.APPROVED]: 'Approved',
      [QuoteStatus.REJECTED]: 'Rejected',
      [QuoteStatus.SENT]: 'Sent',
      [QuoteStatus.ACCEPTED]: 'Accepted',
      [QuoteStatus.EXPIRED]: 'Expired',
      [QuoteStatus.CONVERTED]: 'Converted',
      [QuoteStatus.CANCELLED]: 'Cancelled',
    };
    return labels[status] || status;
  },

  /**
   * Check if quote is expired
   */
  isQuoteExpired: (quote: Quote): boolean => {
    return new Date() > new Date(quote.expirationDate);
  },

  /**
   * Calculate days until quote expiration
   */
  getDaysUntilExpiration: (quote: Quote): number => {
    const now = new Date();
    const expiration = new Date(quote.expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if quote can be converted to order
   */
  canConvertToOrder: (quote: Quote): boolean => {
    return quote.status === QuoteStatus.ACCEPTED && !quoteUtils.isQuoteExpired(quote);
  },

  /**
   * Check if quote can be sent
   */
  canSendQuote: (quote: Quote): boolean => {
    return [QuoteStatus.APPROVED, QuoteStatus.DRAFT].includes(quote.status);
  },

  /**
   * Format quote number for display
   */
  formatQuoteNumber: (quoteNumber: string): string => {
    return quoteNumber.toUpperCase();
  },
};

// ===== CONTRACT UTILITIES =====

export const contractUtils = {
  /**
   * Get contract status color for UI display
   */
  getContractStatusColor: (status: ContractStatus): string => {
    const colors = {
      [ContractStatus.DRAFT]: 'gray',
      [ContractStatus.PENDING_APPROVAL]: 'yellow',
      [ContractStatus.APPROVED]: 'green',
      [ContractStatus.ACTIVE]: 'blue',
      [ContractStatus.EXPIRED]: 'orange',
      [ContractStatus.TERMINATED]: 'red',
      [ContractStatus.RENEWED]: 'purple',
    };
    return colors[status] || 'gray';
  },

  /**
   * Get contract status label for display
   */
  getContractStatusLabel: (status: ContractStatus): string => {
    const labels = {
      [ContractStatus.DRAFT]: 'Draft',
      [ContractStatus.PENDING_APPROVAL]: 'Pending Approval',
      [ContractStatus.APPROVED]: 'Approved',
      [ContractStatus.ACTIVE]: 'Active',
      [ContractStatus.EXPIRED]: 'Expired',
      [ContractStatus.TERMINATED]: 'Terminated',
      [ContractStatus.RENEWED]: 'Renewed',
    };
    return labels[status] || status;
  },

  /**
   * Check if contract is expired
   */
  isContractExpired: (contract: Contract): boolean => {
    return new Date() > new Date(contract.endDate);
  },

  /**
   * Calculate days until contract expiration
   */
  getDaysUntilExpiration: (contract: Contract): number => {
    const now = new Date();
    const expiration = new Date(contract.endDate);
    const diffTime = expiration.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Check if contract requires renewal notice
   */
  requiresRenewalNotice: (contract: Contract): boolean => {
    if (!contract.autoRenewal || !contract.renewalNoticeDays) return false;
    
    const daysUntilExpiration = contractUtils.getDaysUntilExpiration(contract);
    return daysUntilExpiration <= contract.renewalNoticeDays;
  },

  /**
   * Check if contract can be renewed
   */
  canRenewContract: (contract: Contract): boolean => {
    return [ContractStatus.ACTIVE, ContractStatus.EXPIRED].includes(contract.status);
  },

  /**
   * Format contract number for display
   */
  formatContractNumber: (contractNumber: string): string => {
    return contractNumber.toUpperCase();
  },

  /**
   * Calculate contract duration in months
   */
  getContractDurationMonths: (contract: Contract): number => {
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
  },
};

// ===== PRICING UTILITIES =====

export const pricingUtils = {
  /**
   * Calculate discount amount from percentage
   */
  calculateDiscountAmount: (listPrice: number, discountPercentage: number): number => {
    return (listPrice * discountPercentage) / 100;
  },

  /**
   * Calculate customer price after discount
   */
  calculateCustomerPrice: (listPrice: number, discountPercentage: number): number => {
    const discountAmount = pricingUtils.calculateDiscountAmount(listPrice, discountPercentage);
    return listPrice - discountAmount;
  },

  /**
   * Calculate savings percentage
   */
  calculateSavingsPercentage: (listPrice: number, customerPrice: number): number => {
    if (listPrice === 0) return 0;
    return ((listPrice - customerPrice) / listPrice) * 100;
  },

  /**
   * Format pricing rule description
   */
  formatPricingRuleDescription: (rule: PricingRule): string => {
    const { discountType, discountValue, minimumQuantity, minimumAmount } = rule;
    
    let description = '';
    
    if (discountType === 'percentage') {
      description = `${discountValue}% discount`;
    } else if (discountType === 'fixed_amount') {
      description = `$${discountValue} off`;
    } else if (discountType === 'fixed_price') {
      description = `Fixed price: $${discountValue}`;
    }
    
    if (minimumQuantity) {
      description += ` (min qty: ${minimumQuantity})`;
    }
    
    if (minimumAmount) {
      description += ` (min amount: $${minimumAmount})`;
    }
    
    return description;
  },

  /**
   * Check if pricing rule is currently active
   */
  isPricingRuleActive: (rule: PricingRule): boolean => {
    const now = new Date();
    const isWithinDateRange = now >= new Date(rule.effectiveDate) && 
                             (!rule.expirationDate || now <= new Date(rule.expirationDate));
    return rule.isActive && isWithinDateRange;
  },

  /**
   * Get pricing tier color
   */
  getPricingTierColor: (tier: string): string => {
    const colors = {
      'standard': 'gray',
      'bronze': '#CD7F32',
      'silver': '#C0C0C0',
      'gold': '#FFD700',
      'platinum': '#E5E4E2',
      'diamond': '#B9F2FF',
    };
    return colors[tier.toLowerCase()] || 'gray';
  },
};

// ===== TERRITORY UTILITIES =====

export const territoryUtils = {
  /**
   * Calculate territory performance percentage
   */
  calculatePerformancePercentage: (territory: Territory): number => {
    if (!territory.revenueTarget || territory.revenueTarget === 0) return 0;
    return Math.round(((territory.currentRevenue || 0) / territory.revenueTarget) * 100);
  },

  /**
   * Get territory performance status
   */
  getPerformanceStatus: (territory: Territory): 'excellent' | 'good' | 'fair' | 'poor' => {
    const percentage = territoryUtils.calculatePerformancePercentage(territory);
    
    if (percentage >= 100) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'fair';
    return 'poor';
  },

  /**
   * Get territory performance color
   */
  getPerformanceColor: (territory: Territory): string => {
    const status = territoryUtils.getPerformanceStatus(territory);
    const colors = {
      'excellent': 'green',
      'good': 'blue',
      'fair': 'yellow',
      'poor': 'red',
    };
    return colors[status];
  },

  /**
   * Format territory code for display
   */
  formatTerritoryCode: (territoryCode: string): string => {
    return territoryCode.toUpperCase();
  },

  /**
   * Check if territory needs attention
   */
  needsAttention: (territory: Territory): boolean => {
    const performance = territoryUtils.calculatePerformancePercentage(territory);
    return performance < 60 || (territory.customerCount || 0) === 0;
  },
};

// ===== WORKFLOW UTILITIES =====

export const workflowUtils = {
  /**
   * Get workflow status color for UI display
   */
  getWorkflowStatusColor: (status: WorkflowStatus): string => {
    const colors = {
      [WorkflowStatus.PENDING]: 'yellow',
      [WorkflowStatus.IN_PROGRESS]: 'blue',
      [WorkflowStatus.APPROVED]: 'green',
      [WorkflowStatus.REJECTED]: 'red',
      [WorkflowStatus.EXPIRED]: 'orange',
      [WorkflowStatus.CANCELLED]: 'gray',
    };
    return colors[status] || 'gray';
  },

  /**
   * Get workflow status label for display
   */
  getWorkflowStatusLabel: (status: WorkflowStatus): string => {
    const labels = {
      [WorkflowStatus.PENDING]: 'Pending',
      [WorkflowStatus.IN_PROGRESS]: 'In Progress',
      [WorkflowStatus.APPROVED]: 'Approved',
      [WorkflowStatus.REJECTED]: 'Rejected',
      [WorkflowStatus.EXPIRED]: 'Expired',
      [WorkflowStatus.CANCELLED]: 'Cancelled',
    };
    return labels[status] || status;
  },

  /**
   * Get workflow priority color
   */
  getWorkflowPriorityColor: (priority: WorkflowPriority): string => {
    const colors = {
      [WorkflowPriority.LOW]: 'gray',
      [WorkflowPriority.MEDIUM]: 'blue',
      [WorkflowPriority.HIGH]: 'orange',
      [WorkflowPriority.URGENT]: 'red',
    };
    return colors[priority] || 'gray';
  },

  /**
   * Get workflow priority label
   */
  getWorkflowPriorityLabel: (priority: WorkflowPriority): string => {
    const labels = {
      [WorkflowPriority.LOW]: 'Low',
      [WorkflowPriority.MEDIUM]: 'Medium',
      [WorkflowPriority.HIGH]: 'High',
      [WorkflowPriority.URGENT]: 'Urgent',
    };
    return labels[priority] || priority;
  },

  /**
   * Check if workflow is expired
   */
  isWorkflowExpired: (workflow: Workflow): boolean => {
    if (!workflow.expiresAt) return false;
    return new Date() > new Date(workflow.expiresAt);
  },

  /**
   * Calculate days until workflow expiration
   */
  getDaysUntilExpiration: (workflow: Workflow): number => {
    if (!workflow.expiresAt) return -1;
    
    const now = new Date();
    const expiration = new Date(workflow.expiresAt);
    const diffTime = expiration.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate workflow progress percentage
   */
  calculateProgressPercentage: (workflow: Workflow): number => {
    if (workflow.totalSteps === 0) return 0;
    return Math.round((workflow.completedSteps / workflow.totalSteps) * 100);
  },

  /**
   * Get approval step status color
   */
  getApprovalStepStatusColor: (status: ApprovalStepStatus): string => {
    const colors = {
      [ApprovalStepStatus.PENDING]: 'yellow',
      [ApprovalStepStatus.APPROVED]: 'green',
      [ApprovalStepStatus.REJECTED]: 'red',
      [ApprovalStepStatus.SKIPPED]: 'gray',
      [ApprovalStepStatus.REASSIGNED]: 'blue',
    };
    return colors[status] || 'gray';
  },

  /**
   * Get approval step status label
   */
  getApprovalStepStatusLabel: (status: ApprovalStepStatus): string => {
    const labels = {
      [ApprovalStepStatus.PENDING]: 'Pending',
      [ApprovalStepStatus.APPROVED]: 'Approved',
      [ApprovalStepStatus.REJECTED]: 'Rejected',
      [ApprovalStepStatus.SKIPPED]: 'Skipped',
      [ApprovalStepStatus.REASSIGNED]: 'Reassigned',
    };
    return labels[status] || status;
  },

  /**
   * Check if approval step can be acted upon
   */
  canActOnApprovalStep: (step: ApprovalStep): boolean => {
    return step.status === ApprovalStepStatus.PENDING;
  },
};

// ===== GENERAL B2B UTILITIES =====

export const generalB2BUtils = {
  /**
   * Format currency amount
   */
  formatCurrency: (amount: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  },

  /**
   * Format percentage
   */
  formatPercentage: (value: number, decimals = 1): string => {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Calculate percentage change
   */
  calculatePercentageChange: (oldValue: number, newValue: number): number => {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  },

  /**
   * Format large numbers with abbreviations
   */
  formatLargeNumber: (num: number): string => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },

  /**
   * Get urgency level based on days
   */
  getUrgencyLevel: (days: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (days < 0) return 'critical';
    if (days <= 3) return 'high';
    if (days <= 7) return 'medium';
    return 'low';
  },

  /**
   * Get urgency color
   */
  getUrgencyColor: (days: number): string => {
    const level = generalB2BUtils.getUrgencyLevel(days);
    const colors = {
      'low': 'green',
      'medium': 'yellow',
      'high': 'orange',
      'critical': 'red',
    };
    return colors[level];
  },
};

// Export all utilities as a combined object
export const b2bUtils = {
  order: b2bOrderUtils,
  quote: quoteUtils,
  contract: contractUtils,
  pricing: pricingUtils,
  territory: territoryUtils,
  workflow: workflowUtils,
  general: generalB2BUtils,
};