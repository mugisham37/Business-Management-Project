import { Resolver, Subscription, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Inject } from '@nestjs/common';
import { JournalEntry, ChartOfAccount, Budget, Reconciliation } from '../graphql/types';
import { JournalEntryStatus } from '../graphql/enums';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { SubscriptionAuthGuard } from '../../../common/graphql/subscription-auth.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';

@Resolver()
@UseGuards(JwtAuthGuard, TenantGuard, SubscriptionAuthGuard)
export class FinancialSubscriptionsResolver {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  @Subscription(() => JournalEntry, {
    filter: (payload, variables, context) => {
      return payload.journalEntryPosted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  journalEntryPosted(
    @CurrentTenant() tenantId: string,
    @Args('accountId', { nullable: true }) accountId?: string,
  ) {
    return this.pubSub.asyncIterator('journalEntryPosted', tenantId);
  }

  @Subscription(() => JournalEntry, {
    filter: (payload, variables, context) => {
      return payload.journalEntryStatusChanged.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  journalEntryStatusChanged(
    @CurrentTenant() tenantId: string,
    @Args('status', { nullable: true }) status?: JournalEntryStatus,
  ) {
    return this.pubSub.asyncIterator('journalEntryStatusChanged', tenantId);
  }

  @Subscription(() => ChartOfAccount, {
    filter: (payload, variables, context) => {
      return payload.accountBalanceChanged.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  accountBalanceChanged(
    @CurrentTenant() tenantId: string,
    @Args('accountId', { nullable: true }) accountId?: string,
  ) {
    return this.pubSub.asyncIterator('accountBalanceChanged', tenantId);
  }

  @Subscription(() => Budget, {
    filter: (payload, variables, context) => {
      return payload.budgetVarianceAlert.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  budgetVarianceAlert(
    @CurrentTenant() tenantId: string,
    @Args('budgetId', { nullable: true }) budgetId?: string,
    @Args('thresholdPercentage', { nullable: true }) thresholdPercentage?: number,
  ) {
    return this.pubSub.asyncIterator('budgetVarianceAlert', tenantId);
  }

  @Subscription(() => Reconciliation, {
    filter: (payload, variables, context) => {
      return payload.reconciliationCompleted.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  reconciliationCompleted(
    @CurrentTenant() tenantId: string,
    @Args('accountId', { nullable: true }) accountId?: string,
  ) {
    return this.pubSub.asyncIterator('reconciliationCompleted', tenantId);
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.fiscalPeriodClosed.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  fiscalPeriodClosed(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator('fiscalPeriodClosed', tenantId);
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.taxReturnFiled.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  taxReturnFiled(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSub.asyncIterator('taxReturnFiled', tenantId);
  }

  @Subscription(() => String, {
    filter: (payload, variables, context) => {
      return payload.currencyRateUpdated.tenantId === context.req.tenantId;
    },
  })
  @RequirePermission('financial:read')
  currencyRateUpdated(
    @CurrentTenant() tenantId: string,
    @Args('currencyCode', { nullable: true }) currencyCode?: string,
  ) {
    return this.pubSub.asyncIterator('currencyRateUpdated', tenantId);
  }
}