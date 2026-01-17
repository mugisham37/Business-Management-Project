import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ReplicationService } from '../services/replication.service';

@Injectable()
export class ReplicationAccessGuard implements CanActivate {
  constructor(
    private readonly replicationService: ReplicationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const args = ctx.getArgs();

    const configId = args.configId;
    const tenantId = request.tenantId;

    if (!configId) {
      return true; // No specific config to validate
    }

    try {
      const config = await this.replicationService.getReplicationConfig(configId, tenantId);
      
      if (!config) {
        throw new ForbiddenException('Replication configuration not found or access denied');
      }

      // Add config to request for use in resolvers
      request.replicationConfig = config;
      
      return true;
    } catch (error) {
      throw new ForbiddenException('Access denied to replication configuration');
    }
  }
}