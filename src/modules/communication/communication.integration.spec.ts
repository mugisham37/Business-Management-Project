import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CommunicationIntegrationService } from './services/communication-integration.service';
import { SlackIntegrationService } from './services/slack-integration.service';
import { TeamsIntegrationService } from './services/teams-integration.service';
import { EmailNotificationService } from './services/email-notification.service';
import { SMSNotificationService } from './services/sms-notification.service';
import { DRIZZLE_TOKEN } from '../database/drizzle.service';

// Mock database service
const mockDrizzleService = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

describe('Communication Integration', () => {
  let communicationService: CommunicationIntegrationService;
  let slackService: SlackIntegrationService;
  let teamsService: TeamsIntegrationService;
  let emailService: EmailNotificationService;
  let smsService: SMSNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule.register({
          timeout: 5000,
        }),
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [
        CommunicationIntegrationService,
        SlackIntegrationService,
        TeamsIntegrationService,
        EmailNotificationService,
        SMSNotificationService,
        {
          provide: DRIZZLE_TOKEN,
          useValue: mockDrizzleService,
        },
      ],
    }).compile();

    communicationService = module.get<CommunicationIntegrationService>(CommunicationIntegrationService);
    slackService = module.get<SlackIntegrationService>(SlackIntegrationService);
    teamsService = module.get<TeamsIntegrationService>(TeamsIntegrationService);
    emailService = module.get<EmailNotificationService>(EmailNotificationService);
    smsService = module.get<SMSNotificationService>(SMSNotificationService);
  });

  it('should be defined', () => {
    expect(communicationService).toBeDefined();
    expect(slackService).toBeDefined();
    expect(teamsService).toBeDefined();
    expect(emailService).toBeDefined();
    expect(smsService).toBeDefined();
  });

  describe('Slack Integration', () => {
    it('should validate Slack configuration', () => {
      const validConfig = {
        webhookUrl: 'https://hooks.slack.com/services/test',
        defaultChannel: '#general',
        username: 'Business Platform',
      };

      // This would test the validation logic
      expect(() => slackService['validateConfig'](validConfig)).not.toThrow();
    });

    it('should reject invalid Slack webhook URL', () => {
      const invalidConfig = {
        webhookUrl: 'https://invalid-url.com',
        defaultChannel: '#general',
      };

      const result = slackService['validateConfig'](invalidConfig);
      expect(result).toContain('Invalid Slack webhook URL format');
    });
  });

  describe('Teams Integration', () => {
    it('should validate Teams configuration', () => {
      const validConfig = {
        webhookUrl: 'https://outlook.office.com/webhook/test',
        defaultThemeColor: '0078D4',
      };

      expect(() => teamsService['validateConfig'](validConfig)).not.toThrow();
    });

    it('should reject invalid Teams webhook URL', () => {
      const invalidConfig = {
        webhookUrl: 'https://invalid-url.com',
      };

      const result = teamsService['validateConfig'](invalidConfig);
      expect(result).toContain('Invalid Teams webhook URL format');
    });
  });

  describe('Email Service', () => {
    it('should validate email message', () => {
      const validMessage = {
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      };

      const result = emailService['validateMessage'](validMessage);
      expect(result).toBeNull();
    });

    it('should reject message without recipient', () => {
      const invalidMessage = {
        to: '',
        subject: 'Test Subject',
        text: 'Test message',
      };

      const result = emailService['validateMessage'](invalidMessage);
      expect(result).toContain('Recipient email address is required');
    });
  });

  describe('SMS Service', () => {
    it('should validate SMS message', () => {
      const validMessage = {
        to: '+1234567890',
        message: 'Test SMS message',
      };

      const result = smsService['validateMessage'](validMessage);
      expect(result).toBeNull();
    });

    it('should reject message without phone number', () => {
      const invalidMessage = {
        to: '',
        message: 'Test SMS message',
      };

      const result = smsService['validateMessage'](invalidMessage);
      expect(result).toContain('Recipient phone number is required');
    });

    it('should normalize phone numbers', () => {
      const phoneNumber = '(555) 123-4567';
      const normalized = smsService['normalizePhoneNumber'](phoneNumber);
      expect(normalized).toBe('+15551234567');
    });
  });

  describe('Multi-Channel Communication', () => {
    it('should handle empty enabled channels gracefully', async () => {
      // Mock getEnabledChannels to return empty array
      jest.spyOn(communicationService as any, 'getEnabledChannels').mockResolvedValue([]);

      const notification = {
        title: 'Test Notification',
        message: 'Test message',
        priority: 'medium' as const,
        type: 'test',
        channels: ['slack', 'email'],
      };

      const result = await communicationService.sendMultiChannelNotification('tenant-1', notification);

      expect(result.overallSuccess).toBe(false);
      expect(result.totalChannels).toBe(0);
    });
  });
});