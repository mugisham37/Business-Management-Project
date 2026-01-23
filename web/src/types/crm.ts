/**
 * CRM Module Types
 * Comprehensive type definitions for Customer Relationship Management
 */

// Base Types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Enums
export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
  PROSPECT = 'prospect',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

export enum LoyaltyTransactionType {
  EARNED = 'earned',
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  ADJUSTED = 'adjusted',
}

export enum RewardType {
  DISCOUNT_PERCENTAGE = 'discount_percentage',
  DISCOUNT_FIXED = 'discount_fixed',
  FREE_PRODUCT = 'free_product',
  FREE_SHIPPING = 'free_shipping',
  STORE_CREDIT = 'store_credit',
  CUSTOM = 'custom',
}

export enum CampaignType {
  LOYALTY_POINTS = 'loyalty_points',
  DISCOUNT = 'discount',
  PROMOTION = 'promotion',
  REFERRAL = 'referral',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CommunicationType {
  EMAIL = 'email',
  PHONE = 'phone',
  SMS = 'sms',
  MEETING = 'meeting',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum CommunicationStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ChurnRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Customer Types
export interface Customer extends BaseEntity {
  type: CustomerType;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  creditLimit?: number;
  paymentTerms?: number;
  discountPercentage?: number;
  loyaltyTier?: LoyaltyTier;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  averageOrderValue: number;
  lastPurchaseDate?: Date;
  churnRisk: number;
  marketingOptIn: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
  tags: string[];
  notes?: string;
  referralCode?: string;
  dateOfBirth?: Date;
  anniversary?: Date;
  customFields?: Record<string, any>;
  preferences?: Record<string, any>;
  socialProfiles?: Record<string, any>;
}

export interface CreateCustomerInput {
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  creditLimit?: number;
  paymentTerms?: number;
  discountPercentage?: number;
  marketingOptIn?: boolean;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  tags?: string[];
  notes?: string;
  dateOfBirth?: string;
  anniversary?: string;
  referredBy?: string;
  customFields?: Record<string, any>;
  preferences?: Record<string, any>;
  socialProfiles?: Record<string, any>;
}

export interface UpdateCustomerInput {
  type?: CustomerType;
  status?: CustomerStatus;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  creditLimit?: number;
  paymentTerms?: number;
  discountPercentage?: number;
  loyaltyTier?: LoyaltyTier;
  marketingOptIn?: boolean;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  tags?: string[];
  notes?: string;
  referralCode?: string;
  dateOfBirth?: string;
  anniversary?: string;
  customFields?: Record<string, any>;
  preferences?: Record<string, any>;
  socialProfiles?: Record<string, any>;
}

export interface CustomerFilterInput {
  search?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  loyaltyTier?: LoyaltyTier;
  tags?: string[];
  city?: string;
  state?: string;
  country?: string;
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minChurnRisk?: number;
  maxChurnRisk?: number;
  createdAfter?: string;
  createdBefore?: string;
  lastPurchaseAfter?: string;
  lastPurchaseBefore?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// B2B Customer Types
export interface B2BCustomer extends BaseEntity {
  companyName: string;
  industry?: string;
  companySize?: string;
  annualRevenue?: number;
  website?: string;
  taxId?: string;
  creditLimit: number;
  availableCredit: number;
  outstandingBalance: number;
  paymentTerms: string;
  creditStatus: string;
  salesRepId?: string;
  accountManagerId?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
  contractExpiringSoon: boolean;
  daysUntilContractExpiry: number;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  secondaryContactName?: string;
  secondaryContactEmail?: string;
  secondaryContactPhone?: string;
  customFields?: Record<string, any>;
  pricingRules?: CustomerPricingRule[];
  creditHistory?: CustomerCreditHistory[];
}

export interface CustomerPricingRule extends BaseEntity {
  customerId: string;
  productId?: string;
  categoryId?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumQuantity?: number;
  validFrom?: Date;
  validTo?: Date;
  isActive: boolean;
}

export interface CustomerCreditHistory extends BaseEntity {
  customerId: string;
  previousLimit: number;
  newLimit: number;
  reason: string;
  changedBy: string;
  changedAt: Date;
}

export interface B2BCustomerFilterInput {
  industry?: string;
  companySize?: string;
  creditStatus?: string;
  salesRepId?: string;
  accountManagerId?: string;
  contractExpiringWithinDays?: number;
  minAnnualRevenue?: number;
  maxAnnualRevenue?: number;
  minCreditLimit?: number;
  maxCreditLimit?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface B2BCustomerMetrics {
  totalCustomers: number;
  totalRevenue: number;
  averageContractValue: number;
  averageCreditLimit: number;
  totalOutstandingBalance: number;
  contractsExpiringThisMonth: number;
  contractsExpiringNextMonth: number;
  customersByIndustry: Record<string, number>;
  customersByCreditStatus: Record<string, number>;
  topCustomersByRevenue: Array<{
    customerId: string;
    companyName: string;
    revenue: number;
  }>;
  revenueGrowthRate: number;
  customerRetentionRate: number;
  averagePaymentTerms: number;
}

// Loyalty Types
export interface LoyaltyTransaction extends BaseEntity {
  customerId: string;
  type: LoyaltyTransactionType;
  points: number;
  description: string;
  relatedTransactionId?: string;
  expiresAt?: Date;
  campaignId?: string;
  promotionId?: string;
  metadata?: Record<string, any>;
}

export interface LoyaltyReward extends BaseEntity {
  name: string;
  description?: string;
  type: RewardType;
  pointsRequired: number;
  value?: number;
  productId?: string;
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  startDate?: Date;
  endDate?: Date;
  usageLimitPerCustomer?: number;
  totalUsageLimit?: number;
  currentUsage: number;
  requiredTiers?: string[];
  termsAndConditions?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface LoyaltyTransactionFilterInput {
  customerId?: string;
  type?: LoyaltyTransactionType;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Campaign Types
export interface Campaign extends BaseEntity {
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date;
  pointsMultiplier?: number;
  minimumPurchaseAmount?: number;
  targetSegments?: string[];
  targetTiers?: string[];
  applicableCategories?: string[];
  applicableProducts?: string[];
  maxPointsPerCustomer?: number;
  totalPointsBudget?: number;
  termsAndConditions?: string;
  metadata?: Record<string, any>;
}

export interface CampaignPerformance {
  campaignId: string;
  totalParticipants: number;
  totalPointsAwarded: number;
  totalRedemptions: number;
  conversionRate: number;
  averagePointsPerParticipant: number;
  totalRevenue: number;
  roi: number;
  engagementMetrics: Record<string, any>;
  performanceBySegment: Record<string, any>;
  performanceByTier: Record<string, any>;
  dailyMetrics: Array<{
    date: Date;
    participants: number;
    pointsAwarded: number;
    revenue: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignFilterInput {
  status?: CampaignStatus;
  type?: CampaignType;
  activeOnly?: boolean;
  search?: string;
  startDateAfter?: string;
  startDateBefore?: string;
  endDateAfter?: string;
  endDateBefore?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Communication Types
export interface Communication extends BaseEntity {
  customerId: string;
  employeeId?: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content: string;
  status: CommunicationStatus;
  scheduledAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
  customer?: Customer;
  employee?: {
    id: string;
    name: string;
  };
}

export interface CreateCommunicationInput {
  customerId: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content: string;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export interface ScheduleCommunicationInput {
  customerId: string;
  type: CommunicationType;
  subject?: string;
  content: string;
  scheduledAt: Date;
  metadata?: Record<string, any>;
}

// Analytics Types
export interface CustomerLifetimeValue {
  customerId: string;
  currentValue: number;
  predictedValue: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  customerLifespan: number;
  churnProbability: number;
  segmentValue: number;
  calculatedAt: Date;
  purchasePattern?: PurchasePattern;
  churnRisk?: ChurnRiskAnalysis;
}

export interface PurchasePattern {
  customerId: string;
  averageOrderValue: number;
  purchaseFrequency: number;
  seasonalTrends: Record<string, number>;
  preferredCategories: string[];
  preferredProducts: string[];
  peakPurchaseTimes: string[];
  averageDaysBetweenOrders: number;
  lastPurchaseDate?: Date;
  predictedNextPurchase?: Date;
  calculatedAt: Date;
}

export interface ChurnRiskAnalysis {
  customerId: string;
  riskScore: number;
  riskLevel: ChurnRiskLevel;
  factors: string[];
  recommendations: string[];
  lastActivityDate?: Date;
  daysSinceLastPurchase: number;
  engagementScore: number;
  calculatedAt: Date;
}

export interface SegmentAnalytics {
  segmentId: string;
  segmentName: string;
  totalCustomers: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageLifetimeValue: number;
  churnRate: number;
  engagementRate: number;
  conversionRate: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    orders: number;
  }>;
  revenueGrowth: number;
  customerGrowth: number;
  seasonalTrends: Record<string, number>;
  calculatedAt: Date;
}

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  newCustomersLastMonth: number;
  customerGrowthRate: number;
  averageLifetimeValue: number;
  averageOrderValue: number;
  totalRevenue: number;
  churnRate: number;
  retentionRate: number;
  engagementRate: number;
  loyaltyProgramParticipation: number;
  topCustomerSegments: Array<{
    segmentId: string;
    segmentName: string;
    customerCount: number;
    revenue: number;
  }>;
  customersByTier: Record<LoyaltyTier, number>;
  customersByStatus: Record<CustomerStatus, number>;
  revenueBySegment: Record<string, number>;
  monthlyActiveCustomers: number;
  customerAcquisitionCost: number;
  customerSatisfactionScore: number;
}

// Segmentation Types
export interface Segment extends BaseEntity {
  name: string;
  description?: string;
  criteria: Record<string, any>;
  isActive: boolean;
  customerCount: number;
  lastCalculated?: Date;
}

export interface SegmentMember {
  customerId: string;
  segmentId: string;
  addedAt: Date;
  customer?: Customer;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  criteria: Record<string, any>;
  isActive?: boolean;
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string;
  criteria?: Record<string, any>;
  isActive?: boolean;
}

export interface SegmentJobResponse {
  jobId: string;
  status: string;
  createdAt: Date;
}

// Hook Return Types
export interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error?: Error;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  refetch: () => Promise<void>;
  fetchMore: () => Promise<void>;
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
  updateCustomer: (id: string, input: UpdateCustomerInput) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<boolean>;
  updatePurchaseStats: (id: string, orderValue: number, orderDate?: Date) => Promise<boolean>;
  updateLoyaltyPoints: (id: string, pointsChange: number, reason: string) => Promise<boolean>;
}

export interface UseLoyaltyResult {
  transactions: LoyaltyTransaction[];
  rewards: LoyaltyReward[];
  loading: boolean;
  error?: Error;
  awardPoints: (customerId: string, points: number, reason: string, campaignId?: string) => Promise<LoyaltyTransaction>;
  redeemPoints: (customerId: string, points: number, reason: string) => Promise<LoyaltyTransaction>;
  adjustPoints: (customerId: string, pointsChange: number, reason: string) => Promise<LoyaltyTransaction>;
  createReward: (input: any) => Promise<boolean>;
  createCampaign: (input: any) => Promise<boolean>;
}

export interface UseCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  error?: Error;
  createCampaign: (input: any) => Promise<Campaign>;
  updateCampaign: (id: string, input: any) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<boolean>;
  activateCampaign: (id: string) => Promise<Campaign>;
  pauseCampaign: (id: string) => Promise<Campaign>;
  getCampaignPerformance: (id: string) => Promise<CampaignPerformance>;
}

export interface UseCustomerAnalyticsResult {
  loading: boolean;
  error?: Error;
  getLifetimeValue: (customerId: string) => Promise<CustomerLifetimeValue>;
  getPurchasePatterns: (customerId: string) => Promise<PurchasePattern>;
  getChurnRisk: (customerId: string) => Promise<ChurnRiskAnalysis>;
  getSegmentAnalytics: (segmentId: string) => Promise<SegmentAnalytics>;
  getCustomerMetrics: () => Promise<CustomerMetrics>;
  getHighChurnRiskCustomers: (threshold?: number, limit?: number) => Promise<ChurnRiskAnalysis[]>;
}

export interface UseB2BCustomersResult {
  customers: B2BCustomer[];
  loading: boolean;
  error?: Error;
  metrics?: B2BCustomerMetrics;
  createCustomer: (input: any) => Promise<B2BCustomer>;
  updateCustomer: (id: string, input: any) => Promise<B2BCustomer>;
  updateCreditLimit: (id: string, creditLimit: number, reason: string) => Promise<boolean>;
  updateCreditStatus: (id: string, status: string, reason: string) => Promise<boolean>;
  getCustomersByIndustry: (industry: string) => Promise<B2BCustomer[]>;
  getCustomersBySalesRep: (salesRepId: string) => Promise<B2BCustomer[]>;
  getCustomersWithExpiringContracts: (days?: number) => Promise<B2BCustomer[]>;
}

export interface UseCommunicationsResult {
  communications: Communication[];
  loading: boolean;
  error?: Error;
  recordCommunication: (input: CreateCommunicationInput) => Promise<Communication>;
  scheduleCommunication: (input: ScheduleCommunicationInput) => Promise<Communication>;
  getCommunicationTimeline: (customerId: string, limit?: number) => Promise<Communication[]>;
}

export interface UseSegmentationResult {
  segments: Segment[];
  loading: boolean;
  error?: Error;
  createSegment: (input: CreateSegmentInput) => Promise<Segment>;
  updateSegment: (id: string, input: UpdateSegmentInput) => Promise<Segment>;
  deleteSegment: (id: string) => Promise<boolean>;
  recalculateSegment: (id: string) => Promise<SegmentJobResponse>;
  getSegmentMembers: (segmentId: string, limit?: number) => Promise<SegmentMember[]>;
  evaluateSegmentMembership: (segmentId: string, customerId: string) => Promise<boolean>;
}

// Utility Types
export interface CRMFilters {
  customers: CustomerFilterInput;
  b2bCustomers: B2BCustomerFilterInput;
  campaigns: CampaignFilterInput;
  loyaltyTransactions: LoyaltyTransactionFilterInput;
}

export interface CRMSortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CRMPaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Event Types for Real-time Updates
export interface CRMRealtimeEvent {
  type: 'customer_created' | 'customer_updated' | 'customer_deleted' |
        'campaign_created' | 'campaign_updated' | 'campaign_activated' |
        'loyalty_transaction' | 'communication_scheduled';
  data: any;
  timestamp: Date;
  tenantId: string;
}

// Configuration Types
export interface CRMModuleConfig {
  features: {
    loyaltyProgram: boolean;
    b2bCustomers: boolean;
    customerAnalytics: boolean;
    campaignManagement: boolean;
    communicationTracking: boolean;
    segmentation: boolean;
  };
  settings: {
    defaultLoyaltyTier: LoyaltyTier;
    pointsExpirationDays: number;
    maxCampaignsPerCustomer: number;
    churnRiskThreshold: number;
    segmentRecalculationInterval: number;
  };
  permissions: {
    canCreateCustomers: boolean;
    canUpdateCustomers: boolean;
    canDeleteCustomers: boolean;
    canManageLoyalty: boolean;
    canManageCampaigns: boolean;
    canViewAnalytics: boolean;
    canManageSegments: boolean;
  };
}