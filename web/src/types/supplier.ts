// Supplier Module Types
// These types mirror the backend GraphQL schema for type safety

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  legalName?: string;
  supplierType: SupplierType;
  status: SupplierStatus;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  businessRegistrationNumber?: string;
  website?: string;
  description?: string;
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  currency?: string;
  certifications?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  preferredCommunicationMethod?: CommunicationType;
  isPreferredSupplier?: boolean;
  leadTimeDays?: number;
  minimumOrderAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  
  // Relations
  contacts?: SupplierContact[];
  communications?: SupplierCommunication[];
  evaluations?: SupplierEvaluation[];
  purchaseOrders?: PurchaseOrder[];
  latestEvaluation?: SupplierEvaluation;
  performanceMetrics?: SupplierPerformanceMetrics[];
  currentPerformanceScore?: SupplierPerformanceScore;
}

export interface SupplierContact {
  id: string;
  supplierId: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  isPrimary?: boolean;
  preferredContactMethod?: CommunicationType;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  supplier?: Supplier;
}

export interface SupplierCommunication {
  id: string;
  supplierId: string;
  contactId?: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content?: string;
  fromName?: string;
  fromEmail?: string;
  toName?: string;
  toEmail?: string;
  communicationDate?: Date;
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpCompleted?: boolean;
  attachments?: Record<string, unknown>[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  supplier?: Supplier;
  contact?: SupplierContact;
}

export interface SupplierEvaluation {
  id: string;
  supplierId: string;
  evaluationPeriodStart: Date;
  evaluationPeriodEnd: Date;
  evaluationDate?: Date;
  overallScore: number;
  overallRating: SupplierRating;
  qualityScore?: number;
  deliveryScore?: number;
  pricingScore?: number;
  serviceScore?: number;
  reliabilityScore?: number;
  complianceScore?: number;
  onTimeDeliveryRate?: number;
  qualityDefectRate?: number;
  responseTime?: number;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  actionItems?: Record<string, unknown>[];
  customScores?: Record<string, number>;
  attachments?: Record<string, unknown>[];
  status?: EvaluationStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  supplier?: Supplier;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  priority: PurchaseOrderPriority;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  deliveryAddress?: Address;
  billingAddress?: Address;
  shippingMethod?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  description?: string;
  internalNotes?: string;
  supplierNotes?: string;
  currency?: string;
  subtotalAmount: number;
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  trackingNumber?: string;
  customFields?: Record<string, unknown>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  
  // Relations
  supplier?: Supplier;
  lineItems?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId?: string;
  itemDescription: string;
  sku?: string;
  quantityOrdered: number;
  quantityReceived?: number;
  quantityInvoiced?: number;
  unitPrice: number;
  totalPrice: number;
  uom?: string;
  specifications?: Record<string, unknown>;
  requestedDeliveryDate?: Date;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface SupplierPerformanceMetrics {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeDeliveryRate: number;
  averageLeadTime: number;
  averageResponseTime: number;
  qualityScore: number;
  defectRate: number;
  returnRate: number;
  complianceScore: number;
  period: string;
}

export interface SupplierPerformanceScore {
  overallScore: number;
  qualityScore: number;
  deliveryScore: number;
  serviceScore: number;
  communicationScore: number;
}

export interface SpendAnalysis {
  totalSpend: number;
  spendBySupplier: SpendBySupplier[];
  spendByCategory: SpendByCategory[];
  spendByMonth: SpendByMonth[];
  topSuppliers: TopSupplier[];
}

export interface SpendBySupplier {
  supplierId: string;
  supplierName: string;
  amount: number;
  percentage: number;
}

export interface SpendByCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface SpendByMonth {
  month: string;
  amount: number;
}

export interface TopSupplier {
  supplierId: string;
  supplierName: string;
  totalSpend: number;
  orderCount: number;
}

export interface EDIDocument {
  id: string;
  supplierId: string;
  documentType: EDIDocumentType;
  direction: EDIDirection;
  status: EDIStatus;
  rawContent: string;
  processedData?: Record<string, unknown>;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
}

// Enums
export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_APPROVAL = 'pending_approval',
  SUSPENDED = 'suspended',
  BLACKLISTED = 'blacklisted',
}

export enum SupplierType {
  MANUFACTURER = 'manufacturer',
  DISTRIBUTOR = 'distributor',
  WHOLESALER = 'wholesaler',
  SERVICE_PROVIDER = 'service_provider',
  CONTRACTOR = 'contractor',
  CONSULTANT = 'consultant',
}

export enum SupplierRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  POOR = 'poor',
  UNRATED = 'unrated',
}

export enum CommunicationType {
  EMAIL = 'email',
  PHONE = 'phone',
  MEETING = 'meeting',
  VIDEO_CALL = 'video_call',
  CHAT = 'chat',
  LETTER = 'letter',
  FAX = 'fax',
}

export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum PaymentTerms {
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  COD = 'cod',
  PREPAID = 'prepaid',
  CUSTOM = 'custom',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT_TO_SUPPLIER = 'sent_to_supplier',
  ACKNOWLEDGED = 'acknowledged',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

export enum PurchaseOrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum ReceiptStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  COMPLETE = 'complete',
  OVER_RECEIVED = 'over_received',
}

export enum InvoiceMatchStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  VARIANCE = 'variance',
  DISPUTED = 'disputed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  PAID = 'paid',
  OVERDUE = 'overdue',
  DISPUTED = 'disputed',
}

export enum EvaluationStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum EDIDocumentType {
  PURCHASE_ORDER = 'purchase_order',
  INVOICE = 'invoice',
  RECEIPT = 'receipt',
  CATALOG = 'catalog',
}

export enum EDIDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum EDIStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

// Input Types
export interface CreateSupplierInput {
  supplierCode: string;
  name: string;
  legalName?: string;
  supplierType: SupplierType;
  status?: SupplierStatus;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  businessRegistrationNumber?: string;
  website?: string;
  description?: string;
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  currency?: string;
  certifications?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  preferredCommunicationMethod?: CommunicationType;
  isPreferredSupplier?: boolean;
  leadTimeDays?: number;
  minimumOrderAmount?: number;
}

export interface UpdateSupplierInput {
  name?: string;
  legalName?: string;
  supplierType?: SupplierType;
  status?: SupplierStatus;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  businessRegistrationNumber?: string;
  website?: string;
  description?: string;
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  currency?: string;
  certifications?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
  preferredCommunicationMethod?: CommunicationType;
  isPreferredSupplier?: boolean;
  leadTimeDays?: number;
  minimumOrderAmount?: number;
}

export interface SupplierFilterInput {
  search?: string;
  status?: SupplierStatus;
  supplierType?: SupplierType;
  rating?: SupplierRating;
  preferredOnly?: boolean;
  tags?: string[];
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

export interface PurchaseOrderFilterInput {
  status?: PurchaseOrderStatus;
  priority?: PurchaseOrderPriority;
  supplierId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

export interface CreatePurchaseOrderInput {
  poNumber: string;
  supplierId: string;
  status?: PurchaseOrderStatus;
  priority?: PurchaseOrderPriority;
  orderDate: string;
  requestedDeliveryDate?: string;
  deliveryAddress?: Address;
  billingAddress?: Address;
  shippingMethod?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  description?: string;
  internalNotes?: string;
  supplierNotes?: string;
  currency?: string;
  subtotalAmount: number;
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
  lineItems?: CreatePurchaseOrderItemInput[];
}

export interface UpdatePurchaseOrderInput {
  poNumber?: string;
  status?: PurchaseOrderStatus;
  priority?: PurchaseOrderPriority;
  orderDate?: string;
  requestedDeliveryDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryAddress?: Address;
  billingAddress?: Address;
  shippingMethod?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  description?: string;
  internalNotes?: string;
  supplierNotes?: string;
  currency?: string;
  subtotalAmount?: number;
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  trackingNumber?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  lineItems?: UpdatePurchaseOrderItemInput[];
}

export interface CreatePurchaseOrderItemInput {
  productId?: string;
  itemDescription: string;
  sku?: string;
  quantityOrdered: number;
  unitPrice: number;
  uom?: string;
  specifications?: Record<string, unknown>;
  requestedDeliveryDate?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdatePurchaseOrderItemInput {
  id?: string;
  productId?: string;
  itemDescription?: string;
  sku?: string;
  quantityOrdered?: number;
  quantityReceived?: number;
  quantityInvoiced?: number;
  unitPrice?: number;
  uom?: string;
  specifications?: Record<string, unknown>;
  requestedDeliveryDate?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface DateRangeInput {
  startDate: string;
  endDate: string;
}

// Supplier Communication Input Types
export interface CreateSupplierCommunicationInput {
  supplierId: string;
  contactId?: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content?: string;
  fromName?: string;
  fromEmail?: string;
  toName?: string;
  toEmail?: string;
  communicationDate?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  attachments?: Record<string, unknown>[];
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateSupplierCommunicationInput {
  type?: CommunicationType;
  direction?: CommunicationDirection;
  subject?: string;
  content?: string;
  fromName?: string;
  fromEmail?: string;
  toName?: string;
  toEmail?: string;
  communicationDate?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  followUpCompleted?: boolean;
  attachments?: Record<string, unknown>[];
  tags?: string[];
  customFields?: Record<string, unknown>;
}

// Supplier Contact Input Types
export interface CreateSupplierContactInput {
  supplierId: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  isPrimary?: boolean;
  preferredContactMethod?: CommunicationType;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateSupplierContactInput {
  firstName?: string;
  lastName?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  isPrimary?: boolean;
  preferredContactMethod?: CommunicationType;
  notes?: string;
  customFields?: Record<string, unknown>;
}

// Supplier Evaluation Input Types
export interface CreateSupplierEvaluationInput {
  supplierId: string;
  evaluationPeriodStart: string;
  evaluationPeriodEnd: string;
  evaluationDate?: string;
  overallScore: number;
  overallRating: SupplierRating;
  qualityScore?: number;
  deliveryScore?: number;
  pricingScore?: number;
  serviceScore?: number;
  reliabilityScore?: number;
  complianceScore?: number;
  onTimeDeliveryRate?: number;
  qualityDefectRate?: number;
  responseTime?: number;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  actionItems?: Record<string, unknown>[];
  customScores?: Record<string, number>;
  attachments?: Record<string, unknown>[];
  status?: EvaluationStatus;
}

export interface UpdateSupplierEvaluationInput {
  evaluationPeriodStart?: string;
  evaluationPeriodEnd?: string;
  evaluationDate?: string;
  overallScore?: number;
  overallRating?: SupplierRating;
  qualityScore?: number;
  deliveryScore?: number;
  pricingScore?: number;
  serviceScore?: number;
  reliabilityScore?: number;
  complianceScore?: number;
  onTimeDeliveryRate?: number;
  qualityDefectRate?: number;
  responseTime?: number;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  actionItems?: Record<string, unknown>[];
  customScores?: Record<string, number>;
  attachments?: Record<string, unknown>[];
  status?: EvaluationStatus;
  approvedBy?: string;
  approvedAt?: string;
}

// Stats and Analytics Types
export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  preferredSuppliers: number;
  averageRating: number;
}

export interface PurchaseOrderStats {
  totalOrders: number;
  draftOrders: number;
  pendingApproval: number;
  approvedOrders: number;
  totalValue: number;
  averageOrderValue: number;
}

export interface SupplierPurchaseStats {
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeDeliveryRate: number;
}

export interface CommunicationStats {
  totalCommunications: number;
  pendingFollowUps: number;
  averageResponseTime: number;
}

export interface EvaluationStats {
  totalEvaluations: number;
  averageOverallScore: number;
  averageQualityScore: number;
  averageDeliveryScore: number;
  averageServiceScore: number;
  pendingApproval: number;
}

// Connection Types for Pagination
export interface SupplierConnection {
  edges: SupplierEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface SupplierEdge {
  node: Supplier;
  cursor: string;
}

export interface PurchaseOrderConnection {
  edges: PurchaseOrderEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface PurchaseOrderEdge {
  node: PurchaseOrder;
  cursor: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}
