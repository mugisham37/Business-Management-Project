import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getAppInfo(): Record<string, unknown> {
    return {
      name: 'Unified Business Platform',
      version: '1.0.0',
      description: 'Enterprise-level unified business platform with progressive feature disclosure',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
      features: {
        multiTenant: true,
        progressiveDisclosure: true,
        offlineFirst: true,
        realTimeSync: true,
      },
    };
  }
}