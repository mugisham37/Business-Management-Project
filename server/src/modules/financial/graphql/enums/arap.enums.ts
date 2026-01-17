import { registerEnumType } from '@nestjs/graphql';

export enum InvoiceType {
  RECEIVABLE = 'receivable',
  PAYABLE = 'payable',
}

export enum PaymentType {
  RECEIVED = 'received',
  MADE = 'made',
}

export enum ARAPStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  VOID = 'void',
}

export enum PaymentMethod {
  CASH = 'cash',
  CHECK = 'check',
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  ACH = 'ach',
  WIRE = 'wire',
  OTHER = 'other',
}

export enum ReportType {
  RECEIVABLE = 'receivable',
  PAYABLE = 'payable',
}

// Register enums with GraphQL
registerEnumType(InvoiceType, {
  name: 'InvoiceType',
  description: 'Type of invoice - receivable (customer owes us) or payable (we owe supplier)',
});

registerEnumType(PaymentType, {
  name: 'PaymentType',
  description: 'Type of payment - received (from customer) or made (to supplier)',
});

registerEnumType(ARAPStatus, {
  name: 'ARAPStatus',
  description: 'Status of invoice or payment',
});

registerEnumType(PaymentMethod, {
  name: 'PaymentMethod',
  description: 'Method used for payment',
});

registerEnumType(ReportType, {
  name: 'ReportType',
  description: 'Type of aging report to generate',
});