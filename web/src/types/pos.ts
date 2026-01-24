/**
 * POS Module Types
 * Requirements: 11.1, 11.2, 11.3
 */

// Core POS Types
export interface POSSession {
  id: string;
  sessionNumber: string;
  employeeId: string;
  locationId: string;
  status: POSSessionStatus;
  openingCash: number;
  closingCash?: number;
  expectedCash: number;
  cashVariance?: number;
  transactionCount: number;
  totalSales: number;
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum POSSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  SUSPENDED = 'suspended',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  DIGITAL_WALLET = 'digital_wallet',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  STORE_CREDIT = 'store_credit',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  VOIDED = 'voided',
}

// Transaction Types
export interface Transaction {
  id: string;
  tenantId: string;
  transactionNumber: string;
  customerId?: string;
  locationId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  status: TransactionStatus;
  itemCount: number;
  notes?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  paymentReference?: string;
  isOfflineTransaction: boolean;
  offlineTimestamp?: Date;
  syncedAt?: Date;
  metadata: Record<string, any>;
  items: TransactionItem[];
  payments: PaymentRecord[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface TransactionItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  variantInfo?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PaymentRecord {
  id: string;
  paymentMethod: PaymentMethod;
  amount: number;
  status: string;
  paymentProvider?: string;
  providerTransactionId?: string;
  processedAt?: Date;
  refundedAmount: number;
  refundedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

// Input Types
export interface CreateTransactionInput {
  customerId?: string;
  locationId: string;
  items: CreateTransactionItemInput[];
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  notes?: string;
  isOfflineTransaction?: boolean;
  offlineTimestamp?: Date;
  metadata?: Record<string, any>;
}

export interface CreateTransactionItemInput {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  variantInfo?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateTransactionInput {
  status?: TransactionStatus;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface VoidTransactionInput {
  reason: string;
  notes?: string;
}

export interface RefundTransactionInput {
  amount: number;
  reason: string;
  notes?: string;
  refundMethod?: PaymentMethod;
}

// Payment Types
export interface PaymentRequest {
  paymentMethod: PaymentMethod;
  amount: number;
  paymentReference?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  providerTransactionId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// Receipt Types
export interface ReceiptOptions {
  template?: string;
  includeQR?: boolean;
  includeLogo?: boolean;
  customFields?: Record<string, any>;
}

export interface EmailReceiptOptions extends ReceiptOptions {
  email: string;
  subject?: string;
  attachPDF?: boolean;
}

export interface SmsReceiptOptions extends ReceiptOptions {
  phoneNumber: string;
  message?: string;
}

export interface PrintReceiptOptions extends ReceiptOptions {
  printerId: string;
  copies?: number;
}

// Offline Sync Types
export interface OfflineQueueItem {
  id: string;
  operation: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface SyncConflict {
  id: string;
  operation: string;
  localData: any;
  serverData: any;
  conflictType: 'data_conflict' | 'version_conflict' | 'deleted_conflict';
  resolution?: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  resolvedAt?: Date;
}

// Reconciliation Types
export interface ReconciliationReport {
  id: string;
  date: Date;
  locationId: string;
  totalSales: number;
  totalTransactions: number;
  paymentMethodBreakdown: PaymentMethodSummary[];
  discrepancies: ReconciliationDiscrepancy[];
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
}

export interface PaymentMethodSummary {
  paymentMethod: PaymentMethod;
  transactionCount: number;
  totalAmount: number;
  expectedAmount: number;
  variance: number;
}

export interface ReconciliationDiscrepancy {
  type: string;
  description: string;
  amount: number;
  transactionIds: string[];
}

// Configuration Types
export interface POSConfiguration {
  locationId: string;
  taxRate: number;
  currency: string;
  receiptTemplate: string;
  printerSettings: PrinterConfiguration[];
  paymentMethods: PaymentMethod[];
  offlineMode: boolean;
  autoSync: boolean;
  syncInterval: number;
}

export interface PrinterConfiguration {
  id: string;
  name: string;
  type: string;
  connectionType: string;
  ipAddress?: string;
  port?: number;
  devicePath?: string;
  paperWidth: number;
  isDefault: boolean;
}

// Analytics Types
export interface DailySalesSummary {
  date: Date;
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  cashSales: number;
  cardSales: number;
  voidedTransactions: number;
  refundedAmount: number;
  topSellingItems: TopSellingItem[];
}

export interface TopSellingItem {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

// Connection Types for GraphQL
export interface TransactionConnection {
  edges: TransactionEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface TransactionEdge {
  node: Transaction;
  cursor: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// Filter Types
export interface TransactionFilter {
  locationId?: string;
  status?: TransactionStatus;
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  minAmount?: number;
  maxAmount?: number;
}

// Error Types
export interface POSError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

// State Types
export interface POSState {
  currentSession?: POSSession;
  activeTransaction?: Transaction;
  offlineMode: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  queuedOperations: OfflineQueueItem[];
  conflicts: SyncConflict[];
}