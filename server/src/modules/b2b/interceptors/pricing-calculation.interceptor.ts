import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { B2BPricingService } from '../services/b2b-pricing.service';

/**
 * Interceptor to automatically calculate pricing for B2B operations
 * 
 * Automatically injects customer-specific pricing into:
 * - Order creation and updates
 * - Quote generation
 * - Product catalog queries
 * - Pricing rule applications
 */
@Injectable()
export class PricingCalculationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PricingCalculationInterceptor.name);

  constructor(
    private readonly pricingService: B2BPricingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const args = gqlContext.getArgs();
    const request = gqlContext.getContext().req;

    // Check if this operation needs pricing calculation
    const needsPricing = this.shouldCalculatePricing(info.fieldName, args);
    
    if (!needsPricing || !request.user?.tenantId) {
      return next.handle();
    }

    this.logger.debug(`Applying pricing calculation for operation: ${info.fieldName}`);

    return next.handle().pipe(
      map(async (data) => {
        try {
          // Apply pricing calculations based on operation type
          if (this.isOrderOperation(info.fieldName)) {
            return await this.calculateOrderPricing(data, request.user.tenantId);
          } else if (this.isQuoteOperation(info.fieldName)) {
            return await this.calculateQuotePricing(data, request.user.tenantId);
          } else if (this.isProductCatalogOperation(info.fieldName)) {
            return await this.calculateCatalogPricing(data, request.user.tenantId, request.user.customerId);
          }

          return data;
        } catch (error) {
          this.logger.error(`Failed to calculate pricing for ${info.fieldName}:`, error);
          return data; // Return original data if pricing calculation fails
        }
      })
    );
  }

  private shouldCalculatePricing(fieldName: string, args: any): boolean {
    const pricingOperations = [
      'createB2BOrder',
      'updateB2BOrder',
      'createQuote',
      'updateQuote',
      'getPortalProductCatalog',
      'getCustomerPricing',
      'getBulkPricing'
    ];

    return pricingOperations.includes(fieldName);
  }

  private isOrderOperation(fieldName: string): boolean {
    return fieldName.includes('Order') || fieldName.includes('order');
  }

  private isQuoteOperation(fieldName: string): boolean {
    return fieldName.includes('Quote') || fieldName.includes('quote');
  }

  private isProductCatalogOperation(fieldName: string): boolean {
    return fieldName.includes('Catalog') || fieldName.includes('Product');
  }

  private async calculateOrderPricing(data: any, tenantId: string): Promise<any> {
    if (!data || !data.items) {
      return data;
    }

    // Calculate pricing for each order item
    for (const item of data.items) {
      const customerPrice = await this.pricingService.getCustomerPrice(
        tenantId,
        data.customerId,
        item.productId,
        item.quantity
      );

      if (customerPrice !== null) {
        item.customerPrice = customerPrice;
        item.discountAmount = (item.listPrice - customerPrice) * item.quantity;
        item.discountPercentage = ((item.listPrice - customerPrice) / item.listPrice) * 100;
        item.lineTotal = customerPrice * item.quantity;
      }
    }

    // Recalculate order totals
    data.subtotal = data.items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
    data.totalAmount = data.subtotal + data.taxAmount + data.shippingAmount - data.discountAmount;

    return data;
  }

  private async calculateQuotePricing(data: any, tenantId: string): Promise<any> {
    // Similar to order pricing calculation
    return await this.calculateOrderPricing(data, tenantId);
  }

  private async calculateCatalogPricing(data: any, tenantId: string, customerId: string): Promise<any> {
    if (!data || !data.products) {
      return data;
    }

    // Calculate customer-specific pricing for each product
    for (const product of data.products) {
      const customerPrice = await this.pricingService.getCustomerPrice(
        tenantId,
        customerId,
        product.id,
        1
      );

      if (customerPrice !== null) {
        product.customerPrice = customerPrice;
        product.discountPercentage = ((product.basePrice - customerPrice) / product.basePrice) * 100;
      } else {
        product.customerPrice = product.basePrice;
        product.discountPercentage = 0;
      }
    }

    return data;
  }
}