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
  status: string;
  itemCount: number;
  notes?: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference?: string;
  isOfflineTransaction: boolean;
  offlineTimestamp?: Date;
  syncedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
  version: number;
  isActive: boolean;
}

export interface TransactionItem {
  id: string;
  tenantId: string;
  transactionId: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  variantInfo: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
  version: number;
  isActive: boolean;
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  transactionId: string;
  paymentMethod: string;
  amount: number;
  status: string;
  paymentProvider?: string;
  providerTransactionId?: string;
  providerResponse: Record<string, any>;
  processedAt?: Date;
  failureReason?: string;
  refundedAmount: number;
  refundedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
  version: number;
  isActive: boolean;
}

export interface OfflineTransactionQueue {
  id: string;
  tenantId: string;
  queueId: string;
  deviceId: string;
  transactionData: Record<string, any>;
  operationType: string;
  isSynced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: Date;
  syncedAt?: Date;
  syncErrors: any[];
  priority: number;
  sequenceNumber: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: Date;
  version: number;
  isActive: boolean;
}

export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
  payments: PaymentRecord[];
}