/**
 * CRM Module Types
 * Comprehensive type definitions for Customer Relationship Management
 */

import type { ApolloError } from '@apollo/client';

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
  customFields?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  socialProfiles?: Record<string, unknown>;
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
  customFields?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  socialProfiles?: Record<string, unknown>;
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
  customFields?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  socialProfiles?: Record<string, unknown>;
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
  customFields?: Record<string, unknown>;
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

export interface CreateB2BCustomerInput {
  companyName: string;
  industry?: string;
  companySize?: string;
  annualRevenue?: number;
  website?: string;
  taxId?: string;
  creditLimit: number;
  paymentTerms: string;
  salesRepId?: string;
  accountManagerId?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
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
  customFields?: Record<string, unknown>;
}

export interface UpdateB2BCustomerInput {
  companyName?: string;
  industry?: string;
  companySize?: string;
  annualRevenue?: number;
  website?: string;
  creditLimit?: number;
  paymentTerms?: string;
  salesRepId?: string;
  accountManagerId?: string;
  contractStartDate?: Date;
  contractEndDate?: Date;
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
  customFields?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

export interface CreateRewardInput {
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
  requiredTiers?: string[];
  termsAndConditions?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateCampaignInput {
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
  metadata?: Record<string, unknown>;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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
  engagementMetrics: Record<string, unknown>;
  performanceBySegment: Record<string, unknown>;
  performanceByTier: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
}

export interface ScheduleCommunicationInput {
  customerId: string;
  type: CommunicationType;
  subject?: string;
  content: string;
  scheduledAt: Date;
  metadata?: Record<string, unknown>;
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
  criteria: Record<string, unknown>;
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
  criteria: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string;
  criteria?: Record<string, unknown>;
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
  createReward: (input: CreateRewardInput) => Promise<LoyaltyReward>;
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign>;
}

export interface UseCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  error?: ApolloError | null;
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign>;
  updateCampaign: (id: string, input: UpdateCampaignInput) => Promise<Campaign>;
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
  error?: Error | null;
  metrics?: B2BCustomerMetrics;
  createCustomer: (input: CreateB2BCustomerInput) => Promise<B2BCustomer>;
  updateCustomer: (id: string, input: UpdateB2BCustomerInput) => Promise<B2BCustomer>;
  updateCreditLimit: (id: string, creditLimit: number, reason: string) => Promise<boolean>;
  updateCreditStatus: (id: string, status: string, reason: string) => Promise<boolean>;
  getCustomersByIndustry: (industry: string) => Promise<B2BCustomer[]>;
  getCustomersBySalesRep: (salesRepId: string) => Promise<B2BCustomer[]>;
  getCustomersWithExpiringContracts: (days?: number) => Promise<B2BCustomer[]>;
}

export interface UseB2BOrdersResult {
  orders: B2BOrder[];
  loading: boolean;
  error?: Error | null;
  totalCount?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  analytics?: Record<string, unknown>;
  createOrder: (input: CreateB2BOrderInput) => Promise<B2BOrder>;
  updateOrder: (id: string, input: UpdateB2BOrderInput) => Promise<B2BOrder>;
  approveOrder?: (id: string, approvalNotes?: string) => Promise<B2BOrder>;
  rejectOrder?: (id: string, rejectionReason?: string) => Promise<B2BOrder>;
  shipOrder?: (id: string, trackingNumber: string, estimatedDeliveryDate?: Date) => Promise<B2BOrder>;
  cancelOrder?: (id: string, cancellationReason?: string) => Promise<B2BOrder>;
  deleteOrder?: (id: string) => Promise<boolean>;
  getOrderByNumber?: (orderNumber: string) => Promise<B2BOrder | null>;
  getOrdersRequiringApproval?: () => Promise<B2BOrder[]>;
  getB2BOrderAnalytics?: (startDate?: Date, endDate?: Date) => Promise<Record<string, unknown>>;
  refetch?: () => Promise<void>;
}

export interface UseB2BPricingResult {
  pricingRules: PricingRule[];
  loading: boolean;
  error?: Error | null;
  totalCount: number;
  getCustomerPricing: (customerId: string, productId: string, quantity: number) => Promise<CustomerPricing>;
  getBulkPricing: (customerId: string, items: Array<{ productId: string; quantity: number }>) => Promise<Record<string, unknown>>;
  createPricingRule: (input: CreatePricingRuleInput) => Promise<PricingRule>;
  updatePricingRule: (id: string, input: UpdatePricingRuleInput) => Promise<PricingRule>;
  deletePricingRule: (id: string) => Promise<boolean>;
  getApplicableRules: (customerId: string, productId: string, quantity: number, amount: number) => Promise<PricingRule[]>;
  setPricingRuleActive: (id: string, isActive: boolean) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export interface ApprovalStepInput {
  approvalNotes?: string;
}

export interface ReassignApprovalInput {
  newApproverId: string;
  reassignmentReason: string;
  notes?: string;
}

export interface UseB2BWorkflowsResult {
  workflows: Workflow[];
  loading: boolean;
  error?: Error | null;
  approveStep: (workflowId: string, stepId: string, input: ApprovalStepInput) => Promise<{ step: ApprovalStep; workflow: Workflow }>;
  rejectStep: (workflowId: string, stepId: string, rejectionReason: string, input?: ApprovalStepInput) => Promise<{ step: ApprovalStep; workflow: Workflow }>;
  reassignApproval: (workflowId: string, stepId: string, input: ReassignApprovalInput) => Promise<{ step: ApprovalStep; workflow: Workflow }>;
  getPendingApprovals: () => Promise<WorkflowApproval[]>;
  getWorkflowHistory: (entityId: string, entityType: EntityType) => Promise<WorkflowHistoryEntry[]>;
  getWorkflowAnalytics: (startDate?: Date, endDate?: Date) => Promise<Record<string, unknown>>;
  refetch: () => Promise<void>;
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

// B2B Order Types
export interface B2BOrder extends BaseEntity {
  orderNumber: string;
  customerId: string;
  salesRepId?: string;
  accountManagerId?: string;
  quoteId?: string;
  status: B2BOrderStatus;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  paymentTerms: string;
  paymentDueDate?: Date;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  shippedBy?: string;
  shippedAt?: Date;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  items: B2BOrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  metadata?: Record<string, unknown>;
  // Computed fields
  canBeApproved?: boolean;
  canBeRejected?: boolean;
  canBeCancelled?: boolean;
  canBeShipped?: boolean;
  isOverdue?: boolean;
  daysUntilDue?: number;
  totalSavings?: number;
  fulfillmentPercentage?: number;
  availableActions?: string[];
}

export interface CreateB2BOrderInput {
  customerId: string;
  salesRepId?: string;
  accountManagerId?: string;
  quoteId?: string;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  paymentTerms: string;
  currency: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }>;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateB2BOrderInput {
  status?: B2BOrderStatus;
  requestedDeliveryDate?: Date;
  paymentTerms?: string;
  approvalNotes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface B2BOrderItem extends BaseEntity {
  orderId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  discountPercentage: number;
  discountAmount: number;
  lineTotal: number;
  quantityShipped: number;
  quantityBackordered: number;
  notes?: string;
  // Computed fields
  isBackordered?: boolean;
  totalSavings?: number;
}

export enum B2BOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

// Quote Types
export interface Quote extends BaseEntity {
  quoteNumber: string;
  customerId: string;
  salesRepId?: string;
  accountManagerId?: string;
  status: QuoteStatus;
  quoteDate: Date;
  expirationDate: Date;
  validUntil: Date;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  sentAt?: Date;
  sentTo?: string[];
  acceptedAt?: Date;
  convertedToOrderId?: string;
  convertedAt?: Date;
  items: QuoteItem[];
  terms?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface QuoteItem extends BaseEntity {
  quoteId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  discountPercentage: number;
  discountAmount: number;
  lineTotal: number;
  notes?: string;
}

export enum QuoteStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CONVERTED = 'converted',
  CANCELLED = 'cancelled'
}

// Contract Types
export interface Contract extends BaseEntity {
  contractNumber: string;
  customerId: string;
  salesRepId?: string;
  accountManagerId?: string;
  status: ContractStatus;
  contractType: string;
  startDate: Date;
  endDate: Date;
  contractValue: number;
  currency: string;
  paymentTerms: string;
  autoRenewal: boolean;
  renewalNoticeDays?: number;
  customerSignedAt?: Date;
  companySignedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  pricingTerms?: Record<string, unknown>;
  terms?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  // Computed fields
  isExpired?: boolean;
  daysUntilExpiration?: number;
  requiresRenewalNotice?: boolean;
}

export enum ContractStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  RENEWED = 'renewed'
}

// Pricing Types
export interface PricingRule extends BaseEntity {
  name: string;
  description?: string;
  ruleType: PricingRuleType;
  targetType: PricingTargetType;
  targetId?: string;
  discountType: DiscountType;
  discountValue: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  minimumAmount?: number;
  effectiveDate: Date;
  expirationDate?: Date;
  priority: number;
  isActive: boolean;
  // Computed fields
  isCurrentlyActive?: boolean;
}

export enum PricingRuleType {
  CUSTOMER_SPECIFIC = 'customer_specific',
  PRODUCT_SPECIFIC = 'product_specific',
  CATEGORY_SPECIFIC = 'category_specific',
  VOLUME_DISCOUNT = 'volume_discount',
  CONTRACT_PRICING = 'contract_pricing'
}

export enum PricingTargetType {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  CATEGORY = 'category',
  GLOBAL = 'global'
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FIXED_PRICE = 'fixed_price'
}

export interface CustomerPricing {
  customerId: string;
  productId: string;
  quantity: number;
  listPrice: number;
  customerPrice: number;
  discountPercentage: number;
  discountAmount: number;
  appliedRules: PricingRule[];
  pricingTier?: string;
  contractPricing: boolean;
  totalSavings: number;
  savingsPercentage: number;
}

export interface CreatePricingRuleInput {
  name: string;
  description?: string;
  ruleType: PricingRuleType;
  targetType: PricingTargetType;
  targetId?: string;
  discountType: DiscountType;
  discountValue: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  minimumAmount?: number;
  effectiveDate: Date;
  expirationDate?: Date;
  priority?: number;
}

export interface UpdatePricingRuleInput {
  name?: string;
  description?: string;
  ruleType?: PricingRuleType;
  targetType?: PricingTargetType;
  targetId?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  minimumAmount?: number;
  effectiveDate?: Date;
  expirationDate?: Date;
  priority?: number;
  isActive?: boolean;
}

// Territory Types
export interface Territory extends BaseEntity {
  territoryCode: string;
  name: string;
  description?: string;
  territoryType: TerritoryType;
  primarySalesRepId?: string;
  secondarySalesRepIds?: string[];
  managerId?: string;
  isActive: boolean;
  revenueTarget?: number;
  customerTarget?: number;
  regions?: string[];
  postalCodes?: string[];
  states?: string[];
  countries?: string[];
  // Computed fields
  customerCount?: number;
  currentRevenue?: number;
  targetAchievement?: number;
}

export enum TerritoryType {
  GEOGRAPHIC = 'geographic',
  INDUSTRY = 'industry',
  ACCOUNT_SIZE = 'account_size',
  PRODUCT_LINE = 'product_line'
}

export interface TerritoryCustomerAssignment extends BaseEntity {
  territoryId: string;
  customerId: string;
  assignedBy: string;
  assignedAt: Date;
  isActive: boolean;
  notes?: string;
}

export interface TerritoryPerformance {
  territoryId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalRevenue: number;
    customerCount: number;
    orderCount: number;
    averageOrderValue: number;
    revenueTarget: number;
    targetAchievement: number;
    revenueGrowth: number;
    customerGrowth: number;
  };
  topCustomers: Array<{
    customerId: string;
    companyName: string;
    revenue: number;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    revenue: number;
    orders: number;
    customers: number;
  }>;
}

// Workflow Types
export interface Workflow extends BaseEntity {
  workflowType: WorkflowType;
  entityType: EntityType;
  entityId: string;
  status: WorkflowStatus;
  priority: WorkflowPriority;
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  currentStepId?: string;
  totalSteps: number;
  completedSteps: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  // Computed fields
  isExpired?: boolean;
  daysUntilExpiration?: number;
  canBeApproved?: boolean;
  canBeRejected?: boolean;
}

export interface ApprovalStep extends BaseEntity {
  workflowId: string;
  stepNumber: number;
  stepType: ApprovalStepType;
  approverId: string;
  status: ApprovalStepStatus;
  requiredBy?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  approvalNotes?: string;
  rejectionReason?: string;
  reassignedFrom?: string;
  reassignedTo?: string;
  reassignedAt?: Date;
  reassignmentReason?: string;
}

export enum WorkflowType {
  ORDER_APPROVAL = 'order_approval',
  QUOTE_APPROVAL = 'quote_approval',
  CONTRACT_APPROVAL = 'contract_approval',
  PRICING_APPROVAL = 'pricing_approval',
  CREDIT_APPROVAL = 'credit_approval'
}

export enum EntityType {
  ORDER = 'order',
  QUOTE = 'quote',
  CONTRACT = 'contract',
  PRICING_RULE = 'pricing_rule',
  CUSTOMER = 'customer'
}

export interface WorkflowApproval extends ApprovalStep {
  workflowType: WorkflowType;
  entityType: EntityType;
  entityId: string;
  initiatedBy: string;
  approvalNotes?: string;
}

export interface WorkflowHistoryEntry extends BaseEntity {
  workflowId: string;
  entityId: string;
  entityType: EntityType;
  action: string;
  actor: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  previousStatus?: string;
  newStatus?: string;
}

export enum WorkflowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum WorkflowPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ApprovalStepType {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  CONDITIONAL = 'conditional'
}

export enum ApprovalStepStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
  REASSIGNED = 'reassigned'
}

// Address Type
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Event Types for Real-time Updates
export interface CRMRealtimeEvent {
  type: 'customer_created' | 'customer_updated' | 'customer_deleted' |
        'campaign_created' | 'campaign_updated' | 'campaign_activated' |
        'loyalty_transaction' | 'communication_scheduled' |
        'b2b_order_created' | 'b2b_order_updated' | 'b2b_order_approved' |
        'quote_created' | 'quote_sent' | 'quote_converted' |
        'contract_expiring' | 'contract_renewed' |
        'pricing_rule_updated' | 'workflow_step_approved';
  data: unknown
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
