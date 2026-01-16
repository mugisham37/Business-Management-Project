import { InputType, Field } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsISO8601 } from 'class-validator';

/**
 * Grant permission input
 * Assigns specific permission to a user with optional expiration
 */
@InputType()
export class GrantPermissionInput {
  @Field()
  @ApiProperty({ description: 'User ID to grant permission to', type: 'string' })
  @IsString()
  @IsUUID()
  userId!: string;

  @Field()
  @ApiProperty({ description: 'Permission name (e.g., "users:read", "users:write")' })
  @IsString()
  permission!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Resource type for granular permissions', required: false })
  @IsOptional()
  @IsString()
  resource?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Specific resource ID', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  resourceId?: string;

  @Field(() => String, { nullable: true })
  @ApiProperty({ description: 'Permission expiration date (ISO 8601)', required: false, type: 'string' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

/**
 * Revoke permission input
 * Removes specific permission from a user
 */
@InputType()
export class RevokePermissionInput {
  @Field()
  @ApiProperty({ description: 'User ID to revoke permission from', type: 'string' })
  @IsString()
  @IsUUID()
  userId!: string;

  @Field()
  @ApiProperty({ description: 'Permission name to revoke' })
  @IsString()
  permission!: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Resource type', required: false })
  @IsOptional()
  @IsString()
  resource?: string;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Specific resource ID', required: false })
  @IsOptional()
  @IsString()
  @IsUUID()
  resourceId?: string;
}

/**
 * Assign role input
 * Assigns a predefined role to a user
 */
@InputType()
export class AssignRoleInput {
  @Field()
  @ApiProperty({ description: 'User ID to assign role to', type: 'string' })
  @IsString()
  @IsUUID()
  userId!: string;

  @Field()
  @ApiProperty({ description: 'Role name (e.g., "tenant_admin", "manager", "employee")' })
  @IsString()
  role!: string;
}

/**
 * Create role input
 * Creates a new custom role with specific permissions
 */
@InputType()
export class CreateRoleInput {
  @Field()
  @ApiProperty({ description: 'Role name' })
  @IsString()
  name!: string;

  @Field(() => [String])
  @ApiProperty({ description: 'Permissions associated with this role', type: [String] })
  permissions!: string[];
}

/**
 * Update role permissions input
 * Updates permissions for an existing role
 */
@InputType()
export class UpdateRolePermissionsInput {
  @Field()
  @ApiProperty({ description: 'Role name to update' })
  @IsString()
  role!: string;

  @Field(() => [String])
  @ApiProperty({ description: 'New permissions for the role', type: [String] })
  permissions!: string[];
}
