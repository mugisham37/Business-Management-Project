import { userRoleEnum } from '../../database/schema/enums';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  tenantId: string;
  role: typeof userRoleEnum.enumValues[number];
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: typeof userRoleEnum.enumValues[number];
  permissions: string[];
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  sessionId: string;
  lastLoginAt?: Date;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  sessionToken: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  expiresAt: Date;
  lastAccessedAt: Date;
  isRevoked: boolean;
}

export interface PasswordResetInfo {
  token: string;
  expiresAt: Date;
  userId: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  bcryptRounds: number;
  maxFailedAttempts: number;
  lockoutDuration: number;
  passwordResetExpiration: number;
}