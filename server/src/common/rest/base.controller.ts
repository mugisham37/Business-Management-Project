import { UseGuards, UseInterceptors, Controller } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../modules/tenant/guards/tenant.guard';
import { TenantInterceptor } from '../../modules/tenant/interceptors/tenant.interceptor';

/**
 * Base controller with common functionality for all REST controllers
 */
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(TenantInterceptor)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing authentication token' })
@ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions or feature not available' })
@ApiResponse({ status: 500, description: 'Internal Server Error' })
export abstract class BaseController {
  /**
   * Get the API version from the controller path
   */
  protected getApiVersion(): string {
    const controllerPath = Reflect.getMetadata('path', this.constructor);
    const versionMatch = controllerPath?.match(/v(\d+)/);
    return versionMatch ? versionMatch[1] : '1';
  }

  /**
   * Create a standardized success response
   */
  protected createSuccessResponse<T>(data: T, message?: string) {
    return {
      success: true,
      message: message || 'Operation completed successfully',
      data,
      timestamp: new Date().toISOString(),
      version: this.getApiVersion(),
    };
  }

  /**
   * Create a standardized error response
   */
  protected createErrorResponse(message: string, errors?: any[], code?: string) {
    return {
      success: false,
      message,
      errors,
      code,
      timestamp: new Date().toISOString(),
      version: this.getApiVersion(),
    };
  }

  /**
   * Create a paginated response
   */
  protected createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string,
  ) {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      success: true,
      message: message || 'Data retrieved successfully',
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      timestamp: new Date().toISOString(),
      version: this.getApiVersion(),
    };
  }

  /**
   * Handle common error scenarios
   */
  protected handleError(error: any, operation: string) {
    console.error(`Error in ${operation}:`, error);

    if (error.code === 'TENANT_NOT_FOUND') {
      return this.createErrorResponse('Tenant not found', [], 'TENANT_NOT_FOUND');
    }

    if (error.code === 'UNAUTHORIZED') {
      return this.createErrorResponse('Unauthorized access', [], 'UNAUTHORIZED');
    }

    if (error.code === 'FORBIDDEN') {
      return this.createErrorResponse('Insufficient permissions', [], 'FORBIDDEN');
    }

    if (error.code === 'VALIDATION_ERROR') {
      return this.createErrorResponse('Validation failed', error.details, 'VALIDATION_ERROR');
    }

    return this.createErrorResponse(
      'An unexpected error occurred',
      [error.message],
      'INTERNAL_ERROR',
    );
  }
}