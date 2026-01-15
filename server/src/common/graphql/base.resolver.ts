import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Args, Context, Info } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../modules/tenant/guards/tenant.guard';
import { TenantInterceptor } from '../../modules/tenant/interceptors/tenant.interceptor';
import { DataLoaderService } from './dataloader.service';

/**
 * Base resolver with common functionality for all GraphQL resolvers
 */
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
export abstract class BaseResolver {
  constructor(protected readonly dataLoaderService: DataLoaderService) {}

  /**
   * Get the current user from GraphQL context
   */
  protected getCurrentUser(@Context() context: any): any {
    return context.req.user;
  }

  /**
   * Get the current tenant ID from GraphQL context
   */
  protected getCurrentTenantId(@Context() context: any): string {
    return context.req.user?.tenantId;
  }

  /**
   * Check if a field is requested in the GraphQL query
   */
  protected isFieldRequested(info: GraphQLResolveInfo, fieldName: string): boolean {
    const selections = info.fieldNodes[0]?.selectionSet?.selections;
    if (!selections) return false;

    return selections.some(selection => {
      if (selection.kind === 'Field') {
        return selection.name.value === fieldName;
      }
      return false;
    });
  }

  /**
   * Get requested fields from GraphQL query info
   */
  protected getRequestedFields(info: GraphQLResolveInfo): string[] {
    const selections = info.fieldNodes[0]?.selectionSet?.selections;
    if (!selections) return [];

    return selections
      .filter(selection => selection.kind === 'Field')
      .map(selection => (selection as any).name.value);
  }

  /**
   * Create pagination info for GraphQL connections
   */
  protected createPageInfo(
    hasNextPage: boolean,
    hasPreviousPage: boolean,
    startCursor?: string,
    endCursor?: string,
  ) {
    return {
      hasNextPage,
      hasPreviousPage,
      startCursor,
      endCursor,
    };
  }

  /**
   * Create edges for GraphQL connections
   */
  protected createEdges<T>(items: T[], getCursor: (item: T) => string) {
    return items.map(item => ({
      cursor: getCursor(item),
      node: item,
    }));
  }

  /**
   * Parse cursor-based pagination arguments
   */
  protected parsePaginationArgs(args: {
    first?: number;
    after?: string;
    last?: number;
    before?: string;
  }) {
    const { first, after, last, before } = args;

    // Validate pagination arguments
    if (first && last) {
      throw new Error('Cannot specify both first and last');
    }

    if (after && before) {
      throw new Error('Cannot specify both after and before');
    }

    const limit = first || last || 10;
    const isForward = !!first || (!first && !last);

    return {
      limit: Math.min(limit, 100), // Cap at 100 items
      cursor: isForward ? after : before,
      isForward,
    };
  }

  /**
   * Handle GraphQL errors consistently
   */
  protected handleError(error: any, message?: string) {
    console.error('GraphQL Error:', error);
    
    if (error.code === 'TENANT_NOT_FOUND') {
      throw new Error('Tenant not found');
    }
    
    if (error.code === 'UNAUTHORIZED') {
      throw new Error('Unauthorized access');
    }
    
    if (error.code === 'FORBIDDEN') {
      throw new Error('Insufficient permissions');
    }

    throw new Error(message || 'An unexpected error occurred');
  }

  /**
   * Create a mutation response
   */
  protected createMutationResponse(
    success: boolean,
    message?: string,
    errors?: Array<{ message: string; code?: string; path?: string[] }>,
  ) {
    return {
      success,
      message,
      errors: errors?.map(error => ({
        ...error,
        timestamp: new Date(),
      })),
    };
  }
}