import { registerEnumType } from '@nestjs/graphql';

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  REVERSED = 'reversed',
  VOIDED = 'voided',
}

export enum ReconciliationStatus {
  UNRECONCILED = 'unreconciled',
  RECONCILED = 'reconciled',
  DISPUTED = 'disputed',
}

// Register enums with GraphQL
registerEnumType(JournalEntryStatus, {
  name: 'JournalEntryStatus',
  description: 'The status of a journal entry',
});

registerEnumType(ReconciliationStatus, {
  name: 'ReconciliationStatus',
  description: 'The reconciliation status of a journal entry line',
});