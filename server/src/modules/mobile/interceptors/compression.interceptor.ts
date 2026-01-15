import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PayloadCompressionService } from '../services/payload-compression.service';

@Injectable()
export class CompressionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CompressionInterceptor.name);

  constructor(private readonly compressionService: PayloadCompressionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map(async (data) => {
        // Check if compression is supported and requested
        if (!this.shouldCompress(request, response)) {
          return data;
        }

        try {
          // Get optimal compression settings
          const deviceType = this.getDeviceType(request);
          const connectionType = this.getConnectionType(request);
          const batteryLevel = this.getBatteryLevel(request);

          const compressionOptions = this.compressionService.getOptimalCompressionSettings(
            deviceType,
            connectionType,
            batteryLevel,
          );

          // Compress the payload
          const compressionResult = await this.compressionService.compressPayload(
            data,
            compressionOptions,
          );

          if (compressionResult) {
            // Set compression headers
            response.setHeader('Content-Encoding', compressionResult.algorithm);
            response.setHeader('X-Original-Size', compressionResult.originalSize.toString());
            response.setHeader('X-Compressed-Size', compressionResult.compressedSize.toString());
            response.setHeader('X-Compression-Ratio', compressionResult.compressionRatio.toFixed(1) + '%');
            response.setHeader('X-Compression-Algorithm', compressionResult.algorithm);

            // Return compressed data
            return compressionResult.compressed;
          } else {
            // Compression not beneficial or failed
            response.setHeader('X-Compression-Skipped', 'true');
            return data;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : '';
          this.logger.error(`Compression failed: ${errorMessage}`, errorStack);
          
          // Return original data if compression fails
          response.setHeader('X-Compression-Error', errorMessage);
          return data;
        }
      }),
    );
  }

  /**
   * Determine if response should be compressed
   */
  private shouldCompress(request: any, response: any): boolean {
    // Check if client accepts compression
    const acceptEncoding = request.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate') && !acceptEncoding.includes('br')) {
      return false;
    }

    // Check if response is already compressed
    if (response.getHeader('content-encoding')) {
      return false;
    }

    // Check content type - only compress JSON and text responses
    const contentType = response.getHeader('content-type') || '';
    const compressibleTypes = [
      'application/json',
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
    ];

    const isCompressible = compressibleTypes.some(type => contentType.includes(type));
    if (!isCompressible) {
      return false;
    }

    // Check if mobile optimization is requested
    const mobileOptimize = request.headers['x-mobile-optimize'] === 'true';
    const isMobile = this.isMobileDevice(request);
    const isCellular = this.getConnectionType(request) === 'cellular';

    return mobileOptimize || isMobile || isCellular;
  }

  /**
   * Check if request is from a mobile device
   */
  private isMobileDevice(request: any): boolean {
    const userAgent = request.headers['user-agent'] || '';
    const mobileRegex = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone|Tablet/i;
    return mobileRegex.test(userAgent);
  }

  /**
   * Get device type from request
   */
  private getDeviceType(request: any): 'phone' | 'tablet' | 'desktop' {
    const userAgent = request.headers['user-agent'] || '';
    
    if (/Mobile|Android|iPhone|iPod|BlackBerry|Windows Phone/i.test(userAgent) && 
        !/iPad|Android.*Tablet|Kindle|Silk/i.test(userAgent)) {
      return 'phone';
    } else if (/iPad|Android.*Tablet|Kindle|Silk/i.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Get connection type from request
   */
  private getConnectionType(request: any): 'wifi' | 'cellular' | 'offline' {
    const connectionType = request.headers['x-connection-type'] || 'wifi';
    
    if (connectionType === 'cellular' || connectionType === '2g' || 
        connectionType === '3g' || connectionType === '4g') {
      return 'cellular';
    } else if (connectionType === 'offline') {
      return 'offline';
    } else {
      return 'wifi';
    }
  }

  /**
   * Get battery level from request
   */
  private getBatteryLevel(request: any): number | undefined {
    const batteryLevel = request.headers['x-battery-level'];
    return batteryLevel ? parseInt(batteryLevel, 10) : undefined;
  }
}