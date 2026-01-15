import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TransactionPostingService } from '../services/transaction-posting.service';

@Injectable()
export class TransactionPostedHandler {
  constructor(
    private readonly transactionPostingService: TransactionPostingService,
  ) {}

  @OnEvent('transaction.created')
  async handleTransactionCreated(payload: {
    tenantId: string;
    transaction: any;
    userId: string;
  }) {
    try {
      await this.transactionPostingService.postTransactionToAccounting(
        payload.tenantId,
        payload.transaction,
        payload.userId
      );
    } catch (error) {
      console.error('Failed to post transaction to accounting:', error);
      // In a production system, you might want to:
      // 1. Log the error to a monitoring system
      // 2. Queue the transaction for retry
      // 3. Send an alert to administrators
    }
  }

  @OnEvent('inventory.adjusted')
  async handleInventoryAdjusted(payload: {
    tenantId: string;
    adjustment: any;
    userId: string;
  }) {
    try {
      await this.transactionPostingService.postInventoryAdjustmentToAccounting(
        payload.tenantId,
        payload.adjustment,
        payload.userId
      );
    } catch (error) {
      console.error('Failed to post inventory adjustment to accounting:', error);
    }
  }

  @OnEvent('payroll.processed')
  async handlePayrollProcessed(payload: {
    tenantId: string;
    payroll: any;
    userId: string;
  }) {
    try {
      await this.transactionPostingService.postPayrollToAccounting(
        payload.tenantId,
        payload.payroll,
        payload.userId
      );
    } catch (error) {
      console.error('Failed to post payroll to accounting:', error);
    }
  }
}