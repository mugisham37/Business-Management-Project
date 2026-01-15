import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MobileOptimizationService, MobileOptimizationOptions } from '../services/mobile-optimization.service';

@Injectable()
export class MobileApiInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MobileApiInterceptor.name);

  constructor(private readonly mobileOptimizationService: MobileOptimizationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Detect mobile device and connection type
    const mobileOptions = this.detectMobileOptions(request);
    
    // Add mobile optimization headers
    this.addMobileHeaders(response, mobileOptions);

    return next.handle().pipe(
      map(async (data) => {
        // Skip optimization for non-mobile devices unless explicitly requested
        if (!this.shouldOptimize(request, mobileOptions)) {
          return data;
        }

        try {
          // Generate cache key based on request
          const cacheKey = this.generateCacheKey(request);
          
          // Optimize response for mobile
          const optimizedResponse = await this.mobileOptimizationService.optimizeResponse(
            data,
            mobileOptions,
            cacheKey,
          );

          // Add optimization metadata to response headers
          response.setHeader('X-Mobile-Optimized', 'true');
          response.setHeader('X-Optimization-Applied', optimizedResponse.metadata.optimizationApplied.join(','));
          response.setHeader('X-Compression-Ratio', optimizedResponse.metadata.compressed ? 
            ((optimizedResponse.metadata.originalSize - optimizedResponse.metadata.compressedSize) / 
             optimizedResponse.metadata.originalSize * 100).toFixed(1) + '%' : '0%');
          response.setHeader('X-Cache-Hit', optimizedResponse.metadata.cacheHit.toString());

          return {
            data: optimizedResponse.data,
            _mobile: optimizedResponse.metadata,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : '';
          this.logger.error(`Mobile optimization failed: ${errorMessage}`, errorStack);
          
          // Return original data if optimization fails
          response.setHeader('X-Mobile-Optimized', 'false');
          response.setHeader('X-Optimization-Error', errorMessage);
          return data;
        }
      }),
    );
  }

  /**
   * Detect mobile optimization options from request
   */
  private detectMobileOptions(request: any): MobileOptimizationOptions {
    const userAgent = request.headers['user-agent'] || '';
    const acceptEncoding = request.headers['accept-encoding'] || '';
    const connectionType = request.headers['x-connection-type'] || 'wifi';
    const batteryLevel = request.headers['x-battery-level'] ? 
      parseInt(request.headers['x-battery-level'], 10) : undefined;
    const dataUsageLimit = request.headers['x-data-limit'] ? 
      parseInt(request.headers['x-data-limit'], 10) : undefined;

    // Detect device type from user agent
    let deviceType: 'phone' | 'tablet' | 'desktop' = 'desktop';
    
    if (this.isMobilePhone(userAgent)) {
      deviceType = 'phone';
    } else if (this.isTablet(userAgent)) {
      deviceType = 'tablet';
    }

    // Detect connection type
    let detectedConnectionType: 'wifi' | 'cellular' | 'offline' = 'wifi';
    
    if (connectionType === 'cellular' || connectionType === '2g' || connectionType === '3g') {
      detectedConnectionType = 'cellular';
    } else if (connectionType === 'offline') {
      detectedConnectionType = 'offline';
    }

    return {
      deviceType,
      connectionType: detectedConnectionType,
      ...(batteryLevel !== undefined && { batteryLevel }),
      ...(dataUsageLimit !== undefined && { dataUsageLimit }),
      compressionEnabled: acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate'),
      progressiveLoading: deviceType === 'phone' || detectedConnectionType === 'cellular',
    } as MobileOptimizationOptions;
  }

  /**
   * Check if request is from a mobile phone
   */
  private isMobilePhone(userAgent: string): boolean {
    const mobilePhoneRegex = /Mobile|Android|iPhone|iPod|BlackBerry|Windows Phone/i;
    return mobilePhoneRegex.test(userAgent) && !this.isTablet(userAgent);
  }

  /**
   * Check if request is from a tablet
   */
  private isTablet(userAgent: string): boolean {
    const tabletRegex = /iPad|Android.*Tablet|Kindle|Silk/i;
    return tabletRegex.test(userAgent);
  }

  /**
   * Determine if response should be optimized
   */
  private shouldOptimize(request: any, options: MobileOptimizationOptions): boolean {
    // Always optimize for mobile devices
    if (options.deviceType === 'phone' || options.deviceType === 'tablet') {
      return true;
    }

    // Optimize for cellular connections even on desktop
    if (options.connectionType === 'cellular') {
      return true;
    }

    // Optimize if explicitly requested
    if (request.headers['x-mobile-optimize'] === 'true') {
      return true;
    }

    // Optimize for low battery scenarios
    if (options.batteryLevel && options.batteryLevel < 20) {
      return true;
    }

    return false;
  }

  /**
   * Add mobile-specific headers to response
   */
  private addMobileHeaders(response: any, options: MobileOptimizationOptions): void {
    // Add device type header
    response.setHeader('X-Device-Type', options.deviceType);
    
    // Add connection type header
    response.setHeader('X-Connection-Type', options.connectionType);
    
    // Add mobile optimization hints
    if (options.deviceType === 'phone') {
      response.setHeader('X-Mobile-Hints', 'small-screen,touch-interface,limited-bandwidth');
    } else if (options.deviceType === 'tablet') {
      response.setHeader('X-Mobile-Hints', 'medium-screen,touch-interface');
    }

    // Add battery optimization hints
    if (options.batteryLevel && options.batteryLevel < 20) {
      response.setHeader('X-Battery-Optimization', 'enabled');
    }

    // Add data usage hints
    if (options.connectionType === 'cellular') {
      response.setHeader('X-Data-Optimization', 'enabled');
    }
  }

  /**
   * Generate cache key for mobile optimization
   */
  private generateCacheKey(request: any): string {
    const url = request.url;
    const method = request.method;
    const userAgent = request.headers['user-agent'] || '';
    const connectionType = request.headers['x-connection-type'] || 'wifi';
    
    // Create a simple hash of the request characteristics
    const keyComponents = [method, url, this.getDeviceType(userAgent), connectionType];
    const keyString = keyComponents.join(':');
    
    // Simple hash function (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `mobile:${Math.abs(hash)}`;
  }

  /**
   * Get device type from user agent
   */
  private getDeviceType(userAgent: string): string {
    if (this.isMobilePhone(userAgent)) return 'phone';
    if (this.isTablet(userAgent)) return 'tablet';
    return 'desktop';
  }
}