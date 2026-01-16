import { Resolver, Query, Mutation, Subscription, Args, Context } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { GraphQLJwtAuthGuard } from '../../auth/guards/graphql-jwt-auth.guard';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CurrentTenant } from '../../tenant/decorators/tenant.decorators';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { RealtimeService } from '../services/realtime.service';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { PubSubService, SUBSCRIPTION_EVENTS } from '../../../common/graphql/pubsub.service';
import {
  OnlineUser,
  RealtimeMessage,
  BroadcastResult,
  SendMessageInput,
  BroadcastMessageInput,
  UserStatus,
  MessagePriority,
} from '../types/realtime.types';

/**
 * Realtime Resolver
 * 
 * Provides GraphQL operations for real-time features including:
 * - User presence tracking (online/offline status)
 * - Real-time messaging between users
 * - Broadcast messaging to all users in a tenant
 * - Subscriptions for user status changes and messages
 * 
 * Requirements: 26.1-26.6
 */
@Resolver()
@UseGuards(GraphQLJwtAuthGuard, TenantGuard)
export class RealtimeResolver {
  private readonly logger = new Logger(RealtimeResolver.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly pubSubService: PubSubService,
  ) {}

  // ===== QUERIES =====

  /**
   * Get list of online users in the tenant
   * Returns user presence information including connection time and status
   */
  @Query(() => [OnlineUser], {
    description: 'Get list of online users in the current tenant',
  })
  async getOnlineUsers(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OnlineUser[]> {
    try {
      this.logger.log(`Getting online users for tenant ${tenantId}`);

      const connections = this.realtimeService.getTenantConnections(tenantId);

      return connections.map(conn => ({
        userId: conn.user.id,
        email: conn.user.email,
        displayName: conn.user.displayName || `${conn.user.email}`,
        status: UserStatus.ONLINE,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        rooms: Array.from(conn.rooms),
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get online users: ${err.message}`, err.stack);
      throw error;
    }
  }

  // ===== MUTATIONS =====

  /**
   * Send real-time message to specific users
   * Message is delivered immediately via WebSocket to online recipients
   */
  @Mutation(() => RealtimeMessage, {
    description: 'Send real-time message to specific users',
  })
  async sendRealtimeMessage(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SendMessageInput,
  ): Promise<RealtimeMessage> {
    try {
      this.logger.log(`User ${user.id} sending message to ${input.recipientIds.length} recipients`);

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date();

      const message: RealtimeMessage = {
        id: messageId,
        senderId: user.id,
        senderName: user.email,
        recipientIds: input.recipientIds,
        content: input.content,
        priority: input.priority,
        timestamp,
        metadata: input.metadata || undefined,
      };

      // Publish message event for subscriptions
      await this.pubSubService.publish(SUBSCRIPTION_EVENTS.MESSAGE_RECEIVED, {
        messageReceived: message,
        tenantId,
      });

      this.logger.log(`Message ${messageId} sent successfully`);

      return message;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send message: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Broadcast message to all users in the tenant
   * Optionally target a specific room/channel
   */
  @Mutation(() => BroadcastResult, {
    description: 'Broadcast message to all users in the tenant',
  })
  async broadcastMessage(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: BroadcastMessageInput,
  ): Promise<BroadcastResult> {
    try {
      this.logger.log(`User ${user.id} broadcasting message to tenant ${tenantId}`);

      const connections = this.realtimeService.getTenantConnections(tenantId);
      let recipientCount = connections.length;

      // Filter by room if specified
      if (input.targetRoom) {
        recipientCount = connections.filter(conn => conn.rooms.has(input.targetRoom!)).length;
      }

      const messageId = `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date();

      const message: RealtimeMessage = {
        id: messageId,
        senderId: user.id,
        senderName: user.email,
        recipientIds: connections.map(conn => conn.user.id),
        content: input.content,
        priority: input.priority,
        timestamp,
        metadata: input.metadata || undefined,
      };

      // Publish broadcast message event
      await this.pubSubService.publish(SUBSCRIPTION_EVENTS.MESSAGE_RECEIVED, {
        messageReceived: message,
        tenantId,
      });

      this.logger.log(`Broadcast message sent to ${recipientCount} users`);

      return {
        success: true,
        recipientCount,
        message: `Message broadcast to ${recipientCount} users`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to broadcast message: ${err.message}`, err.stack);
      
      return {
        success: false,
        recipientCount: 0,
        message: `Failed to broadcast message: ${err.message}`,
      };
    }
  }

  // ===== SUBSCRIPTIONS =====

  /**
   * Subscribe to user online events
   * Notifies when users come online in the tenant
   */
  @Subscription(() => OnlineUser, {
    description: 'Subscribe to user online events',
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  userOnline(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSubService.asyncIterator(SUBSCRIPTION_EVENTS.USER_ONLINE, tenantId);
  }

  /**
   * Subscribe to user offline events
   * Notifies when users go offline in the tenant
   */
  @Subscription(() => OnlineUser, {
    description: 'Subscribe to user offline events',
    filter: (payload, variables, context) => {
      return payload.tenantId === context.req.user.tenantId;
    },
  })
  userOffline(
    @CurrentTenant() tenantId: string,
  ) {
    return this.pubSubService.asyncIterator(SUBSCRIPTION_EVENTS.USER_OFFLINE, tenantId);
  }

  /**
   * Subscribe to incoming messages
   * Receives real-time messages sent to the current user
   */
  @Subscription(() => RealtimeMessage, {
    description: 'Subscribe to incoming real-time messages',
    filter: (payload, variables, context) => {
      const message = payload.messageReceived;
      const userId = context.req.user.id;
      const tenantId = context.req.user.tenantId;
      
      // Check tenant match and if user is a recipient
      return payload.tenantId === tenantId && 
             message.recipientIds.includes(userId);
    },
  })
  messageReceived(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pubSubService.asyncIterator(SUBSCRIPTION_EVENTS.MESSAGE_RECEIVED, tenantId);
  }
}
