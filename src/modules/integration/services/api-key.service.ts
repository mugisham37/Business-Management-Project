import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

import { ApiKeyRepository } from '../repositories/api-key.repository';
import { RateLimitService } from './rate-limit.service';
import { CacheService } from '../../cache/cache.service';

import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  ApiKeyValidationResult,
  ApiKeyUsageStats,
} from '../dto/api-key.dto';

import { ApiKey } from '../entities/api-key.entity';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly keyPrefix = 'ubp_'; // Unified Business Platform prefix
  private readonly keyLength = 32;

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly rateLimitService: RateLimitService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new API key
   */
  async create(
    tenantId: string,
    integrationId: string,
    dto: CreateApiKeyDto,
    userId: string,
  ): Promise<{ apiKey: ApiKey; plainKey: string }> {
    this.logger.log(`Creating API key: ${dto.name} for integration: ${integrationId}`);

    // Generate API key
    const plainKey = this.generateApiKey();
    const keyHash = await this.hashApiKey(plainKey);
    const keyPrefix = plainKey.substring(0, 8); // First 8 characters for identification

    // Create API key record
    const apiKey = await this.apiKeyRepository.create({
      tenantId,
      integrationId,
      name: dto.name,
      keyHash,
      keyPrefix,
      scopes: dto.scopes || [],
      permissions: dto.permissions || [],
      rateLimit: dto.rateLimit || 1000,
      rateLimitWindow: dto.rateLimitWindow || 3600,
      ...(dto.description ? { description: dto.description } : {}),
      ipWhitelist: dto.ipWhitelist || [],
      ...(dto.expiresAt ? { expiresAt: dto.expiresAt } : {}),
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });

    // Emit API key created event
    this.eventEmitter.emit('api_key.created', {
      tenantId,
      integrationId,
      apiKeyId: apiKey.id,
      name: dto.name,
      scopes: dto.scopes,
    });

    this.logger.log(`API key created successfully: ${apiKey.id}`);
    
    // Return API key without sensitive hash
    const { keyHash: _, ...apiKeyWithoutHash } = apiKey;
    
    return {
      apiKey: apiKeyWithoutHash as ApiKey,
      plainKey,
    };
  }

  /**
   * Update API key configuration
   */
  async update(
    tenantId: string,
    apiKeyId: string,
    dto: UpdateApiKeyDto,
    userId: string,
  ): Promise<ApiKey> {
    this.logger.log(`Updating API key: ${apiKeyId}`);

    const apiKey = await this.apiKeyRepository.findById(tenantId, apiKeyId);
    if (!apiKey) {
      throw new BadRequestException(`API key not found: ${apiKeyId}`);
    }

    const updatedApiKey = await this.apiKeyRepository.update(apiKeyId, {
      ...dto,
      updatedBy: userId,
    });

    // Clear cache for this API key
    await this.cacheService.del(`api_key:${apiKey.keyPrefix}`);

    // Emit API key updated event
    this.eventEmitter.emit('api_key.updated', {
      tenantId,
      apiKeyId,
      changes: dto,
    });

    this.logger.log(`API key updated successfully: ${apiKeyId}`);
    return updatedApiKey;
  }

  /**
   * Validate API key and check permissions
   */
  async validateApiKey(
    apiKey: string,
    requiredScopes?: string[],
    requiredPermissions?: string[],
    clientIp?: string,
    userAgent?: string,
  ): Promise<ApiKeyValidationResult> {
    if (!apiKey || !apiKey.startsWith(this.keyPrefix)) {
      return { isValid: false, error: 'Invalid API key format' };
    }

    const keyPrefix = apiKey.substring(0, 8);
    
    // Check cache first
    const cacheKey = `api_key:${keyPrefix}`;
    let apiKeyRecord = await this.cacheService.get<ApiKey>(cacheKey);

    if (!apiKeyRecord) {
      // Find API key by prefix
      apiKeyRecord = await this.apiKeyRepository.findByPrefix(keyPrefix);
      
      if (!apiKeyRecord) {
        return { isValid: false, error: 'API key not found' };
      }

      // Cache the API key record for 5 minutes
      await this.cacheService.set(cacheKey, apiKeyRecord, { ttl: 300 });
    }

    // Verify the full API key hash
    const isValidKey = await bcrypt.compare(apiKey, apiKeyRecord!.keyHash);
    if (!isValidKey) {
      return { isValid: false, error: 'Invalid API key' };
    }

    // Check if API key is active
    if (!apiKeyRecord!.isActive) {
      return { isValid: false, error: 'API key is inactive' };
    }

    // Check expiration
    if (apiKeyRecord!.expiresAt && apiKeyRecord!.expiresAt <= new Date()) {
      return { isValid: false, error: 'API key has expired' };
    }

    // Check IP whitelist
    if (clientIp && apiKeyRecord!.ipWhitelist && apiKeyRecord!.ipWhitelist.length > 0) {
      if (!apiKeyRecord!.ipWhitelist.includes(clientIp)) {
        return { isValid: false, error: 'IP address not whitelisted' };
      }
    }

    // Check rate limits
    const rateLimitResult = await this.rateLimitService.checkRateLimit(
      apiKeyRecord!.id,
      'api_key',
      apiKeyRecord!.rateLimit,
      apiKeyRecord!.rateLimitWindow,
    );

    if (!rateLimitResult.allowed) {
      return {
        isValid: false,
        error: 'Rate limit exceeded',
        rateLimitInfo: rateLimitResult,
      };
    }

    // Check required scopes
    if (requiredScopes && requiredScopes.length > 0) {
      const hasRequiredScopes = requiredScopes.every(scope =>
        apiKeyRecord!.scopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        return { isValid: false, error: 'Insufficient scopes' };
      }
    }

    // Check required permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasRequiredPermissions = requiredPermissions.every(permission =>
        apiKeyRecord!.permissions.includes(permission)
      );

      if (!hasRequiredPermissions) {
        return { isValid: false, error: 'Insufficient permissions' };
      }
    }

    // Update usage statistics
    await this.updateUsageStats(apiKeyRecord!.id, userAgent);

    return {
      isValid: true,
      apiKey: apiKeyRecord,
      rateLimitInfo: rateLimitResult,
    };
  }

  /**
   * Revoke API key
   */
  async revoke(tenantId: string, apiKeyId: string, userId: string): Promise<void> {
    this.logger.log(`Revoking API key: ${apiKeyId}`);

    const apiKey = await this.apiKeyRepository.findById(tenantId, apiKeyId);
    if (!apiKey) {
      throw new BadRequestException(`API key not found: ${apiKeyId}`);
    }

    await this.apiKeyRepository.update(apiKeyId, {
      isActive: false,
      updatedBy: userId,
    });

    // Clear cache
    await this.cacheService.del(`api_key:${apiKey.keyPrefix}`);

    // Emit API key revoked event
    this.eventEmitter.emit('api_key.revoked', {
      tenantId,
      apiKeyId,
      name: apiKey.name,
    });

    this.logger.log(`API key revoked successfully: ${apiKeyId}`);
  }

  /**
   * Revoke all API keys for an integration
   */
  async revokeApiKeys(integrationId: string): Promise<void> {
    this.logger.log(`Revoking all API keys for integration: ${integrationId}`);

    const apiKeys = await this.apiKeyRepository.findByIntegration(integrationId);
    
    for (const apiKey of apiKeys) {
      await this.revoke(apiKey.tenantId, apiKey.id, 'system');
    }

    this.logger.log(`Revoked ${apiKeys.length} API keys for integration: ${integrationId}`);
  }

  /**
   * Get API key usage statistics
   */
  async getUsageStats(tenantId: string, apiKeyId: string): Promise<ApiKeyUsageStats> {
    const apiKey = await this.apiKeyRepository.findById(tenantId, apiKeyId);
    if (!apiKey) {
      throw new BadRequestException(`API key not found: ${apiKeyId}`);
    }

    const rateLimitStats = await this.rateLimitService.getUsageStats(apiKeyId, 'api_key');

    return {
      apiKeyId,
      name: apiKey.name,
      totalRequests: apiKey.requestCount,
      ...(apiKey.lastUsedAt ? { lastUsedAt: apiKey.lastUsedAt } : {}),
      createdAt: apiKey.createdAt,
      isActive: apiKey.isActive,
      ...(apiKey.expiresAt ? { expiresAt: apiKey.expiresAt } : {}),
      rateLimit: apiKey.rateLimit,
      rateLimitWindow: apiKey.rateLimitWindow,
      currentPeriodRequests: rateLimitStats.currentCount,
      rateLimitResetAt: rateLimitStats.resetAt,
    };
  }

  /**
   * List API keys for integration
   */
  async findByIntegration(
    tenantId: string,
    integrationId: string,
    includeInactive: boolean = false,
  ): Promise<ApiKey[]> {
    const apiKeys = await this.apiKeyRepository.findByIntegration(integrationId);
    
    let filteredKeys = apiKeys.filter(key => key.tenantId === tenantId);
    
    if (!includeInactive) {
      filteredKeys = filteredKeys.filter(key => key.isActive);
    }

    // Remove sensitive data
    return filteredKeys.map(key => {
      const { keyHash: _, ...keyWithoutHash } = key;
      return keyWithoutHash as ApiKey;
    });
  }

  /**
   * Store integration credentials (for non-OAuth2 integrations)
   */
  async storeCredentials(integrationId: string, credentials: Record<string, any>): Promise<void> {
    this.logger.log(`Storing credentials for integration: ${integrationId}`);

    // This would typically encrypt and store credentials
    // For now, we'll create a system API key for the integration
    await this.create(
      credentials.tenantId,
      integrationId,
      {
        name: 'System Integration Key',
        description: 'Auto-generated key for integration authentication',
        scopes: ['integration:read', 'integration:write'],
        permissions: ['*'],
      },
      'system',
    );

    this.logger.log(`Credentials stored for integration: ${integrationId}`);
  }

  /**
   * Get integration credentials
   */
  async getCredentials(integrationId: string): Promise<Record<string, any>> {
    // This would typically decrypt and return stored credentials
    // For now, we'll return the system API key
    const apiKeys = await this.apiKeyRepository.findByIntegration(integrationId);
    const systemKey = apiKeys.find(key => key.name === 'System Integration Key');

    if (!systemKey) {
      throw new UnauthorizedException(`No credentials found for integration: ${integrationId}`);
    }

    return {
      apiKey: systemKey.keyPrefix + '...', // Partial key for identification
      type: 'api_key',
    };
  }

  /**
   * Generate a new API key
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(this.keyLength);
    return this.keyPrefix + randomBytes.toString('hex');
  }

  /**
   * Hash API key for secure storage
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(apiKey, saltRounds);
  }

  /**
   * Update API key usage statistics
   */
  private async updateUsageStats(apiKeyId: string, userAgent?: string): Promise<void> {
    const updates: any = {
      requestCount: { increment: 1 },
      lastUsedAt: new Date(),
    };

    if (userAgent) {
      updates.userAgent = userAgent;
    }

    await this.apiKeyRepository.update(apiKeyId, updates);
  }
}