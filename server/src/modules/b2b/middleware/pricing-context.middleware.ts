import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { B2BPricingService } from '../services/b2b-pricing.service';

/**
 * Middleware to inject pricing context into requests
 * 
 * Adds customer pricing tier and applicable rules to request context
 * for use in GraphQL resolvers and services
 */
@Injectable()
export class PricingContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PricingContextMiddleware.name);

  constructor(
    private readonly pricingService: B2BPricingService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Only process authenticated B2B requests
      if (!req.user?.tenantId || !req.user?.customerId) {
        return next();
      }

      const tenantId = req.user.tenantId;
      const customerId = req.user.customerId;

      this.logger.debug(`Injecting pricing context for customer ${customerId} in tenant ${tenantId}`);

      // Get customer pricing tier
      const pricingTier = await this.pricingService.getCustomerPricingTier(tenantId, customerId);
      
      // Get active pricing rules for customer
      const activePricingRules = await this.pricingService.getActivePricingRulesForCustomer(tenantId, customerId);

      // Inject pricing context into request
      req.pricingContext = {
        tier: pricingTier,
        activePricingRules,
        customerId,
        tenantId,
      };

      this.logger.debug(`Injected pricing context: tier=${pricingTier}, rules=${activePricingRules.length}`);
    } catch (error) {
      this.logger.error(`Failed to inject pricing context:`, error);
      // Continue without pricing context rather than failing the request
    }

    next();
  }
}