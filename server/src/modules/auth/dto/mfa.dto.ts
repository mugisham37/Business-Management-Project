import { IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnableMfaDto {
  @ApiProperty({
    description: 'TOTP token from authenticator app',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  token!: string;
}

export class DisableMfaDto {
  @ApiPropertyOptional({
    description: 'TOTP token from authenticator app',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  token?: string;

  @ApiPropertyOptional({
    description: 'Backup code (alternative to token)',
    example: 'A1B2C3D4',
    minLength: 8,
    maxLength: 8,
  })
  @IsOptional()
  @IsString()
  @Length(8, 8)
  backupCode?: string;
}

export class VerifyMfaDto {
  @ApiProperty({
    description: 'TOTP token from authenticator app or backup code',
    example: '123456',
  })
  @IsString()
  token!: string;
}

export class GenerateBackupCodesDto {
  @ApiProperty({
    description: 'Current TOTP token to verify identity',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  token!: string;
}

export class MfaLoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsString()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
  })
  @IsString()
  password!: string;

  @ApiProperty({
    description: 'MFA token (TOTP or backup code)',
    example: '123456',
  })
  @IsString()
  mfaToken!: string;
}