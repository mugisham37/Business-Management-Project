import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

import { OAuth2Repository } from '../repositories/oauth2.repository';
import { EncryptionService } from '../../../common/services/encryption.service';
import { CacheService } from '../../cache/cache.service';

import {
  OAuth2ConfigInput,
  OAuth2AuthorizeInput,
  OAuth2CallbackInput,
  OAuth2RefreshInput,
} from '../inputs/oauth2.input';

import {
  OAuth2Config,
  OAuth2AuthorizeDto,
  OAuth2Token,
} from '../types/oauth2.types';

interface OAuth2Provider {
  name: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable()
export class OAuth2Service {
  private readonly logger = new Logger(OAuth2Service.name);
  private readonly providers = new Map<string, OAuth2Provider>();

  constructor(
    private readonly oauth2Repository: OAuth2Repository,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: CacheService,
  ) {
    this.initializeProviders();
  }

  /**
   * Initialize OAuth2 providers configuration
   */
  private initializeProviders(): void {
    // QuickBooks OAuth2 configuration
    const quickbooksClientId = this.configService.get('QUICKBOOKS_CLIENT_ID');
    const quickbooksClientSecret = this.configService.get('QUICKBOOKS_CLIENT_SECRET');
    const quickbooksRedirectUri = this.configService.get('QUICKBOOKS_REDIRECT_URI');
    
    if (quickbooksClientId && quickbooksClientSecret && quickbooksRedirectUri) {
      this.providers.set('quickbooks', {
        name: 'QuickBooks',
        authUrl: 'https://appcenter.intuit.com/connect/oauth2',
        tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
        scopes: ['com.intuit.quickbooks.accounting'],
        clientId: quickbooksClientId,
        clientSecret: quickbooksClientSecret,
        redirectUri: quickbooksRedirectUri,
      });
    }

    // Xero OAuth2 configuration
    const xeroClientId = this.configService.get('XERO_CLIENT_ID');
    const xeroClientSecret = this.configService.get('XERO_CLIENT_SECRET');
    const xeroRedirectUri = this.configService.get('XERO_REDIRECT_URI');
    
    if (xeroClientId && xeroClientSecret && xeroRedirectUri) {
      this.providers.set('xero', {
        name: 'Xero',
        authUrl: 'https://login.xero.com/identity/connect/authorize',
        tokenUrl: 'https://identity.xero.com/connect/token',
        revokeUrl: 'https://identity.xero.com/connect/revocation',
        scopes: ['accounting.transactions', 'accounting.contacts', 'accounting.settings'],
        clientId: xeroClientId,
        clientSecret: xeroClientSecret,
        redirectUri: xeroRedirectUri,
      });
    }

    // Shopify OAuth2 configuration
    const shopifyClientId = this.configService.get('SHOPIFY_CLIENT_ID');
    const shopifyClientSecret = this.configService.get('SHOPIFY_CLIENT_SECRET');
    const shopifyRedirectUri = this.configService.get('SHOPIFY_REDIRECT_URI');
    
    if (shopifyClientId && shopifyClientSecret && shopifyRedirectUri) {
      this.providers.set('shopify', {
        name: 'Shopify',
        authUrl: 'https://{shop}.myshopify.com/admin/oauth/authorize',
        tokenUrl: 'https://{shop}.myshopify.com/admin/oauth/access_token',
        scopes: ['read_products', 'write_products', 'read_orders', 'write_orders'],
        clientId: shopifyClientId,
        clientSecret: shopifyClientSecret,
        redirectUri: shopifyRedirectUri,
      });
    }

    // Stripe OAuth2 configuration (Connect)
    const stripeClientId = this.configService.get('STRIPE_CLIENT_ID');
    const stripeClientSecret = this.configService.get('STRIPE_CLIENT_SECRET');
    const stripeRedirectUri = this.configService.get('STRIPE_REDIRECT_URI');
    
    if (stripeClientId && stripeClientSecret && stripeRedirectUri) {
      this.providers.set('stripe', {
        name: 'Stripe',
        authUrl: 'https://connect.stripe.com/oauth/authorize',
        tokenUrl: 'https://connect.stripe.com/oauth/token',
        scopes: ['read_write'],
        clientId: stripeClientId,
        clientSecret: stripeClientSecret,
        redirectUri: stripeRedirectUri,
      });
    }

    this.logger.log(`Initialized ${this.providers.size} OAuth2 providers`);
  }

  /**
   * Initialize OAuth2 configuration for an integration
   */
  async initializeOAuth2(integrationId: string, config: OAuth2Config): Promise<void> {
    this.logger.log(`Initializing OAuth2 for integration: ${integrationId}`);

    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new BadRequestException(`Unsupported OAuth2 provider: ${config.provider}`);
    }

    // Store OAuth2 configuration (encrypted)
    await this.oauth2Repository.createConfig(integrationId, {
      provider: config.provider,
      clientId: provider.clientId,
      clientSecret: await this.encryptionService.encrypt(provider.clientSecret),
      redirectUri: provider.redirectUri,
      scopes: config.scopes || provider.scopes,
      additionalParams: config.additionalParams || {},
    });

    this.logger.log(`OAuth2 initialized for integration: ${integrationId}`);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  async getAuthorizationUrl(
    integrationId: string,
    dto: OAuth2AuthorizeDto,
  ): Promise<{ authUrl: string; state: string }> {
    this.logger.log(`Generating OAuth2 authorization URL for integration: ${integrationId}`);

    const config = await this.oauth2Repository.getConfig(integrationId);
    if (!config) {
      throw new BadRequestException(`OAuth2 not configured for integration: ${integrationId}`);
    }

    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new BadRequestException(`Provider not found: ${config.provider}`);
    }

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in cache for verification
    await this.cacheService.set(`oauth2:state:${state}`, {
      integrationId,
      tenantId: dto.tenantId,
      timestamp: Date.now(),
    }, { ttl: 600 }); // 10 minutes

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state,
      ...config.additionalParams,
    });

    // Handle provider-specific URL patterns
    let authUrl = provider.authUrl;
    if (config.provider === 'shopify' && dto.shop) {
      authUrl = authUrl.replace('{shop}', dto.shop);
    }

    const fullAuthUrl = `${authUrl}?${params.toString()}`;

    this.logger.log(`Generated OAuth2 authorization URL for integration: ${integrationId}`);
    return { authUrl: fullAuthUrl, state };
  }

  /**
   * Handle OAuth2 callback and exchange code for tokens
   */
  async handleCallback(input: OAuth2CallbackInput): Promise<OAuth2Token> {
    this.logger.log(`Handling OAuth2 callback with state: ${input.state}`);

    // Verify state parameter
    const stateData = await this.cacheService.get<{ integrationId: string; tenantId: string; timestamp: number }>(`oauth2:state:${input.state}`);
    if (!stateData) {
      throw new UnauthorizedException('Invalid or expired state parameter');
    }

    // Clean up state
    await this.cacheService.del(`oauth2:state:${input.state}`);

    const { integrationId, tenantId } = stateData;

    if (input.error) {
      throw new BadRequestException(`OAuth2 authorization failed: ${input.error}`);
    }

    const config = await this.oauth2Repository.getConfig(integrationId);
    const provider = this.providers.get(config.provider);
    
    if (!provider) {
      throw new BadRequestException(`Provider not found: ${config.provider}`);
    }

    // Exchange authorization code for access token
    const tokenData = await this.exchangeCodeForToken(provider, config, input.code, input.shop);

    // Store encrypted tokens
    const oauth2Token = await this.oauth2Repository.storeToken(integrationId, {
      accessToken: await this.encryptionService.encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token 
        ? await this.encryptionService.encrypt(tokenData.refresh_token)
        : null,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : config.scopes,
      providerId: tokenData.user_id || tokenData.stripe_user_id,
      providerData: {
        realmId: tokenData.realmId, // QuickBooks company ID
        shop: input.shop, // Shopify shop domain
        stripeUserId: tokenData.stripe_user_id, // Stripe account ID
        ...tokenData,
      },
    });

    this.logger.log(`OAuth2 tokens stored for integration: ${integrationId}`);
    return oauth2Token;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidToken(integrationId: string): Promise<{ accessToken: string; tokenType: string }> {
    const token = await this.oauth2Repository.getToken(integrationId);
    if (!token) {
      throw new UnauthorizedException(`No OAuth2 token found for integration: ${integrationId}`);
    }

    // Check if token is expired
    if (token.expiresAt && token.expiresAt <= new Date()) {
      if (!token.refreshToken) {
        throw new UnauthorizedException('Access token expired and no refresh token available');
      }

      // Refresh the token
      const refreshedToken = await this.refreshToken(integrationId);
      return {
        accessToken: await this.encryptionService.decrypt(refreshedToken.accessToken),
        tokenType: refreshedToken.tokenType,
      };
    }

    return {
      accessToken: await this.encryptionService.decrypt(token.accessToken),
      tokenType: token.tokenType,
    };
  }

  /**
   * Refresh OAuth2 access token
   */
  async refreshToken(integrationId: string): Promise<OAuth2Token> {
    this.logger.log(`Refreshing OAuth2 token for integration: ${integrationId}`);

    const token = await this.oauth2Repository.getToken(integrationId);
    if (!token || !token.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const config = await this.oauth2Repository.getConfig(integrationId);
    const provider = this.providers.get(config.provider);
    
    if (!provider) {
      throw new BadRequestException(`Provider not found: ${config.provider}`);
    }

    try {
      const refreshTokenDecrypted = await this.encryptionService.decrypt(token.refreshToken);
      
      const response = await firstValueFrom(
        this.httpService.post(provider.tokenUrl, {
          grant_type: 'refresh_token',
          refresh_token: refreshTokenDecrypted,
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
        }, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        })
      );

      const tokenData = response.data;

      // Update stored token
      const updatedToken = await this.oauth2Repository.updateToken(integrationId, {
        accessToken: await this.encryptionService.encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token 
          ? await this.encryptionService.encrypt(tokenData.refresh_token)
          : token.refreshToken, // Keep existing refresh token if not provided
        expiresAt: tokenData.expires_in 
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        lastRefreshedAt: new Date(),
      });

      this.logger.log(`OAuth2 token refreshed for integration: ${integrationId}`);
      return updatedToken;

    } catch (error) {
      this.logger.error(`Failed to refresh OAuth2 token for integration ${integrationId}:`, error);
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  /**
   * Revoke OAuth2 tokens
   */
  async revokeTokens(integrationId: string): Promise<void> {
    this.logger.log(`Revoking OAuth2 tokens for integration: ${integrationId}`);

    const token = await this.oauth2Repository.getToken(integrationId);
    if (!token) {
      this.logger.warn(`No OAuth2 token found for integration: ${integrationId}`);
      return;
    }

    const config = await this.oauth2Repository.getConfig(integrationId);
    const provider = this.providers.get(config.provider);
    
    if (!provider) {
      this.logger.warn(`Provider not found for integration: ${integrationId}`);
      // Delete token from database anyway
      await this.oauth2Repository.deleteToken(integrationId);
      return;
    }

    // Revoke token with provider if revoke URL is available
    if (provider.revokeUrl) {
      try {
        const accessToken = await this.encryptionService.decrypt(token.accessToken);
        
        await firstValueFrom(
          this.httpService.post(provider.revokeUrl, {
            token: accessToken,
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })
        );

        this.logger.log(`OAuth2 token revoked with provider for integration: ${integrationId}`);
      } catch (error) {
        this.logger.error(`Failed to revoke token with provider:`, error);
        // Continue with local deletion even if provider revocation fails
      }
    }

    // Delete token from database
    await this.oauth2Repository.deleteToken(integrationId);

    this.logger.log(`OAuth2 tokens deleted for integration: ${integrationId}`);
  }

  /**
   * Update OAuth2 configuration
   */
  async updateOAuth2Config(integrationId: string, config: Partial<OAuth2Config>): Promise<void> {
    this.logger.log(`Updating OAuth2 config for integration: ${integrationId}`);

    const existingConfig = await this.oauth2Repository.getConfig(integrationId);
    if (!existingConfig) {
      throw new BadRequestException(`OAuth2 not configured for integration: ${integrationId}`);
    }

    await this.oauth2Repository.updateConfig(integrationId, config);

    this.logger.log(`OAuth2 config updated for integration: ${integrationId}`);
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(
    provider: OAuth2Provider,
    config: any,
    code: string,
    shop?: string,
  ): Promise<any> {
    try {
      let tokenUrl = provider.tokenUrl;
      
      // Handle provider-specific token URL patterns
      if (config.provider === 'shopify' && shop) {
        tokenUrl = tokenUrl.replace('{shop}', shop);
      }

      const requestData: any = {
        grant_type: 'authorization_code',
        code,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        redirect_uri: provider.redirectUri,
      };

      // Provider-specific parameters
      if (config.provider === 'shopify') {
        // Shopify doesn't use redirect_uri in token exchange
        delete requestData.redirect_uri;
      }

      const response = await firstValueFrom(
        this.httpService.post(tokenUrl, requestData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        })
      );

      return response.data;

    } catch (error) {
      this.logger.error('Failed to exchange code for token:', error);
      throw new BadRequestException('Failed to exchange authorization code for access token');
    }
  }
}