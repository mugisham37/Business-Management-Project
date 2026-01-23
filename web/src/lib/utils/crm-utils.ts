/**
 * CRM Utility Functions
 * Helper functions for CRM operations, calculations, and data transformations
 */

import { 
  Customer, 
  LoyaltyTier, 
  ChurnRiskLevel, 
  CampaignStatus,
  CommunicationType,
  B2BCustomer 
} from '@/types/crm';

// Customer Utilities
export const customerUtils = {
  /**
   * Get customer display name
   */
  getDisplayName: (customer: Customer): string => {
    if (customer.displayName) return customer.displayName;
    if (customer.type === 'business' && customer.companyName) return customer.companyName;
    if (customer.firstName && customer.lastName) return `${customer.firstName} ${customer.lastName}`;
    if (customer.firstName) return customer.firstName;
    if (customer.email) return customer.email;
    return 'Unknown Customer';
  },

  /**
   * Get customer full address
   */
  getFullAddress: (customer: Customer): string => {
    const parts = [
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.state,
      customer.postalCode,
      customer.country,
    ].filter(Boolean);
    
    return parts.join(', ');
  },

  /**
   * Calculate customer age in years
   */
  getAge: (customer: Customer): number | null => {
    if (!customer.dateOfBirth) return null;
    
    const birthDate = new Date(customer.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  },

  /**
   * Check if customer is high value
   */
  isHighValue: (customer: Customer, threshold = 1000): boolean => {
    return customer.totalSpent >= threshold;
  },

  /**
   * Get customer status color
   */
  getStatusColor: (status: string): string => {
    const colors = {
      active: 'green',
      inactive: 'gray',
      blocked: 'red',
      prospect: 'blue',
    };
    return colors[status as keyof typeof colors] || 'gray';
  },

  /**
   * Get customer type icon
   */
  getTypeIcon: (type: string): string => {
    return type === 'business' ? '🏢' : '👤';
  },

  /**
   * Calculate days since last purchase
   */
  getDaysSinceLastPurchase: (customer: Customer): number | null => {
    if (!customer.lastPurchaseDate) return null;
    
    const lastPurchase = new Date(customer.lastPurchaseDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastPurchase.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Format customer tags for display
   */
  formatTags: (tags: string[]): string => {
    return tags.map(tag => `#${tag}`).join(' ');
  },

  /**
   * Check if customer has opted in for marketing
   */
  canReceiveMarketing: (customer: Customer): boolean => {
    return customer.marketingOptIn && customer.emailOptIn;
  },
};

// Loyalty Utilities
export const loyaltyUtils = {
  /**
   * Get loyalty tier color
   */
  getTierColor: (tier: LoyaltyTier): string => {
    const colors = {
      bronze: '#CD7F32',
      silver: '#C0C0C0',
      gold: '#FFD700',
      platinum: '#E5E4E2',
      diamond: '#B9F2FF',
    };
    return colors[tier] || colors.bronze;
  },

  /**
   * Get loyalty tier icon
   */
  getTierIcon: (tier: LoyaltyTier): string => {
    const icons = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '💠',
    };
    return icons[tier] || icons.bronze;
  },

  /**
   * Calculate points needed for next tier
   */
  getPointsToNextTier: (currentPoints: number, currentTier: LoyaltyTier): number => {
    const tierThresholds = {
      bronze: 0,
      silver: 1000,
      gold: 5000,
      platinum: 10000,
      diamond: 25000,
    };

    const tiers = Object.keys(tierThresholds) as LoyaltyTier[];
    const currentIndex = tiers.indexOf(currentTier);
    
    if (currentIndex === tiers.length - 1) return 0; // Already at highest tier
    
    const nextTier = tiers[currentIndex + 1];
    const nextThreshold = tierThresholds[nextTier];
    
    return Math.max(0, nextThreshold - currentPoints);
  },

  /**
   * Get tier for points amount
   */
  getTierForPoints: (points: number): LoyaltyTier => {
    if (points >= 25000) return 'diamond';
    if (points >= 10000) return 'platinum';
    if (points >= 5000) return 'gold';
    if (points >= 1000) return 'silver';
    return 'bronze';
  },

  /**
   * Format points with commas
   */
  formatPoints: (points: number): string => {
    return points.toLocaleString();
  },

  /**
   * Calculate points expiration date
   */
  getPointsExpirationDate: (earnedDate: Date, expirationDays = 365): Date => {
    const expiration = new Date(earnedDate);
    expiration.setDate(expiration.getDate() + expirationDays);
    return expiration;
  },
};

// Churn Risk Utilities
export const churnUtils = {
  /**
   * Get churn risk level from score
   */
  getRiskLevel: (riskScore: number): ChurnRiskLevel => {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.3) return 'medium';
    return 'low';
  },

  /**
   * Get churn risk color
   */
  getRiskColor: (riskLevel: ChurnRiskLevel): string => {
    const colors = {
      low: 'green',
      medium: 'yellow',
      high: 'orange',
      critical: 'red',
    };
    return colors[riskLevel];
  },

  /**
   * Get churn risk icon
   */
  getRiskIcon: (riskLevel: ChurnRiskLevel): string => {
    const icons = {
      low: '✅',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    };
    return icons[riskLevel];
  },

  /**
   * Generate churn prevention recommendations
   */
  getPreventionRecommendations: (riskLevel: ChurnRiskLevel, customer: Customer): string[] => {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Schedule immediate personal outreach');
      recommendations.push('Offer exclusive discount or promotion');
      recommendations.push('Provide priority customer support');
    }

    if (riskLevel === 'medium' || riskLevel === 'high') {
      recommendations.push('Send personalized email campaign');
      recommendations.push('Invite to loyalty program if not enrolled');
      recommendations.push('Gather feedback through survey');
    }

    if (customer.loyaltyPoints > 0) {
      recommendations.push('Remind about available loyalty rewards');
    }

    if (customer.totalOrders > 5) {
      recommendations.push('Highlight customer appreciation');
    }

    return recommendations;
  },
};

// Campaign Utilities
export const campaignUtils = {
  /**
   * Get campaign status color
   */
  getStatusColor: (status: CampaignStatus): string => {
    const colors = {
      draft: 'gray',
      active: 'green',
      paused: 'yellow',
      completed: 'blue',
      cancelled: 'red',
    };
    return colors[status];
  },

  /**
   * Get campaign status icon
   */
  getStatusIcon: (status: CampaignStatus): string => {
    const icons = {
      draft: '📝',
      active: '🟢',
      paused: '⏸️',
      completed: '✅',
      cancelled: '❌',
    };
    return icons[status];
  },

  /**
   * Check if campaign is currently active
   */
  isCurrentlyActive: (campaign: any): boolean => {
    if (campaign.status !== 'active') return false;
    
    const now = new Date();
    const startDate = new Date(campaign.startDate);
    const endDate = new Date(campaign.endDate);
    
    return now >= startDate && now <= endDate;
  },

  /**
   * Calculate campaign duration in days
   */
  getDurationInDays: (startDate: Date, endDate: Date): number => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate days until campaign starts/ends
   */
  getDaysUntilEvent: (eventDate: Date): number => {
    const now = new Date();
    const diffTime = eventDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Format campaign budget
   */
  formatBudget: (budget: number): string => {
    return budget.toLocaleString() + ' points';
  },

  /**
   * Calculate campaign ROI
   */
  calculateROI: (revenue: number, cost: number): number => {
    if (cost === 0) return 0;
    return ((revenue - cost) / cost) * 100;
  },
};

// Communication Utilities
export const communicationUtils = {
  /**
   * Get communication type icon
   */
  getTypeIcon: (type: CommunicationType): string => {
    const icons = {
      email: '📧',
      phone: '📞',
      sms: '💬',
      meeting: '🤝',
    };
    return icons[type];
  },

  /**
   * Get communication type color
   */
  getTypeColor: (type: CommunicationType): string => {
    const colors = {
      email: 'blue',
      phone: 'green',
      sms: 'purple',
      meeting: 'orange',
    };
    return colors[type];
  },

  /**
   * Format communication subject
   */
  formatSubject: (subject?: string, type?: CommunicationType): string => {
    if (subject) return subject;
    
    const defaults = {
      email: 'Email Communication',
      phone: 'Phone Call',
      sms: 'SMS Message',
      meeting: 'Meeting',
    };
    
    return type ? defaults[type] : 'Communication';
  },

  /**
   * Calculate response time in hours
   */
  getResponseTimeHours: (sentAt: Date, respondedAt: Date): number => {
    const diffTime = Math.abs(respondedAt.getTime() - sentAt.getTime());
    return Math.round(diffTime / (1000 * 60 * 60));
  },

  /**
   * Check if communication is overdue
   */
  isOverdue: (scheduledAt: Date, status: string): boolean => {
    if (status === 'completed') return false;
    return new Date() > scheduledAt;
  },
};

// B2B Customer Utilities
export const b2bUtils = {
  /**
   * Calculate credit utilization percentage
   */
  getCreditUtilization: (customer: B2BCustomer): number => {
    if (customer.creditLimit === 0) return 0;
    return (customer.outstandingBalance / customer.creditLimit) * 100;
  },

  /**
   * Get credit status color
   */
  getCreditStatusColor: (status: string): string => {
    const colors = {
      good: 'green',
      fair: 'yellow',
      poor: 'orange',
      blocked: 'red',
    };
    return colors[status as keyof typeof colors] || 'gray';
  },

  /**
   * Check if contract is expiring soon
   */
  isContractExpiringSoon: (customer: B2BCustomer, days = 30): boolean => {
    return customer.daysUntilContractExpiry <= days && customer.daysUntilContractExpiry > 0;
  },

  /**
   * Format company size
   */
  formatCompanySize: (size?: string): string => {
    const sizeMap = {
      'startup': 'Startup (1-10)',
      'small': 'Small (11-50)',
      'medium': 'Medium (51-200)',
      'large': 'Large (201-1000)',
      'enterprise': 'Enterprise (1000+)',
    };
    return size ? sizeMap[size as keyof typeof sizeMap] || size : 'Unknown';
  },

  /**
   * Format annual revenue
   */
  formatAnnualRevenue: (revenue?: number): string => {
    if (!revenue) return 'Not specified';
    
    if (revenue >= 1000000000) {
      return `$${(revenue / 1000000000).toFixed(1)}B`;
    }
    if (revenue >= 1000000) {
      return `$${(revenue / 1000000).toFixed(1)}M`;
    }
    if (revenue >= 1000) {
      return `$${(revenue / 1000).toFixed(0)}K`;
    }
    return `$${revenue.toLocaleString()}`;
  },

  /**
   * Get payment terms description
   */
  getPaymentTermsDescription: (terms: string): string => {
    const termsMap = {
      'net_15': 'Net 15 days',
      'net_30': 'Net 30 days',
      'net_45': 'Net 45 days',
      'net_60': 'Net 60 days',
      'cod': 'Cash on Delivery',
      'prepaid': 'Prepaid',
    };
    return termsMap[terms as keyof typeof termsMap] || terms;
  },
};

// Date and Time Utilities
export const dateUtils = {
  /**
   * Format date for display
   */
  formatDate: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  },

  /**
   * Format datetime for display
   */
  formatDateTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  },

  /**
   * Get relative time (e.g., "2 days ago")
   */
  getRelativeTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  },

  /**
   * Check if date is in the future
   */
  isFuture: (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d > new Date();
  },

  /**
   * Check if date is in the past
   */
  isPast: (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d < new Date();
  },
};

// Formatting Utilities
export const formatUtils = {
  /**
   * Format currency
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
    return `${(value * 100).toFixed(decimals)}%`;
  },

  /**
   * Format large numbers with K, M, B suffixes
   */
  formatLargeNumber: (num: number): string => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  },

  /**
   * Truncate text with ellipsis
   */
  truncateText: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  /**
   * Format phone number
   */
  formatPhoneNumber: (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  },
};

// Validation Utilities
export const validationUtils = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate phone number format
   */
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  },

  /**
   * Validate credit limit
   */
  isValidCreditLimit: (limit: number): boolean => {
    return limit >= 0 && limit <= 10000000; // Max 10M
  },

  /**
   * Validate loyalty points
   */
  isValidLoyaltyPoints: (points: number): boolean => {
    return points >= 0 && points <= 1000000; // Max 1M points
  },
};

// Export all utilities
export const crmUtils = {
  customer: customerUtils,
  loyalty: loyaltyUtils,
  churn: churnUtils,
  campaign: campaignUtils,
  communication: communicationUtils,
  b2b: b2bUtils,
  date: dateUtils,
  format: formatUtils,
  validation: validationUtils,
};