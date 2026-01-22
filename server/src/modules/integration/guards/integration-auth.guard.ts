import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Integration authentication guard
 * Validates API keys and OAuth tokens for integration endpoints
 */
@Injectable()
export class IntegrationAuthGuard implements CanActivate {
  private readonly logger = new Logger(IntegrationAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const apiKey = request.headers['x-api-key'];

    // Check for Bearer token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (this.validateToken(token)) {
        return true;
      }
    }

    // Check for API key
    if (apiKey && this.validateApiKey(apiKey)) {
      return true;
    }

    this.logger.warn(`Integration authentication failed for ${request.ip}`);
    throw new HttpException(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid or missing authentication credentials',
      },
      HttpStatus.UNAUTHORIZED
    );
  }

  /**
   * Validate Bearer token (simplified - implement with actual JWT validation)
   */
  private validateToken(token: string): boolean {
    // Placeholder implementation
    // In production, verify JWT token here
    return !!(token && token.length > 0);
  }

  /**
   * Validate API key (simplified - implement with actual API key validation)
   */
  private validateApiKey(apiKey: string): boolean {
    // Placeholder implementation
    // In production, lookup and validate API key from database
    return !!(apiKey && apiKey.length > 0 && apiKey.startsWith('sk_'));
  }
}
