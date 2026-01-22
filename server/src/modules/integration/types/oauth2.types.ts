/**
 * OAuth2 Configuration
 */
export interface OAuth2Config {
  provider: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  additionalParams?: Record<string, any>;
}

/**
 * OAuth2 Authorization DTO
 */
export interface OAuth2AuthorizeDto {
  provider: string;
  scopes?: string[];
  state?: string;
  redirectUri?: string;
  additionalParams?: Record<string, any>;
  tenantId?: string;
  shop?: string;
  code?: string;
}

/**
 * OAuth2 Token Response
 */
export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
  additionalParams?: Record<string, any>;
}
