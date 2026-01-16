import { ObjectType, Field, ID, InputType, registerEnumType } from '@nestjs/graphql';

// ===== ENUMS =====

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

export enum MessagePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
  description: 'User online status',
});

registerEnumType(MessagePriority, {
  name: 'MessagePriority',
  description: 'Message priority level',
});

// ===== OBJECT TYPES =====

@ObjectType()
export class OnlineUser {
  @Field(() => ID)
  userId!: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field(() => UserStatus)
  status!: UserStatus;

  @Field()
  connectedAt!: Date;

  @Field()
  lastActivity!: Date;

  @Field(() => [String])
  rooms!: string[];
}

@ObjectType()
export class RealtimeMessage {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  senderId!: string;

  @Field()
  senderName!: string;

  @Field(() => [ID])
  recipientIds!: string[];

  @Field()
  content!: string;

  @Field(() => MessagePriority)
  priority!: MessagePriority;

  @Field()
  timestamp!: Date;

  @Field(() => String, { nullable: true })
  metadata?: string; // JSON string
}

@ObjectType()
export class BroadcastResult {
  @Field()
  success!: boolean;

  @Field()
  recipientCount!: number;

  @Field()
  message!: string;
}

// ===== INPUT TYPES =====

@InputType()
export class SendMessageInput {
  @Field(() => [ID])
  recipientIds!: string[];

  @Field()
  content!: string;

  @Field(() => MessagePriority, { defaultValue: MessagePriority.MEDIUM })
  priority!: MessagePriority;

  @Field(() => String, { nullable: true })
  metadata?: string; // JSON string
}

@InputType()
export class BroadcastMessageInput {
  @Field()
  content!: string;

  @Field(() => MessagePriority, { defaultValue: MessagePriority.MEDIUM })
  priority!: MessagePriority;

  @Field(() => String, { nullable: true })
  targetRoom?: string;

  @Field(() => String, { nullable: true })
  metadata?: string; // JSON string
}
