import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class OAuth2Config {
  @ApiProperty({ description: 'OAuth2 provider name' })
  @IsString()
  provider: string;

  @ApiPropertyOptional({ description: 'OAuth2 scopes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ description: 'Additional OAuth2 parameters' })
  @IsOptional()
  @IsObject()
  additionalParams?: Record<string, any>;
}

export class OAuth2Token {
  @ApiProperty({ description: 'Access token' })
  @IsString()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Refresh token' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({ description: 'Token type', default: 'Bearer' })
  @IsString()
  tokenType: string;

  @ApiPropertyOptional({ description: 'Token expiry date' })
  @IsOptional()
  expiresAt?: Date;

  @ApiProperty({ description: 'Token scopes' })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @ApiPropertyOptional({ description: 'Provider user ID' })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ description: 'Provider-specific data' })
  @IsOptional()
  @IsObject()
  providerData?: Record<string, any>;
}

export class OAuth2AuthorizeDto {
  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Shop domain (for Shopify)' })
  @IsOptional()
  @IsString()
  shop?: string;
}

export class OAuth2CallbackDto {
  @ApiProperty({ description: 'Authorization code' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'State parameter' })
  @IsString()
  state: string;

  @ApiPropertyOptional({ description: 'Error code' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({ description: 'Shop domain (for Shopify)' })
  @IsOptional()
  @IsString()
  shop?: string;
}

export class OAuth2RefreshDto {
  @ApiProperty({ description: 'Integration ID' })
  @IsString()
  integrationId: string;
}