import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/services/auth.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { AuthenticatedUser, JwtPayload } from '../../auth/interfaces/auth.interface';

interface ConnectedClient {
  id: string;
  user: AuthenticatedUser;
  tenantId: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: Set<string>;
}

interface ConnectionHealthMetrics {
  totalConnections: number;
  connectionsByTenant: Map<string, number>;
  averageConnectionTime: number;
  lastHealthCheck: Date;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly connectedClients = new Map<string, ConnectedClient>();
  private readonly tenantRooms = new Map<string, Set<string>>(); // tenantId -> Set of socketIds
  private healthMetrics: ConnectionHealthMetrics = {
    totalConnections: 0,
    connectionsByTenant: new Map(),
    averageConnectionTime: 0,
    lastHealthCheck: new Date(),
  };

  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Handle new WebSocket connections
   */
  async handleConnection(client: Socket) {
    try {
      this.logger.log(`New connection attempt: ${client.id}`);

      // Extract and validate authentication token
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Connection rejected - no token: ${client.id}`);
        client.emit('auth_error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      // Validate JWT token
      const user = await this.validateToken(token);
      if (!user) {
        this.logger.warn(`Connection rejected - invalid token: ${client.id}`);
        client.emit('auth_error', { message: 'Invalid authentication token' });
        client.disconnect();
        return;
      }

      // Validate tenant
      const isValidTenant = await this.tenantService.isValidTenant(user.tenantId);
      if (!isValidTenant) {
        this.logger.warn(`Connection rejected - invalid tenant: ${client.id}, tenant: ${user.tenantId}`);
        client.emit('auth_error', { message: 'Invalid or inactive tenant' });
        client.disconnect();
        return;
      }

      // Store client information
      const connectedClient: ConnectedClient = {
        id: client.id,
        user,
        tenantId: user.tenantId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        rooms: new Set(),
      };

      this.connectedClients.set(client.id, connectedClient);

      // Join tenant-specific room for isolation
      const tenantRoom = `tenant:${user.tenantId}`;
      client.join(tenantRoom);
      connectedClient.rooms.add(tenantRoom);

      // Track tenant connections
      if (!this.tenantRooms.has(user.tenantId)) {
        this.tenantRooms.set(user.tenantId, new Set());
      }
      this.tenantRooms.get(user.tenantId)!.add(client.id);

      // Update health metrics
      this.updateConnectionMetrics(user.tenantId, 'connect');

      // Store user data on socket for easy access
      client.data.user = user;
      client.data.tenantId = user.tenantId;

      // Send connection success
      client.emit('connected', {
        message: 'Successfully connected to real-time service',
        userId: user.id,
        tenantId: user.tenantId,
        connectedAt: connectedClient.connectedAt,
      });

      this.logger.log(
        `Client connected successfully: ${client.id}, user: ${user.id}, tenant: ${user.tenantId}`,
      );

      // Emit to other clients in the same tenant (optional)
      client.to(tenantRoom).emit('user_connected', {
        userId: user.id,
        displayName: user.displayName,
        connectedAt: connectedClient.connectedAt,
      });

    } catch (error: any) {
      this.logger.error(`Connection error: ${error.message}`, error.stack);
      client.emit('auth_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: Socket) {
    const connectedClient = this.connectedClients.get(client.id);
    
    if (connectedClient) {
      const { user, tenantId, connectedAt } = connectedClient;
      const connectionDuration = Date.now() - connectedAt.getTime();

      // Remove from tenant room tracking
      const tenantConnections = this.tenantRooms.get(tenantId);
      if (tenantConnections) {
        tenantConnections.delete(client.id);
        if (tenantConnections.size === 0) {
          this.tenantRooms.delete(tenantId);
        }
      }

      // Update health metrics
      this.updateConnectionMetrics(tenantId, 'disconnect', connectionDuration);

      // Notify other clients in the same tenant
      const tenantRoom = `tenant:${tenantId}`;
      client.to(tenantRoom).emit('user_disconnected', {
        userId: user.id,
        displayName: user.displayName,
        disconnectedAt: new Date(),
        connectionDuration,
      });

      // Remove from connected clients
      this.connectedClients.delete(client.id);

      this.logger.log(
        `Client disconnected: ${client.id}, user: ${user.id}, tenant: ${tenantId}, duration: ${connectionDuration}ms`,
      );
    } else {
      this.logger.log(`Unknown client disconnected: ${client.id}`);
    }
  }

  /**
   * Subscribe to inventory updates for a specific location
   */
  @SubscribeMessage('subscribe_inventory')
  async handleInventorySubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { locationId?: string; productIds?: string[] },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    try {
      const { tenantId } = connectedClient;
      const { locationId, productIds } = data;

      // Create room name for inventory updates
      let room: string;
      if (locationId && productIds?.length) {
        room = `inventory:${tenantId}:${locationId}:${productIds.join(',')}`;
      } else if (locationId) {
        room = `inventory:${tenantId}:${locationId}`;
      } else {
        room = `inventory:${tenantId}`;
      }

      // Join the inventory room
      client.join(room);
      connectedClient.rooms.add(room);
      this.updateLastActivity(client.id);

      client.emit('subscription_success', {
        type: 'inventory',
        room,
        locationId,
        productIds,
        subscribedAt: new Date(),
      });

      this.logger.log(`Client ${client.id} subscribed to inventory updates: ${room}`);
    } catch (error: any) {
      this.logger.error(`Inventory subscription error: ${error.message}`, error.stack);
      client.emit('subscription_error', {
        type: 'inventory',
        message: 'Failed to subscribe to inventory updates',
      });
    }
  }

  /**
   * Subscribe to transaction updates
   */
  @SubscribeMessage('subscribe_transactions')
  async handleTransactionSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { locationId?: string },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    try {
      const { tenantId } = connectedClient;
      const { locationId } = data;

      const room = locationId 
        ? `transactions:${tenantId}:${locationId}`
        : `transactions:${tenantId}`;

      client.join(room);
      connectedClient.rooms.add(room);
      this.updateLastActivity(client.id);

      client.emit('subscription_success', {
        type: 'transactions',
        room,
        locationId,
        subscribedAt: new Date(),
      });

      this.logger.log(`Client ${client.id} subscribed to transaction updates: ${room}`);
    } catch (error: any) {
      this.logger.error(`Transaction subscription error: ${error.message}`, error.stack);
      client.emit('subscription_error', {
        type: 'transactions',
        message: 'Failed to subscribe to transaction updates',
      });
    }
  }

  /**
   * Subscribe to customer activity updates
   */
  @SubscribeMessage('subscribe_customer_activity')
  async handleCustomerActivitySubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { customerId?: string },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    try {
      const { tenantId } = connectedClient;
      const { customerId } = data;

      const room = customerId 
        ? `customer_activity:${tenantId}:${customerId}`
        : `customer_activity:${tenantId}`;

      client.join(room);
      connectedClient.rooms.add(room);
      this.updateLastActivity(client.id);

      client.emit('subscription_success', {
        type: 'customer_activity',
        room,
        customerId,
        subscribedAt: new Date(),
      });

      this.logger.log(`Client ${client.id} subscribed to customer activity: ${room}`);
    } catch (error: any) {
      this.logger.error(`Customer activity subscription error: ${error.message}`, error.stack);
      client.emit('subscription_error', {
        type: 'customer_activity',
        message: 'Failed to subscribe to customer activity updates',
      });
    }
  }

  /**
   * Unsubscribe from a specific room
   */
  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    try {
      const { room } = data;
      
      // Verify the room belongs to the client's tenant
      if (!room.includes(connectedClient.tenantId)) {
        client.emit('error', { message: 'Cannot unsubscribe from room outside your tenant' });
        return;
      }

      client.leave(room);
      connectedClient.rooms.delete(room);
      this.updateLastActivity(client.id);

      client.emit('unsubscribe_success', {
        room,
        unsubscribedAt: new Date(),
      });

      this.logger.log(`Client ${client.id} unsubscribed from: ${room}`);
    } catch (error: any) {
      this.logger.error(`Unsubscribe error: ${error.message}`, error.stack);
      client.emit('unsubscribe_error', {
        message: 'Failed to unsubscribe from room',
      });
    }
  }

  /**
   * Get connection health status
   */
  @SubscribeMessage('health_check')
  handleHealthCheck(@ConnectedSocket() client: Socket) {
    const connectedClient = this.connectedClients.get(client.id);
    if (!connectedClient) {
      client.emit('error', { message: 'Client not authenticated' });
      return;
    }

    this.updateLastActivity(client.id);

    client.emit('health_status', {
      status: 'healthy',
      connectedAt: connectedClient.connectedAt,
      lastActivity: connectedClient.lastActivity,
      rooms: Array.from(connectedClient.rooms),
      serverTime: new Date(),
    });
  }

  /**
   * Public methods for emitting events to clients
   */

  /**
   * Emit inventory update to subscribed clients
   */
  emitInventoryUpdate(tenantId: string, locationId: string, update: any) {
    const room = `inventory:${tenantId}:${locationId}`;
    this.server.to(room).emit('inventory_updated', {
      ...update,
      timestamp: new Date(),
    });

    // Also emit to general inventory room
    this.server.to(`inventory:${tenantId}`).emit('inventory_updated', {
      ...update,
      timestamp: new Date(),
    });
  }

  /**
   * Emit transaction update to subscribed clients
   */
  emitTransactionUpdate(tenantId: string, locationId: string, transaction: any) {
    const room = `transactions:${tenantId}:${locationId}`;
    this.server.to(room).emit('transaction_created', {
      ...transaction,
      timestamp: new Date(),
    });

    // Also emit to general transactions room
    this.server.to(`transactions:${tenantId}`).emit('transaction_created', {
      ...transaction,
      timestamp: new Date(),
    });
  }

  /**
   * Emit customer activity update
   */
  emitCustomerActivity(tenantId: string, customerId: string, activity: any) {
    const room = `customer_activity:${tenantId}:${customerId}`;
    this.server.to(room).emit('customer_activity', {
      ...activity,
      timestamp: new Date(),
    });

    // Also emit to general customer activity room
    this.server.to(`customer_activity:${tenantId}`).emit('customer_activity', {
      ...activity,
      timestamp: new Date(),
    });
  }

  /**
   * Emit notification to specific tenant
   */
  emitNotification(tenantId: string, notification: any) {
    const room = `tenant:${tenantId}`;
    this.server.to(room).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      ...this.healthMetrics,
      connectedClients: this.connectedClients.size,
      tenantRooms: this.tenantRooms.size,
    };
  }

  /**
   * Get connections for a specific tenant
   */
  getTenantConnections(tenantId: string): ConnectedClient[] {
    return Array.from(this.connectedClients.values())
      .filter(client => client.tenantId === tenantId);
  }

  /**
   * Private helper methods
   */

  private extractToken(client: Socket): string | null {
    // Try to get token from handshake auth
    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken;
    }

    // Try to get token from query parameters
    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Try to get token from headers
    const headerToken = client.handshake.headers?.authorization;
    if (headerToken && typeof headerToken === 'string') {
      return headerToken.replace('Bearer ', '');
    }

    return null;
  }

  private async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'fallback-secret',
      }) as JwtPayload;

      // Validate user exists and is active
      const user = await this.authService.validateUser(payload.sub);
      return user;
    } catch (error: any) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return null;
    }
  }

  private updateLastActivity(clientId: string) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  private updateConnectionMetrics(tenantId: string, action: 'connect' | 'disconnect', duration?: number) {
    if (action === 'connect') {
      this.healthMetrics.totalConnections++;
      const tenantCount = this.healthMetrics.connectionsByTenant.get(tenantId) || 0;
      this.healthMetrics.connectionsByTenant.set(tenantId, tenantCount + 1);
    } else if (action === 'disconnect') {
      this.healthMetrics.totalConnections = Math.max(0, this.healthMetrics.totalConnections - 1);
      const tenantCount = this.healthMetrics.connectionsByTenant.get(tenantId) || 0;
      if (tenantCount > 1) {
        this.healthMetrics.connectionsByTenant.set(tenantId, tenantCount - 1);
      } else {
        this.healthMetrics.connectionsByTenant.delete(tenantId);
      }

      // Update average connection time
      if (duration) {
        const currentAvg = this.healthMetrics.averageConnectionTime;
        const totalConnections = this.healthMetrics.totalConnections + 1; // +1 because we just decremented
        this.healthMetrics.averageConnectionTime = 
          (currentAvg * (totalConnections - 1) + duration) / totalConnections;
      }
    }
  }

  private startHealthMonitoring() {
    // Health check every 30 seconds
    setInterval(() => {
      this.healthMetrics.lastHealthCheck = new Date();
      
      // Clean up stale connections
      this.cleanupStaleConnections();
      
      // Log health metrics
      this.logger.log(
        `Health Check - Total: ${this.healthMetrics.totalConnections}, ` +
        `Tenants: ${this.healthMetrics.connectionsByTenant.size}, ` +
        `Avg Duration: ${Math.round(this.healthMetrics.averageConnectionTime / 1000)}s`,
      );
    }, 30000);
  }

  private cleanupStaleConnections() {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [clientId, client] of this.connectedClients.entries()) {
      if (now - client.lastActivity.getTime() > staleThreshold) {
        this.logger.warn(`Cleaning up stale connection: ${clientId}`);
        
        // Find the socket and disconnect it
        const socket = this.server.sockets.sockets.get(clientId);
        if (socket) {
          socket.disconnect();
        } else {
          // Manual cleanup if socket is already gone
          this.connectedClients.delete(clientId);
          const tenantConnections = this.tenantRooms.get(client.tenantId);
          if (tenantConnections) {
            tenantConnections.delete(clientId);
            if (tenantConnections.size === 0) {
              this.tenantRooms.delete(client.tenantId);
            }
          }
        }
      }
    }
  }
}