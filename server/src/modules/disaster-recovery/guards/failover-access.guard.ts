import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FailoverService } from '../services/failover.service';

@Injectable()
export class FailoverAccessGuard implements CanActivate {
  constructor(
    private readonly failoverService: FailoverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();

    const configId = args.configId;
    const serviceName = args.serviceName || args.input?.serviceName;
    const tenantId = request.tenantId;

    if (!configId && !serviceName) {
      return true; // No specific config to validate
    }

    try {
      let config;
      
      if (configId) {
        config = await this.failoverService.getFailoverConfig(configId, tenantId);
      } else if (serviceName) {
        const configs = await this.failoverService.listFailoverConfigs(tenantId);
        config = configs.find(c => c.serviceName === serviceName);
      }

      if (!config) {
        throw new ForbiddenException('Failover configuration not found or access denied');
      }

      // Add config to request for use in resolvers
      request.failoverConfig = config;
      
      return true;
    } catch (error) {
      throw new ForbiddenException('Access denied to failover configuration');
    }
  }
}