import { ObjectType, Field, ID, InputType, Int, registerEnumType } from '@nestjs/graphql';

// ===== ENUMS =====

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

registerEnumType(NotificationStatus, {
  name: 'NotificationStatus',
  description: 'Notification delivery status',
});

registerEnumType(NotificationPriority, {
  name: 'NotificationPriority',
  description: 'Notification priority level',
});

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Notification type',
});

// ===== OBJECT TYPES =====

@ObjectType()
export class Notification {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  recipientId!: string;

  @Field()
  type!: string;

  @Field()
  channel!: string;

  @Field({ nullable: true })
  subject?: string;

  @Field()
  message!: string;

  @Field(() => NotificationStatus)
  status!: NotificationStatus;

  @Field(() => NotificationPriority, { nullable: true })
  priority?: NotificationPriority;

  @Field({ nullable: true })
  scheduledAt?: Date;

  @Field({ nullable: true })
  sentAt?: Date;

  @Field({ nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  readAt?: Date;

  @Field(() => Int)
  deliveryAttempts!: number;

  @Field({ nullable: true })
  failureReason?: string;

  @Field(() => String, { nullable: true })
  metadata?: string; // JSON string

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class NotificationConnection {
  @Field(() => [Notification])
  nodes!: Notification[];

  @Field(() => Int)
  totalCount!: number;

  @Field()
  hasMore!: boolean;
}

@ObjectType()
export class MarkNotificationReadResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;

  @Field(() => Notification, { nullable: true })
  notification?: Notification;
}

@ObjectType()
export class DeleteNotificationResponse {
  @Field()
  success!: boolean;

  @Field()
  message!: string;
}

// ===== INPUT TYPES =====

@InputType()
export class GetNotificationsInput {
  @Field(() => Int, { defaultValue: 50 })
  limit!: number;

  @Field(() => Int, { defaultValue: 0 })
  offset!: number;

  @Field({ nullable: true })
  type?: string;

  @Field(() => NotificationStatus, { nullable: true })
  status?: NotificationStatus;

  @Field({ defaultValue: false })
  unreadOnly!: boolean;
}

@InputType()
export class MarkNotificationReadInput {
  @Field(() => ID)
  notificationId!: string;
}

@InputType()
export class DeleteNotificationInput {
  @Field(() => ID)
  notificationId!: string;
}
