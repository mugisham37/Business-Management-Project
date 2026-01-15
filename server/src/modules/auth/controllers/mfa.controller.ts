import { 
  Controller, 
  Post, 
  Get,
  Delete,
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
} from '@nestjs/swagger';

import { MfaService, MfaSetupResponse } from '../services/mfa.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { 
  EnableMfaDto, 
  DisableMfaDto, 
  VerifyMfaDto, 
  GenerateBackupCodesDto,
} from '../dto/mfa.dto';
import { 
  CurrentUser, 
  CurrentTenant,
} from '../decorators/auth.decorators';
import { AuthenticatedUser } from '../interfaces/auth.interface';

@ApiTags('Multi-Factor Authentication')
@Controller('auth/mfa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('setup')
  @ApiOperation({ 
    summary: 'Generate MFA setup',
    description: 'Generate QR code and backup codes for MFA setup',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'MFA setup generated successfully',
    schema: {
      type: 'object',
      properties: {
        secret: { type: 'string', description: 'Base32 encoded secret' },
        qrCodeUrl: { type: 'string', description: 'QR code data URL' },
        backupCodes: { 
          type: 'array',
          items: { type: 'string' },
          description: 'Backup codes for recovery'
        },
        manualEntryKey: { type: 'string', description: 'Manual entry key for authenticator apps' },
      },
    },
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  async setupMfa(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MfaSetupResponse> {
    return this.mfaService.generateMfaSetup(user.id, user.tenantId, user.email);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Enable MFA',
    description: 'Enable MFA after verifying the setup token',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'MFA enabled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        enabled: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid MFA token or setup not found',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  async enableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() enableMfaDto: EnableMfaDto,
  ): Promise<{ message: string; enabled: boolean }> {
    await this.mfaService.enableMfa(user.id, user.tenantId, enableMfaDto.token);
    return { 
      message: 'MFA enabled successfully', 
      enabled: true 
    };
  }

  @Delete('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Disable MFA',
    description: 'Disable MFA using current token or backup code',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'MFA disabled successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        enabled: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid MFA token or backup code',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required or invalid credentials',
  })
  async disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() disableMfaDto: DisableMfaDto,
  ): Promise<{ message: string; enabled: boolean }> {
    await this.mfaService.disableMfa(
      user.id, 
      user.tenantId, 
      disableMfaDto.token, 
      disableMfaDto.backupCode
    );
    
    return { 
      message: 'MFA disabled successfully', 
      enabled: false 
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Verify MFA token',
    description: 'Verify a MFA token (for testing purposes)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'MFA token verification result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        usedBackupCode: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'MFA not enabled for user',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  async verifyMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() verifyMfaDto: VerifyMfaDto,
  ): Promise<{ isValid: boolean; usedBackupCode?: boolean }> {
    const result = await this.mfaService.verifyMfaToken(
      user.id, 
      user.tenantId, 
      verifyMfaDto.token
    );
    
    return result;
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Get MFA status',
    description: 'Get current MFA status for the authenticated user',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'MFA status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        backupCodesCount: { type: 'number' },
        hasSecret: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required',
  })
  async getMfaStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ enabled: boolean; backupCodesCount: number; hasSecret: boolean }> {
    return this.mfaService.getMfaStatus(user.id, user.tenantId);
  }

  @Post('backup-codes/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Generate new backup codes',
    description: 'Generate new backup codes (invalidates old ones)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'New backup codes generated successfully',
    schema: {
      type: 'object',
      properties: {
        backupCodes: { 
          type: 'array',
          items: { type: 'string' },
          description: 'New backup codes'
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid MFA token',
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication required or invalid credentials',
  })
  async generateNewBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() generateDto: GenerateBackupCodesDto,
  ): Promise<{ backupCodes: string[]; message: string }> {
    const backupCodes = await this.mfaService.generateNewBackupCodes(
      user.id, 
      user.tenantId, 
      generateDto.token
    );
    
    return { 
      backupCodes, 
      message: 'New backup codes generated successfully. Store them securely!' 
    };
  }
}