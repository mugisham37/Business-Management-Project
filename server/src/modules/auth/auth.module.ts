import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './services/auth.service';
import { PermissionsService } from './services/permissions.service';
import { MfaService } from './services/mfa.service';
import { AuthResolver } from './resolvers/auth.resolver';
import { MfaResolver } from './resolvers/mfa.resolver';
import { PermissionsResolver } from './resolvers/permissions.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { DrizzleService } from '../database/drizzle.service';
import { DataLoaderService } from '../../common/graphql/dataloader.service';
import { CacheModule } from '../cache/cache.module';

/**
 * Auth Module
 * Provides authentication, authorization, and MFA services
 * GraphQL-only implementation with no REST endpoints
 */
@Module({
  imports: [
    PassportModule.register({ 
      defaultStrategy: 'jwt',
      session: false,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m');
        
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }
        
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
    CacheModule,
  ],
  providers: [
    DrizzleService,
    DataLoaderService,
    AuthService,
    PermissionsService,
    MfaService,
    AuthResolver,
    MfaResolver,
    PermissionsResolver,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    LocalAuthGuard,
    PermissionsGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    PermissionsService,
    MfaService,
    AuthResolver,
    MfaResolver,
    PermissionsResolver,
    JwtAuthGuard,
    LocalAuthGuard,
    PermissionsGuard,
    RolesGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}