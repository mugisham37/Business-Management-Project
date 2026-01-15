import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export interface CompressionOptions {
  algorithm: 'gzip' | 'deflate' | 'brotli';
  level: number; // 1-9, higher = better compression but slower
  threshold: number; // Minimum size in bytes to compress
}

export interface CompressionResult {
  compressed: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
}

@Injectable()
export class PayloadCompressionService {
  private readonly logger = new Logger(PayloadCompressionService.name);

  private readonly defaultOptions: CompressionOptions = {
    algorithm: 'gzip',
    level: 6,
    threshold: 1024, // 1KB threshold
  };

  /**
   * Compress payload for mobile transmission
   */
  async compressPayload(
    data: any,
    options: Partial<CompressionOptions> = {},
  ): Promise<CompressionResult | null> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Convert data to buffer
      const jsonString = JSON.stringify(data);
      const originalBuffer = Buffer.from(jsonString, 'utf8');
      const originalSize = originalBuffer.length;

      // Skip compression if below threshold
      if (originalSize < opts.threshold) {
        this.logger.debug(`Payload size ${originalSize} below compression threshold ${opts.threshold}`);
        return null;
      }

      let compressed: Buffer;
      const startTime = Date.now();

      switch (opts.algorithm) {
        case 'gzip':
          compressed = await gzip(originalBuffer, { level: opts.level });
          break;
        case 'deflate':
          compressed = await deflate(originalBuffer, { level: opts.level });
          break;
        case 'brotli':
          compressed = await this.compressBrotli(originalBuffer, opts.level);
          break;
        default:
          throw new Error(`Unsupported compression algorithm: ${opts.algorithm}`);
      }

      const compressionTime = Date.now() - startTime;
      const compressedSize = compressed.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      this.logger.debug(
        `Payload compressed using ${opts.algorithm}: ${originalSize} -> ${compressedSize} bytes ` +
        `(${compressionRatio.toFixed(1)}% reduction) in ${compressionTime}ms`,
      );

      return {
        compressed,
        originalSize,
        compressedSize,
        compressionRatio,
        algorithm: opts.algorithm,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Payload compression failed: ${errorMessage}`, errorStack);
      return null;
    }
  }

  /**
   * Decompress payload
   */
  async decompressPayload(
    compressedData: Buffer,
    algorithm: 'gzip' | 'deflate' | 'brotli',
  ): Promise<any> {
    try {
      let decompressed: Buffer;

      switch (algorithm) {
        case 'gzip':
          decompressed = await gunzip(compressedData);
          break;
        case 'deflate':
          decompressed = await inflate(compressedData);
          break;
        case 'brotli':
          decompressed = await this.decompressBrotli(compressedData);
          break;
        default:
          throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
      }

      const jsonString = decompressed.toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Payload decompression failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Compress using Brotli algorithm (Node.js 11.7.0+)
   */
  private async compressBrotli(data: Buffer, level: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(data, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: level,
        },
      }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Decompress using Brotli algorithm
   */
  private async decompressBrotli(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(data, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Get optimal compression settings based on device and connection
   */
  getOptimalCompressionSettings(
    deviceType: 'phone' | 'tablet' | 'desktop',
    connectionType: 'wifi' | 'cellular' | 'offline',
    batteryLevel?: number,
  ): CompressionOptions {
    let algorithm: 'gzip' | 'deflate' | 'brotli' = 'gzip';
    let level = 6;
    let threshold = 1024;

    // Optimize based on device type
    if (deviceType === 'phone') {
      // Phones need faster compression due to limited CPU
      level = 4;
      threshold = 512; // Compress smaller payloads
    } else if (deviceType === 'desktop') {
      // Desktops can handle higher compression
      algorithm = 'brotli';
      level = 8;
    }

    // Optimize based on connection type
    if (connectionType === 'cellular') {
      // Cellular connections benefit from higher compression
      algorithm = 'brotli';
      level = Math.min(level + 2, 9);
      threshold = 256; // Compress even smaller payloads
    } else if (connectionType === 'wifi') {
      // WiFi connections can use moderate compression
      level = Math.max(level - 1, 1);
    }

    // Optimize based on battery level
    if (batteryLevel && batteryLevel < 20) {
      // Low battery: use faster, less CPU-intensive compression
      algorithm = 'deflate';
      level = Math.max(level - 2, 1);
    }

    return {
      algorithm,
      level,
      threshold,
    };
  }

  /**
   * Analyze compression effectiveness
   */
  async analyzeCompressionEffectiveness(
    sampleData: any[],
  ): Promise<{
    algorithm: string;
    averageCompressionRatio: number;
    averageCompressionTime: number;
    recommendation: string;
  }> {
    const algorithms: ('gzip' | 'deflate' | 'brotli')[] = ['gzip', 'deflate', 'brotli'];
    const results = [];

    for (const algorithm of algorithms) {
      const compressionResults = [];
      
      for (const data of sampleData.slice(0, 10)) { // Test with first 10 samples
        const startTime = Date.now();
        const result = await this.compressPayload(data, { algorithm, level: 6 });
        const compressionTime = Date.now() - startTime;
        
        if (result) {
          compressionResults.push({
            ratio: result.compressionRatio,
            time: compressionTime,
          });
        }
      }

      if (compressionResults.length > 0) {
        const avgRatio = compressionResults.reduce((sum, r) => sum + r.ratio, 0) / compressionResults.length;
        const avgTime = compressionResults.reduce((sum, r) => sum + r.time, 0) / compressionResults.length;
        
        results.push({
          algorithm,
          averageCompressionRatio: avgRatio,
          averageCompressionTime: avgTime,
          score: avgRatio / avgTime, // Higher ratio per ms is better
        });
      }
    }

    // Find best algorithm
    const bestResult = results.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    let recommendation = `Use ${bestResult.algorithm} compression for optimal performance.`;
    
    if (bestResult.averageCompressionRatio > 50) {
      recommendation += ' High compression ratio achieved - excellent for mobile.';
    } else if (bestResult.averageCompressionRatio > 30) {
      recommendation += ' Good compression ratio - suitable for mobile optimization.';
    } else {
      recommendation += ' Low compression ratio - consider alternative optimization strategies.';
    }

    return {
      algorithm: bestResult.algorithm,
      averageCompressionRatio: bestResult.averageCompressionRatio,
      averageCompressionTime: bestResult.averageCompressionTime,
      recommendation,
    };
  }
}