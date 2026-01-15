import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsDateString,
  IsObject,
  IsNumber,
  IsEmail,
  ValidateNested,
  ArrayMinSize,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationChannel {
  IN_APP = 'in-app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

export enum NotificationFrequency {
  IMMEDIATE = 'immediate',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

export class NotificationActionDto {
  @ApiProperty({ description: 'Action ID' })
  @IsString()
  @Length(1, 50)
  id!: string;

  @ApiProperty({ description: 'Action label' })
  @IsString()
  @Length(1, 100)
  label!: string;

  @ApiPropertyOptional({ description: 'Action URL' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Action type' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ 
    description: 'Action style',
    enum: ['primary', 'secondary', 'danger'],
  })
  @IsOptional()
  @IsEnum(['primary', 'secondary', 'danger'])
  style?: 'primary' | 'secondary' | 'danger';
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'Notification type' })
  @IsString()
  @Length(1, 50)
  type!: string;

  @ApiProperty({ 
    description: 'Recipient user IDs',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(4, { each: true })
  recipients!: string[];

  @ApiPropertyOptional({ description: 'Template ID' })
  @IsOptional()
  @IsUUID(4)
  templateId?: string;

  @ApiPropertyOptional({ description: 'Notification subject' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  subject?: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @Length(1, 1000)
  message!: string;

  @ApiPropertyOptional({ description: 'HTML content' })
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiPropertyOptional({ 
    description: 'Notification priority',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Scheduled delivery time' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  scheduledAt?: Date;

  @ApiPropertyOptional({ 
    description: 'Notification channels',
    type: [String],
    enum: NotificationChannel,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ 
    description: 'Template variables',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Notification actions',
    type: [NotificationActionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationActionDto)
  actions?: NotificationActionDto[];

  @ApiPropertyOptional({ description: 'Group ID for related notifications' })
  @IsOptional()
  @IsUUID(4)
  groupId?: string;

  @ApiPropertyOptional({ description: 'Thread ID for conversation threading' })
  @IsOptional()
  @IsUUID(4)
  threadId?: string;

  @ApiPropertyOptional({ 
    description: 'Additional metadata',
    type: 'object',    additionalProperties: true,  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ description: 'Notification type' })
  @IsString()
  @Length(1, 50)
  type!: string;

  @ApiProperty({ 
    description: 'Notification channel',
    enum: NotificationChannel,
  })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiPropertyOptional({ description: 'Template subject' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  subject?: string;

  @ApiProperty({ description: 'Template body' })
  @IsString()
  @Length(1, 5000)
  bodyTemplate!: string;

  @ApiPropertyOptional({ description: 'HTML template' })
  @IsOptional()
  @IsString()
  htmlTemplate?: string;

  @ApiProperty({ 
    description: 'Template variables',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  variables!: string[];

  @ApiPropertyOptional({ 
    description: 'Template is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class NotificationPreferenceDto {
  @ApiProperty({ description: 'Notification type' })
  @IsString()
  @Length(1, 50)
  notificationType!: string;

  @ApiProperty({ 
    description: 'Notification channel',
    enum: NotificationChannel,
  })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ description: 'Preference is enabled' })
  @IsBoolean()
  isEnabled!: boolean;

  @ApiPropertyOptional({ 
    description: 'Notification frequency',
    enum: NotificationFrequency,
    default: NotificationFrequency.IMMEDIATE,
  })
  @IsOptional()
  @IsEnum(NotificationFrequency)
  frequency?: NotificationFrequency;

  @ApiPropertyOptional({ 
    description: 'Quiet hours start time (HH:MM)',
    pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional({ 
    description: 'Quiet hours end time (HH:MM)',
    pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$',
  })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  @ApiPropertyOptional({ 
    description: 'User timezone',
    default: 'UTC',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ 
    description: 'Channel-specific settings',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: 'User ID (admin only)' })
  @IsOptional()
  @IsUUID(4)
  userId?: string;

  @ApiProperty({ 
    description: 'Notification preferences',
    type: [NotificationPreferenceDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceDto)
  preferences!: NotificationPreferenceDto[];
}

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'Device token' })
  @IsString()
  @Length(1, 500)
  token!: string;

  @ApiProperty({ 
    description: 'Device platform',
    enum: DevicePlatform,
  })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiPropertyOptional({ description: 'Device ID' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deviceId?: string;

  @ApiPropertyOptional({ description: 'App version' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  appVersion?: string;
}

export class NotificationHistoryQueryDto {
  @ApiPropertyOptional({ 
    description: 'Number of notifications to return',
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ 
    description: 'Number of notifications to skip',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Filter by notification type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by notification status',
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
  })
  @IsOptional()
  @IsEnum(['pending', 'sent', 'delivered', 'failed', 'read'])
  status?: string;

  @ApiPropertyOptional({ 
    description: 'Show only unread notifications',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class NotificationStatsQueryDto {
  @ApiPropertyOptional({ description: 'Start date for statistics' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for statistics' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Filter by notification type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID(4)
  userId?: string;
}

export class BulkNotificationDto {
  @ApiProperty({ 
    description: 'Notifications to send',
    type: [CreateNotificationDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateNotificationDto)
  notifications!: CreateNotificationDto[];

  @ApiPropertyOptional({ 
    description: 'Batch processing options',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  options?: {
    batchSize?: number;
    delayBetweenBatches?: number;
    priority?: NotificationPriority;
  };
}

export class NotificationWebhookDto {
  @ApiProperty({ description: 'Webhook URL' })
  @IsString()
  url!: string;

  @ApiProperty({ 
    description: 'Events to subscribe to',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @ApiPropertyOptional({ description: 'Webhook secret for verification' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({ 
    description: 'Webhook is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}