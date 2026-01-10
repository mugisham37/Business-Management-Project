import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { QueueService } from '../../queue/queue.service';
import { RealtimeService } from './realtime.service';
import { NotificationWebhookService } from './notification-webhook.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let queueService: jest.Mocked<QueueService>;
  let realtimeService: jest.Mocked<RealtimeService>;
  let webhookService: jest.Mocked<NotificationWebhookService>;

  beforeEach(async () => {
    const mockQueueService = {
      addNotificationJob: jest.fn(),
    };

    const mockRealtimeService = {
      sendNotification: jest.fn(),
    };

    const mockWebhookService = {
      triggerWebhook: jest.fn(),
    };

    const mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: 'DRIZZLE_DB',
          useValue: mockDb,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: RealtimeService,
          useValue: mockRealtimeService,
        },
        {
          provide: NotificationWebhookService,
          useValue: mockWebhookService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    queueService = module.get(QueueService);
    realtimeService = module.get(RealtimeService);
    webhookService = module.get(NotificationWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendNotification', () => {
    it('should send notification to recipients', async () => {
      const tenantId = 'test-tenant';
      const request = {
        type: 'test_notification',
        recipients: ['user1', 'user2'],
        message: 'Test message',
        priority: 'medium' as const,
      };

      // Mock the private methods that would be called
      jest.spyOn(service as any, 'getUserPreferences').mockResolvedValue([
        {
          id: 'pref1',
          userId: 'user1',
          notificationType: 'test_notification',
          channel: 'email',
          isEnabled: true,
          frequency: 'immediate',
          timezone: 'UTC',
          settings: {},
        },
      ]);

      jest.spyOn(service as any, 'createNotificationRecord').mockResolvedValue('notification-id');
      jest.spyOn(service as any, 'deliverNotification').mockResolvedValue(undefined);

      const result = await service.sendNotification(tenantId, request);

      expect(result).toEqual(['notification-id', 'notification-id']);
      expect(webhookService.triggerWebhook).toHaveBeenCalledWith(
        tenantId,
        'notification.created',
        expect.objectContaining({
          notificationIds: ['notification-id', 'notification-id'],
          type: 'test_notification',
          recipientCount: 2,
        })
      );
    });
  });

  describe('sendRealtimeNotification', () => {
    it('should send real-time notification via WebSocket', async () => {
      const tenantId = 'test-tenant';
      const recipientIds = ['user1', 'user2'];
      const notification = {
        id: 'test-id',
        type: 'info',
        title: 'Test Title',
        message: 'Test Message',
        priority: 'medium',
      };

      await service.sendRealtimeNotification(tenantId, recipientIds, notification);

      expect(realtimeService.sendNotification).toHaveBeenCalledWith(tenantId, {
        id: 'test-id',
        type: 'info',
        title: 'Test Title',
        message: 'Test Message',
        priority: 'medium',
        targetUsers: recipientIds,
        metadata: undefined,
      });

      expect(webhookService.triggerWebhook).toHaveBeenCalledWith(
        tenantId,
        'notification.realtime',
        expect.objectContaining({
          notificationId: 'test-id',
          type: 'info',
          recipientIds,
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and trigger webhook', async () => {
      const tenantId = 'test-tenant';
      const notificationId = 'notification-id';
      const userId = 'user-id';

      const mockUpdate = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // Mock the database update
      (service as any).db = {
        update: mockUpdate,
      };

      await service.markAsRead(tenantId, notificationId, userId);

      expect(webhookService.triggerWebhook).toHaveBeenCalledWith(
        tenantId,
        'notification.read',
        expect.objectContaining({
          notificationId,
          userId,
          readAt: expect.any(Date),
        })
      );
    });
  });
});