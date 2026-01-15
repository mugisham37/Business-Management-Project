import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateTransactionDto, CreateTransactionItemDto } from '../dto/transaction.dto';

@Injectable()
export class TransactionValidationService {
  
  validateTransaction(transactionData: CreateTransactionDto): void {
    this.validateBasicFields(transactionData);
    this.validateItems(transactionData.items);
    this.validateAmounts(transactionData);
    this.validateBusinessRules(transactionData);
  }

  private validateBasicFields(transactionData: CreateTransactionDto): void {
    if (!transactionData.locationId) {
      throw new BadRequestException('Location ID is required');
    }

    if (!transactionData.items || transactionData.items.length === 0) {
      throw new BadRequestException('Transaction must have at least one item');
    }

    if (!transactionData.paymentMethod) {
      throw new BadRequestException('Payment method is required');
    }
  }

  private validateItems(items: CreateTransactionItemDto[]): void {
    for (const [index, item] of items.entries()) {
      if (!item.productId) {
        throw new BadRequestException(`Item ${index + 1}: Product ID is required`);
      }

      if (!item.productSku) {
        throw new BadRequestException(`Item ${index + 1}: Product SKU is required`);
      }

      if (!item.productName) {
        throw new BadRequestException(`Item ${index + 1}: Product name is required`);
      }

      if (item.quantity <= 0) {
        throw new BadRequestException(`Item ${index + 1}: Quantity must be greater than 0`);
      }

      if (item.unitPrice < 0) {
        throw new BadRequestException(`Item ${index + 1}: Unit price cannot be negative`);
      }

      if (item.discountAmount && item.discountAmount < 0) {
        throw new BadRequestException(`Item ${index + 1}: Discount amount cannot be negative`);
      }

      // Validate that discount doesn't exceed line total
      const lineTotal = item.quantity * item.unitPrice;
      if (item.discountAmount && item.discountAmount > lineTotal) {
        throw new BadRequestException(
          `Item ${index + 1}: Discount amount cannot exceed line total`
        );
      }
    }
  }

  private validateAmounts(transactionData: CreateTransactionDto): void {
    if (transactionData.taxAmount && transactionData.taxAmount < 0) {
      throw new BadRequestException('Tax amount cannot be negative');
    }

    if (transactionData.discountAmount && transactionData.discountAmount < 0) {
      throw new BadRequestException('Discount amount cannot be negative');
    }

    if (transactionData.tipAmount && transactionData.tipAmount < 0) {
      throw new BadRequestException('Tip amount cannot be negative');
    }

    // Calculate expected subtotal
    const calculatedSubtotal = transactionData.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return sum + lineTotal;
    }, 0);

    // Validate that amounts make sense
    const taxAmount = transactionData.taxAmount || 0;
    const discountAmount = transactionData.discountAmount || 0;
    const tipAmount = transactionData.tipAmount || 0;
    
    const expectedTotal = calculatedSubtotal + taxAmount - discountAmount + tipAmount;

    if (expectedTotal < 0) {
      throw new BadRequestException('Transaction total cannot be negative');
    }

    // Validate discount doesn't exceed subtotal
    if (discountAmount > calculatedSubtotal) {
      throw new BadRequestException('Discount amount cannot exceed subtotal');
    }
  }

  private validateBusinessRules(transactionData: CreateTransactionDto): void {
    // Validate maximum items per transaction
    const MAX_ITEMS_PER_TRANSACTION = 100;
    if (transactionData.items.length > MAX_ITEMS_PER_TRANSACTION) {
      throw new BadRequestException(
        `Transaction cannot have more than ${MAX_ITEMS_PER_TRANSACTION} items`
      );
    }

    // Validate maximum transaction amount
    const calculatedSubtotal = transactionData.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return sum + lineTotal;
    }, 0);

    const taxAmount = transactionData.taxAmount || 0;
    const discountAmount = transactionData.discountAmount || 0;
    const tipAmount = transactionData.tipAmount || 0;
    const total = calculatedSubtotal + taxAmount - discountAmount + tipAmount;

    const MAX_TRANSACTION_AMOUNT = 100000; // $100,000
    if (total > MAX_TRANSACTION_AMOUNT) {
      throw new BadRequestException(
        `Transaction amount cannot exceed $${MAX_TRANSACTION_AMOUNT.toLocaleString()}`
      );
    }

    // Validate quantity limits
    const MAX_QUANTITY_PER_ITEM = 10000;
    for (const [index, item] of transactionData.items.entries()) {
      if (item.quantity > MAX_QUANTITY_PER_ITEM) {
        throw new BadRequestException(
          `Item ${index + 1}: Quantity cannot exceed ${MAX_QUANTITY_PER_ITEM}`
        );
      }
    }

    // Validate notes length
    if (transactionData.notes && transactionData.notes.length > 1000) {
      throw new BadRequestException('Transaction notes cannot exceed 1000 characters');
    }
  }

  validateRefund(originalAmount: number, refundAmount: number, alreadyRefunded: number = 0): void {
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    const remainingAmount = originalAmount - alreadyRefunded;
    if (refundAmount > remainingAmount) {
      throw new BadRequestException(
        `Refund amount cannot exceed remaining amount of $${remainingAmount.toFixed(2)}`
      );
    }
  }

  validateVoid(transactionStatus: string): void {
    const VOIDABLE_STATUSES = ['pending', 'processing', 'completed'];
    
    if (!VOIDABLE_STATUSES.includes(transactionStatus)) {
      throw new BadRequestException(
        `Transaction with status '${transactionStatus}' cannot be voided`
      );
    }
  }

  validatePaymentAmount(transactionTotal: number, paymentAmount: number): void {
    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    // Allow overpayment for cash transactions (change will be calculated)
    // But prevent excessive overpayment
    const MAX_OVERPAYMENT_RATIO = 2; // 200% of transaction total
    if (paymentAmount > transactionTotal * MAX_OVERPAYMENT_RATIO) {
      throw new BadRequestException(
        `Payment amount cannot exceed ${MAX_OVERPAYMENT_RATIO * 100}% of transaction total`
      );
    }
  }

  validateInventoryAvailability(
    items: CreateTransactionItemDto[],
    inventoryLevels: Map<string, number>
  ): void {
    for (const [index, item] of items.entries()) {
      const availableQuantity = inventoryLevels.get(item.productId) || 0;
      
      if (item.quantity > availableQuantity) {
        throw new BadRequestException(
          `Item ${index + 1} (${item.productName}): Insufficient inventory. ` +
          `Requested: ${item.quantity}, Available: ${availableQuantity}`
        );
      }
    }
  }

  validateOfflineTransaction(transactionData: CreateTransactionDto): void {
    if (!transactionData.isOfflineTransaction) {
      return;
    }

    // Offline transactions have additional restrictions
    if (transactionData.paymentMethod !== 'cash') {
      throw new BadRequestException(
        'Offline transactions are only supported for cash payments'
      );
    }

    // Validate offline transaction limits
    const calculatedSubtotal = transactionData.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
      return sum + lineTotal;
    }, 0);

    const MAX_OFFLINE_AMOUNT = 1000; // $1,000 limit for offline transactions
    if (calculatedSubtotal > MAX_OFFLINE_AMOUNT) {
      throw new BadRequestException(
        `Offline transactions cannot exceed $${MAX_OFFLINE_AMOUNT}`
      );
    }
  }
}