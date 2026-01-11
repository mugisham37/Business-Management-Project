import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { DrizzleService } from '../../database/drizzle.service';
import { users, userSessions } from '../../database/schema/user.schema';
import { LoginDto, RegisterDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '../dto/auth.dto';
import { 
  JwtPayload, 
  AuthenticatedUser, 
  LoginResponse, 
  RefreshTokenResponse, 
  SessionInfo,
  AuthConfig 
} from '../interfaces/auth.interface';
import { eq, and, gt } from 'drizzle-orm';

@Injectable()
export class AuthService {
  private readonly authConfig: AuthConfig;

  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required but not provided');
    }
    
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is required but not provided');
    }

    this.authConfig = {
      jwtSecret,
      jwtExpiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      jwtRefreshSecret,
      jwtRefreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      bcryptRounds: this.configService.get<number>('BCRYPT_ROUNDS', 12),
      maxFailedAttempts: this.configService.get<number>('MAX_FAILED_ATTEMPTS', 5),
      lockoutDuration: this.configService.get<number>('LOCKOUT_DURATION', 15 * 60 * 1000), // 15 minutes
      passwordResetExpiration: this.configService.get<number>('PASSWORD_RESET_EXPIRATION', 60 * 60 * 1000), // 1 hour
    };
  }

  async register(registerDto: RegisterDto, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const db = this.drizzleService.getDb();

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(and(
        eq(users.email, registerDto.email),
        eq(users.tenantId, registerDto.tenantId)
      ))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ConflictException('User with this email already exists in this tenant');
    }

    // Hash password
    const passwordHash = await this.hashPassword(registerDto.password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        tenantId: registerDto.tenantId,
        email: registerDto.email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        displayName: `${registerDto.firstName} ${registerDto.lastName}`,
        role: 'employee', // Default role
        emailVerified: false, // Will be verified later
        createdBy: null, // Self-registration
        updatedBy: null,
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    // Emit user registered event
    this.eventEmitter.emit('user.registered', {
      userId: newUser.id,
      tenantId: newUser.tenantId,
      email: newUser.email,
      timestamp: new Date(),
    });

    // Create session and return login response
    return this.createUserSession(newUser, ipAddress, userAgent);
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const db = this.drizzleService.getDb();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, loginDto.email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked due to too many failed login attempts');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(loginDto.password, user.passwordHash || '');
    
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      // For MFA-enabled users, we need a separate login flow
      // This method should not be used directly for MFA users
      throw new UnauthorizedException('MFA required. Use MFA login endpoint.');
    }

    // Reset failed login attempts on successful login
    await this.resetFailedLoginAttempts(user.id);

    // Update last login information
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Emit login event
    this.eventEmitter.emit('user.login', {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });

    // Create session and return login response
    return this.createUserSession(user, ipAddress, userAgent);
  }

  /**
   * Login with MFA token
   */
  async loginWithMfa(
    email: string, 
    password: string, 
    mfaToken: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<LoginResponse> {
    const db = this.drizzleService.getDb();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked due to too many failed login attempts');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash || '');
    
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if MFA is enabled
    if (!user.mfaEnabled) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }

    // Verify MFA token (this will be injected via dependency)
    // For now, we'll add a simple verification
    if (!user.mfaSecret) {
      throw new UnauthorizedException('MFA setup incomplete');
    }

    // Note: MFA verification will be handled by MfaService
    // This is a placeholder for the integration
    const isMfaValid = await this.verifyMfaTokenInternal(user, mfaToken);
    
    if (!isMfaValid) {
      throw new UnauthorizedException('Invalid MFA token');
    }

    // Reset failed login attempts on successful login
    await this.resetFailedLoginAttempts(user.id);

    // Update last login information
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Emit login event
    this.eventEmitter.emit('user.login', {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      ipAddress,
      userAgent,
      mfaUsed: true,
      timestamp: new Date(),
    });

    // Create session and return login response
    return this.createUserSession(user, ipAddress, userAgent);
  }

  /**
   * Check if user requires MFA
   */
  async requiresMfa(email: string): Promise<{ requiresMfa: boolean; userId?: string }> {
    const db = this.drizzleService.getDb();

    const [user] = await db
      .select({
        id: users.id,
        mfaEnabled: users.mfaEnabled,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.isActive) {
      // Don't reveal if user exists for security
      return { requiresMfa: false };
    }

    return { 
      requiresMfa: user.mfaEnabled || false,
      ...(user.mfaEnabled ? { userId: user.id } : {}),
    };
  }

  /**
   * Internal MFA token verification (placeholder)
   * This will be replaced with proper MfaService integration
   */
  private async verifyMfaTokenInternal(user: any, token: string): Promise<boolean> {
    // This is a placeholder implementation
    // In a real implementation, this would use the MfaService
    // For now, we'll do a basic check
    if (!user.mfaSecret) {
      return false;
    }

    // Check if it's a backup code
    const backupCodes = Array.isArray(user.mfaBackupCodes) ? user.mfaBackupCodes : [];
    if (backupCodes.includes(token)) {
      // In real implementation, we would remove the used backup code
      return true;
    }

    // For TOTP verification, we would use speakeasy here
    // This is just a placeholder
    return token.length === 6 && /^\d+$/.test(token);
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const db = this.drizzleService.getDb();

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.authConfig.jwtRefreshSecret,
      }) as JwtPayload;

      // Find session
      const [session] = await db
        .select()
        .from(userSessions)
        .where(and(
          eq(userSessions.refreshToken, refreshToken),
          eq(userSessions.isRevoked, false),
          gt(userSessions.expiresAt, new Date())
        ))
        .limit(1);

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new tokens
      const newAccessToken = await this.generateAccessToken(user, session.id);
      const newRefreshToken = await this.generateRefreshToken(user, session.id);

      // Update session with new refresh token
      await db
        .update(userSessions)
        .set({
          refreshToken: newRefreshToken,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userSessions.id, session.id));

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.getTokenExpirationTime(this.authConfig.jwtExpiresIn),
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(sessionId: string): Promise<void> {
    const db = this.drizzleService.getDb();

    await db
      .update(userSessions)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'user_logout',
        updatedAt: new Date(),
      })
      .where(eq(userSessions.id, sessionId));

    // Emit logout event
    this.eventEmitter.emit('user.logout', {
      sessionId,
      timestamp: new Date(),
    });
  }

  async logoutAllSessions(userId: string): Promise<void> {
    const db = this.drizzleService.getDb();

    await db
      .update(userSessions)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'logout_all_sessions',
        updatedAt: new Date(),
      })
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isRevoked, false)
      ));

    // Emit logout all event
    this.eventEmitter.emit('user.logout_all', {
      userId,
      timestamp: new Date(),
    });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const db = this.drizzleService.getDb();

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.verifyPassword(
      changePasswordDto.currentPassword,
      user.passwordHash || ''
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(changePasswordDto.newPassword);

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(users.id, userId));

    // Revoke all sessions except current one (force re-login)
    await this.logoutAllSessions(userId);

    // Emit password changed event
    this.eventEmitter.emit('user.password_changed', {
      userId,
      timestamp: new Date(),
    });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const db = this.drizzleService.getDb();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, forgotPasswordDto.email))
      .limit(1);

    if (!user) {
      // Don't reveal if email exists or not for security
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + this.authConfig.passwordResetExpiration);

    // Update user with reset token
    await db
      .update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Emit password reset requested event
    this.eventEmitter.emit('user.password_reset_requested', {
      userId: user.id,
      email: user.email,
      resetToken,
      expiresAt: resetExpires,
      timestamp: new Date(),
    });
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const db = this.drizzleService.getDb();

    // Find user by reset token
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.passwordResetToken, resetPasswordDto.token),
        gt(users.passwordResetExpires, new Date())
      ))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(resetPasswordDto.newPassword);

    // Update password and clear reset token
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Revoke all sessions (force re-login)
    await this.logoutAllSessions(user.id);

    // Emit password reset event
    this.eventEmitter.emit('user.password_reset', {
      userId: user.id,
      timestamp: new Date(),
    });
  }

  async validateUser(userId: string): Promise<AuthenticatedUser | null> {
    const db = this.drizzleService.getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user) {
      return null;
    }

    return this.mapUserToAuthenticatedUser(user);
  }

  async validateSession(sessionId: string): Promise<SessionInfo | null> {
    const db = this.drizzleService.getDb();

    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.id, sessionId),
        eq(userSessions.isRevoked, false),
        gt(userSessions.expiresAt, new Date())
      ))
      .limit(1);

    if (!session) {
      return null;
    }

    const sessionInfo: SessionInfo = {
      id: session.id,
      userId: session.userId,
      sessionToken: session.sessionToken,
      refreshToken: session.refreshToken,
      deviceInfo: session.deviceInfo as Record<string, any>,
      expiresAt: session.expiresAt,
      lastAccessedAt: session.lastAccessedAt || new Date(),
      isRevoked: session.isRevoked || false,
    };

    if (session.ipAddress) sessionInfo.ipAddress = session.ipAddress;
    if (session.userAgent) sessionInfo.userAgent = session.userAgent;

    return sessionInfo;
  }

  private async createUserSession(
    user: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    const db = this.drizzleService.getDb();

    // Create session
    const sessionId = uuidv4();
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + this.getTokenExpirationTime(this.authConfig.jwtRefreshExpiresIn));

    const accessToken = await this.generateAccessToken(user, sessionId);
    const refreshToken = await this.generateRefreshToken(user, sessionId);

    // Store session in database
    await db
      .insert(userSessions)
      .values({
        id: sessionId,
        tenantId: user.tenantId,
        userId: user.id,
        sessionToken,
        refreshToken,
        ipAddress,
        userAgent,
        deviceInfo: {},
        expiresAt,
        lastAccessedAt: new Date(),
        createdBy: user.id,
        updatedBy: user.id,
      });

    const authenticatedUser = this.mapUserToAuthenticatedUser(user, sessionId);

    return {
      user: authenticatedUser,
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpirationTime(this.authConfig.jwtExpiresIn),
      tokenType: 'Bearer',
    };
  }

  private async generateAccessToken(user: any, sessionId: string): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions || [],
      sessionId,
    };

    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(user: any, sessionId: string): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions || [],
      sessionId,
    };

    // For refresh tokens, we need to use a different secret
    // Since JwtService is configured with the access token secret,
    // we'll use the jwt library directly for refresh tokens
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, this.authConfig.jwtRefreshSecret, {
      expiresIn: this.authConfig.jwtRefreshExpiresIn,
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.authConfig.bcryptRounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    const db = this.drizzleService.getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return;

    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updateData: any = {
      failedLoginAttempts: failedAttempts,
      updatedAt: new Date(),
    };

    // Lock account if max attempts reached
    if (failedAttempts >= this.authConfig.maxFailedAttempts) {
      updateData.lockedUntil = new Date(Date.now() + this.authConfig.lockoutDuration);
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
  }

  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    const db = this.drizzleService.getDb();

    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  private mapUserToAuthenticatedUser(user: any, sessionId?: string): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions || [],
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
      sessionId: sessionId || '',
      lastLoginAt: user.lastLoginAt,
    };
  }

  private getTokenExpirationTime(expiresIn: string): number {
    // Convert string like '15m', '7d', '1h' to seconds
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }
}