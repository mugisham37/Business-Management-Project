import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsUrl,
  IsEmail,
  IsPhoneNumber,
  ValidateNested,
  ArrayMinSize,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Base DTOs

export class ActionDto {
  @ApiProperty({ description: 'Action ID' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Action label' })
  @IsString()
  label!: string;

  @ApiPropertyOptional({ description: 'Action URL' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({ description: 'Action style', enum: ['primary', 'secondary', 'danger'] })
  @IsOptional()
  @IsEnum(['primary', 'secondary', 'danger'])
  style?: 'primary' | 'secondary' | 'danger';
}

export class RecipientsDto {
  @ApiPropertyOptional({ description: 'User IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Email addresses', type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @ApiPropertyOptional({ description: 'Phone numbers', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[];

  @ApiPropertyOptional({ description: 'Slack channels', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slackChannels?: string[];

  @ApiPropertyOptional({ description: 'Teams channels', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamsChannels?: string[];
}

export class NotificationOptionsDto {
  @ApiPropertyOptional({ description: 'Enable fallback channels' })
  @IsOptional()
  @IsBoolean()
  enableFallback?: boolean;

  @ApiPropertyOptional({ description: 'Retry attempts', minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  retryAttempts?: number;

  @ApiPropertyOptional({ description: 'Batch size for bulk operations', minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  batchSize?: number;

  @ApiPropertyOptional({ description: 'Delay between batches in milliseconds', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delayBetweenBatches?: number;
}

// Multi-channel notification DTOs

export class SendMultiChannelNotificationDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @Length(1, 2000)
  message!: string;

  @ApiProperty({ description: 'Notification priority', enum: ['low', 'medium', 'high', 'urgent'] })
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority!: 'low' | 'medium' | 'high' | 'urgent';

  @ApiProperty({ description: 'Notification type' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Communication channels to use', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  channels!: string[];

  @ApiPropertyOptional({ description: 'Notification recipients' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientsDto)
  recipients?: RecipientsDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Action buttons', type: [ActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];

  @ApiPropertyOptional({ description: 'Template name for rendering' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional({ description: 'Template variables' })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Scheduled delivery time' })
  @IsOptional()
  scheduledAt?: Date;

  @ApiPropertyOptional({ description: 'Notification options' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationOptionsDto)
  options?: NotificationOptionsDto;
}

export class SendAlertDto {
  @ApiProperty({ description: 'Alert title' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: 'Alert message' })
  @IsString()
  @Length(1, 2000)
  message!: string;

  @ApiProperty({ description: 'Alert severity', enum: ['info', 'warning', 'error', 'critical'] })
  @IsEnum(['info', 'warning', 'error', 'critical'])
  severity!: 'info' | 'warning' | 'error' | 'critical';

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Action URL' })
  @IsOptional()
  @IsUrl()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Action label' })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiPropertyOptional({ description: 'Alert recipients' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientsDto)
  recipients?: RecipientsDto;
}

export class SendBusinessNotificationDto {
  @ApiProperty({ description: 'Notification type' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @Length(1, 2000)
  message!: string;

  @ApiPropertyOptional({ description: 'Notification priority', enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @ApiPropertyOptional({ description: 'Notification recipients' })
  @IsOptional()
  @IsObject()
  recipients?: {
    userIds?: string[];
    roles?: string[];
  };

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional({ description: 'Template variables' })
  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, any>;
}

// Channel configuration DTOs

export class CommunicationChannelDto {
  @ApiProperty({ description: 'Channel type' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Whether channel is enabled' })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ description: 'Channel configuration' })
  @IsOptional()
  @IsObject()
  configuration?: any;

  @ApiPropertyOptional({ description: 'Channel priority (lower = higher priority)', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Fallback channels', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fallbackChannels?: string[];
}

export class ConfigureCommunicationChannelsDto {
  @ApiProperty({ description: 'Communication channels to configure', type: [CommunicationChannelDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CommunicationChannelDto)
  channels!: CommunicationChannelDto[];
}

// Slack integration DTOs

export class CreateSlackIntegrationDto {
  @ApiProperty({ description: 'Slack webhook URL' })
  @IsUrl()
  webhookUrl!: string;

  @ApiPropertyOptional({ description: 'Slack bot token' })
  @IsOptional()
  @IsString()
  botToken?: string;

  @ApiPropertyOptional({ description: 'Default channel' })
  @IsOptional()
  @IsString()
  defaultChannel?: string;

  @ApiPropertyOptional({ description: 'Bot username' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Bot icon emoji' })
  @IsOptional()
  @IsString()
  iconEmoji?: string;

  @ApiPropertyOptional({ description: 'Bot icon URL' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Enable threaded messages' })
  @IsOptional()
  @IsBoolean()
  enableThreads?: boolean;

  @ApiPropertyOptional({ description: 'Enable mentions' })
  @IsOptional()
  @IsBoolean()
  enableMentions?: boolean;

  @ApiPropertyOptional({ description: 'Users to mention', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionUsers?: string[];

  @ApiPropertyOptional({ description: 'Channels to mention', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionChannels?: string[];
}

// Teams integration DTOs

export class CreateTeamsIntegrationDto {
  @ApiProperty({ description: 'Teams webhook URL' })
  @IsUrl()
  webhookUrl!: string;

  @ApiPropertyOptional({ description: 'Default title' })
  @IsOptional()
  @IsString()
  defaultTitle?: string;

  @ApiPropertyOptional({ description: 'Default theme color (hex)' })
  @IsOptional()
  @IsString()
  defaultThemeColor?: string;

  @ApiPropertyOptional({ description: 'Enable mentions' })
  @IsOptional()
  @IsBoolean()
  enableMentions?: boolean;

  @ApiPropertyOptional({ description: 'Users to mention', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionUsers?: string[];

  @ApiPropertyOptional({ description: 'Enable activity images' })
  @IsOptional()
  @IsBoolean()
  enableActivityImages?: boolean;

  @ApiPropertyOptional({ description: 'Activity image URL' })
  @IsOptional()
  @IsUrl()
  activityImageUrl?: string;
}

// Email provider DTOs

export class CreateEmailProviderDto {
  @ApiProperty({ description: 'Email provider type', enum: ['sendgrid', 'ses', 'smtp', 'mailgun', 'postmark'] })
  @IsEnum(['sendgrid', 'ses', 'smtp', 'mailgun', 'postmark'])
  type!: 'sendgrid' | 'ses' | 'smtp' | 'mailgun' | 'postmark';

  @ApiProperty({ description: 'Provider configuration' })
  @IsObject()
  configuration!: any;
}

// SMS provider DTOs

export class CreateSMSProviderDto {
  @ApiProperty({ description: 'SMS provider type', enum: ['twilio', 'aws-sns', 'nexmo', 'messagebird', 'plivo'] })
  @IsEnum(['twilio', 'aws-sns', 'nexmo', 'messagebird', 'plivo'])
  type!: 'twilio' | 'aws-sns' | 'nexmo' | 'messagebird' | 'plivo';

  @ApiProperty({ description: 'Provider configuration' })
  @IsObject()
  configuration!: any;
}

// Specific provider configuration DTOs

export class SendGridConfigDto {
  @ApiProperty({ description: 'SendGrid API key' })
  @IsString()
  apiKey!: string;

  @ApiProperty({ description: 'From email address' })
  @IsEmail()
  fromEmail!: string;

  @ApiPropertyOptional({ description: 'From name' })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional({ description: 'Reply-to email' })
  @IsOptional()
  @IsEmail()
  replyToEmail?: string;

  @ApiPropertyOptional({ description: 'Template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Enable tracking' })
  @IsOptional()
  @IsBoolean()
  enableTracking?: boolean;

  @ApiPropertyOptional({ description: 'Enable click tracking' })
  @IsOptional()
  @IsBoolean()
  enableClickTracking?: boolean;

  @ApiPropertyOptional({ description: 'Enable open tracking' })
  @IsOptional()
  @IsBoolean()
  enableOpenTracking?: boolean;
}

export class TwilioConfigDto {
  @ApiProperty({ description: 'Twilio Account SID' })
  @IsString()
  accountSid!: string;

  @ApiProperty({ description: 'Twilio Auth Token' })
  @IsString()
  authToken!: string;

  @ApiProperty({ description: 'From phone number' })
  @IsPhoneNumber()
  fromNumber!: string;

  @ApiPropertyOptional({ description: 'Messaging Service SID' })
  @IsOptional()
  @IsString()
  messagingServiceSid?: string;

  @ApiPropertyOptional({ description: 'Enable delivery receipts' })
  @IsOptional()
  @IsBoolean()
  enableDeliveryReceipts?: boolean;

  @ApiPropertyOptional({ description: 'Enable status callbacks' })
  @IsOptional()
  @IsBoolean()
  enableStatusCallbacks?: boolean;

  @ApiPropertyOptional({ description: 'Callback URL' })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;
}

export class SMTPConfigDto {
  @ApiProperty({ description: 'SMTP host' })
  @IsString()
  host!: string;

  @ApiProperty({ description: 'SMTP port' })
  @IsNumber()
  @Min(1)
  @Max(65535)
  port!: number;

  @ApiProperty({ description: 'Use secure connection (TLS)' })
  @IsBoolean()
  secure!: boolean;

  @ApiProperty({ description: 'Authentication credentials' })
  @IsObject()
  auth!: {
    user: string;
    pass: string;
  };

  @ApiProperty({ description: 'From email address' })
  @IsEmail()
  fromEmail!: string;

  @ApiPropertyOptional({ description: 'From name' })
  @IsOptional()
  @IsString()
  fromName?: string;
}