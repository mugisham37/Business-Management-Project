import { InputType, Field } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsBoolean, IsUUID } from 'class-validator';

/**
 * Login input for GraphQL
 * Supports session persistence with rememberMe flag
 */
@InputType()
export class LoginInput {
  @Field()
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email!: string;

  @Field()
  @ApiProperty({ description: 'User password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Remember me for extended session (30 days instead of 15 minutes)', required: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

/**
 * Login with MFA input
 * Used when user has MFA enabled
 */
@InputType()
export class LoginWithMfaInput {
  @Field()
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email!: string;

  @Field()
  @ApiProperty({ description: 'User password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @Field()
  @ApiProperty({ description: 'MFA token (6-digit TOTP code or backup code)' })
  @IsString()
  mfaToken!: string;
}

/**
 * Register input for GraphQL
 * Creates new user account
 */
@InputType()
export class RegisterInput {
  @Field()
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email!: string;

  @Field()
  @ApiProperty({ description: 'User password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Field()
  @ApiProperty({ description: 'User first name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @Field()
  @ApiProperty({ description: 'User last name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @Field()
  @ApiProperty({ description: 'Tenant ID for multi-tenant registration', type: 'string' })
  @IsString()
  @IsUUID()
  tenantId!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'User phone number', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

/**
 * Refresh token input
 * Generates new access and refresh tokens
 */
@InputType()
export class RefreshTokenInput {
  @Field()
  @ApiProperty({ description: 'Valid refresh token' })
  @IsString()
  refreshToken!: string;
}

/**
 * Change password input
 * Updates user password (requires current password verification)
 */
@InputType()
export class ChangePasswordInput {
  @Field()
  @ApiProperty({ description: 'Current password for verification' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @Field()
  @ApiProperty({ description: 'New password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

/**
 * Forgot password input
 * Initiates password reset process
 */
@InputType()
export class ForgotPasswordInput {
  @Field()
  @ApiProperty({ description: 'Registered email address' })
  @IsEmail()
  email!: string;
}

/**
 * Reset password input
 * Completes password reset using token from email
 */
@InputType()
export class ResetPasswordInput {
  @Field()
  @ApiProperty({ description: 'Password reset token sent via email' })
  @IsString()
  token!: string;

  @Field()
  @ApiProperty({ description: 'New password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
