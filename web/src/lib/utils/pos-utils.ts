/**
 * POS Utilities
 * Requirements: 11.1, 11.2, 11.3
 */

import type {
  Transaction,
  TransactionItem,
  PaymentMethod,
  TransactionStatus,
  PaymentRecord,
  ReconciliationReport,
  DailySalesSummary,
} from '@/types/pos';

// Transaction Utilities
export const transactionUtils = {
  /**
   * Calculate transaction totals
   */
  calculateTotals: (items: TransactionItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const discountAmount = items.reduce((sum, item) => sum + item.discountAmount, 0);
    const total = subtotal + taxAmount - discountAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      total,
      itemCount: items.length,
    };
  },

  /**
   * Format transaction number
   */
  formatTransactionNumber: (number: string, prefix = 'TXN') => {
    return `${prefix}-${number.padStart(8, '0')}`;
  },

  /**
   * Get transaction status color
   */
  getStatusColor: (status: TransactionStatus) => {
    const colors = {
      [TransactionStatus.PENDING]: 'yellow',
      [TransactionStatus.PROCESSING]: 'blue',
      [TransactionStatus.COMPLETED]: 'green',
      [TransactionStatus.FAILED]: 'red',
      [TransactionStatus.CANCELLED]: 'gray',
      [TransactionStatus.REFUNDED]: 'orange',
      [TransactionStatus.VOIDED]: 'purple',
    };
    return colors[status] || 'gray';
  },

  /**
   * Check if transaction can be voided
   */
  canVoid: (transaction: Transaction) => {
    return transaction.status === TransactionStatus.COMPLETED &&
           new Date().getTime() - new Date(transaction.createdAt).getTime() < 24 * 60 * 60 * 1000; // 24 hours
  },

  /**
   * Check if transaction can be refunded
   */
  canRefund: (transaction: Transaction) => {
    return transaction.status === TransactionStatus.COMPLETED &&
           transaction.total > 0;
  },

  /**
   * Get refundable amount
   */
  getRefundableAmount: (transaction: Transaction) => {
    const totalRefunded = transaction.payments
      .reduce((sum, payment) => sum + payment.refundedAmount, 0);
    return Math.max(0, transaction.total - totalRefunded);
  },

  /**
   * Validate transaction items
   */
  validateItems: (items: TransactionItem[]) => {
    const errors: string[] = [];

    if (items.length === 0) {
      errors.push('At least one item is required');
    }

    items.forEach((item, index) => {
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${index + 1}: Unit price cannot be negative`);
      }
      if (!item.productId) {
        errors.push(`Item ${index + 1}: Product ID is required`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

// Payment Utilities
export const paymentUtils = {
  /**
   * Format payment method display name
   */
  formatPaymentMethod: (method: PaymentMethod) => {
    const names = {
      [PaymentMethod.CASH]: 'Cash',
      [PaymentMethod.CARD]: 'Card',
      [PaymentMethod.MOBILE_MONEY]: 'Mobile Money',
      [PaymentMethod.DIGITAL_WALLET]: 'Digital Wallet',
      [PaymentMethod.BANK_TRANSFER]: 'Bank Transfer',
      [PaymentMethod.CHECK]: 'Check',
      [PaymentMethod.STORE_CREDIT]: 'Store Credit',
    };
    return names[method] || method;
  },

  /**
   * Get payment method icon
   */
  getPaymentMethodIcon: (method: PaymentMethod) => {
    const icons = {
      [PaymentMethod.CASH]: '💵',
      [PaymentMethod.CARD]: '💳',
      [PaymentMethod.MOBILE_MONEY]: '📱',
      [PaymentMethod.DIGITAL_WALLET]: '💰',
      [PaymentMethod.BANK_TRANSFER]: '🏦',
      [PaymentMethod.CHECK]: '📝',
      [PaymentMethod.STORE_CREDIT]: '🎫',
    };
    return icons[method] || '💳';
  },

  /**
   * Calculate change for cash payments
   */
  calculateChange: (amountReceived: number, amountDue: number) => {
    const change = amountReceived - amountDue;
    return Math.max(0, change);
  },

  /**
   * Break down change into denominations
   */
  breakdownChange: (amount: number, denominations = [100, 50, 20, 10, 5, 1, 0.25, 0.10, 0.05, 0.01]) => {
    const breakdown: Array<{ denomination: number; count: number }> = [];
    let remaining = Math.round(amount * 100) / 100; // Round to 2 decimal places

    for (const denomination of denominations) {
      if (remaining >= denomination) {
        const count = Math.floor(remaining / denomination);
        breakdown.push({ denomination, count });
        remaining = Math.round((remaining - (count * denomination)) * 100) / 100;
      }
    }

    return breakdown;
  },

  /**
   * Validate payment amount
   */
  validatePaymentAmount: (amount: number, transactionTotal: number, method: PaymentMethod) => {
    const errors: string[] = [];

    if (amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (method === PaymentMethod.CASH && amount < transactionTotal) {
      errors.push('Cash payment amount cannot be less than transaction total');
    }

    if (method !== PaymentMethod.CASH && amount !== transactionTotal) {
      errors.push('Payment amount must equal transaction total for non-cash payments');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

// Receipt Utilities
export const receiptUtils = {
  /**
   * Format receipt content
   */
  formatReceiptContent: (transaction: Transaction, businessInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  }) => {
    const lines: string[] = [];

    // Header
    if (businessInfo) {
      lines.push(businessInfo.name);
      lines.push(businessInfo.address);
      lines.push(`Phone: ${businessInfo.phone}`);
      lines.push(`Email: ${businessInfo.email}`);
    }
    lines.push('');
    lines.push('RECEIPT');
    lines.push('================================');
    lines.push(`Transaction: ${transaction.transactionNumber}`);
    lines.push(`Date: ${new Date(transaction.createdAt).toLocaleString()}`);
    lines.push(`Cashier: ${transaction.createdBy || 'N/A'}`);
    lines.push('================================');
    lines.push('');

    // Items
    transaction.items.forEach(item => {
      lines.push(`${item.productName}`);
      lines.push(`  ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.lineTotal.toFixed(2)}`);
      if (item.discountAmount > 0) {
        lines.push(`  Discount: -$${item.discountAmount.toFixed(2)}`);
      }
    });

    lines.push('');
    lines.push('================================');

    // Totals
    lines.push(`Subtotal: $${transaction.subtotal.toFixed(2)}`);
    if (transaction.discountAmount > 0) {
      lines.push(`Discount: -$${transaction.discountAmount.toFixed(2)}`);
    }
    if (transaction.taxAmount > 0) {
      lines.push(`Tax: $${transaction.taxAmount.toFixed(2)}`);
    }
    if (transaction.tipAmount > 0) {
      lines.push(`Tip: $${transaction.tipAmount.toFixed(2)}`);
    }
    lines.push(`TOTAL: $${transaction.total.toFixed(2)}`);

    // Payment
    lines.push('');
    lines.push('PAYMENT:');
    transaction.payments.forEach(payment => {
      lines.push(`${paymentUtils.formatPaymentMethod(payment.paymentMethod)}: $${payment.amount.toFixed(2)}`);
    });

    // Footer
    lines.push('');
    lines.push('Thank you for your business!');
    lines.push('================================');

    return lines.join('\n');
  },

  /**
   * Generate receipt filename
   */
  generateReceiptFilename: (transaction: Transaction, format = 'pdf') => {
    const date = new Date(transaction.createdAt).toISOString().split('T')[0];
    return `receipt-${transaction.transactionNumber}-${date}.${format}`;
  },

  /**
   * Validate email for receipt delivery
   */
  validateEmail: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate phone number for SMS receipt
   */
  validatePhoneNumber: (phone: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  },
};

// Reconciliation Utilities
export const reconciliationUtils = {
  /**
   * Calculate reconciliation summary
   */
  calculateSummary: (report: ReconciliationReport) => {
    const totalVariance = report.paymentMethodBreakdown
      .reduce((sum, pm) => sum + Math.abs(pm.variance), 0);
    
    const totalDiscrepancies = report.discrepancies
      .reduce((sum, disc) => sum + Math.abs(disc.amount), 0);

    return {
      totalVariance,
      totalDiscrepancies,
      hasIssues: totalVariance > 0 || totalDiscrepancies > 0,
      severity: totalVariance > 100 || totalDiscrepancies > 100 ? 'high' : 
                totalVariance > 10 || totalDiscrepancies > 10 ? 'medium' : 'low',
    };
  },

  /**
   * Format reconciliation status
   */
  formatStatus: (status: string) => {
    const statuses = {
      pending: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return statuses[status as keyof typeof statuses] || status;
  },

  /**
   * Get status color
   */
  getStatusColor: (status: string) => {
    const colors = {
      pending: 'yellow',
      approved: 'green',
      rejected: 'red',
    };
    return colors[status as keyof typeof colors] || 'gray';
  },
};

// Analytics Utilities
export const analyticsUtils = {
  /**
   * Calculate sales metrics
   */
  calculateSalesMetrics: (summary: DailySalesSummary) => {
    const cashPercentage = summary.totalSales > 0 ? 
      (summary.cashSales / summary.totalSales) * 100 : 0;
    
    const cardPercentage = summary.totalSales > 0 ? 
      (summary.cardSales / summary.totalSales) * 100 : 0;

    return {
      cashPercentage: Math.round(cashPercentage * 100) / 100,
      cardPercentage: Math.round(cardPercentage * 100) / 100,
      averageTransactionValue: summary.averageTransactionValue,
      voidRate: summary.totalTransactions > 0 ? 
        (summary.voidedTransactions / summary.totalTransactions) * 100 : 0,
    };
  },

  /**
   * Format currency
   */
  formatCurrency: (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  },

  /**
   * Format percentage
   */
  formatPercentage: (value: number, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  },
};

// Offline Utilities
export const offlineUtils = {
  /**
   * Check if device is online
   */
  isOnline: () => navigator.onLine,

  /**
   * Generate offline operation ID
   */
  generateOfflineId: () => {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Estimate sync time
   */
  estimateSyncTime: (operationCount: number) => {
    // Rough estimate: 1 second per operation
    return operationCount * 1000;
  },

  /**
   * Prioritize sync operations
   */
  prioritizeOperations: (operations: Array<{ operation: string; timestamp: Date; priority?: string }>) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return operations.sort((a, b) => {
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // Same priority, sort by timestamp (older first)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  },
};

// Validation Utilities
export const validationUtils = {
  /**
   * Validate transaction data
   */
  validateTransaction: (data: any) => {
    const errors: string[] = [];

    if (!data.locationId) {
      errors.push('Location ID is required');
    }

    if (!data.items || data.items.length === 0) {
      errors.push('At least one item is required');
    }

    if (!data.paymentMethod) {
      errors.push('Payment method is required');
    }

    if (typeof data.total !== 'number' || data.total <= 0) {
      errors.push('Total must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate refund data
   */
  validateRefund: (data: any, transaction: Transaction) => {
    const errors: string[] = [];

    if (!data.amount || data.amount <= 0) {
      errors.push('Refund amount must be greater than 0');
    }

    const refundableAmount = transactionUtils.getRefundableAmount(transaction);
    if (data.amount > refundableAmount) {
      errors.push(`Refund amount cannot exceed $${refundableAmount.toFixed(2)}`);
    }

    if (!data.reason) {
      errors.push('Refund reason is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

// Export all utilities
export const posUtils = {
  transaction: transactionUtils,
  payment: paymentUtils,
  receipt: receiptUtils,
  reconciliation: reconciliationUtils,
  analytics: analyticsUtils,
  offline: offlineUtils,
  validation: validationUtils,
};