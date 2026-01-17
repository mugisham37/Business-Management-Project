import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TerritoryService } from '../services/territory.service';

/**
 * Middleware to inject territory context into requests
 * 
 * Adds user's territory information and applicable rules to request context
 * for use in GraphQL resolvers and services
 */
@Injectable()
export class TerritoryContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TerritoryContextMiddleware.name);

  constructor(
    private readonly territoryService: TerritoryService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Only process authenticated requests with user context
      if (!req.user?.tenantId || !req.user?.id) {
        return next();
      }

      const tenantId = req.user.tenantId;
      const userId = req.user.id;

      this.logger.debug(`Injecting territory context for user ${userId} in tenant ${tenantId}`);

      // Get user's assigned territories
      const userTerritories = await this.territoryService.getUserTerritories(tenantId, userId);
      
      // Get territory-specific rules and permissions
      const territoryRules = await this.territoryService.getTerritoryRules(tenantId, userTerritories.map(t => t.id));

      // Inject territory context into request
      req.territoryContext = {
        territories: userTerritories,
        rules: territoryRules,
        userId,
        tenantId,
        canAccessAllTerritories: req.user.permissions?.includes('territory:access_all') || false,
      };

      this.logger.debug(`Injected territory context: territories=${userTerritories.length}, rules=${territoryRules.length}`);
    } catch (error) {
      this.logger.error(`Failed to inject territory context:`, error);
      // Continue without territory context rather than failing the request
    }

    next();
  }
}