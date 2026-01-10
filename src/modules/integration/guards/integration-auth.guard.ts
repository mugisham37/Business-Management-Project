import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ApiKeyService } from '../services/api-key.service';

@Injectable()
export class IntegrationAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Check for API key in headers
    const apiKey = this.extractApiKey(request);
    
    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    // Validate API key
    const validationResult = await this.apiKeyService.validateApiKey(
      apiKey,
      undefined, // scopes will be checked by other guards
      undefined, // permissions will be checked by other guards
      request.ip,
      request.get('User-Agent'),
    );

    if (!validationResult.isValid) {
      throw new UnauthorizedException(validationResult.error);
    }

    // Attach API key info to request
    request.apiKey = validationResult.apiKey;
    request.rateLimitInfo = validationResult.rateLimitInfo;

    return true;
  }

  private extractApiKey(request: any): string | null {
    // Check Authorization header
    const authHeader = request.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    const apiKeyHeader = request.get('X-API-Key');
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    // Check query parameter
    const apiKeyQuery = request.query.api_key;
    if (apiKeyQuery) {
      return apiKeyQuery;
    }

    return null;
  }
}