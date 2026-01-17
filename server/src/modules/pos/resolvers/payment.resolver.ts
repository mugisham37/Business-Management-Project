import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { StripePaymentProvider } from '../providers/stripe-payment.provider';
import { CashPaymentProvider } from '../providers/cash-payment.provider';
import { MobileMoneyProvider } from '../providers/mobile-money.provider';
import { DataLoaderService } from '../../../common/graphql/dataloader.service';
import { BaseResolver } from '../../../common/graphql/base.resolver';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { MutationResponse } from '../../../common/graphql/mutation-response.types';
import { PaymentResult, PaymentRecord } from '../types/transaction.types';
import { PaymentRequestInput } from '../inputs/transaction.input';

// NEW: GraphQL types for payment provider functionality
import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType({ description: 'Payment method validation result' })
export class PaymentValidationResult {
  @Field()
  valid!: boolean;

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  provider?: string;

  @Field({ nullable: true })
  supportedFeatures?: string[];
}

@ObjectType({ description: 'Cash drawer status' })
export class CashDrawerStatus {
  @Field(() => Float)
  currentAmount!: number;

  @Field(() => Float)
  expectedAmount!: number;

  @Field(() => Float)
  variance!: number;

  @Field()
  lastCounted!: Date;

  @Field(() => [DenominationCount])
  changeAvailable!: DenominationCount[];
}

@ObjectType({ description: 'Denomination count' })
export class DenominationCount {
  @Field(() => Float)
  denomination!: number;

  @Field(() => Int)
  count!: number;
}

@ObjectType({ description: 'Change calculation result' })
export class ChangeResult {
  @Field(() => Float)
  changeAmount!: number;

  @Field(() => [DenominationCount])
  changeDenominations!: DenominationCount[];
}

@ObjectType({ description: 'Mobile money account status' })
export class MobileMoneyAccountStatus {
  @Field()
  isActive!: boolean;

  @Field()
  provider!: string;

  @Field({ nullable: true })
  accountName?: string;

  @Field(() => Float, { nullable: true })
  balance?: number;

  @Field({ nullable: true })
  currency?: string;
}

@ObjectType({ description: 'Payment request initiation result' })
export class PaymentRequestResult {
  @Field()
  requestId!: string;

  @Field()
  status!: string;

  @Field()
  message!: string;
}

@ObjectType({ description: 'Stripe payment method' })
export class StripePaymentMethod {
  @Field()
  paymentMethodId!: string;

  @Field()
  last4!: string;

  @Field()
  brand!: string;

  @Field()
  expiryMonth!: number;

  @Field()
  expiryYear!: number;
}

@ObjectType({ description: 'Payment status information' })
export class PaymentStatusInfo {
  @Field()
  status!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;

  @Field({ nullable: true })
  metadata?: any;
}

@ObjectType({ description: 'Cash count record' })
export class CashCountRecord {
  @Field(() => Float)
  totalAmount!: number;

  @Field(() => Float)
  variance!: number;

  @Field()
  countId!: string;

  @Field()
  countedBy!: string;

  @Field()
  countedAt!: Date;
}

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentResolver extends BaseResolver {
  constructor(
    protected override readonly dataLoaderService: DataLoaderService,
    private readonly paymentService: PaymentService,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly cashProvider: CashPaymentProvider,
    private readonly mobileMoneyProvider: MobileMoneyProvider,
  ) {
    super(dataLoaderService);
  }

  // Payment Service Queries
  @Query(() => [PaymentRecord], { description: 'Get payment history for transaction' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:read')
  async paymentHistory(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const payments = await this.paymentService.getPaymentHistory(tenantId, transactionId);
    return payments.map(payment => ({
      ...payment,
      paymentMethod: payment.paymentMethod as any,
    }));
  }

  @Query(() => PaymentValidationResult, { description: 'Validate payment method' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:payment')
  async validatePaymentMethod(
    @Args('paymentMethod') paymentMethod: string,
    @Args('amount') amount: number,
    @Args('metadata', { nullable: true }) metadata: any,
  ): Promise<PaymentValidationResult> {
    const result = await this.paymentService.validatePaymentMethod(
      paymentMethod,
      amount,
      metadata
    );

    return {
      valid: result.valid,
      error: result.error || undefined,
      provider: paymentMethod,
      supportedFeatures: this.getPaymentMethodFeatures(paymentMethod),
    };
  }

  // Cash Provider Queries
  @Query(() => CashDrawerStatus, { description: 'Get cash drawer status' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:cash')
  async cashDrawerStatus(): Promise<CashDrawerStatus> {
    const status = await this.cashProvider.getCashDrawerStatus();
    
    return {
      currentAmount: status.currentAmount,
      expectedAmount: status.expectedAmount,
      variance: status.variance,
      lastCounted: status.lastCounted,
      changeAvailable: Object.entries(status.changeAvailable).map(([denom, count]) => ({
        denomination: parseFloat(denom),
        count,
      })),
    };
  }

  // Mobile Money Provider Queries
  @Query(() => MobileMoneyAccountStatus, { description: 'Check mobile money account status' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:mobile_money')
  async mobileMoneyAccountStatus(
    @Args('phoneNumber') phoneNumber: string,
  ): Promise<MobileMoneyAccountStatus> {
    return this.mobileMoneyProvider.checkAccountStatus(phoneNumber);
  }

  // Stripe Provider Queries
  @Query(() => PaymentStatusInfo, { description: 'Get Stripe payment status' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:stripe')
  async stripePaymentStatus(
    @Args('providerTransactionId') providerTransactionId: string,
  ): Promise<PaymentStatusInfo> {
    return this.stripeProvider.getPaymentStatus(providerTransactionId);
  }

  // Payment Service Mutations
  @Mutation(() => PaymentResult, { description: 'Process payment' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:payment')
  async processPayment(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('input') input: PaymentRequestInput,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<PaymentResult> {
    return this.paymentService.processPayment(
      tenantId,
      transactionId,
      input as any,
      user.id
    );
  }

  @Mutation(() => MutationResponse, { description: 'Void payment' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:payment:void')
  async voidPayment(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      await this.paymentService.voidPayment(tenantId, transactionId, user.id);
      
      return {
        success: true,
        message: 'Payment voided successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to void payment',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  @Mutation(() => MutationResponse, { description: 'Refund payment' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:payment:refund')
  async refundPayment(
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('amount') amount: number,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ): Promise<MutationResponse> {
    try {
      await this.paymentService.refundPayment(tenantId, transactionId, amount, user.id);
      
      return {
        success: true,
        message: 'Payment refunded successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to refund payment',
        errors: [{ message: error.message, timestamp: new Date() }],
      };
    }
  }

  // Cash Provider Mutations
  @Mutation(() => ChangeResult, { description: 'Calculate change for cash payment' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:cash')
  async calculateChange(
    @Args('receivedAmount') receivedAmount: number,
    @Args('requiredAmount') requiredAmount: number,
  ): Promise<ChangeResult> {
    const result = await this.cashProvider.makeChange(receivedAmount, requiredAmount);
    
    return {
      changeAmount: result.changeAmount,
      changeDenominations: Object.entries(result.changeDenominations).map(([denom, count]) => ({
        denomination: parseFloat(denom),
        count,
      })),
    };
  }

  @Mutation(() => CashCountRecord, { description: 'Record cash count' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:cash:count')
  async recordCashCount(
    @Args('denominations') denominations: any,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashCountRecord> {
    const result = await this.cashProvider.recordCashCount(denominations, user.id);
    
    return {
      totalAmount: result.totalAmount,
      variance: result.variance,
      countId: result.countId,
      countedBy: user.id,
      countedAt: new Date(),
    };
  }

  // Mobile Money Provider Mutations
  @Mutation(() => PaymentRequestResult, { description: 'Initiate mobile money payment request' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:mobile_money')
  async initiateMobileMoneyPayment(
    @Args('phoneNumber') phoneNumber: string,
    @Args('amount') amount: number,
    @Args('reference') reference: string,
  ): Promise<PaymentRequestResult> {
    return this.mobileMoneyProvider.initiatePaymentRequest(phoneNumber, amount, reference);
  }

  // Stripe Provider Mutations
  @Mutation(() => StripePaymentMethod, { description: 'Create Stripe payment method' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:stripe')
  async createStripePaymentMethod(
    @Args('cardNumber') cardNumber: string,
    @Args('expMonth') expMonth: number,
    @Args('expYear') expYear: number,
    @Args('cvc') cvc: string,
  ): Promise<StripePaymentMethod> {
    const result = await this.stripeProvider.createPaymentMethod({
      number: cardNumber,
      expMonth,
      expYear,
      cvc,
    });
    
    return {
      paymentMethodId: result.paymentMethodId,
      last4: result.last4,
      brand: 'visa', // Would come from Stripe response
      expiryMonth: expMonth,
      expiryYear: expYear,
    };
  }

  // Reconciliation Mutations
  @Mutation(() => String, { description: 'Perform payment reconciliation' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async performPaymentReconciliation(
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Args('options', { nullable: true }) options: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.paymentService.performReconciliation(tenantId, startDate, endDate, options);
  }

  @Mutation(() => String, { description: 'Perform daily payment reconciliation' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async performDailyPaymentReconciliation(
    @Args('date') date: Date,
    @Args('options', { nullable: true }) options: any,
    @CurrentTenant() tenantId: string,
  ): Promise<any> {
    return this.paymentService.performDailyReconciliation(tenantId, date, options);
  }

  @Query(() => [String], { description: 'Get payment reconciliation history' })
  @UseGuards(PermissionsGuard)
  @Permissions('pos:reconciliation')
  async paymentReconciliationHistory(
    @Args('limit', { nullable: true }) limit: number | undefined,
    @Args('offset', { nullable: true }) offset: number | undefined,
    @CurrentTenant() tenantId: string,
  ): Promise<any[]> {
    const result = await this.paymentService.getReconciliationHistory(tenantId, limit, offset);
    return result.reports || [];
  }

  private getPaymentMethodFeatures(paymentMethod: string): string[] {
    const features: Record<string, string[]> = {
      cash: ['instant_settlement', 'change_calculation', 'drawer_management'],
      card: ['authorization', 'capture', 'void', 'refund', 'chargeback_protection'],
      mobile_money: ['sms_confirmation', 'balance_check', 'multi_provider'],
      digital_wallet: ['tokenization', 'biometric_auth', 'instant_transfer'],
    };

    return features[paymentMethod] || [];
  }
}