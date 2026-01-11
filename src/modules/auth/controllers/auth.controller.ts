import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  Patch,
  Request,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { 
  LoginDto, 
  RegisterDto, 
  RefreshTokenDto, 
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/auth.dto';
import { MfaLoginDto } from '../dto/mfa.dto';
import { 
  LoginResponse, 
  RefreshTokenResponse,
  AuthenticatedUser,
} from '../interfaces/auth.interface';
import { 
  Public, 
  CurrentUser, 
  CurrentSession,
  IpAddress,
  UserAgent,
  RequirePermissions,
} from '../decorators/auth.decorators';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Register a new user',
    description: 'Create a new user account with email and password',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            tenantId: { type: 'string' },
            role: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number' },
        tokenType: { type: 'string' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data',
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User already exists',
  })
  async register(
    @Body() registerDto: RegisterDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<LoginResponse> {
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticate user with email and password',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'User successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            tenantId: { type: 'string' },
            role: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number' },
        tokenType: { type: 'string' },
      },
    },
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials',
  })
  async login(@Request() req: any): Promise<LoginResponse> {
    // The LocalAuthGuard handles the authentication
    // and attaches the login response to req.user
    return req.user;
  }

  @Public()
  @Post('check-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Check if MFA is required',
    description: 'Check if a user requires MFA for login',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'MFA requirement check result',
    schema: {
      type: 'object',
      properties: {
        requiresMfa: { type: 'boolean' },
        userId: { type: 'string', nullable: true },
      },
    },
  })
  async checkMfaRequired(
    @Body() body: { email: string },
  ): Promise<{ requiresMfa: boolean; userId?: string }> {
    return this.authService.requiresMfa(body.email);
  }

  @Public()
  @Post('login-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Login with MFA',
    description: 'Authenticate user with email, password, and MFA token',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User successfully authenticated with MFA',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            tenantId: { type: 'string' },
            role: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            displayName: { type: 'string' },
          },
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number' },
        tokenType: { type: 'string' },
      },
    },
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials or MFA token',
  })
  async loginWithMfa(
    @Body() mfaLoginDto: MfaLoginDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ): Promise<LoginResponse> {
    return this.authService.loginWithMfa(
      mfaLoginDto.email,
      mfaLoginDto.password,
      mfaLoginDto.mfaToken,
      ipAddress,
      userAgent
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Get a new access token using refresh token',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token successfully refreshed',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number' },
        tokenType: { type: 'string' },
      },
    },
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid refresh token',
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponse> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'User logout',
    description: 'Logout user and invalidate current session',
  })
  @ApiResponse({ 
    status: 204, 
    description: 'User successfully logged out',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  async logout(@CurrentSession() sessionId: string): Promise<void> {
    await this.authService.logout(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Logout from all sessions',
    description: 'Logout user from all active sessions',
  })
  @ApiResponse({ 
    status: 204, 
    description: 'User successfully logged out from all sessions',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  async logoutAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.authService.logoutAllSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @RequirePermissions('profile:update')
  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Change user password',
    description: 'Change the authenticated user\'s password',
  })
  @ApiResponse({ 
    status: 204, 
    description: 'Password successfully changed',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid current password',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(userId, changePasswordDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Request password reset',
    description: 'Send password reset email to user',
  })
  @ApiResponse({ 
    status: 204, 
    description: 'Password reset email sent (if email exists)',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid email format',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<void> {
    await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Reset password',
    description: 'Reset user password using reset token',
  })
  @ApiResponse({ 
    status: 204, 
    description: 'Password successfully reset',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid or expired reset token',
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<void> {
    await this.authService.resetPassword(resetPasswordDto);
  }
}