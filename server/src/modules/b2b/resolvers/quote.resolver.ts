import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { RequirePermission } from '../../auth/decorators/auth.decorators';
import { RequireFeature } from '../../tenant/decorators/tenant.decorators';
import { QuoteService } from '../services/quote.service';
import {
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteQueryInput,
  ApproveQuoteInput,
  RejectQuoteInput,
  SendQuoteInput,
  QuoteType,
  QuotesResponse,
  QuoteApprovalResponse,
  QuoteSendResponse,
  QuoteConversionResponse
} from '../types/quote.types';

@Resolver(() => QuoteType)
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature('quote-management')
export class QuoteResolver {
  private readonly logger = new Logger(QuoteResolver.name);

  constructor(
    private readonly quoteService: QuoteService,
  ) {}

  @Query(() => QuotesResponse)
  @RequirePermission('quote:read')
  async getQuotes(
    @Args('query') query: QuoteQueryInput,
    @Context() context: any,
  ): Promise<QuotesResponse> {
    try {
      const tenantId = context.req.user.tenantId;
      const result = await this.quoteService.findQuotes(tenantId, query);
      
      return {
        quotes: result.quotes,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to get quotes:`, error);
      throw error;
    }
  }

  @Query(() => QuoteType)
  @RequirePermission('quote:read')
  async getQuote(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<QuoteType> {
    try {
      const tenantId = context.req.user.tenantId;
      return await this.quoteService.findQuoteById(tenantId, id);
    } catch (error) {
      this.logger.error(`Failed to get quote ${id}:`, error);
      throw error;
    }
  }

  @Mutation(() => QuoteType)
  @RequirePermission('quote:create')
  async createQuote(
    @Args('input') input: CreateQuoteInput,
    @Context() context: any,
  ): Promise<QuoteType> {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const quote = await this.quoteService.createQuote(
        tenantId,
        input,
        userId,
      );
      
      this.logger.log(`Created quote ${quote.quoteNumber} via GraphQL`);
      return quote;
    } catch (error) {
      this.logger.error(`Failed to create quote via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation(() => QuoteType)
  @RequirePermission('quote:update')
  async updateQuote(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateQuoteInput,
    @Context() context: any,
  ): Promise<QuoteType> {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const quote = await this.quoteService.updateQuote(
        tenantId,
        id,
        input,
        userId,
      );
      
      this.logger.log(`Updated quote ${id} via GraphQL`);
      return quote;
    } catch (error) {
      this.logger.error(`Failed to update quote ${id} via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation(() => QuoteApprovalResponse)
  @RequirePermission('quote:approve')
  async approveQuote(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ApproveQuoteInput,
    @Context() context: any,
  ): Promise<QuoteApprovalResponse> {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const quote = await this.quoteService.approveQuote(
        tenantId,
        id,
        input.approvalNotes,
        userId,
      );
      
      this.logger.log(`Approved quote ${id} via GraphQL`);
      return {
        quote,
        message: 'Quote approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve quote ${id} via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation(() => QuoteApprovalResponse)
  @RequirePermission('quote:approve')
  async rejectQuote(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RejectQuoteInput,
    @Context() context: any,
  ): Promise<QuoteApprovalResponse> {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const quote = await this.quoteService.rejectQuote(
        tenantId,
        id,
        input.rejectionReason,
        userId,
      );
      
      this.logger.log(`Rejected quote ${id} via GraphQL`);
      return {
        quote,
        message: 'Quote rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reject quote ${id} via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation(() => QuoteSendResponse)
  @RequirePermission('quote:send')
  async sendQuote(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SendQuoteInput,
    @Context() context: any,
  ): Promise<QuoteSendResponse> {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const quote = await this.quoteService.sendQuote(
        tenantId,
        id,
        input,
        userId,
      );
      
      this.logger.log(`Sent quote ${id} via GraphQL`);
      return {
        quote,
        message: 'Quote sent successfully',
        sentTo: input.recipients,
      };
    } catch (error) {
      this.logger.error(`Failed to send quote ${id} via GraphQL:`, error);
      throw error;
    }
  }

  @Mutation(() => QuoteConversionResponse)
  @RequirePermission('quote:convert')
  async convertQuoteToOrder(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<QuoteConversionResponse> {
    try {
      const tenantId = context.req.user.tenantId;
      const userId = context.req.user.id;
      
      const result = await this.quoteService.convertQuoteToOrder(
        tenantId,
        id,
        userId,
      );
      
      this.logger.log(`Converted quote ${id} to order via GraphQL`);
      return {
        quote: result.quote,
        order: result.order,
        message: 'Quote converted to order successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to convert quote ${id} via GraphQL:`, error);
      throw error;
    }
  }
}